import { useEffect, useRef, useState } from 'react';
import { Bell, ChevronRight, ChevronsUpDown, Home as HomeIcon, Plus, Search, X } from 'lucide-react';
import type { Notice, Page } from './data/model';
import { useNotices, useStore } from './store';
import { ActionMenu, Button } from './ui';
import { Home } from './pages/Home';
import { Jobs } from './pages/Jobs';
import { Candidates } from './pages/Candidates';
import { Interviews } from './pages/Interviews';
import { Approvals } from './pages/Approvals';
import { Preboarding } from './pages/Preboarding';
import { Analytics } from './pages/Analytics';

// Same order as the original pill nav.
const NAV: { page: Page; label: string }[] = [
  { page: 'jobs', label: 'Jobs' },
  { page: 'candidates', label: 'Candidates' },
  { page: 'interviews', label: 'Interviews' },
  { page: 'preboarding', label: 'Preboarding' },
  { page: 'analytics', label: 'Analytics' },
  { page: 'approvals', label: 'Approvals' },
];

const PAGES = new Set<string>(['home', ...NAV.map((n) => n.page)]);

interface Tip {
  text: string;
  cta: string;
  page: Page;
  params?: Record<string, string>;
}

// Nova's one suggestion per page. Hidden behind the launcher so pages stay quiet.
const TIPS: Partial<Record<Page, Tip>> = {
  home: { text: '2 approvals wait on you. Sneha Iyer has a competing offer closing Friday.', cta: 'Open approvals', page: 'approvals' },
  jobs: {
    text: 'Account Manager is the most urgent role: 47 people have waited over 7 days.',
    cta: 'Review Account Manager',
    page: 'candidates',
    params: { role: 'Account Manager', stage: 'Screening' },
  },
  candidates: { text: '27 of the 95 people in Screening are excellent matches.', cta: 'Show excellent', page: 'candidates', params: { stage: 'Screening', band: 'Excellent' } },
  interviews: { text: "Nova drafted Tanvi's scorecard from the recording. Check it and sign.", cta: 'Open interviews', page: 'interviews' },
  preboarding: { text: 'Aditi Yadav joins in 6 days with 4 documents missing.', cta: 'Show who needs attention', page: 'preboarding', params: { view: 'Needs attention' } },
  analytics: { text: 'Interview → Offer keeps only 26%, the steepest drop in the pipeline.', cta: 'See candidates in Interview', page: 'candidates', params: { stage: 'Interview' } },
  approvals: { text: "Start with Sneha Iyer's offer. She has a competing offer closing Friday.", cta: 'Got it', page: 'approvals' },
};

function readHash(): Page {
  const h = location.hash.replace('#/', '');
  return (PAGES.has(h) ? h : 'home') as Page;
}

export interface NavProps {
  go: (page: Page, params?: Record<string, string>) => void;
  params: Record<string, string>;
}

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

