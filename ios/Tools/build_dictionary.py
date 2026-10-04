#!/usr/bin/env python3
"""Build the offline dictionary database bundled with Concise English.

Sources (both openly licensed, downloaded on first run and cached in Tools/.cache):
  * Open English WordNet 2024 (CC BY 4.0) - definitions, examples, senses,
    synonyms, antonyms, word relations, irregular forms and some IPA.
  * CMU Pronouncing Dictionary (BSD-2-Clause) - fallback US pronunciations,
    converted from ARPAbet to IPA.

Usage:  python3 ios/Tools/build_dictionary.py
Output: ios/ConciseEnglish/Resources/dictionary.sqlite
"""

from __future__ import annotations

import gzip
import os
import re
import sqlite3
import sys
import unicodedata
import urllib.request
import xml.etree.ElementTree as ET
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, ".cache")
OUT = os.path.join(HERE, "..", "ConciseEnglish", "Resources", "dictionary.sqlite")

OEWN_URL = (
    "https://github.com/globalwordnet/english-wordnet/releases/download/"
    "2024-edition/english-wordnet-2024.xml.gz"
)
CMU_URL = "https://raw.githubusercontent.com/cmusphinx/cmudict/master/cmudict.dict"

# Synset relations shown in the thesaurus. Everything else is dropped to keep
# the database small.
SYNSET_RELATIONS = {
    "hypernym", "instance_hypernym", "hyponym", "instance_hyponym", "similar",
    "also", "entails", "causes", "mero_part", "holo_part", "mero_member",
    "holo_member", "mero_substance", "holo_substance", "attribute",
}
SENSE_RELATIONS = {"antonym", "derivation", "pertainym", "participle"}
POS_ORDER = {"n": 0, "v": 1, "a": 2, "s": 2, "r": 3}


def fetch(url: str, name: str) -> str:
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, name)
    if not os.path.exists(path):
        print(f"Downloading {url}")
        urllib.request.urlretrieve(url, path + ".part")
        os.replace(path + ".part", path)
    return path


def fold(text: str) -> str:
    """Search key: lowercase, accents removed, typographic apostrophes unified.

    Must stay in sync with `SearchKey.fold` in the app.
    """
    text = text.replace("’", "'").replace("‘", "'")
    decomposed = unicodedata.normalize("NFKD", text.lower())
    return "".join(c for c in decomposed if not unicodedata.combining(c))


# --- ARPAbet -> IPA ---------------------------------------------------------

ARPA = {
    "AA": "ɑ", "AE": "æ", "AH": "ʌ", "AO": "ɔ", "AW": "aʊ", "AY": "aɪ",
    "B": "b", "CH": "tʃ", "D": "d", "DH": "ð", "EH": "ɛ", "ER": "ɝ",
    "EY": "eɪ", "F": "f", "G": "ɡ", "HH": "h", "IH": "ɪ", "IY": "i",
    "JH": "dʒ", "K": "k", "L": "l", "M": "m", "N": "n", "NG": "ŋ",
    "OW": "oʊ", "OY": "ɔɪ", "P": "p", "R": "ɹ", "S": "s", "SH": "ʃ",
    "T": "t", "TH": "θ", "UH": "ʊ", "UW": "u", "V": "v", "W": "w",
    "Y": "j", "Z": "z", "ZH": "ʒ",
}
ONSETS2 = {
    "pl", "pr", "pj", "bl", "br", "bj", "tr", "tw", "tj", "dr", "dw", "dj",
    "kl", "kr", "kw", "kj", "gl", "gr", "gw", "gj", "fl", "fr", "fj", "θr",
    "θw", "ʃr", "sl", "sw", "sp", "st", "sk", "sm", "sn", "sf", "mj", "nj",
    "hj", "vj", "lj",
}
ONSETS3 = {"spl", "spr", "spj", "str", "stj", "skl", "skr", "skw", "skj"}


def arpabet_to_ipa(phones: list[str]) -> str:
    out: list[str] = []
    consonants_since_vowel: list[int] = []  # indices into `out`
    for phone in phones:
        stress = phone[-1] if phone[-1].isdigit() else None
        base = phone.rstrip("012")
        symbol = ARPA.get(base)
        if symbol is None:
            continue
        if stress is None:
            consonants_since_vowel.append(len(out))
            out.append(symbol)
            continue
        if base == "AH" and stress == "0":
            symbol = "ə"
        elif base == "ER" and stress == "0":
            symbol = "ɚ"
        if stress in ("1", "2"):
            mark = "ˈ" if stress == "1" else "ˌ"
            # Maximal onset: attach the longest legal cluster to this syllable.
            cluster = [out[i] for i in consonants_since_vowel]
            take = 0
            for n in (3, 2, 1):
                if len(cluster) >= n:
                    tail = "".join(cluster[-n:]).replace("ɹ", "r").replace("ɡ", "g")
                    if n == 1 or (n == 2 and tail in ONSETS2) or (n == 3 and tail in ONSETS3):
                        take = n
                        break
            at = consonants_since_vowel[-take] if take else len(out)
            # Word-initial stress marks are only shown on multi-syllable words
            # by the caller; insert here unconditionally.
            out.insert(at, mark)
        out.append(symbol)
        consonants_since_vowel = []
    return "".join(out)


