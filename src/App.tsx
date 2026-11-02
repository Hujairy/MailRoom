import { useEffect, useState } from 'react';
import { APP_TITLE } from './config';
import { openSession, type Session, type UnitAccess } from './data';
import { DemoRepository } from './data/demo';
import type { CurrentUser } from './data/types';
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
import type { MailKind } from './data/types';
import { PAGES, type Page, type PageProps } from './pages/shared';

const NAV: { page: Page; label: string; admin?: boolean }[] = [
  { page: 'home', label: 'Home' },
  { page: 'mine', label: 'My Personal Mail' },
  { page: 'department', label: 'Department Mail' },
  { page: 'add', label: 'Add Mail', admin: true },
  { page: 'maintenance', label: 'Maintenance', admin: true },
];

const ADMIN_PAGES: Page[] = ['add', 'maintenance'];

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    openSession().then(
      (s) => !cancelled && setSession(s),
      (e: unknown) => !cancelled && setFatal(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      cancelled = true;
    };
  }, []);

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
  return <Shell session={session} />;
}

function Shell({ session }: { session: Session }) {
  const { user, params, mode } = session;

  // In demo mode, try both sides: an employee only belongs to the first unit;
  // an admin manages every unit.
  const [demoRole, setDemoRole] = useStored<'employee' | 'admin'>('demo:as', 'admin');
  const units: UnitAccess[] =
    mode === 'demo'
      ? demoRole === 'admin'
        ? session.units.map((u) => ({ ...u, admin: true }))
        : session.units.slice(0, 1).map((u) => ({ ...u, admin: false }))
      : session.units;

  const [storedUnit, setUnit] = useStored<string>('unit', '');
  const paramUnit = units.find((u) => u.config.name.toLowerCase() === (params.unit ?? '').toLowerCase());
  const [unitOverride, setUnitOverride] = useState(paramUnit?.config.name ?? null);
  const current = units.find((u) => u.config.name === (unitOverride ?? storedUnit)) ?? units[0];
  const unit = current?.config.name ?? '';
  const admin = current?.admin ?? false;

  const initialPage = PAGES.find((p) => p === params.page) ?? 'home';
  const [page, setPage] = useState<Page>(initialPage);
  const [addKind, setAddKind] = useState<MailKind>(params.kind?.toLowerCase() === 'department' ? 'Department' : 'Personal');
  const [visit, setVisit] = useState(0);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [resetKey, setResetKey] = useState(0);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(timer);
  }, [toast]);

  // Admin pages don't exist for anyone else: no navigation, no tiles, no links.
  const visiblePage: Page = !admin && ADMIN_PAGES.includes(page) ? 'home' : page;

  const go = (next: Page, options?: { kind?: MailKind }) => {
    if (!admin && ADMIN_PAGES.includes(next)) return;
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

  if (!current) return <NoAccess user={user} />;

  const props: PageProps = {
    session,
    unit,
    repo: current.repo,
    admin,
    addKind,
    go,
    notify: (text) => setToast({ id: Date.now(), text }),
  };

  return (
    <div className="app">
      <header className="bar">
        <button type="button" className="brand" aria-label={`${unit} ${APP_TITLE}, home`} onClick={() => go('home')}>
          <img className="brand-logo" src={wordmarkUrl} alt="Bank ABC" width={161} height={30} />
          <img className="brand-mark-img" src={markUrl} alt="Bank ABC" width={41} height={28} />
          <span className="brand-name">
            {unit} {APP_TITLE}
          </span>
        </button>

        <nav className="nav" aria-label="Pages">
          {NAV.filter((n) => !n.admin || admin).map((n) => (
            <button
              key={n.page}
              type="button"
              className={`nav-item ${n.admin ? 'nav-desk' : ''}`}
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
                options={units.map((u) => ({ value: u.config.name, label: u.config.name }))}
              />
            ) : (
              <select className="unit-select" aria-label="Unit" value={unit} onChange={(e) => changeUnit(e.target.value)}>
                {units.map((u) => (
                  <option key={u.config.name}>{u.config.name}</option>
                ))}
              </select>
            ))}
          {admin && <span className="role-badge">Admin</span>}
          <span className="avatar" title={`${user.name} (${user.email})`}>
            {initials(user.name)}
          </span>
        </div>
      </header>

      {mode === 'demo' && (
        <div className="demo-strip" role="note">
          <p>
            <strong>Demo data</strong>, saved in this browser only.{' '}
            {demoRole === 'admin'
              ? 'As an admin you manage every unit.'
              : `As an employee you only see ${unit}, and no admin pages.`}
          </p>
          <Segmented
            label="View as"
            size="sm"
            value={demoRole}
            onChange={(r) =>
              transition(() => {
                setDemoRole(r);
                setUnitOverride(null);
              })
            }
            options={[
              { value: 'employee', label: 'Employee' },
              { value: 'admin', label: 'Admin' },
            ]}
          />
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              session.units.forEach((u) => u.repo instanceof DemoRepository && u.repo.reset());
              setResetKey((k) => k + 1);
              setToast({ id: Date.now(), text: 'Demo data reset' });
            }}
          >
            Reset demo data
          </button>
        </div>
      )}

      <main className="main" key={`${unit}-${resetKey}`}>
        {visiblePage === 'home' && <Home {...props} />}
        {visiblePage === 'mine' && <MyMail {...props} />}
        {visiblePage === 'department' && <DepartmentMail {...props} />}
        {visiblePage === 'add' && <LogMail key={`add-${visit}`} {...props} />}
        {visiblePage === 'maintenance' && <Manage {...props} />}
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

/** Shown to people who can't open any unit's lists. */
function NoAccess({ user }: { user: CurrentUser }) {
  return (
    <div className="boot no-access" role="alert">
      <img className="boot-mark" src={tileUrl} alt="" width={72} height={72} />
      <h1>You don’t have access to a mail room yet</h1>
      <p>
        Ask your unit’s mail room admin to give <strong>{user.email}</strong> access to the unit’s mail lists, then open the app
        again.
      </p>
    </div>
  );
}
