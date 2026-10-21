import { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import type { NavProps } from '../App';
import { CANDIDATES, JOBS, type Job, type JobStatus } from '../data/model';
import { Button, Chip, Field, Initials, Modal, PageHeader, Skeleton, Tabs, Wait, settle, usePageLoad, useToast } from '../ui';

const STATUSES: JobStatus[] = ['Open', 'Draft', 'On hold', 'Closed'];

const inPipeline = (title: string) => CANDIDATES.filter((c) => c.role === title).length;
const inScreening = (title: string) => CANDIDATES.filter((c) => c.role === title && c.stage === 'Screening').length;

export function Jobs({ go, params }: NavProps) {
  const loading = usePageLoad();
  const toast = useToast();
  const [jobs, setJobs] = useState<Job[]>(JOBS);
  const [status, setStatus] = useState<JobStatus>('Open');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(params.new === '1');

  const counts = useMemo(() => Object.fromEntries(STATUSES.map((s) => [s, jobs.filter((j) => j.status === s).length])), [jobs]);
  const q = query.trim().toLowerCase();
  const visible = jobs.filter((j) => j.status === status && (!q || j.title.toLowerCase().includes(q)));
  const open = jobs.filter((j) => j.status === 'Open');
  const total = open.reduce((n, j) => n + inPipeline(j.title), 0);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Jobs"
        title="All jobs"
        subtitle={`${counts.Open} open roles · ${total} people in pipeline`}
        action={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> New job
          </Button>
        }
      />

      <div className="row-between">
        <Tabs label="Job status" value={status} options={STATUSES.map((s) => ({ value: s, count: counts[s] }))} onChange={setStatus} />
        <div className="search">
          <Search size={14} aria-hidden />
          <input className="input" type="search" placeholder="Search jobs" aria-label="Search jobs" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <div className="job-grid">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card job">
              <Skeleton w="50%" h={16} />
              <Skeleton w="30%" />
              <Skeleton w="70%" h={28} />
              <Skeleton w="40%" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="card empty">{q ? 'No jobs match your search.' : `No ${status.toLowerCase()} jobs.`}</div>
      ) : (
        <div className="job-grid">
          {visible.map((job) => (
            <article key={job.id} className="card job">
              <div>
                <h2>
                  {job.title}
                  {job.priority === 'P0' ? <Chip tone="red">P0</Chip> : <Chip>{job.priority}</Chip>}
                </h2>
                <span className="sub">
                  {job.id} · {job.location}
                </span>
              </div>
              <div className="job-stats">
                <div>
                  <span>In pipeline</span>
                  <strong className="num">{inPipeline(job.title)}</strong>
                </div>
                <div>
                  <span>Hired</span>
                  <strong className="num">
                    {job.hired}/{job.openings}
                  </strong>
                </div>
                <div>
                  <span>Oldest wait</span>
                  <strong>
                    <Wait days={job.oldestWait} />
                  </strong>
                </div>
              </div>
              <div className="job-foot">
                {job.owner ? (
                  <span className="person" style={{ minWidth: 0 }}>
                    <Initials name={job.owner} size="sm" />
                    {job.owner}
                  </span>
                ) : (
                  <span className="muted">No owner yet</span>
                )}
                <Button size="sm" onClick={() => go('candidates', { role: job.title, stage: 'Screening' })}>
                  Review {inScreening(job.title)} in Screening
                </Button>
              </div>
            </article>
          ))}
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
