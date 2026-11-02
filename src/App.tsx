import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { APP_TITLE } from './config';
import { openSession, SetupNeeded, type Session } from './data';
import type { MailKind } from './data/types';
import { initials } from './lib/format';
import { transition } from './lib/motion';
import { useStored } from './lib/stored';
import markUrl from './assets/bankabc-mark.png';
import tileUrl from './assets/bankabc-tile.png';
import wordmarkUrl from './assets/bankabc-wordmark.png';
import { Segmented } from './components/Segmented';
import { DepartmentMail } from './pages/DepartmentMail';
import { Home } from './pages/Home';
import { LogMail } from './pages/LogMail';
import { Manage } from './pages/Manage';
import { MyMail } from './pages/MyMail';
import { Settings } from './pages/Settings';
import { Setup } from './pages/Setup';
import { PAGES, type Page, type PageProps } from './pages/shared';

type Access = 'unit' | 'admin' | 'general';

const NAV: { page: Page; label: string; access: Access }[] = [
  { page: 'home', label: 'Home', access: 'unit' },
  { page: 'mine', label: 'My Personal Mail', access: 'unit' },
  { page: 'department', label: 'Department Mail', access: 'unit' },
  { page: 'add', label: 'Add Mail', access: 'admin' },
  { page: 'maintenance', label: 'Maintenance', access: 'admin' },
  { page: 'settings', label: 'Settings', access: 'general' },
];

const ACCESS: Record<Page, Access> = Object.fromEntries(NAV.map((n) => [n.page, n.access])) as Record<Page, Access>;

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [setup, setSetup] = useState<SetupNeeded | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const run = useRef(0);

  /** Opens the session again, e.g. after Settings changed who is in which unit. */
  const reload = useCallback(async () => {
    const id = ++run.current;
    const next = await openSession();
    if (id === run.current) setSession(next);
  }, []);

  useEffect(() => {
    reload().catch((e: unknown) => {
      if (e instanceof SetupNeeded) setSetup(e);
      else setFatal(e instanceof Error ? e.message : String(e));
    });
  }, [reload]);

  if (setup) return <Setup problem={setup} />;
  if (fatal) {
    return (
      <div className="fatal" role="alert">
        <h1>{APP_TITLE} can’t start</h1>
        <p>{fatal}</p>
      </div>
    );
  }
  if (!session) {
    return (
      <div className="boot" aria-live="polite">
        <img className="boot-mark" src={tileUrl} alt="" width={72} height={72} />
        <p>Opening {APP_TITLE}…</p>
      </div>
    );
  }
  return <Shell session={session} reload={reload} />;
}

interface ShellProps {
  session: Session;
  reload: () => Promise<void>;
}

