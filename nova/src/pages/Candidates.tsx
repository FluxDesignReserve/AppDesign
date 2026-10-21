import { useMemo, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUp, ChevronLeft, ChevronRight, MoreHorizontal, Plus, Search, X } from 'lucide-react';
import type { NavProps } from '../App';
import { BANDS, CANDIDATES, ROLES, STAGES, type Band, type Candidate, type Stage } from '../data/model';
import { ActionMenu, Button, Chip, Field, Initials, Modal, PageHeader, Select, TableSkeleton, Wait, settle, usePageLoad, useToast } from '../ui';

const ALL = 'All';
const PAGE_SIZE = 25;

// Only the strongest bands get colour; the rest stay neutral.
const BAND_TONE: Partial<Record<Band, 'green' | 'blue'>> = { Excellent: 'green', Strong: 'blue' };

type Moved = Record<string, Stage | 'Rejected'>;
type SortKey = 'score' | 'days' | 'name';

const nextStage = (s: Stage): Stage => STAGES[Math.min(STAGES.indexOf(s) + 1, STAGES.length - 1)];

const SORTERS: Record<SortKey, (a: Candidate, b: Candidate) => number> = {
  score: (a, b) => (a.score ?? -1) - (b.score ?? -1),
  days: (a, b) => a.days - b.days,
  name: (a, b) => b.name.localeCompare(a.name),
};

export function Candidates({ params }: NavProps) {
  const loading = usePageLoad();
  const toast = useToast();
  const [moved, setMoved] = useState<Moved>({});
  const [stage, setStage] = useState<Stage>((params.stage as Stage) ?? 'Screening');
  const [role, setRole] = useState<string>(params.role ?? ALL);
  const [band, setBand] = useState<string>(ALL);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'score', desc: true });
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

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
        (!q || c.name.toLowerCase().includes(q) || c.employer.toLowerCase().includes(q)),
    )
    .sort((a, b) => SORTERS[sort.key](a, b) * (sort.desc ? -1 : 1));
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const pageRows = rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const allOnPage = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));

  const filter =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(0);
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

  const sortable = (key: SortKey, label: string) => (
    <th aria-sort={sort.key === key ? (sort.desc ? 'descending' : 'ascending') : undefined}>
      <button onClick={() => setSort({ key, desc: sort.key === key ? !sort.desc : true })}>
        {label}
        {sort.key === key && (sort.desc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
      </button>
    </th>
  );

  return (
    <div className="page">
      <PageHeader
        title="Candidates"
        subtitle={`${people.length} people across ${ROLES.length} roles`}
        action={
          <Button variant="primary" onClick={() => setAdding(true)}>
            <Plus size={16} /> Add candidates
          </Button>
        }
      />

      <div className="filters">
        <Select label="Stage" value={stage} options={STAGES.map((s) => ({ value: s, count: stageCounts[s] }))} onChange={filter(setStage)} />
        <Select label="Role" value={role} options={[ALL, ...ROLES].map((r) => ({ value: r }))} onChange={filter(setRole)} />
        <Select label="Match" value={band} options={[ALL, ...BANDS].map((b) => ({ value: b }))} onChange={filter(setBand)} />
        <span className="spacer" />
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
                      aria-label="Select all on this page"
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
                  {sortable('name', 'Candidate')}
                  {sortable('score', 'Match')}
                  <th>Notice</th>
                  <th>Expected CTC</th>
                  {sortable('days', 'In stage')}
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
                          <span className="sub">
                            {c.role} · {c.employer}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td>
                      <Chip tone={BAND_TONE[c.band]} dot={!!BAND_TONE[c.band]}>
                        {c.score === null ? c.band : `${c.score} · ${c.band}`}
                      </Chip>
                    </td>
                    <td>{c.notice}</td>
                    <td className="num">{c.ctc ?? <span className="muted">—</span>}</td>
                    <td>
                      <Wait days={c.days} />
                    </td>
                    <td className="end">
                      <ActionMenu
                        label={`Actions for ${c.name}`}
                        trigger={<MoreHorizontal size={16} />}
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
                {current * PAGE_SIZE + 1}–{Math.min((current + 1) * PAGE_SIZE, rows.length)} of {rows.length}
              </span>
              <span style={{ display: 'flex', gap: 4 }}>
                <Button size="sm" variant="ghost" icon aria-label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)}>
                  <ChevronLeft size={16} />
                </Button>
                <Button size="sm" variant="ghost" icon aria-label="Next page" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
                  <ChevronRight size={16} />
                </Button>
              </span>
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
