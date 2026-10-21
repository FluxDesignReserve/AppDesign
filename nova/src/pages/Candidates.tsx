import { useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, Clock, Plus, Search, X } from 'lucide-react';
import type { NavProps } from '../App';
import { BANDS, CANDIDATES, ROLES, STAGES, type Band, type Candidate, type Stage } from '../data/model';
import { ActionMenu, Button, Chip, Field, Initials, Modal, PageHeader, Select, TableSkeleton, Tabs, Wait, settle, usePageLoad, useToast } from '../ui';

const ALL = 'All';
const PAGE_SIZE = 12;

// Only the strongest bands get colour; the rest stay neutral.
const BAND_TONE: Partial<Record<Band, 'green' | 'blue'>> = { Excellent: 'green', Strong: 'blue' };

type Moved = Record<string, Stage | 'Rejected'>;
type SortKey = 'score' | 'days' | 'name';

const nextStage = (s: Stage): Stage => STAGES[Math.min(STAGES.indexOf(s) + 1, STAGES.length - 1)];

// Highest first for every option.
const SORTERS: Record<SortKey, (a: Candidate, b: Candidate) => number> = {
  score: (a, b) => (b.score ?? -1) - (a.score ?? -1),
  days: (a, b) => b.days - a.days,
  name: (a, b) => a.name.localeCompare(b.name),
};

const SORT_LABELS: Record<SortKey, string> = { score: 'Best match', days: 'Longest wait', name: 'Name' };