function Shell({ session, reload }: ShellProps) {
  const { user, params, units, generalAdmin } = session;

  const [storedUnit, setUnit] = useStored<string>('unit', '');
  const paramUnit = units.find((u) => u.name.toLowerCase() === (params.unit ?? '').toLowerCase());
  const [unitOverride, setUnitOverride] = useState(paramUnit?.name ?? null);
  const current = units.find((u) => u.name === (unitOverride ?? storedUnit)) ?? units[0];
  const unit = current?.name ?? '';
  const admin = current?.admin ?? false;

  const initialPage = PAGES.find((p) => p === params.page) ?? 'home';
  const [page, setPage] = useState<Page>(initialPage);
  const [addKind, setAddKind] = useState<MailKind>(params.kind?.toLowerCase() === 'department' ? 'Department' : 'Personal');
  const [visit, setVisit] = useState(0);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(timer);
  }, [toast]);

  const notify = (text: string) => setToast({ id: Date.now(), text });
  const { barRef, stacked } = useStackedBar();

  // Pages someone can't use don't exist for them: no navigation, no tiles, no links.
  const allowed = (p: Page) => {
    const need = ACCESS[p];
    if (need === 'general') return generalAdmin;
    if (!current) return false;
    return need === 'admin' ? admin : true;
  };
  const visiblePage: Page = allowed(page) ? page : current ? 'home' : 'settings';

  const go = (next: Page, options?: { kind?: MailKind }) => {
    if (!allowed(next)) return;
    const kindChange = next === 'add' && options?.kind && options.kind !== addKind;
    if (next === visiblePage && !kindChange) return;
    transition(() => {
      if (options?.kind) setAddKind(options.kind);
      setPage(next);
      setVisit((v) => v + 1);
      window.scrollTo({ top: 0 });
    });
  };

  const changeUnit = (next: string) =>
    transition(() => {
      setUnitOverride(null);
      setUnit(next);
    });

  const refresh = () => {
    reload().catch((e: unknown) => notify(e instanceof Error ? e.message : String(e)));
  };

  if (!current && !generalAdmin) return <NoAccess session={session} />;

  const props: PageProps | null = current
    ? { session, unit, repo: current.repo, admin, addKind, go, notify }
    : null;

  return (
    <div className="app">
      <header className={`bar ${stacked ? 'is-stacked' : ''}`} ref={barRef}>
        <button
          type="button"
          className="brand"
          aria-label={`${unit ? `${unit} ` : ''}${APP_TITLE}, home`}
          onClick={() => go(current ? 'home' : 'settings')}
        >
          <img className="brand-logo" src={wordmarkUrl} alt="Bank ABC" width={161} height={30} />
          <img className="brand-mark-img" src={markUrl} alt="Bank ABC" width={41} height={28} />
          <span className="brand-name">
            {unit} {APP_TITLE}
          </span>
        </button>

        <nav className="nav" aria-label="Pages">
          {NAV.filter((n) => allowed(n.page)).map((n) => (
            <button
              key={n.page}
              type="button"
              className={`nav-item ${n.access !== 'unit' ? 'nav-desk' : ''}`}
              aria-current={visiblePage === n.page ? 'page' : undefined}
              onClick={() => go(n.page)}
            >
              {n.label}
            </button>
          ))}
        </nav>

        <div className="bar-end">
          {units.length > 1 &&
            (units.length <= 3 ? (
              <Segmented
                label="Unit"
                size="sm"
                value={unit}
                onChange={changeUnit}
                options={units.map((u) => ({ value: u.name, label: u.name }))}
              />
            ) : (
              <select className="unit-select" aria-label="Unit" value={unit} onChange={(e) => changeUnit(e.target.value)}>
                {units.map((u) => (
                  <option key={u.name}>{u.name}</option>
                ))}
              </select>
            ))}
          {(generalAdmin || admin) && <span className="role-badge">{generalAdmin ? 'General admin' : 'Admin'}</span>}
          <span className="avatar" title={`${user.name} (${user.email})`}>
            {initials(user.name)}
          </span>
        </div>
      </header>

      <main className="main" key={unit}>
        {props && visiblePage === 'home' && <Home {...props} />}
        {props && visiblePage === 'mine' && <MyMail {...props} />}
        {props && visiblePage === 'department' && <DepartmentMail {...props} />}
        {props && visiblePage === 'add' && <LogMail key={`add-${visit}`} {...props} />}
        {props && visiblePage === 'maintenance' && <Manage {...props} />}
        {visiblePage === 'settings' && generalAdmin && <Settings session={session} notify={notify} onChanged={refresh} />}
      </main>

      <div className="toast-region" aria-live="polite">
        {toast && (
          <div key={toast.id} className="toast">
            {toast.text}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Puts the page links on their own row when they don't fit beside the brand
 * and the controls (more pages for admins, a unit switcher, a narrow window).
 */
function useStackedBar() {
  const barRef = useRef<HTMLElement>(null);
  const [stacked, setStacked] = useState(false);
  useLayoutEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    const measure = () => {
      if (window.matchMedia('(max-width: 900px)').matches) return setStacked(false);
      const parts = Array.from(bar.children) as HTMLElement[];
      // The links' natural width, whichever row they're on.
      const width = (el: HTMLElement) => {
        if (!el.classList.contains('nav')) return el.getBoundingClientRect().width;
        const items = el.children;
        if (items.length === 0) return 0;
        return items[items.length - 1].getBoundingClientRect().right - items[0].getBoundingClientRect().left;
      };
      const style = getComputedStyle(bar);
      const gaps = 20 * Math.max(parts.length - 1, 0);
      const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const needed = parts.reduce((sum, el) => sum + width(el), 0) + gaps + padding + 8;
      setStacked(needed > bar.clientWidth);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    Array.from(bar.children).forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  });
  return { barRef, stacked };
}

/** Shown to people who can't open any unit. */
function NoAccess({ session }: { session: Session }) {
  const { user, blocked } = session;
  const locked = blocked.filter((b) => b.reason === 'no-permission').map((b) => b.name);
  const waiting = blocked.filter((b) => b.reason === 'not-connected').map((b) => b.name);
  const list = (names: string[]) => names.join(', ');
  return (
    <div className="boot no-access" role="alert">
      <img className="boot-mark" src={tileUrl} alt="" width={72} height={72} />
      {locked.length > 0 ? (
        <>
          <h1>You can’t open the {list(locked)} mail room yet</h1>
          <p>
            You’re in {list(locked)}, but SharePoint doesn’t let <strong>{user.email}</strong> open the unit’s mail lists. Ask the
            site owner to give you access, then open the app again.
          </p>
        </>
      ) : waiting.length > 0 ? (
        <>
          <h1>The {list(waiting)} mail room isn’t set up yet</h1>
          <p>You’re in {list(waiting)}. It will appear here as soon as its lists are added to the app.</p>
        </>
      ) : (
        <>
          <h1>You don’t have access to a mail room yet</h1>
          <p>
            Ask a general admin to add <strong>{user.email}</strong> to your unit in Mail Room Settings, then open the app again.
          </p>
        </>
      )}
    </div>
  );
}
