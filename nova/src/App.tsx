import { useEffect, useState } from 'react';
import {
  BarChart3,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Home as HomeIcon,
  Inbox,
  Menu,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import type { Notice, Page } from './data/model';
import { useNotices, useStore } from './store';
import { Button, Initials } from './ui';
import { Home } from './pages/Home';
import { Jobs } from './pages/Jobs';
import { Candidates } from './pages/Candidates';
import { Interviews } from './pages/Interviews';
import { Approvals } from './pages/Approvals';
import { Preboarding } from './pages/Preboarding';
import { Analytics } from './pages/Analytics';

interface NavItem {
  page: Page;
  label: string;
  icon: LucideIcon;
}

const WORK: NavItem[] = [
  { page: 'home', label: 'Home', icon: HomeIcon },
  { page: 'jobs', label: 'Jobs', icon: Briefcase },
  { page: 'candidates', label: 'Candidates', icon: Users },
  { page: 'interviews', label: 'Interviews', icon: CalendarClock },
  { page: 'approvals', label: 'Approvals', icon: CheckCircle2 },
];

const MORE: NavItem[] = [
  { page: 'preboarding', label: 'Preboarding', icon: UserPlus },
  { page: 'analytics', label: 'Analytics', icon: BarChart3 },
];

const PAGES = new Set<string>([...WORK, ...MORE].map((n) => n.page));

function readHash(): Page {
  const h = location.hash.replace('#/', '');
  return (PAGES.has(h) ? h : 'home') as Page;
}

export interface NavProps {
  go: (page: Page, params?: Record<string, string>) => void;
  params: Record<string, string>;
}

export function App() {
  const [page, setPage] = useState<Page>(readHash);
  const [params, setParams] = useState<Record<string, string>>({});
  const [inbox, setInbox] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [booting, setBooting] = useState(true);
  const notices = useNotices();
  const { approvals, interviews } = useStore();

  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 500);
    const onHash = () => setPage(readHash());
    window.addEventListener('hashchange', onHash);
    return () => {
      clearTimeout(t);
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  useEffect(() => {
    if (!inbox) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setInbox(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inbox]);

  const go = (next: Page, nextParams: Record<string, string> = {}) => {
    setParams(nextParams);
    setInbox(false);
    setNavOpen(false);
    setPage(next);
    location.hash = `/${next}`;
    window.scrollTo(0, 0);
  };

  // Counts only where something waits on the user, so the sidebar stays quiet.
  const counts: Partial<Record<Page, number>> = {
    interviews: interviews.filter((i) => i.status === 'Feedback due').length,
    approvals: approvals.filter((a) => a.state === 'Waiting on you').length,
  };

  const link = (n: NavItem) => (
    <a
      key={n.page}
      href={`#/${n.page}`}
      className="nav-item"
      aria-current={page === n.page ? 'page' : undefined}
      onClick={(e) => {
        e.preventDefault();
        go(n.page);
      }}
    >
      <n.icon size={16} aria-hidden />
      {n.label}
      {!!counts[n.page] && <span className="nav-count">{counts[n.page]}</span>}
    </a>
  );

  const nav: NavProps = { go, params };

  return (
    <div className={`shell${navOpen ? ' shell--nav-open' : ''}`}>
      {booting && (
        <div className="boot" role="status" aria-label="Loading Nova">
          <span className="spinner" />
        </div>
      )}

      <aside className="sidebar" aria-label="Main">
        <div className="workspace">
          <span className="logo" aria-hidden>
            N
          </span>
          <div>
            Nova
            <small>TestMu AI · Hiring</small>
          </div>
        </div>
        <nav className="nav">
          <button className="nav-item" onClick={() => setInbox(true)} aria-haspopup="dialog">
            <Inbox size={16} aria-hidden />
            Needs you
            {notices.length > 0 && <span className="nav-count nav-count--alert">{notices.length}</span>}
          </button>
          <div className="nav-label">Hiring</div>
          {WORK.map(link)}
          <div className="nav-label">More</div>
          {MORE.map(link)}
        </nav>
        <div className="sidebar-foot">
          <div className="nav-item" style={{ cursor: 'default' }}>
            <Initials name="Vedank Singh" size="sm" />
            Vedank Singh
          </div>
        </div>
      </aside>
      <div className="scrim" onClick={() => setNavOpen(false)} />

      <div className="main">
        <div className="topbar">
          <Button variant="ghost" icon aria-label="Open menu" onClick={() => setNavOpen(true)}>
            <Menu size={18} />
          </Button>
          Nova
          <span style={{ flex: 1 }} />
          <Button variant="ghost" size="sm" onClick={() => setInbox(true)} aria-label={`Needs you, ${notices.length}`}>
            <Inbox size={16} />
            {notices.length}
          </Button>
        </div>
        <main id="main-content">
          {page === 'home' && <Home {...nav} notices={notices} />}
          {page === 'jobs' && <Jobs {...nav} />}
          {page === 'candidates' && <Candidates key={JSON.stringify(params)} {...nav} />}
          {page === 'interviews' && <Interviews {...nav} />}
          {page === 'approvals' && <Approvals {...nav} />}
          {page === 'preboarding' && <Preboarding {...nav} />}
          {page === 'analytics' && <Analytics {...nav} />}
        </main>
      </div>

      {inbox && <NeedsYou notices={notices} onClose={() => setInbox(false)} onOpen={(p) => go(p)} />}
    </div>
  );
}

function NeedsYou({ notices, onClose, onOpen }: { notices: Notice[]; onClose: () => void; onOpen: (p: Page) => void }) {
  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <section className="drawer" role="dialog" aria-modal="true" aria-label="Needs you">
        <div className="drawer-head">
          <h2>Needs you · {notices.length}</h2>
          <Button variant="ghost" size="sm" icon aria-label="Close" onClick={onClose} autoFocus>
            <X size={16} />
          </Button>
        </div>
        {notices.length === 0 ? (
          <div className="empty">You're all caught up.</div>
        ) : (
          <ul className="list" style={{ overflowY: 'auto' }}>
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
      </section>
    </>
  );
}
