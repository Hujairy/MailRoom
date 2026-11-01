import { useEffect, useMemo, useState } from 'react';
import { COURIERS, DEPARTMENTS } from '../config';
import { departmentKey, departmentOptions, loadUnit } from '../data/rules';
import { localDay } from '../lib/format';
import { useStored } from '../lib/stored';
import { useAsync } from '../lib/useAsync';
import { BoxIcon, SearchIcon } from '../components/icons';
import { PageHead } from '../components/PageHead';
import { Segmented } from '../components/Segmented';
import { Slip } from '../components/Slip';
import { SlipSkeleton } from './MyMail';
import type { PageProps } from './shared';

type Show = 'Waiting' | 'Collected' | 'All';
/** '' means not chosen yet (defaults from the directory); ALL means every department. */
const ALL = '*';

export function DepartmentMail({ session, unit, notify }: PageProps) {
  const { user, repo, directory } = session;
  const [stored, setDept] = useStored<string>('department', '');
  const dept = stored === ALL ? '' : stored;
  const [show, setShow] = useStored<Show>('department:show', 'Waiting');
  const [query, setQuery] = useState('');
  const [courier, setCourier] = useState('');
  const [day, setDay] = useState('');

  const items = useAsync(() => loadUnit(repo, unit, 'Department'), [repo, unit]);
  const all = useMemo(() => items.data ?? [], [items.data]);
  const departments = useMemo(() => departmentOptions(all, DEPARTMENTS), [all]);
  const couriers = useMemo(
    () => [...new Set([...COURIERS, ...all.map((i) => i.courierCompany).filter(Boolean)].map((c) => c.trim()))],
    [all],
  );

  useEffect(() => {
    if (stored) return;
    let cancelled = false;
    void directory.myDepartment().then((d) => {
      if (!cancelled) setDept(d ?? ALL);
    });
    return () => {
      cancelled = true;
    };
  }, [directory, stored, setDept]);

  const selectedDept = dept ? (departments.find((d) => departmentKey(d) === departmentKey(dept)) ?? dept) : ALL;

  const inDept = useMemo(
    () => (dept ? all.filter((i) => departmentKey(i.department) === departmentKey(dept)) : all),
    [all, dept],
  );
  const counts = {
    Waiting: inDept.filter((i) => i.status === 'Waiting').length,
    Collected: inDept.filter((i) => i.status === 'Collected').length,
    All: inDept.length,
  };

  const q = query.trim().toLowerCase();
  const visible = inDept.filter(
    (i) =>
      (show === 'All' || i.status === show) &&
      (!courier || i.courierCompany.trim().toLowerCase() === courier.toLowerCase()) &&
      (!day || localDay(i.created) === day) &&
      (!q || [i.courierNumber, i.sender, i.department, i.courierCompany].some((f) => f.toLowerCase().includes(q))),
  );
  const filtered = !!(q || courier || day);

  return (
    <div className="page">
      <PageHead
        title="Department mail"
        text={`Deliveries addressed to departments at the ${unit} mail room. Anyone in the department can confirm collection.`}
        loading={items.loading}
        onRefresh={() => void items.reload()}
      />

      <div className="toolbar">
        <label className="field field-dept">
          <span className="field-label">Department</span>
          <select value={selectedDept} onChange={(e) => setDept(e.target.value)}>
            <option value={ALL}>All departments</option>
            {dept && !departments.includes(selectedDept) && <option value={dept}>{dept}</option>}
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <Segmented
          label="Show"
          value={show}
          onChange={setShow}
          options={[
            { value: 'Waiting', label: 'Waiting', count: counts.Waiting },
            { value: 'Collected', label: 'Collected', count: counts.Collected },
            { value: 'All', label: 'All', count: counts.All },
          ]}
        />
      </div>

      <div className="filters">
        <label className="search">
          <SearchIcon />
          <span className="sr-only">Search department mail</span>
          <input type="search" value={query} placeholder="Courier number or sender" onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label className="field-inline">
          <span className="sr-only">Courier</span>
          <select value={courier} onChange={(e) => setCourier(e.target.value)}>
            <option value="">Any courier</option>
            {couriers.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="field-inline">
          <span className="sr-only">Logged on</span>
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </label>
        {filtered && (
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setQuery('');
              setCourier('');
              setDay('');
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {items.error && <p className="error-box" role="alert">{items.error}</p>}

      {!items.data && items.loading ? (
        <SlipSkeleton />
      ) : visible.length === 0 ? (
        <div className="empty">
          <BoxIcon width={30} height={30} />
          <p>
            {filtered
              ? 'No deliveries match these filters.'
              : show === 'Waiting'
                ? `Nothing is waiting for ${dept || 'any department'} right now.`
                : 'No deliveries to show yet.'}
          </p>
        </div>
      ) : (
        <ul className="slips" key={`${show}-${dept}`}>
          {visible.slice(0, 120).map((item, i) => (
            <Slip
              key={item.id}
              item={item}
              index={i}
              showFor={!dept}
              leaveOnConfirm={show === 'Waiting'}
              onConfirm={item.status === 'Waiting' ? async () => void (await repo.collect(item.id, user)) : undefined}
              onSettled={() => {
                notify(`Collected ${item.courierCompany} ${item.courierNumber} for ${item.department}`);
                void items.reload();
              }}
            />
          ))}
        </ul>
      )}
      {visible.length > 120 && <p className="more-note">Showing the newest 120. Use the filters to find older deliveries.</p>}
    </div>
  );
}
