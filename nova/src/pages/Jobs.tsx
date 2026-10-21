import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Search } from 'lucide-react';
import type { NavProps } from '../App';
import { CANDIDATES, JOBS, type Job, type JobStatus } from '../data/model';
import { Button, Chip, Field, Initials, Modal, PageHeader, Select, TableSkeleton, Wait, settle, usePageLoad, useToast } from '../ui';

const STATUSES: JobStatus[] = ['Open', 'Draft', 'On hold', 'Closed'];

const inPipeline = (title: string) => CANDIDATES.filter((c) => c.role === title).length;
const inScreening = (title: string) => CANDIDATES.filter((c) => c.role === title && c.stage === 'Screening').length;

type SortKey = 'pipeline' | 'wait';

export function Jobs({ go }: NavProps) {
  const loading = usePageLoad();
  const toast = useToast();
  const [jobs, setJobs] = useState<Job[]>(JOBS);
  const [status, setStatus] = useState<JobStatus>('Open');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'pipeline', desc: true });
  const [creating, setCreating] = useState(false);

  const counts = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s, jobs.filter((j) => j.status === s).length])), [jobs]);
  const q = query.trim().toLowerCase();
  const visible = jobs
    .filter((j) => j.status === status && (!q || j.title.toLowerCase().includes(q)))
    .sort((a, b) => {
      const v = (j: Job) => (sort.key === 'pipeline' ? inPipeline(j.title) : j.oldestWait);
      return (v(a) - v(b)) * (sort.desc ? -1 : 1);
    });
  const total = jobs.filter((j) => j.status === 'Open').reduce((n, j) => n + inPipeline(j.title), 0);

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
        title="Jobs"
        subtitle={`${counts.Open} open · ${total} people in the pipeline`}
        action={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> New job
          </Button>
        }
      />

      <div className="filters">
        <Select label="Status" value={status} options={STATUSES.map((s) => ({ value: s, count: counts[s] }))} onChange={setStatus} />
        <span className="spacer" />
        <div className="search">
          <Search size={14} aria-hidden />
          <input className="input" type="search" placeholder="Search jobs" aria-label="Search jobs" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={5} />
      ) : (
        <div className="card table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Priority</th>
                {sortable('pipeline', 'In pipeline')}
                <th>Hired</th>
                {sortable('wait', 'Oldest wait')}
                <th>Owner</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {visible.map((job) => (
                <tr key={job.id}>
                  <td>
                    <b style={{ fontWeight: 500 }}>{job.title}</b>
                    <span className="sub">
                      {job.id} · {job.location}
                    </span>
                  </td>
                  <td>{job.priority === 'P0' ? <Chip tone="red">P0</Chip> : <Chip>{job.priority}</Chip>}</td>
                  <td className="num">{inPipeline(job.title)}</td>
                  <td className="num">
                    {job.hired}/{job.openings}
                  </td>
                  <td>
                    <Wait days={job.oldestWait} />
                  </td>
                  <td>
                    {job.owner ? (
                      <span className="person" style={{ minWidth: 0 }}>
                        <Initials name={job.owner} size="sm" />
                        {job.owner}
                      </span>
                    ) : (
                      <span className="muted">Unassigned</span>
                    )}
                  </td>
                  <td className="end">
                    <Button size="sm" onClick={() => go('candidates', { role: job.title, stage: 'Screening' })}>
                      Review {inScreening(job.title)}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visible.length === 0 && <div className="empty">{q ? 'No jobs match your search.' : `No ${status.toLowerCase()} jobs.`}</div>}
        </div>
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

  const close = () => {
    setTitle('');
    setTouched(false);
    setSaving(false);
    onClose();
  };

  const save = async () => {
    setTouched(true);
    if (!title.trim()) return;
    setSaving(true);
    await settle();
    onCreate(title.trim(), location.trim() || 'Noida');
    close();
  };

  return (
    <Modal
      open={open}
      title="New job"
      subtitle="Drafts stay private until you publish them."
      onClose={close}
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={save}>
            Save as draft
          </Button>
        </>
      }
    >
      <Field label="Job title" error={invalid ? 'Add a job title.' : undefined}>
        {(id) => (
          <input
            id={id}
            className="input"
            value={title}
            autoFocus
            aria-invalid={invalid}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => setTouched(true)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
        )}
      </Field>
      <Field label="Location">{(id) => <input id={id} className="input" value={location} onChange={(e) => setLocation(e.target.value)} />}</Field>
    </Modal>
  );
}
