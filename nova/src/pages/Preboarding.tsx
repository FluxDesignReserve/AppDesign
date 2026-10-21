import { useState } from 'react';
import type { NavProps } from '../App';
import { JOINERS, dateIn, type Joiner, type Risk } from '../data/model';
import { Button, Chip, Initials, PageHeader, Progress, Select, TableSkeleton, settle, usePageLoad, useToast } from '../ui';

type View = 'Everyone' | 'Needs attention';

const RISK_TONE: Record<Risk, 'orange' | 'red' | undefined> = { Low: undefined, Medium: 'orange', High: 'red' };

export function Preboarding(_: NavProps) {
  const loading = usePageLoad();
  const toast = useToast();
  const [view, setView] = useState<View>('Everyone');
  const [nudging, setNudging] = useState<string | null>(null);
  const [nudged, setNudged] = useState<Set<string>>(new Set());

  const attention = JOINERS.filter((j) => j.risk === 'High' || j.issue);
  const visible = view === 'Everyone' ? JOINERS : attention;

  const nudge = async (j: Joiner) => {
    setNudging(j.id);
    await settle();
    setNudging(null);
    setNudged((s) => new Set(s).add(j.id));
    toast({ title: `Nudged ${j.name}`, subtitle: 'Sent on WhatsApp and email' });
  };

  return (
    <div className="page">
      <PageHeader title="Preboarding" subtitle={`${JOINERS.length} joiners · next starts ${dateIn(JOINERS[0].startsIn)}`} />

      <div className="filters">
        <Select<View>
          label="Show"
          value={view}
          options={[
            { value: 'Everyone', count: JOINERS.length },
            { value: 'Needs attention', count: attention.length },
          ]}
          onChange={setView}
        />
      </div>

      {loading ? (
        <TableSkeleton rows={7} />
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Joiner</th>
                <th>Starts</th>
                <th>Readiness</th>
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
        </div>
      )}
    </div>
  );
}
