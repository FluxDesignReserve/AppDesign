import { useEffect, useState } from 'react';
import {
  Button,
  ContainedList,
  ContainedListItem,
  Header,
  HeaderContainer,
  HeaderGlobalAction,
  HeaderGlobalBar,
  HeaderMenu,
  HeaderMenuButton,
  HeaderMenuItem,
  HeaderName,
  HeaderNavigation,
  HeaderPanel,
  HeaderSideNavItems,
  Loading,
  SideNav,
  SideNavItems,
  SkipToContent,
} from '@carbon/react';
import { Notification, UserAvatar } from '@carbon/icons-react';
import type { HeaderContainerRenderProps } from '@carbon/react/lib/components/UIShell/HeaderContainer';
import type { Page } from './data/model';
import { useNotices } from './store';
import { Home } from './pages/Home';
import { Jobs } from './pages/Jobs';
import { Candidates } from './pages/Candidates';
import { Interviews } from './pages/Interviews';
import { Approvals } from './pages/Approvals';
import { Preboarding } from './pages/Preboarding';
import { Analytics } from './pages/Analytics';

const PRIMARY: { page: Page; label: string }[] = [
  { page: 'jobs', label: 'Jobs' },
  { page: 'candidates', label: 'Candidates' },
  { page: 'interviews', label: 'Interviews' },
  { page: 'approvals', label: 'Approvals' },
];

// Used less often, so they sit behind "More" instead of crowding the bar.
const MORE: { page: Page; label: string }[] = [
  { page: 'preboarding', label: 'Preboarding' },
  { page: 'analytics', label: 'Analytics' },
];

const PAGES = new Set<string>(['home', ...PRIMARY.map((p) => p.page), ...MORE.map((p) => p.page)]);

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
  const [panel, setPanel] = useState<'notifications' | 'user' | null>(null);
  const [booting, setBooting] = useState(true);
  const notices = useNotices();

  useEffect(() => {
    const t = setTimeout(() => setBooting(false), 600);
    const onHash = () => setPage(readHash());
    window.addEventListener('hashchange', onHash);
    return () => {
      clearTimeout(t);
      window.removeEventListener('hashchange', onHash);
    };
  }, []);

  const go = (next: Page, nextParams: Record<string, string> = {}) => {
    setParams(nextParams);
    setPanel(null);
    if (next === page) setPage(next);
    location.hash = `/${next}`;
    window.scrollTo(0, 0);
  };

  const nav: NavProps = { go, params };
  const link = (p: Page) => ({
    href: `#/${p}`,
    isActive: page === p,
    onClick: (e: React.MouseEvent) => {
      e.preventDefault();
      go(p);
    },
  });

  return (
    <>
      <Loading active={booting} withOverlay description="Loading Nova" />
      <HeaderContainer
        render={({ isSideNavExpanded, onClickSideNavExpand }: HeaderContainerRenderProps) => (
          <Header aria-label="Nova">
            <SkipToContent />
            <HeaderMenuButton
              aria-label={isSideNavExpanded ? 'Close menu' : 'Open menu'}
              onClick={onClickSideNavExpand}
              isActive={isSideNavExpanded}
              aria-expanded={isSideNavExpanded}
            />
            <HeaderName {...link('home')} prefix="Nova">
              Hiring
            </HeaderName>
            <HeaderNavigation aria-label="Main">
              {PRIMARY.map((p) => (
                <HeaderMenuItem key={p.page} {...link(p.page)}>
                  {p.label}
                </HeaderMenuItem>
              ))}
              <HeaderMenu aria-label="More" menuLinkName="More" isActive={MORE.some((m) => m.page === page)}>
                {MORE.map((p) => (
                  <HeaderMenuItem key={p.page} {...link(p.page)}>
                    {p.label}
                  </HeaderMenuItem>
                ))}
              </HeaderMenu>
            </HeaderNavigation>
            <SideNav aria-label="Side navigation" expanded={isSideNavExpanded} isPersistent={false} onSideNavBlur={onClickSideNavExpand}>
              <SideNavItems>
                <HeaderSideNavItems>
                  {[{ page: 'home' as Page, label: 'Home' }, ...PRIMARY, ...MORE].map((p) => (
                    <HeaderMenuItem
                      key={p.page}
                      {...link(p.page)}
                      onClick={(e: React.MouseEvent) => {
                        e.preventDefault();
                        onClickSideNavExpand();
                        go(p.page);
                      }}
                    >
                      {p.label}
                    </HeaderMenuItem>
                  ))}
                </HeaderSideNavItems>
              </SideNavItems>
            </SideNav>
            <HeaderGlobalBar>
              <HeaderGlobalAction
                aria-label={`Notifications, ${notices.length} waiting`}
                isActive={panel === 'notifications'}
                onClick={() => setPanel(panel === 'notifications' ? null : 'notifications')}
                tooltipAlignment="end"
              >
                <Notification size={20} />
                <span className="cds--badge-indicator cds--badge-indicator--count" aria-hidden>
                  {notices.length}
                </span>
              </HeaderGlobalAction>
              <HeaderGlobalAction
                aria-label="Vedank Singh"
                isActive={panel === 'user'}
                onClick={() => setPanel(panel === 'user' ? null : 'user')}
                tooltipAlignment="end"
              >
                <UserAvatar size={20} />
              </HeaderGlobalAction>
            </HeaderGlobalBar>
            <HeaderPanel expanded={panel === 'notifications'} onHeaderPanelFocus={() => setPanel(null)} href="#">
              <ContainedList label={`Needs you · ${notices.length}`} kind="on-page" className="nova-notifications">
                {notices.map((n) => (
                  <ContainedListItem key={n.id} onClick={() => go(n.page)}>
                    {n.title}
                    <span className="nova-secondary">{n.detail}</span>
                  </ContainedListItem>
                ))}
              </ContainedList>
            </HeaderPanel>
            <HeaderPanel expanded={panel === 'user'} onHeaderPanelFocus={() => setPanel(null)} href="#">
              <ContainedList label="Vedank Singh" kind="on-page" className="nova-notifications">
                <ContainedListItem>
                  TestMu AI
                  <span className="nova-secondary">Workspace</span>
                </ContainedListItem>
                <ContainedListItem>
                  <Button kind="ghost" size="sm" onClick={() => setPanel(null)}>
                    Sign out
                  </Button>
                </ContainedListItem>
              </ContainedList>
            </HeaderPanel>
          </Header>
        )}
      />
      <main id="main-content" className="nova-main">
        {page === 'home' && <Home {...nav} notices={notices} />}
        {page === 'jobs' && <Jobs {...nav} />}
        {page === 'candidates' && <Candidates key={JSON.stringify(params)} {...nav} />}
        {page === 'interviews' && <Interviews {...nav} />}
        {page === 'approvals' && <Approvals {...nav} />}
        {page === 'preboarding' && <Preboarding {...nav} />}
        {page === 'analytics' && <Analytics {...nav} />}
      </main>
    </>
  );
}
