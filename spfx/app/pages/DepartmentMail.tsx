/* eslint-disable */
import * as React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { COURIERS, DEPARTMENTS } from '../config';
import { departmentKey, departmentOptions, loadUnit, uniqueOptions } from '../data/rules';
import { mailKey } from '../data/types';
import { localDay } from '../lib/format';
import { useStored } from '../lib/stored';
import { useAsync } from '../lib/useAsync';
import { BoxIcon } from '../components/icons';
import { PageHead } from '../components/PageHead';
import { ReceivedFilter, type Show } from '../components/ReceivedFilter';
import { Slip } from '../components/Slip';
import { SlipSkeleton } from './MyMail';
import type { PageProps } from './shared';

/** '' means not chosen yet (defaults from the directory); ALL means every department. */
const ALL = '*';
const same = (a: string, b: string) => departmentKey(a) === departmentKey(b);

export function DepartmentMail({ session, unit, repo, notify }: PageProps) {
  const { user, directory } = session;
  const [stored, setDept] = useStored<string>('department', '');
  const dept = stored === ALL ? '' : stored;
  const [show, setShow] = useStored<Show>('department:received', 'Waiting');
  const [number, setNumber] = useState('');
  const [courier, setCourier] = useState('');
  const [senderCompany, setSenderCompany] = useState('');
  const [day, setDay] = useState('');

  const items = useAsync(() => loadUnit(repo, 'Department'), [repo]);
  const all = useMemo(() => items.data ?? [], [items.data]);
  const departments = useMemo(() => departmentOptions(all, DEPARTMENTS), [all]);
  const couriers = useMemo(() => uniqueOptions(all.map((i) => i.courierCompany), COURIERS), [all]);
  const senders = useMemo(() => uniqueOptions(all.map((i) => i.sender)), [all]);

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

  const selectedDept = dept ? (departments.find((d) => same(d, dept)) ?? dept) : ALL;
  const inDept = useMemo(() => (dept ? all.filter((i) => same(i.department, dept)) : all), [all, dept]);

  const q = number.trim().toLowerCase().replace(/\s+/g, '');
  const visible = inDept.filter(
    (i) =>
      (show === 'All' || i.status === show) &&
      (!courier || same(i.courierCompany, courier)) &&
      (!senderCompany || same(i.sender, senderCompany)) &&
      (!day || localDay(i.created) === day) &&
      (!q || i.courierNumber.toLowerCase().replace(/\s+/g, '').includes(q)),
  );
  const filtered = !!(q || courier || senderCompany || day);

  return (
    <div className="page">
      <PageHead
        title="Department Mail"
        text={`Find delivery for department at the ${unit} mail room. Anyone in the department can mark it as received.`}
        loading={items.loading}
        onRefresh={() => void items.reload()}
      />

      <div className="filter-grid panel" role="search" aria-label="Filter department mail">
        <label className="field">
          <span className="field-label">Courier Number</span>
          <input type="search" value={number} placeholder="Any" onChange={(e) => setNumber(e.target.value)} />
        </label>
        <label className="field">
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
        <label className="field">
          <span className="field-label">Date</span>
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Courier Company</span>
          <select value={courier} onChange={(e) => setCourier(e.target.value)}>
            <option value="">Any</option>
            {couriers.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Sender Company</span>
          <select value={senderCompany} onChange={(e) => setSenderCompany(e.target.value)}>
            <option value="">Any</option>
            {senders.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          <span className="field-label">Received</span>
          <ReceivedFilter value={show} onChange={setShow} items={inDept} />
        </div>
        {filtered && (
          <button
            type="button"
            className="link-btn filter-clear"
            onClick={() => {
              setNumber('');
              setCourier('');
              setSenderCompany('');
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
                ? `No mail is waiting for ${dept || 'any department'} right now.`
                : 'No deliveries to show yet.'}
          </p>
        </div>
      ) : (
        <ul className="slips" key={`${show}-${dept}`}>
          {visible.slice(0, 120).map((item, i) => (
            <Slip
              key={mailKey(item)}
              item={item}
              index={i}
              showFor
              leaveOnConfirm={show === 'Waiting'}
              onConfirm={item.status === 'Waiting' ? async () => void (await repo.receive(item, user)) : undefined}
              onSettled={() => {
                notify(`Marked ${item.courierCompany} ${item.courierNumber} as received for ${item.department}`);
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