export function App() {
  const [page, setPage] = useState<Page>(readHash);
  const [params, setParams] = useState<Record<string, string>>({});
  const [bell, setBell] = useState(false);
  const [search, setSearch] = useState(false);
  const [tip, setTip] = useState(false);
  const [booting, setBooting] = useState(true);
  const [visit, setVisit] = useState(0);
  const notices = useNotices();
  const { approvals, interviews } = useStore();
  const pageRef = useRef(page);
  const bellRef = useOutside(bell, () => setBell(false));
  const tipRef = useOutside(tip, () => setTip(false));

  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 500);
    // Back/forward and hand-edited URLs: reset per-page state the same way go() does.
    const onHash = () => {
      const next = readHash();
      if (next === pageRef.current) return;
      pageRef.current = next;
      setPage(next);
      setParams({});
      setTip(false);
      setBell(false);
      setVisit((v) => v + 1);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearch(true);
      }
    };
    window.addEventListener('hashchange', onHash);
    window.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const go = (next: Page, nextParams: Record<string, string> = {}) => {
    setParams(nextParams);
    setBell(false);
    setSearch(false);
    setTip(false);
    pageRef.current = next;
    setPage(next);
    setVisit((v) => v + 1);
    location.hash = `/${next}`;
    window.scrollTo(0, 0);
  };

  // Only counts that wait on the user, as in the original nav.
  const counts: Partial<Record<Page, number>> = {
    jobs: 5,
    interviews: interviews.filter((i) => i.status === 'Feedback due').length,
    approvals: approvals.filter((a) => a.state === 'Waiting on you').length,
  };

  const link = (p: Page, children: React.ReactNode, className?: string) => (
    <a
      key={p}
      href={`#/${p}`}
      className={className}
      aria-current={page === p ? 'page' : undefined}
      onClick={(e) => {
        e.preventDefault();
        go(p);
      }}
    >
      {children}
    </a>
  );

  const nav: NavProps = { go, params };
  const pageTip = TIPS[page];

  return (
    <>
      {booting && (
        <div className="boot" role="status" aria-label="Loading Nova">
          <span className="spinner" />
        </div>
      )}

      <header className="topbar">
        <div className="topbar-left">
          <span className="logo" aria-hidden>
            N
          </span>
          <span className="workspace">
            TestMu AI <span>· Hiring</span>
            <ChevronsUpDown size={13} color="var(--text-3)" aria-hidden />
          </span>
        </div>

        <nav className="pillnav" aria-label="Main">
          {link('home', <HomeIcon size={16} aria-label="Home" />, 'home')}
          <span className="sep" aria-hidden />
          {NAV.map((n) =>
            link(
              n.page,
              <>
                {n.label}
                {!!counts[n.page] && <span className="count">{counts[n.page]}</span>}
              </>,
            ),
          )}
        </nav>

        <div className="topbar-right">
          <button className="icon-btn" aria-label="Search (Ctrl K)" onClick={() => setSearch(true)}>
            <Search size={16} />
          </button>
          <div style={{ position: 'relative' }} ref={bellRef}>
            <button className="icon-btn" aria-label={`Notifications, ${notices.length}`} aria-expanded={bell} onClick={() => setBell(!bell)}>
              <Bell size={16} />
              {notices.length > 0 && <span className="badge">{notices.length}</span>}
            </button>
            {bell && <Notifications notices={notices} onOpen={(p) => go(p)} onClose={() => setBell(false)} />}
          </div>
          <ActionMenu
            label="New"
            variant="secondary"
            icon={false}
            trigger={
              <>
                <Plus size={15} />
                <span className="new-label">New</span>
              </>
            }
            actions={[
              { label: 'New job', onSelect: () => go('jobs', { new: '1' }) },
              { label: 'Add candidates', onSelect: () => go('candidates', { new: '1' }) },
            ]}
          />
          <span className="me" aria-label="Vedank Singh" role="img">
            V
          </span>
        </div>
      </header>

      <main id="main-content" key={visit}>
        {page === 'home' && <Home {...nav} notices={notices} openNotifications={() => setBell(true)} />}
        {page === 'jobs' && <Jobs {...nav} />}
        {page === 'candidates' && <Candidates {...nav} />}
        {page === 'interviews' && <Interviews {...nav} />}
        {page === 'approvals' && <Approvals {...nav} />}
        {page === 'preboarding' && <Preboarding {...nav} />}
        {page === 'analytics' && <Analytics {...nav} />}
      </main>

      {pageTip && (
        <div className="launcher" ref={tipRef}>
          {tip && (
            <div className="launcher-tip" role="dialog" aria-label="Nova">
              <p>{pageTip.text}</p>
              <Button size="sm" variant="primary" onClick={() => (pageTip.page === page && !pageTip.params ? setTip(false) : go(pageTip.page, pageTip.params))}>
                {pageTip.cta}
              </Button>
            </div>
          )}
          <button className="launcher-btn" aria-label="Ask Nova" aria-expanded={tip} onClick={() => setTip(!tip)}>
            <span className="eyes" aria-hidden>
              <i />
              <i />
            </span>
          </button>
        </div>
      )}

      {search && <SearchPalette onClose={() => setSearch(false)} onGo={(p) => go(p)} />}
    </>
  );
}

function Notifications({ notices, onOpen, onClose }: { notices: Notice[]; onOpen: (p: Page) => void; onClose: () => void }) {
  return (
    <div className="popover" role="dialog" aria-label="Notifications">
      <div className="popover-head">
        {notices.length} things wait on you
        <Button variant="ghost" size="sm" icon aria-label="Close" onClick={onClose}>
          <X size={15} />
        </Button>
      </div>
      {notices.length === 0 ? (
        <div className="empty">You're all caught up.</div>
      ) : (
        <ul className="list" style={{ maxHeight: 420, overflowY: 'auto' }}>
          {notices.map((n) => (
            <li key={n.id}>
              <button className="list-item" onClick={() => onOpen(n.page)}>
                <span className="grow">
                  <b>{n.title}</b>
                  <span className="sub">{n.detail}</span>
                </span>
                <ChevronRight size={16} className="chev" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const DESTINATIONS: { page: Page; label: string }[] = [{ page: 'home', label: 'Home' }, ...NAV];

function SearchPalette({ onClose, onGo }: { onClose: () => void; onGo: (p: Page) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const hits = DESTINATIONS.filter((d) => d.label.toLowerCase().includes(q.trim().toLowerCase()));

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      className="modal palette"
      aria-label="Go to"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
    >
      <input
        autoFocus
        placeholder="Go to…"
        aria-label="Go to"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, hits.length - 1));
          else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
          else if (e.key === 'Enter' && hits[active]) onGo(hits[active].page);
          else return;
          e.preventDefault();
        }}
      />
      <ul className="list" role="listbox" aria-label="Pages">
        {hits.map((d, i) => (
          <li key={d.page} role="option" aria-selected={i === active}>
            <button className="list-item" style={i === active ? { background: 'var(--hover)' } : undefined} onMouseEnter={() => setActive(i)} onClick={() => onGo(d.page)}>
              <span className="grow">{d.label}</span>
              <ChevronRight size={16} className="chev" aria-hidden />
            </button>
          </li>
        ))}
        {hits.length === 0 && <li className="empty">No matches.</li>}
      </ul>
    </dialog>
  );
}
