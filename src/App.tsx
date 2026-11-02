import { useEffect, useState } from 'react';
import { APP_TITLE, DEFAULT_UNIT, UNITS } from './config';
import { openSession, type Session } from './data';
import { DemoRepository } from './data/demo';
import { isStaff } from './data/rules';
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

const NAV: { page: Page; label: string; staff?: boolean }[] = [
  { page: 'home', label: 'Home' },
  { page: 'mine', label: 'My Personal Mail' },
  { page: 'department', label: 'Department Mail' },
  { page: 'add', label: 'Add Mail', staff: true },
  { page: 'maintenance', label: 'Maintenance', staff: true },
];

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
  const { user, repo, params } = session;
  const [storedUnit, setUnit] = useStored<string>('unit', DEFAULT_UNIT);
  const paramUnit = UNITS.find((u) => u.toLowerCase() === (params.unit ?? '').toLowerCase());
  const [unitOverride, setUnitOverride] = useState(paramUnit ?? null);
  const unit = unitOverride ?? (UNITS.includes(storedUnit) ? storedUnit : (UNITS[0] ?? DEFAULT_UNIT));

  const [demoRole, setDemoRole] = useStored<'staff' | 'employee'>('demo:role', 'staff');
  const staff = repo.mode === 'demo' ? demoRole === 'staff' : isStaff(user, unit);

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

  const visiblePage: Page = !staff && (page === 'add' || page === 'maintenance') ? 'home' : page;

  const go = (next: Page, options?: { kind?: MailKind }) => {
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

  const props: PageProps = {
    session,
    unit,
    staff,
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
          {NAV.filter((n) => !n.staff || staff).map((n) => (
            <button
              key={n.page}
              type="button"
              className={`nav-item ${n.staff ? 'nav-desk' : ''}`}
              aria-current={visiblePage === n.page ? 'page' : undefined}
              onClick={() => go(n.page)}
            >
              {n.label}
            </button>
          ))}
        </nav>

        <div className="bar-end">
          {UNITS.length > 1 &&
            (UNITS.length <= 3 ? (
              <Segmented
                label="Mail room"
                size="sm"
                value={unit}
                onChange={changeUnit}
                options={UNITS.map((u) => ({ value: u, label: u }))}
              />
            ) : (
              <select className="unit-select" aria-label="Mail room" value={unit} onChange={(e) => changeUnit(e.target.value)}>
                {UNITS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
            ))}
          <span className="avatar" title={`${user.name} (${user.email})`}>
            {initials(user.name)}
          </span>
        </div>
      </header>

      {repo.mode === 'demo' && (
        <div className="demo-strip" role="note">
          <p>
            <strong>Demo data</strong>, saved in this browser only{user.fromPowerApps ? '' : ' (you’re a demo user outside Power Apps)'}.
          </p>
          <Segmented
            label="View as"
            size="sm"
            value={demoRole}
            onChange={(r) => transition(() => setDemoRole(r))}
            options={[
              { value: 'employee', label: 'Employee' },
              { value: 'staff', label: 'Mail room staff' },
            ]}
          />
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              if (repo instanceof DemoRepository) repo.reset();
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