export function Candidates({ params }: NavProps) {
  const loading = usePageLoad();
  const toast = useToast();
  const [moved, setMoved] = useState<Moved>({});
  const [stage, setStage] = useState<Stage>((params.stage as Stage) ?? 'Screening');
  const [role, setRole] = useState<string>(params.role ?? ALL);
  const [band, setBand] = useState<string>(params.band ?? ALL);
  const [slowOnly, setSlowOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('score');
  const [shown, setShown] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(params.new === '1');

  const people = useMemo(
    () => CANDIDATES.map((c) => ({ ...c, stage: moved[c.id] ?? c.stage })).filter((c) => c.stage !== 'Rejected') as Candidate[],
    [moved],
  );
  const stageCounts = useMemo(() => Object.fromEntries(STAGES.map((s) => [s, people.filter((c) => c.stage === s).length])), [people]);
  const byId = useMemo(() => new Map(people.map((c) => [c.id, c])), [people]);

  const q = query.trim().toLowerCase();
  const rows = people
    .filter(
      (c) =>
        c.stage === stage &&
        (role === ALL || c.role === role) &&
        (band === ALL || c.band === band) &&
        (!slowOnly || c.days > 7) &&
        (!q || c.name.toLowerCase().includes(q) || c.employer.toLowerCase().includes(q)),
    )
    .sort(SORTERS[sort]);
  const slowCount = people.filter((c) => c.stage === stage && c.days > 7).length;
  const pageRows = rows.slice(0, shown);
  const allOnPage = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));

  const filter =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setShown(PAGE_SIZE);
      setSelected(new Set());
    };

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const move = (ids: string[], to: 'next' | 'Rejected') => {
    const before = moved;
    const update: Moved = {};
    for (const id of ids) update[id] = to === 'next' ? nextStage(byId.get(id)!.stage) : 'Rejected';
    setMoved({ ...moved, ...update });
    setSelected(new Set());
    const who = ids.length === 1 ? byId.get(ids[0])!.name : `${ids.length} people`;
    toast({
      title: to === 'next' ? `Moved ${who} to ${nextStage(stage)}` : `Rejected ${who}`,
      undo: () => setMoved(before),
    });
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Candidates"
        title={stage}
        subtitle={`${stageCounts[stage]} people across ${ROLES.length} roles`}
        action={
          <Button variant="primary" onClick={() => setAdding(true)}>
            <Plus size={16} /> Add candidates
          </Button>
        }
      />

      <Tabs label="Stage" value={stage} options={STAGES.map((s) => ({ value: s, count: stageCounts[s] }))} onChange={filter(setStage)} />

      <div className="filters">
        <div className="search">
          <Search size={14} aria-hidden />
          <input
            className="input"
            type="search"
            placeholder="Search name or employer"
            aria-label="Search candidates"
            value={query}
            onChange={(e) => filter(setQuery)(e.target.value)}
          />
        </div>
        <Select label="Role" value={role} options={[ALL, ...ROLES].map((r) => ({ value: r }))} onChange={filter(setRole)} />
        <Select label="Match" value={band} options={[ALL, ...BANDS].map((b) => ({ value: b }))} onChange={filter(setBand)} />
        <button className="select-trigger" aria-pressed={slowOnly} onClick={() => filter(setSlowOnly)(!slowOnly)} style={slowOnly ? { borderColor: 'var(--text)' } : undefined}>
          <Clock size={13} aria-hidden /> Waiting &gt; 7d <span className="muted num">{slowCount}</span>
        </button>
        <span className="spacer" />
        <Select<SortKey>
          label="Sort"
          align="end"
          value={sort}
          options={(Object.keys(SORT_LABELS) as SortKey[]).map((k) => ({ value: k, label: SORT_LABELS[k] }))}
          onChange={setSort}
        />
      </div>

      {loading ? (
        <TableSkeleton rows={8} />
      ) : (
        <div className="card">
          {selected.size > 0 && (
            <div className="bulk" role="region" aria-label="Bulk actions">
              <strong style={{ fontWeight: 500 }}>{selected.size} selected</strong>
              <span className="spacer" />
              {stage !== 'Hired' && (
                <Button size="sm" variant="primary" onClick={() => move([...selected], 'next')}>
                  Move to {nextStage(stage)} <ArrowRight size={14} />
                </Button>
              )}
              <Button size="sm" variant="danger" onClick={() => move([...selected], 'Rejected')}>
                Reject
              </Button>
              <Button size="sm" variant="ghost" icon aria-label="Clear selection" onClick={() => setSelected(new Set())}>
                <X size={14} />
              </Button>
            </div>
          )}
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th className="check-col">
                    <input
                      type="checkbox"
                      aria-label="Select all shown"
                      checked={allOnPage}
                      onChange={() =>
                        setSelected((s) => {
                          const n = new Set(s);
                          pageRows.forEach((r) => (allOnPage ? n.delete(r.id) : n.add(r.id)));
                          return n;
                        })
                      }
                    />
                  </th>
                  <th>Candidate</th>
                  <th>Match</th>
                  <th>Notice</th>
                  <th>Expected CTC</th>
                  <th>Current employer</th>
                  <th>Days in stage</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {pageRows.map((c) => (
                  <tr key={c.id} data-selected={selected.has(c.id)}>
                    <td className="check-col">
                      <input type="checkbox" aria-label={`Select ${c.name}`} checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
                    </td>
                    <td>
                      <span className="person">
                        <Initials name={c.name} />
                        <span>
                          <b>{c.name}</b>
                          <span className="sub">{c.role}</span>
                        </span>
                      </span>
                    </td>
                    <td>
                      <Chip tone={BAND_TONE[c.band]} dot={!!BAND_TONE[c.band]}>
                        {c.score === null ? c.band : `${c.score} · ${c.band}`}
                      </Chip>
                    </td>
                    <td>{c.notice}</td>
                    <td className="num">{c.ctc ?? <span className="muted">Not recorded</span>}</td>
                    <td>{c.employer}</td>
                    <td>
                      <Wait days={c.days} />
                    </td>
                    <td className="end">
                      <ActionMenu
                        label={`Move ${c.name}`}
                        variant="secondary"
                        icon={false}
                        trigger={
                          <>
                            Move <ChevronDown size={13} />
                          </>
                        }
                        actions={[
                          ...(stage !== 'Hired' ? [{ label: `Move to ${nextStage(stage)}`, onSelect: () => move([c.id], 'next') }] : []),
                          { label: 'Reject', danger: true, onSelect: () => move([c.id], 'Rejected') },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 ? (
            <div className="empty">No one matches these filters.</div>
          ) : (
            <div className="table-foot">
              <span className="num">
                Showing {pageRows.length} of {rows.length}
              </span>
              {rows.length > shown && (
                <Button size="sm" onClick={() => setShown(shown + PAGE_SIZE)}>
                  Show {Math.min(PAGE_SIZE, rows.length - shown)} more
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      <AddCandidates open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function AddCandidates({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const emails = text.split(/[\s,;]+/).filter((e) => e.includes('@'));

  const close = () => {
    setText('');
    onClose();
  };

  return (
    <Modal
      open={open}
      title="Add candidates"
      subtitle="They start in Sourced. Nova scores each CV as it arrives."
      onClose={close}
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!emails.length}
            loading={saving}
            onClick={async () => {
              setSaving(true);
              await settle();
              setSaving(false);
              toast({ title: `Added ${emails.length} to Sourced` });
              close();
            }}
          >
            {emails.length ? `Add ${emails.length}` : 'Add'}
          </Button>
        </>
      }
    >
      <Field label="Email addresses" hint="One per line, or separated by commas.">
        {(id) => <textarea id={id} className="textarea" rows={5} value={text} autoFocus onChange={(e) => setText(e.target.value)} />}
      </Field>
    </Modal>
  );
}
