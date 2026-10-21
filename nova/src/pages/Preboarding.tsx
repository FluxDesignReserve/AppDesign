import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import type { NavProps } from '../App';
import { JOINERS, ROLES, dateIn, type Joiner, type Risk } from '../data/model';
import { Button, Chip, Field, Initials, Modal, PageHeader, Progress, Select, TableSkeleton, settle, usePageLoad, useToast } from '../ui';

type View = 'Everyone' | 'Needs attention';

const RISK_TONE: Record<Risk, 'orange' | 'red' | undefined> = { Low: undefined, Medium: 'orange', High: 'red' };

export function Preboarding({ params }: NavProps) {
  const loading = usePageLoad();
  const toast = useToast();
  const [joiners, setJoiners] = useState<Joiner[]>(JOINERS);
  const [view, setView] = useState<View>((params.view as View) ?? 'Everyone');
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [nudging, setNudging] = useState<string | null>(null);
  const [nudged, setNudged] = useState<Set<string>>(new Set());

  const attention = joiners.filter((j) => j.risk === 'High' || j.issue);
  const q = query.trim().toLowerCase();
  const visible = (view === 'Everyone' ? joiners : attention).filter((j) => !q || j.name.toLowerCase().includes(q));

  const nudge = async (j: Joiner) => {
    setNudging(j.id);
    await settle();
    setNudging(null);
    setNudged((s) => new Set(s).add(j.id));
    toast({ title: `Nudged ${j.name}`, subtitle: 'Sent on WhatsApp and email' });
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="People"
        title="Preboarding"
        subtitle={`${joiners.length} joiners · next start ${dateIn(joiners[0].startsIn)} (${joiners[0].name.split(' ')[0]}, in ${joiners[0].startsIn} days)`}
        action={
          <Button variant="primary" onClick={() => setAdding(true)}>
            <Plus size={16} /> Add joiner
          </Button>
        }
      />

      <div className="filters">
        <Select<View>
          label="Show"
          value={view}
          options={[
            { value: 'Everyone', count: joiners.length },
            { value: 'Needs attention', count: attention.length },
          ]}
          onChange={setView}
        />
        <div className="search">
          <Search size={14} aria-hidden />
          <input className="input" type="search" placeholder="Search joiners" aria-label="Search joiners" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={7} />
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Joiner</th>
                <th>Joins on</th>
                <th>Progress</th>
                <th>Risk</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {visible.map((j) => (
                <tr key={j.id}>
                  <td>
                    <span className="person">
                      <Initials name={j.name} />
                      <span>
                        <b>{j.name}</b>
                        <span className="sub" style={j.issue ? { color: 'var(--orange)' } : undefined}>
                          {j.issue ?? j.role}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td>
                    {dateIn(j.startsIn)}
                    <span className="sub">in {j.startsIn} days</span>
                  </td>
                  <td>
                    <Progress value={j.progress} label={`${j.name} readiness`} />
                  </td>
                  <td>
                    <Chip tone={RISK_TONE[j.risk]}>{j.risk}</Chip>
                  </td>
                  <td className="end">
                    {j.progress < 100 && (
                      <Button size="sm" loading={nudging === j.id} disabled={nudged.has(j.id)} onClick={() => nudge(j)}>
                        {nudged.has(j.id) ? 'Nudged' : 'Nudge'}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 && <div className="empty">No joiners match.</div>}
        </div>
      )}

      <AddJoiner
        open={adding}
        onClose={() => setAdding(false)}
        onAdd={(j) => {
          setJoiners((all) => [...all, j].sort((a, b) => a.startsIn - b.startsIn));
          toast({ title: `Added ${j.name}`, subtitle: 'Nova will send their welcome pack.', undo: () => setJoiners((all) => all.filter((x) => x.id !== j.id)) });
        }}
      />
    </div>
  );
}

function AddJoiner({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (j: Joiner) => void }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<string>(ROLES[0]);
  const [days, setDays] = useState('30');
  const [saving, setSaving] = useState(false);
  const valid = name.trim() && Number(days) > 0;

  const close = () => {
    setName('');
    setDays('30');
    onClose();
  };

  return (
    <Modal
      open={open}
      title="Add joiner"
      onClose={close}
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!valid}
            loading={saving}
            onClick={async () => {
              setSaving(true);
              await settle();
              setSaving(false);
              onAdd({ id: `j${Date.now()}`, name: name.trim(), role, startsIn: Number(days), progress: 0, risk: 'Low' });
              close();
            }}
          >
            Add joiner
          </Button>
        </>
      }
    >
      <Field label="Name">{(id) => <input id={id} className="input" value={name} autoFocus onChange={(e) => setName(e.target.value)} />}</Field>
      <Select label="Role" value={role} options={ROLES.map((r) => ({ value: r }))} onChange={setRole} />
      <Field label="Starts in (days)">
        {(id) => <input id={id} className="input" type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} />}
      </Field>
    </Modal>
  );
}
