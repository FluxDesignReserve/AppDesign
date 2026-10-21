import { useMemo, useState } from 'react';
import {
  Button,
  DataTable,
  DataTableSkeleton,
  Dropdown,
  Modal,
  OverflowMenu,
  OverflowMenuItem,
  Pagination,
  Table,
  TableBatchAction,
  TableBatchActions,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableSelectAll,
  TableSelectRow,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Tag,
  TextArea,
} from '@carbon/react';
import { Add, ArrowRight, Close } from '@carbon/icons-react';
import type { NavProps } from '../App';
import { BANDS, CANDIDATES, ROLES, STAGES, type Band, type Stage } from '../data/model';
import { PageHeader, Wait, settle, usePageLoad, useToast } from '../ui';

const HEADERS = [
  { key: 'name', header: 'Candidate' },
  { key: 'score', header: 'Match' },
  { key: 'notice', header: 'Notice' },
  { key: 'ctc', header: 'Expected CTC' },
  { key: 'days', header: 'In stage' },
];

const ALL_ROLES = 'All roles';
const ALL_MATCHES = 'Any match';

// Tag colours stay muted: only the strongest band gets a hue.
const BAND_TAG: Record<Band, 'green' | 'teal' | 'gray' | 'cool-gray' | 'warm-gray'> = {
  Excellent: 'green',
  Strong: 'teal',
  Good: 'gray',
  Low: 'warm-gray',
  'No match': 'warm-gray',
  'No CV yet': 'cool-gray',
};

type Moved = Record<string, Stage | 'Rejected'>;

const nextStage = (s: Stage): Stage => STAGES[Math.min(STAGES.indexOf(s) + 1, STAGES.length - 1)];
const lakh = (ctc: string | null) => (ctc ? parseFloat(ctc.replace(/[^\d.]/g, '')) : -1);