def load_cmudict(path: str) -> dict[str, str]:
    result: dict[str, str] = {}
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.split("#", 1)[0].strip()
            if not line:
                continue
            word, *phones = line.split()
            if "(" in word:  # alternate pronunciations: keep the first
                continue
            ipa = arpabet_to_ipa(phones)
            vowels = sum(1 for p in phones if p[-1].isdigit())
            if vowels <= 1:
                ipa = ipa.replace("ˈ", "")
            result[word.lower()] = ipa
    return result


# --- WordNet ----------------------------------------------------------------

def parse_oewn(path: str):
    entries = []          # (lemma, pos, ipa_us, ipa_gb, ipa_any, forms, senses)
    synsets = {}          # id -> (pos, lexfile, definition, examples, members, relations)
    with gzip.open(path, "rb") as fh:
        for _, el in ET.iterparse(fh, events=("end",)):
            tag = el.tag
            if tag == "LexicalEntry":
                lemma_el = el.find("Lemma")
                prons = {}
                for p in lemma_el.findall("Pronunciation"):
                    prons.setdefault(p.get("variety") or "", (p.text or "").strip())
                senses = []
                for s in el.findall("Sense"):
                    rels = [
                        (r.get("relType"), r.get("target"))
                        for r in s.findall("SenseRelation")
                        if r.get("relType") in SENSE_RELATIONS
                    ]
                    senses.append((s.get("id"), s.get("synset"), rels))
                entries.append((
                    el.get("id"),
                    lemma_el.get("writtenForm"),
                    lemma_el.get("partOfSpeech"),
                    prons,
                    [f.get("writtenForm") for f in el.findall("Form")],
                    senses,
                ))
                el.clear()
            elif tag == "Synset":
                definition = el.findtext("Definition") or ""
                examples = [e.text or "" for e in el.findall("Example")]
                rels = [
                    (r.get("relType"), r.get("target"))
                    for r in el.findall("SynsetRelation")
                    if r.get("relType") in SYNSET_RELATIONS
                ]
                synsets[el.get("id")] = (
                    el.get("partOfSpeech"),
                    el.get("lexfile"),
                    definition.strip(),
                    examples,
                    (el.get("members") or "").split(),
                    rels,
                )
                el.clear()
    return entries, synsets


def clean_example(text: str) -> str:
    text = text.strip()
    if len(text) >= 2 and text[0] == '"' and text[-1] == '"':
        text = text[1:-1]
    return text


SCHEMA = """
CREATE TABLE word (
    id INTEGER PRIMARY KEY,
    lemma TEXT NOT NULL,
    key TEXT NOT NULL,
    score INTEGER NOT NULL,
    featured INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE entry (
    id INTEGER PRIMARY KEY,
    word_id INTEGER NOT NULL,
    pos TEXT NOT NULL,
    ipa_us TEXT,
    ipa_gb TEXT
);
CREATE TABLE synset (
    id INTEGER PRIMARY KEY,
    pos TEXT NOT NULL,
    lexfile TEXT NOT NULL,
    definition TEXT NOT NULL,
    examples TEXT NOT NULL
);
CREATE TABLE sense (
    id INTEGER PRIMARY KEY,
    entry_id INTEGER NOT NULL,
    synset_id INTEGER NOT NULL,
    ord INTEGER NOT NULL,
    member_ord INTEGER NOT NULL
);
CREATE TABLE sense_relation (
    sense_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    target_sense_id INTEGER NOT NULL,
    PRIMARY KEY (sense_id, type, target_sense_id)
) WITHOUT ROWID;
CREATE TABLE synset_relation (
    synset_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    target_synset_id INTEGER NOT NULL,
    PRIMARY KEY (synset_id, type, target_synset_id)
) WITHOUT ROWID;
CREATE TABLE form (
    form_key TEXT NOT NULL,
    word_id INTEGER NOT NULL
);
CREATE TABLE meta (name TEXT PRIMARY KEY, value TEXT NOT NULL);
"""

INDEXES = """
CREATE INDEX word_key ON word(key);
CREATE INDEX word_featured ON word(featured) WHERE featured = 1;
CREATE INDEX entry_word ON entry(word_id);
CREATE INDEX sense_entry ON sense(entry_id);
CREATE INDEX sense_synset ON sense(synset_id);
CREATE INDEX form_key ON form(form_key);
"""


