import { useState } from 'react';
import { Button, Dropdown, InlineLoading, Modal, SkeletonPlaceholder, Tag, TextArea, Tile } from '@carbon/react';
import type { NavProps } from '../App';
import type { Approval, ApprovalState } from '../data/model';
import { update, useStore } from '../store';
import { PageHeader, settle, usePageLoad, useToast } from '../ui';

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
    <div className="nova-page">
      <PageHeader title="Approvals" subtitle={count('Waiting on you') ? `${count('Waiting on you')} waiting on you` : "You're all caught up"} />

      <div className="nova-filters">
        <Dropdown
          id="approval-view"
          titleText="Show"
          label="Show"
          items={VIEWS}
          itemToString={(v) => (v ? `${v} (${count(v)})` : '')}
          selectedItem={view}
          onChange={({ selectedItem }) => selectedItem && setView(selectedItem)}
        />
      </div>

      {loading ? (
        <div className="nova-cards">
          <SkeletonPlaceholder style={{ width: '100%', height: '13rem' }} />
          <SkeletonPlaceholder style={{ width: '100%', height: '13rem' }} />
        </div>
      ) : visible.length === 0 ? (
        <div className="nova-empty">Nothing here.</div>
      ) : (
        <div className="nova-cards">
          {visible.map((a) => (
            <Tile key={a.id} className="nova-card">
              <div className="nova-card__meta">
                <Tag size="sm" type={a.kind === 'Offer' ? 'blue' : 'gray'}>
                  {a.kind}
                </Tag>
                <span className="nova-secondary">{a.age}</span>
              </div>
              <h2>{a.title}</h2>
              <span className="nova-muted">{a.facts.join(' · ')}</span>
              <span className="nova-secondary">
                {a.requestedBy === 'You' ? '' : `${a.requestedBy}: `}“{a.note}”
              </span>
              {a.state === 'Waiting on you' && (
                <div className="nova-card__actions">
                  {busy === a.id ? (
                    <InlineLoading description="Saving decision…" />
                  ) : (
                    <>
                      <Button size="md" onClick={() => decide(a, 'Approved')}>
                        Approve
                      </Button>
                      <Button size="md" kind="tertiary" onClick={() => setChanging(a)}>
                        Ask for changes
                      </Button>
                    </>
                  )}
                </div>
              )}
            </Tile>
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
  return (
    <Modal
      open={!!approval}
      size="sm"
      modalHeading="Ask for changes"
      modalLabel={approval?.title}
      primaryButtonText="Send"
      secondaryButtonText="Cancel"
      primaryButtonDisabled={!note.trim()}
      onRequestClose={() => {
        setNote('');
        onClose();
      }}
      onRequestSubmit={() => {
        if (approval) onSend(approval);
        setNote('');
      }}
    >
      <TextArea
        id="change-note"
        labelText={`What should ${approval?.requestedBy ?? 'they'} change?`}
        rows={4}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        data-modal-primary-focus
      />
    </Modal>
  );
}