export function Candidates({ params }: NavProps) {
  const loading = usePageLoad();
  const toast = useToast();
  const [moved, setMoved] = useState<Moved>({});
  const [stage, setStage] = useState<Stage>((params.stage as Stage) ?? 'Screening');
  const [role, setRole] = useState<string>(params.role ?? ALL_ROLES);
  const [band, setBand] = useState<string>(ALL_MATCHES);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [adding, setAdding] = useState(false);

  const people = useMemo(
    () => CANDIDATES.map((c) => ({ ...c, stage: moved[c.id] ?? c.stage })).filter((c) => c.stage !== 'Rejected') as typeof CANDIDATES,
    [moved],
  );
  const stageCounts = useMemo(() => Object.fromEntries(STAGES.map((s) => [s, people.filter((c) => c.stage === s).length])), [people]);
  const byId = useMemo(() => new Map(people.map((c) => [c.id, c])), [people]);

  const q = query.trim().toLowerCase();
  const filtered = people.filter(
    (c) =>
      c.stage === stage &&
      (role === ALL_ROLES || c.role === role) &&
      (band === ALL_MATCHES || c.band === band) &&
      (!q || c.name.toLowerCase().includes(q) || c.employer.toLowerCase().includes(q)),
  );
  const rows = filtered.map((c) => ({ id: c.id, name: c.name, score: c.score ?? -1, notice: c.notice, ctc: lakh(c.ctc), days: c.days }));

  const filter = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  const move = (ids: string[], to: 'next' | 'Rejected') => {
    const before = moved;
    const update: Moved = {};
    for (const id of ids) {
      const c = byId.get(id)!;
      update[id] = to === 'next' ? nextStage(c.stage) : 'Rejected';
    }
    setMoved({ ...moved, ...update });
    const who = ids.length === 1 ? byId.get(ids[0])!.name : `${ids.length} people`;
    toast({
      title: to === 'next' ? `Moved ${who} to ${nextStage(stage)}` : `Rejected ${who}`,
      kind: 'success',
      undo: () => setMoved(before),
    });
  };

  return (
    <div className="nova-page">
      <PageHeader
        title="Candidates"
        subtitle={`${people.length} people across ${ROLES.length} roles`}
        action={
          <Button renderIcon={Add} onClick={() => setAdding(true)}>
            Add candidates
          </Button>
        }
      />

      <div className="nova-filters">
        <Dropdown
          id="stage"
          titleText="Stage"
          label="Stage"
          items={[...STAGES]}
          itemToString={(s) => (s ? `${s} (${stageCounts[s]})` : '')}
          selectedItem={stage}
          onChange={({ selectedItem }) => selectedItem && filter(setStage)(selectedItem)}
        />
        <Dropdown
          id="role"
          titleText="Role"
          label="Role"
          items={[ALL_ROLES, ...ROLES]}
          selectedItem={role}
          onChange={({ selectedItem }) => selectedItem && filter(setRole)(selectedItem)}
        />
        <Dropdown
          id="match"
          titleText="Match"
          label="Match"
          items={[ALL_MATCHES, ...BANDS]}
          selectedItem={band}
          onChange={({ selectedItem }) => selectedItem && filter(setBand)(selectedItem)}
        />
      </div>

      {loading ? (
        <DataTableSkeleton headers={HEADERS} rowCount={8} columnCount={HEADERS.length + 2} showHeader={false} />
      ) : (
        <DataTable rows={rows} headers={HEADERS} isSortable>
          {({ rows, headers, selectedRows, getTableProps, getHeaderProps, getRowProps, getSelectionProps, getBatchActionProps, getToolbarProps }) => {
            const batch = getBatchActionProps();
            const ids = selectedRows.map((r) => r.id);
            const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);
            return (
              <TableContainer>
                <TableToolbar {...getToolbarProps()} aria-label="Candidate actions">
                  <TableBatchActions {...batch}>
                    {stage !== 'Hired' && (
                      <TableBatchAction
                        renderIcon={ArrowRight}
                        onClick={() => {
                          move(ids, 'next');
                          batch.onCancel();
                        }}
                      >
                        Move to {nextStage(stage)}
                      </TableBatchAction>
                    )}
                    <TableBatchAction
                      renderIcon={Close}
                      onClick={() => {
                        move(ids, 'Rejected');
                        batch.onCancel();
                      }}
                    >
                      Reject
                    </TableBatchAction>
                  </TableBatchActions>
                  <TableToolbarContent aria-hidden={batch.shouldShowBatchActions}>
                    <TableToolbarSearch
                      persistent
                      placeholder="Search name or employer"
                      tabIndex={batch.shouldShowBatchActions ? -1 : 0}
                      onChange={(e) => filter(setQuery)((e as React.ChangeEvent<HTMLInputElement>).target?.value ?? '')}
                    />
                  </TableToolbarContent>
                </TableToolbar>
                <Table {...getTableProps()} aria-label="Candidates">
                  <TableHead>
                    <TableRow>
                      <TableSelectAll {...getSelectionProps()} />
                      {headers.map((h) => {
                        const { key, ...props } = getHeaderProps({ header: h });
                        return (
                          <TableHeader key={key} {...props}>
                            {h.header}
                          </TableHeader>
                        );
                      })}
                      <TableHeader aria-label="Actions" />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pageRows.map((row) => {
                      const c = byId.get(row.id);
                      // DataTable syncs rows a render after props change.
                      if (!c) return null;
                      const { key, ...props } = getRowProps({ row });
                      return (
                        <TableRow key={key} {...props}>
                          <TableSelectRow {...getSelectionProps({ row })} />
                          <TableCell>
                            {c.name}
                            <span className="nova-secondary">
                              {c.role} · {c.employer}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Tag size="sm" type={BAND_TAG[c.band]}>
                              {c.score === null ? c.band : `${c.score} · ${c.band}`}
                            </Tag>
                          </TableCell>
                          <TableCell>{c.notice}</TableCell>
                          <TableCell className="nova-num">{c.ctc ?? <span className="nova-muted">—</span>}</TableCell>
                          <TableCell>
                            <Wait days={c.days} />
                          </TableCell>
                          <TableCell className="cds--table-column-menu">
                            <OverflowMenu size="sm" flipped aria-label={`Actions for ${c.name}`}>
                              {stage !== 'Hired' && <OverflowMenuItem itemText={`Move to ${nextStage(stage)}`} onClick={() => move([c.id], 'next')} />}
                              <OverflowMenuItem itemText="Reject" isDelete hasDivider onClick={() => move([c.id], 'Rejected')} />
                            </OverflowMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {rows.length === 0 && <div className="nova-empty">No one matches these filters.</div>}
                {rows.length > 0 && (
                  <Pagination
                    page={page}
                    pageSize={pageSize}
                    pageSizes={[25, 50, 100]}
                    totalItems={rows.length}
                    onChange={({ page, pageSize }) => {
                      setPage(page);
                      setPageSize(pageSize);
                    }}
                  />
                )}
              </TableContainer>
            );
          }}
        </DataTable>
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

  return (
    <Modal
      open={open}
      size="sm"
      modalHeading="Add candidates"
      primaryButtonText={emails.length ? `Add ${emails.length}` : 'Add'}
      secondaryButtonText="Cancel"
      primaryButtonDisabled={!emails.length || saving}
      loadingStatus={saving ? 'active' : 'inactive'}
      loadingDescription="Adding…"
      onRequestClose={() => {
        setText('');
        onClose();
      }}
      onRequestSubmit={async () => {
        setSaving(true);
        await settle();
        setSaving(false);
        toast({ title: `Added ${emails.length} to Sourced`, subtitle: 'Nova will score their CVs as they arrive.' });
        setText('');
        onClose();
      }}
    >
      <TextArea
        id="emails"
        labelText="Email addresses"
        helperText="One per line, or separated by commas."
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
        data-modal-primary-focus
      />
    </Modal>
  );
}
