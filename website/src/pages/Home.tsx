import { useEffect, useMemo, useState } from 'react';
import { MAX_WAITING } from '../config';
import { departmentKey } from '../data/rules';
import { mailKey } from '../data/types';
import { firstName, greeting, plural } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { useStored } from '../lib/stored';
import { BoxIcon, EnvelopeIcon, GearIcon, PlusIcon, UsersIcon } from '../components/icons';
import { Slip } from '../components/Slip';
import type { PageProps } from './shared';

export function Home({ session, unit, repo, admin, go, notify }: PageProps) {
  const { user, directory } = session;
  const [storedDept, setMyDept] = useStored<string>('department', '');
  const myDept = storedDept === '*' ? '' : storedDept;

  const mine = useAsync(
    () => repo.list({ kind: 'Personal', recipientEmail: [user.email, ...user.aliases], status: 'Waiting' }, 100),
    [repo],
  );
  const unitWaiting = useAsync(() => repo.list({ status: 'Waiting' }, MAX_WAITING), [repo]);

  // Default the department from the directory the first time.
  useEffect(() => {
    if (storedDept) return;
    let cancelled = false;
    void directory.myDepartment().then((d) => {
      if (!cancelled && d) setMyDept(d);
    });
    return () => {
      cancelled = true;
    };
  }, [directory, storedDept, setMyDept]);

  const waiting = mine.data ?? [];
  const stats = useMemo(() => {
    const open = unitWaiting.data ?? [];
    return {
      dept: myDept
        ? open.filter((i) => i.kind === 'Department' && departmentKey(i.department) === departmentKey(myDept)).length
        : null,
      personal: open.filter((i) => i.kind === 'Personal').length,
      department: open.filter((i) => i.kind === 'Department').length,
    };
  }, [unitWaiting.data, myDept]);

  const [hello] = useState(() => `${greeting()}, ${firstName(user.name)}`);

  return (
    <div className="page home">
      <header className="home-head">
        <h1 className="display">{hello}</h1>
        <p className="lede" aria-live="polite">
          {mine.loading && !mine.data
            ? `Checking the ${unit} mail room for you…`
            : waiting.length === 0
              ? `You have no personal mail waiting at the ${unit} mail room.`
              : `${plural(waiting.length, 'delivery', 'deliveries')} ${waiting.length === 1 ? 'is' : 'are'} waiting for you at the ${unit} mail room.`}
        </p>
      </header>

      {mine.error && <p className="error-box" role="alert">{mine.error}</p>}

      {waiting.length > 0 && (
        <ul className="slips">
          {waiting.map((item, i) => (
            <Slip
              key={mailKey(item)}
              item={item}
              index={i}
              leaveOnConfirm
              onConfirm={async () => {
                await repo.receive(item, user);
              }}
              onSettled={() => {
                notify(`Marked ${item.courierCompany} ${item.courierNumber} as received`);
                void mine.reload();
                void unitWaiting.reload();
              }}
            />
          ))}
        </ul>
      )}

      <nav className="tiles" aria-label="Go to">
        <button type="button" className="tile" onClick={() => go('mine')}>
          <EnvelopeIcon width={26} height={26} />
          <span className="tile-title">My Personal Mail</span>
          <span className="tile-text">Find your personal delivery</span>
        </button>
        <button type="button" className="tile" onClick={() => go('department')}>
          <BoxIcon width={26} height={26} />
          <span className="tile-title">Department Mail</span>
          <span className="tile-text">
            {myDept && stats.dept !== null ? `${myDept}: ${stats.dept} not received` : 'Find delivery for department'}
          </span>
        </button>
      </nav>

      {admin && (
        <>
          <h2 className="section-title desk-title">Mail room admin</h2>
          <nav className="tiles tiles-desk" aria-label="Mail room admin">
            <button type="button" className="tile tile-desk" onClick={() => go('add', { kind: 'Personal' })}>
              <PlusIcon width={26} height={26} />
              <span className="tile-title">Add Personal Mail</span>
              <span className="tile-text">Register new personal delivery and notify individuals</span>
            </button>
            <button type="button" className="tile tile-desk" onClick={() => go('add', { kind: 'Department' })}>
              <PlusIcon width={26} height={26} />
              <span className="tile-title">Add Department Mail</span>
              <span className="tile-text">Register new delivery and notify department</span>
            </button>
            <button type="button" className="tile tile-desk" onClick={() => go('maintenance')}>
              <GearIcon width={26} height={26} />
              <span className="tile-title">Maintenance</span>
              <span className="tile-text">
                {unitWaiting.data
                  ? `${stats.personal} personal and ${stats.department} department not received in ${unit}`
                  : 'Edit details related to delivery'}
              </span>
            </button>
            {session.generalAdmin && (
              <button type="button" className="tile tile-desk" onClick={() => go('settings')}>
                <UsersIcon width={26} height={26} />
                <span className="tile-title">Settings</span>
                <span className="tile-text">
                  {`${plural(session.data.units.length, 'unit', 'units')} and ${plural(new Set(session.data.members.map((m) => m.email)).size, 'person', 'people')}. Add units, users and admins`}
                </span>
              </button>
            )}
          </nav>
        </>
      )}
    </div>
  );
}