def main() -> int:
    oewn_path = fetch(OEWN_URL, "english-wordnet-2024.xml.gz")
    cmu_path = fetch(CMU_URL, "cmudict.dict")

    print("Parsing CMU Pronouncing Dictionary")
    cmu = load_cmudict(cmu_path)
    print("Parsing Open English WordNet (this takes a minute)")
    entries, synsets = parse_oewn(oewn_path)
    print(f"  {len(entries)} lexical entries, {len(synsets)} synsets")

    synset_ids = {sid: i + 1 for i, sid in enumerate(sorted(synsets))}

    # Words are distinct written forms ("polish" and "Polish" are separate).
    word_ids: dict[str, int] = {}
    word_senses: dict[int, int] = defaultdict(int)
    entry_rows = []
    sense_rows = []
    sense_ids: dict[str, int] = {}
    pending_sense_rels = []
    form_rows = set()

    entry_sort = sorted(entries, key=lambda e: (e[1], POS_ORDER.get(e[2], 9)))
    for entry_key, lemma, pos, prons, forms, senses in entry_sort:
        wid = word_ids.setdefault(lemma, len(word_ids) + 1)
        eid = len(entry_rows) + 1
        general = prons.get("")
        us = prons.get("US") or general or cmu.get(lemma.lower())
        gb = prons.get("GB") or general
        entry_rows.append((eid, wid, "a" if pos == "s" else pos, us, gb))
        for form in forms:
            form_rows.add((fold(form), wid))
        for ord_, (sense_key, synset_key, rels) in enumerate(senses):
            sid = len(sense_rows) + 1
            sense_ids[sense_key] = sid
            members = synsets[synset_key][4]
            member_ord = members.index(entry_key) if entry_key in members else len(members)
            sense_rows.append((sid, eid, synset_ids[synset_key], ord_, member_ord))
            word_senses[wid] += 1
            for rel_type, target in rels:
                pending_sense_rels.append((sid, rel_type, target))

    sense_rel_rows = [
        (sid, t, sense_ids[target])
        for sid, t, target in pending_sense_rels
        if target in sense_ids
    ]

    synset_rows = []
    synset_rel_rows = []
    for key, (pos, lexfile, definition, examples, _members, rels) in synsets.items():
        sid = synset_ids[key]
        synset_rows.append((
            sid,
            "a" if pos == "s" else pos,
            lexfile,
            definition,
            "\n".join(clean_example(x) for x in examples if x.strip()),
        ))
        for rel_type, target in rels:
            if target in synset_ids:
                synset_rel_rows.append((sid, rel_type, synset_ids[target]))

    word_rows = []
    for lemma, wid in word_ids.items():
        senses = word_senses[wid]
        plain = lemma.isalpha() and lemma.islower()
        common = lemma.lower() in cmu
        # Higher score = more likely to be what someone is looking for.
        score = senses * 10 + (25 if common else 0) + (10 if plain else 0)
        score -= lemma.count(" ") * 8 + lemma.count("-") * 4
        featured = int(plain and common and 7 <= len(lemma) <= 12 and 1 <= senses <= 4)
        word_rows.append((wid, lemma, fold(lemma), score, featured))

    if os.path.exists(OUT):
        os.remove(OUT)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    db = sqlite3.connect(OUT)
    db.executescript(SCHEMA)
    db.executemany("INSERT INTO word VALUES (?,?,?,?,?)", word_rows)
    db.executemany("INSERT INTO entry VALUES (?,?,?,?,?)", entry_rows)
    db.executemany("INSERT INTO synset VALUES (?,?,?,?,?)", synset_rows)
    db.executemany("INSERT INTO sense VALUES (?,?,?,?,?)", sense_rows)
    db.executemany("INSERT OR IGNORE INTO sense_relation VALUES (?,?,?)", sense_rel_rows)
    db.executemany("INSERT OR IGNORE INTO synset_relation VALUES (?,?,?)", synset_rel_rows)
    db.executemany("INSERT INTO form VALUES (?,?)", sorted(form_rows))
    db.executemany("INSERT INTO meta VALUES (?,?)", [
        ("source", "Open English WordNet 2024 (CC BY 4.0); CMU Pronouncing Dictionary (BSD-2-Clause)"),
        ("words", str(len(word_rows))),
    ])
    db.executescript(INDEXES)
    db.commit()
    db.execute("PRAGMA journal_mode = DELETE")
    db.execute("VACUUM")
    db.close()

    with_ipa = sum(1 for r in entry_rows if r[3] or r[4])
    size = os.path.getsize(OUT) / 1_000_000
    print(f"Wrote {OUT}")
    print(f"  {len(word_rows)} words, {len(entry_rows)} entries ({with_ipa} with IPA), "
          f"{len(sense_rows)} senses, {len(sense_rel_rows) + len(synset_rel_rows)} relations, "
          f"{size:.1f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
