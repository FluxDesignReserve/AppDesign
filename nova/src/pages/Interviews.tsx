import { useState } from 'react';
import { Sparkles, Video } from 'lucide-react';
import type { NavProps } from '../App';
import { dayLabel, type Decision, type Interview } from '../data/model';
import { update, useStore } from '../store';
import { Button, Chip, Field, Initials, Modal, PageHeader, Select, TableSkeleton, settle, usePageLoad, useToast } from '../ui';

const VIEWS: Decision[] = ['Feedback due', 'Upcoming', 'Done'];
const VERDICTS = ['Strong yes', 'Yes', 'No', 'Strong no'];

export function Interviews(_: NavProps) {
  const loading = usePageLoad();
  const toast = useToast();
  const items = useStore().interviews;
  const setItems = (fn: (all: Interview[]) => Interview[]) => update((s) => ({ interviews: fn(s.interviews) }));
  const [view, setView] = useState<Decision>(items.some((i) => i.status === 'Feedback due') ? 'Feedback due' : 'Upcoming');
  const [writing, setWriting] = useState<Interview | null>(null);

  const count = (d: Decision) => items.filter((i) => i.status === d).length;
  const visible = items.filter((i) => i.status === view);
  const next = items.find((i) => i.status === 'Upcoming');

  return (
    <div className="page">
      <PageHeader
        title="Interviews"
        subtitle={next ? `Next: ${next.candidate}, ${dayLabel(next.dayOffset).toLowerCase()} at ${next.time}` : 'Nothing scheduled'}
      />

      <div className="filters">
        <Select label="Show" value={view} options={VIEWS.map((v) => ({ value: v, count: count(v) }))} onChange={setView} />
      </div>

      {loading ? (
        <TableSkeleton rows={3} />
      ) : visible.length === 0 ? (
        <div className="card empty">{view === 'Feedback due' ? "You're all caught up." : 'Nothing here yet.'}</div>
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>When</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {visible.map((i) => (
                <tr key={i.id}>
                  <td>
                    <span className="person">
                      <Initials name={i.candidate} />
                      <span>
                        <b>{i.candidate}</b>
                        <span className="sub">
                          {i.role} · {i.round}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td>
                    {dayLabel(i.dayOffset)}, {i.time}
                    {i.status === 'Feedback due' && i.dayOffset < 0 && (
                      <>
                        {' '}
                        <Chip tone="orange">Overdue</Chip>
                      </>
                    )}
                  </td>
                  <td className="end">
                    {i.status === 'Feedback due' && (
                      <Button size="sm" variant="primary" onClick={() => setWriting(i)}>
                        Write feedback
                      </Button>
                    )}
                    {i.status === 'Upcoming' && (
                      <Button size="sm" onClick={() => toast({ title: 'Opening Google Meet', subtitle: `${i.candidate} · ${i.time}` })}>
                        <Video size={14} /> Join
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Feedback
        interview={writing}
        onClose={() => setWriting(null)}
        onSign={(i, verdict) => {
          setItems((all) => all.map((x) => (x.id === i.id ? { ...x, status: 'Done' } : x)));
          toast({
            title: 'Feedback signed',
            subtitle: `${verdict} for ${i.candidate}`,
            undo: () => setItems((all) => all.map((x) => (x.id === i.id ? { ...x, status: 'Feedback due' } : x))),
          });
        }}
      />
    </div>
  );
}

function Feedback({ interview, onClose, onSign }: { interview: Interview | null; onClose: () => void; onSign: (i: Interview, verdict: string) => void }) {
  const [verdict, setVerdict] = useState('Yes');
  const [notes, setNotes] = useState('Clear on fundamentals and motivated by the EMEA book. Probe pipeline discipline in the next round.');
  const [saving, setSaving] = useState(false);

  return (
    <Modal
      open={!!interview}
      title={interview ? `Feedback for ${interview.candidate}` : ''}
      subtitle={interview ? `${interview.role} · ${interview.round}` : undefined}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={saving}
            disabled={!notes.trim()}
            onClick={async () => {
              if (!interview) return;
              setSaving(true);
              await settle();
              setSaving(false);
              onSign(interview, verdict);
              onClose();
            }}
          >
            Sign feedback
          </Button>
        </>
      }
    >
      {interview?.draftReady && (
        <p className="quote">
          <Sparkles size={14} color="var(--accent)" style={{ flex: 'none', marginTop: 2 }} aria-hidden />
          Nova drafted this from the recording. Check it before you sign.
        </p>
      )}
      <div className="field">
        <label id="verdict-label">Recommendation</label>
        <div className="segmented" role="group" aria-labelledby="verdict-label">
          {VERDICTS.map((v) => (
            <button key={v} type="button" aria-pressed={verdict === v} onClick={() => setVerdict(v)}>
              {v}
            </button>
          ))}
        </div>
      </div>
      <Field label="Notes" error={!notes.trim() ? 'Add a short note so the panel knows why.' : undefined}>
        {(id) => <textarea id={id} className="textarea" rows={4} value={notes} aria-invalid={!notes.trim()} onChange={(e) => setNotes(e.target.value)} />}
      </Field>
    </Modal>
  );
}
