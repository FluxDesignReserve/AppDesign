import { useState } from 'react';
import {
  Button,
  DataTableSkeleton,
  Dropdown,
  Modal,
  RadioButton,
  RadioButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TextArea,
} from '@carbon/react';
import type { NavProps } from '../App';
import { dayLabel, type Decision, type Interview } from '../data/model';
import { update, useStore } from '../store';
import { PageHeader, settle, usePageLoad, useToast } from '../ui';

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
    <div className="nova-page">
      <PageHeader
        title="Interviews"
        subtitle={next ? `Next: ${next.candidate}, ${dayLabel(next.dayOffset).toLowerCase()} at ${next.time}` : 'Nothing scheduled'}
      />

      <div className="nova-filters">
        <Dropdown
          id="interview-view"
          titleText="Show"
          label="Show"
          items={VIEWS}
          itemToString={(v) => (v ? `${v} (${count(v)})` : '')}
          selectedItem={view}
          onChange={({ selectedItem }) => selectedItem && setView(selectedItem)}
        />
      </div>

      {loading ? (
        <DataTableSkeleton rowCount={3} columnCount={3} showHeader={false} showToolbar={false} />
      ) : visible.length === 0 ? (
        <div className="nova-empty">{view === 'Feedback due' ? "You're all caught up." : 'Nothing here yet.'}</div>
      ) : (
        <TableContainer>
          <Table aria-label={view}>
            <TableHead>
              <TableRow>
                <TableHeader>Candidate</TableHeader>
                <TableHeader>When</TableHeader>
                <TableHeader aria-label="Actions" />
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>
                    {i.candidate}
                    <span className="nova-secondary">
                      {i.role} · {i.round}
                    </span>
                  </TableCell>
                  <TableCell>
                    {dayLabel(i.dayOffset)}, {i.time}
                    {i.status === 'Feedback due' && i.dayOffset < 0 && (
                      <span className="nova-secondary">Feedback overdue</span>
                    )}
                  </TableCell>
                  <TableCell className="nova-end">
                    {i.status === 'Feedback due' && (
                      <Button size="sm" kind="primary" onClick={() => setWriting(i)}>
                        Write feedback
                      </Button>
                    )}
                    {i.status === 'Upcoming' && (
                      <Button size="sm" kind="ghost" onClick={() => toast({ kind: 'info', title: 'Opening Google Meet', subtitle: `${i.candidate} · ${i.time}` })}>
                        Join
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Feedback
        interview={writing}
        onClose={() => setWriting(null)}
        onSign={(i, verdict) => {
          setItems((all) => all.map((x) => (x.id === i.id ? { ...x, status: 'Done' } : x)));
          toast({
            title: 'Feedback signed',
            subtitle: `${verdict} for ${i.candidate}. You can now see the other panelists' verdicts.`,
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
      modalHeading={interview ? `Feedback for ${interview.candidate}` : ''}
      modalLabel={interview?.round}
      primaryButtonText="Sign feedback"
      secondaryButtonText="Cancel"
      primaryButtonDisabled={saving || !notes.trim()}
      loadingStatus={saving ? 'active' : 'inactive'}
      loadingDescription="Signing…"
      onRequestClose={onClose}
      onRequestSubmit={async () => {
        if (!interview) return;
        setSaving(true);
        await settle();
        setSaving(false);
        onSign(interview, verdict);
        onClose();
      }}
    >
      <div className="nova-modal-body">
        {interview?.draftReady && <p className="nova-muted">Nova drafted this from the recording. Check it before you sign.</p>}
        <RadioButtonGroup legendText="Recommendation" name="verdict" valueSelected={verdict} onChange={(v) => setVerdict(String(v))}>
          {VERDICTS.map((v) => (
            <RadioButton key={v} id={`verdict-${v}`} labelText={v} value={v} />
          ))}
        </RadioButtonGroup>
        <TextArea
          id="notes"
          labelText="Notes"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          invalid={!notes.trim()}
          invalidText="Add a short note so the panel knows why."
        />
      </div>
    </Modal>
  );
}
