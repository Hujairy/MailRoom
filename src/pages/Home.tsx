import { useEffect, useMemo, useState } from 'react';
import { MAX_WAITING } from '../config';
import { departmentKey } from '../data/rules';
import { firstName, greeting, plural } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { useStored } from '../lib/stored';
import { BoxIcon, EnvelopeIcon, ListIcon, PlusIcon } from '../components/icons';
import { Slip } from '../components/Slip';
import type { PageProps } from './shared';

export function Home({ session, unit, staff, go, notify }: PageProps) {
  const { user, repo, directory } = session;
  const [storedDept, setMyDept] = useStored<string>('department', '');
  const myDept = storedDept === '*' ? '' : storedDept;

  const mine = useAsync(() => repo.list({ unit, kind: 'Personal', recipientEmail: user.email, status: 'Waiting' }, 100), [repo, unit]);
  const unitWaiting = useAsync(() => repo.list({ unit, status: 'Waiting' }, MAX_WAITING), [repo, unit]);

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
      dept: myDept ? open.filter((i) => i.kind === 'Department' && departmentKey(i.department) === departmentKey(myDept)).length : null,
      unitWaiting: open.length,
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
              ? `Nothing is waiting for you at the ${unit} mail room.`
              : `${plural(waiting.length, 'delivery', 'deliveries')} ${waiting.length === 1 ? 'is' : 'are'} waiting for you at the ${unit} mail room.`}
        </p>
      </header>

      {mine.error && <p className="error-box" role="alert">{mine.error}</p>}

      {waiting.length > 0 && (
        <ul className="slips">
          {waiting.map((item, i) => (
            <Slip
              key={item.id}
              item={item}
              index={i}
              leaveOnConfirm
              onConfirm={async () => {
                await repo.collect(item.id, user);
              }}
              onSettled={() => {
                notify(`Collected ${item.courierCompany} ${item.courierNumber}`);
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
          <span className="tile-title">My mail</span>
          <span className="tile-text">Everything delivered to you, waiting and collected</span>
        </button>
        <button type="button" className="tile" onClick={() => go('department')}>
          <BoxIcon width={26} height={26} />
          <span className="tile-title">Department mail</span>
          <span className="tile-text">
            {myDept
              ? stats.dept === null
                ? myDept
                : `${myDept}: ${stats.dept} waiting`
              : 'Deliveries addressed to a department'}
          </span>
        </button>
        {staff && (
          <>
            <button type="button" className="tile tile-desk" onClick={() => go('log')}>
              <PlusIcon width={26} height={26} />
              <span className="tile-title">Log a delivery</span>
              <span className="tile-text">Register personal or department mail</span>
            </button>
            <button type="button" className="tile tile-desk" onClick={() => go('manage')}>
              <ListIcon width={26} height={26} />
              <span className="tile-title">Manage deliveries</span>
              <span className="tile-text">
                {unitWaiting.data ? `${stats.unitWaiting} waiting in ${unit}` : 'Edit details and record collections'}
              </span>
            </button>
          </>
        )}
      </nav>
    </div>
  );
}
