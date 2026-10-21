import { useState } from 'react';
import { Check, MessageSquare } from 'lucide-react';
import type { NavProps } from '../App';
import type { Approval, ApprovalState } from '../data/model';
import { update, useStore } from '../store';
import { Button, Chip, Field, Initials, InlineLoading, Modal, PageHeader, Select, Skeleton, settle, usePageLoad, useToast } from '../ui';

const VIEWS: ApprovalState[] = ['Waiting on you', 'You sent', 'Decided'];

export function Approvals(_: NavProps) {
  const loading = usePageLoad();
  const toast = useToast();
  const items = useStore().approvals;
  const setItems = (fn: (all: Approval[]) => Approval[]) => update((s) => ({ approvals: fn(s.approvals) }));
  const [view, setView] = useState<ApprovalState>('Waiting on you');
  const [busy, setBusy] = useState<string | null>(null);
  const [changing, setChanging] = useState<Approval | null>(null);

  const count = (s: ApprovalState) => items.filter((a) => a.state === s).length;
  const visible = items.filter((a) => a.state === view);

  const decide = async (a: Approval, outcome: 'Approved' | 'Changes requested') => {
    setBusy(a.id);
    await settle();
    setBusy(null);
    setItems((all) => all.map((x) => (x.id === a.id ? { ...x, state: 'Decided', note: `${outcome} by you.` } : x)));
    toast({
      title: outcome,
      subtitle: a.title,
      undo: () => setItems((all) => all.map((x) => (x.id === a.id ? a : x))),
    });
  };

  return (
    <div className="page">
      <PageHeader title="Approvals" subtitle={count('Waiting on you') ? `${count('Waiting on you')} waiting on you` : "You're all caught up"} />

      <div className="filters">
        <Select label="Show" value={view} options={VIEWS.map((v) => ({ value: v, count: count(v) }))} onChange={setView} />
      </div>

      {loading ? (
        <div className="cards">
          {[0, 1].map((i) => (
            <div key={i} className="card approval">
              <Skeleton w={60} h={20} />
              <Skeleton w="70%" h={16} />
              <Skeleton w="50%" />
              <Skeleton w="90%" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="card empty">Nothing here.</div>
      ) : (
        <div className="cards">
          {visible.map((a) => (
            <article key={a.id} className="card approval">
              <div className="meta">
                <Chip tone={a.kind === 'Offer' ? 'blue' : undefined}>{a.kind}</Chip>
                <span className="sub">{a.age}</span>
              </div>
              <h2>{a.title}</h2>
              <span className="muted">{a.facts.join(' · ')}</span>
              <p className="quote">
                {a.requestedBy === 'You' ? (
                  <MessageSquare size={14} style={{ flex: 'none', marginTop: 2 }} aria-hidden />
                ) : (
                  <Initials name={a.requestedBy} size="sm" />
                )}
                <span>
                  {a.requestedBy !== 'You' && <b style={{ color: 'var(--text)', fontWeight: 500 }}>{a.requestedBy} </b>}
                  {a.note}
                </span>
              </p>
              {a.state === 'Waiting on you' && (
                <div className="actions">
                  {busy === a.id ? (
                    <InlineLoading>Saving decision…</InlineLoading>
                  ) : (
                    <>
                      <Button variant="primary" onClick={() => decide(a, 'Approved')}>
                        <Check size={15} /> Approve
                      </Button>
                      <Button onClick={() => setChanging(a)}>Ask for changes</Button>
                    </>
                  )}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <AskForChanges
        approval={changing}
        onClose={() => setChanging(null)}
        onSend={(a) => {
          setChanging(null);
          decide(a, 'Changes requested');
        }}
      />
    </div>
  );
}

function AskForChanges({ approval, onClose, onSend }: { approval: Approval | null; onClose: () => void; onSend: (a: Approval) => void }) {
  const [note, setNote] = useState('');
  const close = () => {
    setNote('');
    onClose();
  };
  return (
    <Modal
      open={!!approval}
      title="Ask for changes"
      subtitle={approval?.title}
      onClose={close}
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!note.trim()}
            onClick={() => {
              if (approval) onSend(approval);
              setNote('');
            }}
          >
            Send
          </Button>
        </>
      }
    >
      <Field label={`What should ${approval?.requestedBy ?? 'they'} change?`}>
        {(id) => <textarea id={id} className="textarea" rows={4} value={note} autoFocus onChange={(e) => setNote(e.target.value)} />}
      </Field>
    </Modal>
  );
}
