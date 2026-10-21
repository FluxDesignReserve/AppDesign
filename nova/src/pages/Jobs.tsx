import { useMemo, useState } from 'react';
import {
  Button,
  DataTable,
  DataTableSkeleton,
  Dropdown,
  Modal,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Tag,
  TextInput,
} from '@carbon/react';
import { Add } from '@carbon/icons-react';
import type { NavProps } from '../App';
import { CANDIDATES, JOBS, type Job, type JobStatus } from '../data/model';
import { PageHeader, Wait, settle, usePageLoad, useToast } from '../ui';

const STATUSES: JobStatus[] = ['Open', 'Draft', 'On hold', 'Closed'];

const HEADERS = [
  { key: 'title', header: 'Role' },
  { key: 'priority', header: 'Priority' },
  { key: 'pipeline', header: 'In pipeline' },
  { key: 'hired', header: 'Hired' },
  { key: 'wait', header: 'Oldest wait' },
  { key: 'owner', header: 'Owner' },
  { key: 'action', header: '' },
];

const inPipeline = (title: string) => CANDIDATES.filter((c) => c.role === title).length;
const inScreening = (title: string) => CANDIDATES.filter((c) => c.role === title && c.stage === 'Screening').length;

export function Jobs({ go }: NavProps) {
  const loading = usePageLoad();
  const toast = useToast();
  const [jobs, setJobs] = useState<Job[]>(JOBS);
  const [status, setStatus] = useState<JobStatus>('Open');
  const [creating, setCreating] = useState(false);

  const counts = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s, jobs.filter((j) => j.status === s).length])), [jobs]);
  const visible = jobs.filter((j) => j.status === status);
  const rows = visible.map((j) => ({ id: j.id, title: j.title, priority: j.priority, pipeline: inPipeline(j.title), hired: j.hired, wait: j.oldestWait, owner: j.owner ?? '', action: '' }));
  const byId = new Map(jobs.map((j) => [j.id, j]));
  const total = jobs.filter((j) => j.status === 'Open').reduce((n, j) => n + inPipeline(j.title), 0);

  return (
    <div className="nova-page">
      <PageHeader
        title="Jobs"
        subtitle={`${counts.Open} open · ${total} people in the pipeline`}
        action={
          <Button renderIcon={Add} onClick={() => setCreating(true)}>
            New job
          </Button>
        }
      />

      {loading ? (
        <DataTableSkeleton headers={HEADERS} rowCount={5} columnCount={HEADERS.length} showHeader={false} />
      ) : (
        <DataTable rows={rows} headers={HEADERS} isSortable>
          {({ rows, headers, getTableProps, getHeaderProps, getRowProps, onInputChange }) => (
            <TableContainer>
              <TableToolbar aria-label="Job filters">
                <TableToolbarContent>
                  <TableToolbarSearch onChange={(e) => onInputChange(e as React.ChangeEvent<HTMLInputElement>)} placeholder="Search jobs" persistent />
                  <Dropdown
                    id="job-status"
                    titleText="Status"
                    hideLabel
                    label="Status"
                    type="inline"
                    items={STATUSES}
                    itemToString={(s) => (s ? `${s} (${counts[s]})` : '')}
                    selectedItem={status}
                    onChange={({ selectedItem }) => selectedItem && setStatus(selectedItem)}
                  />
                </TableToolbarContent>
              </TableToolbar>
              <Table {...getTableProps()} aria-label="Jobs">
                <TableHead>
                  <TableRow>
                    {headers.map((h) => {
                      const { key, ...props } = getHeaderProps({ header: h, isSortable: h.key !== 'action' });
                      return (
                        <TableHeader key={key} {...props}>
                          {h.header}
                        </TableHeader>
                      );
                    })}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => {
                    const job = byId.get(row.id);
                    // DataTable syncs rows a render after props change.
                    if (!job) return null;
                    const { key, ...props } = getRowProps({ row });
                    return (
                      <TableRow key={key} {...props}>
                        <TableCell>
                          {job.title}
                          <span className="nova-secondary">
                            {job.id} · {job.location}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Tag size="sm" type={job.priority === 'P0' ? 'red' : 'gray'}>
                            {job.priority}
                          </Tag>
                        </TableCell>
                        <TableCell className="nova-num">{inPipeline(job.title)}</TableCell>
                        <TableCell className="nova-num">
                          {job.hired}/{job.openings}
                        </TableCell>
                        <TableCell>
                          <Wait days={job.oldestWait} />
                        </TableCell>
                        <TableCell>{job.owner ?? <span className="nova-muted">Unassigned</span>}</TableCell>
                        <TableCell className="nova-end">
                          <Button kind="ghost" size="sm" onClick={() => go('candidates', { role: job.title, stage: 'Screening' })}>
                            Review {inScreening(job.title)}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {rows.length === 0 && <div className="nova-empty">No {status.toLowerCase()} jobs.</div>}
            </TableContainer>
          )}
        </DataTable>
      )}

      <NewJob
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={(title, location) => {
          const id = `LT-00${23 + jobs.length - JOBS.length}`;
          setJobs((js) => [...js, { id, title, location, priority: 'P2', status: 'Draft', openings: 1, hired: 0, owner: 'Vedank Singh', oldestWait: 0 }]);
          setStatus('Draft');
          toast({
            title: 'Draft saved',
            subtitle: `${title} isn't published yet.`,
            undo: () => setJobs((js) => js.filter((j) => j.id !== id)),
          });
        }}
      />
    </div>
  );
}

function NewJob({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (title: string, location: string) => void }) {
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('Noida');
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);
  const invalid = touched && !title.trim();

  const reset = () => {
    setTitle('');
    setTouched(false);
    setSaving(false);
  };

  return (
    <Modal
      open={open}
      modalHeading="New job"
      primaryButtonText="Save as draft"
      secondaryButtonText="Cancel"
      primaryButtonDisabled={saving}
      loadingStatus={saving ? 'active' : 'inactive'}
      loadingDescription="Saving…"
      onRequestClose={() => {
        reset();
        onClose();
      }}
      onRequestSubmit={async () => {
        setTouched(true);
        if (!title.trim()) return;
        setSaving(true);
        await settle();
        onCreate(title.trim(), location.trim() || 'Noida');
        reset();
        onClose();
      }}
      size="sm"
    >
      <div className="nova-modal-body">
        <p className="nova-muted">Drafts stay private until you publish them.</p>
        <TextInput
          id="job-title"
          labelText="Job title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => setTouched(true)}
          invalid={invalid}
          invalidText="Add a job title."
          data-modal-primary-focus
        />
        <TextInput id="job-location" labelText="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
      </div>
    </Modal>
  );
}
