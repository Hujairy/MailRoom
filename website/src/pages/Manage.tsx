import { useMemo, useState } from 'react';
import { COURIERS, DEPARTMENTS } from '../config';
import { departmentKey, departmentOptions, loadUnit, uniqueOptions } from '../data/rules';
import { mailKey, type MailItem, type MailKind } from '../data/types';
import { formatDateTime, localDay } from '../lib/format';
import { useStored } from '../lib/stored';
import { useAsync } from '../lib/useAsync';
import { ListIcon, PencilIcon } from '../components/icons';
import { EditDrawer } from '../components/EditDrawer';
import { PageHead } from '../components/PageHead';
import { ReceivedFilter, type Show } from '../components/ReceivedFilter';
import { Segmented } from '../components/Segmented';
import type { PageProps } from './shared';

const same = (a: string, b: string) => departmentKey(a) === departmentKey(b);

/** Maintenance: the original list columns, with an edit button per delivery. */
export function Manage({ session, unit, repo, notify }: PageProps) {
  const [kind, setKind] = useStored<MailKind>('maintenance:kind', 'Department');
  const [show, setShow] = useStored<Show>('maintenance:received', 'Waiting');
  const [number, setNumber] = useState('');
  const [forWhom, setForWhom] = useState('');
  const [courier, setCourier] = useState('');
  const [sender, setSender] = useState('');
  const [day, setDay] = useState('');
  const [editing, setEditing] = useState<MailItem | null>(null);

  const items = useAsync(() => loadUnit(repo, kind), [repo, kind]);
  const all = useMemo(() => items.data ?? [], [items.data]);
  const forOptions = useMemo(
    () => (kind === 'Department' ? departmentOptions(all, DEPARTMENTS) : uniqueOptions(all.map((i) => i.recipient))),
    [all, kind],
  );
  const couriers = useMemo(() => uniqueOptions(all.map((i) => i.courierCompany), COURIERS), [all]);
  const senders = useMemo(() => uniqueOptions(all.map((i) => i.sender)), [all]);

  const q = number.trim().toLowerCase().replace(/\s+/g, '');
  const forValue = (i: MailItem) => (kind === 'Department' ? i.department : i.recipient);
  const visible = all.filter(
    (i) =>
      (show === 'All' || i.status === show) &&
      (!forWhom || same(forValue(i), forWhom)) &&
      (!courier || same(i.courierCompany, courier)) &&
      (!sender || same(i.sender, sender)) &&
      (!day || localDay(i.created) === day) &&
      (!q || i.courierNumber.toLowerCase().replace(/\s+/g, '').includes(q) || i.id === number.trim()),
  );
  const filtered = !!(q || forWhom || courier || sender || day);

  function clear() {
    setNumber('');
    setForWhom('');
    setCourier('');
    setSender('');
    setDay('');
  }

  const forLabel = kind === 'Department' ? 'Department' : 'Recipient';
  const senderLabel = kind === 'Department' ? 'Sender Company' : 'Sender';

  return (
    <div className="page page-wide">
      <PageHead
        title="Maintenance"
        text={`Edit details related to delivery at the ${unit} mail room.`}
        loading={items.loading}
        onRefresh={() => void items.reload()}
      >
        <Segmented
          label="List"
          value={kind}
          onChange={(k) => {
            setKind(k);
            clear();
          }}
          options={[
            { value: 'Personal', label: 'Personal Mail' },
            { value: 'Department', label: 'Department Mail' },
          ]}
        />
      </PageHead>

      <div className="filter-grid panel" role="search" aria-label="Filter deliveries">
        <label className="field">
          <span className="field-label">Courier Number</span>
          <input type="search" value={number} placeholder="Any" onChange={(e) => setNumber(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">{forLabel}</span>
          <select value={forWhom} onChange={(e) => setForWhom(e.target.value)}>
            <option value="">Any</option>
            {forOptions.map((d) => (
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
          <span className="field-label">{senderLabel}</span>
          <select value={sender} onChange={(e) => setSender(e.target.value)}>
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
          <ReceivedFilter value={show} onChange={setShow} items={all} />
        </div>
        {filtered && (
          <button type="button" className="link-btn filter-clear" onClick={clear}>
            Clear filters
          </button>
        )}
      </div>

      {items.error && <p className="error-box" role="alert">{items.error}</p>}

      {!items.data && items.loading ? (
        <div className="table-skeleton" aria-hidden="true" />
      ) : visible.length === 0 ? (
        <div className="empty">
          <ListIcon width={30} height={30} />
          <p>{filtered ? 'No deliveries match these filters.' : 'No deliveries to show.'}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <div className="table-scroll">
            <table className="table">
              <caption className="sr-only">{kind === 'Department' ? 'Department Mail' : 'Personal Mail'}</caption>
              <thead>
                <tr>
                  <th scope="col">ID</th>
                  <th scope="col">Courier Number</th>
                  <th scope="col">Courier Company</th>
                  {kind === 'Department' ? (
                    <>
                      <th scope="col">Department</th>
                      <th scope="col">Sender Company</th>
                    </>
                  ) : (
                    <>
                      <th scope="col">Sender</th>
                      <th scope="col">Recipient</th>
                      <th scope="col">On Behalf</th>
                    </>
                  )}
                  <th scope="col">Creation Time Stamp</th>
                  <th scope="col">Created By</th>
                  <th scope="col">Received</th>
                  <th scope="col">Received By</th>
                  <th scope="col">Received Time Stamp</th>
                  <th scope="col">
                    <span className="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.slice(0, 300).map((i) => (
                  <tr key={mailKey(i)} data-status={i.status.toLowerCase()} onClick={() => setEditing(i)}>
                    <td data-label="ID" className="num">
                      {i.id}
                    </td>
                    <td data-label="Courier Number" className="strong num">
                      {i.courierNumber}
                    </td>
                    <td data-label="Courier Company">{i.courierCompany}</td>
                    {kind === 'Department' ? (
                      <>
                        <td data-label="Department">{i.department}</td>
                        <td data-label="Sender Company">{i.sender}</td>
                      </>
                    ) : (
                      <>
                        <td data-label="Sender">{i.sender}</td>
                        <td data-label="Recipient">{i.recipient || i.recipientEmail}</td>
                        <td data-label="On Behalf">{i.onBehalf}</td>
                      </>
                    )}
                    <td data-label="Creation Time Stamp" className="num">
                      {formatDateTime(i.created)}
                    </td>
                    <td data-label="Created By">{i.createdBy}</td>
                    <td data-label="Received" className="received-cell">
                      <span className="status-dot" />
                      {i.status === 'Received' ? 'Yes' : 'No'}
                    </td>
                    <td data-label="Received By">{i.receivedBy}</td>
                    <td data-label="Received Time Stamp" className="num">
                      {i.receivedTimeStamp ? formatDateTime(i.receivedTimeStamp) : ''}
                    </td>
                    <td className="edit-cell">
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Edit ${i.courierNumber}`}
                        title="Edit"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(i);
                        }}
                      >
                        <PencilIcon width={18} height={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="more-note">
            {visible.length > 300 ? `Showing 300 of ${visible.length}. Use the filters to narrow down.` : `${visible.length} deliveries`}
          </p>
        </div>
      )}

      <EditDrawer
        item={editing}
        session={session}
        repo={repo}
        onClose={() => setEditing(null)}
        onSaved={(message) => {
          notify(message);
          setEditing(null);
          void items.reload();
        }}
      />
    </div>
  );
}
