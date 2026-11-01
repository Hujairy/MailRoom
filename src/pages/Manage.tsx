import { useMemo, useState } from 'react';
import { COURIERS } from '../config';
import { loadUnit } from '../data/rules';
import type { MailItem, MailKind } from '../data/types';
import { formatDateTime, localDay, timeAgo } from '../lib/format';
import { useStored } from '../lib/stored';
import { useAsync } from '../lib/useAsync';
import { ListIcon, SearchIcon } from '../components/icons';
import { EditDrawer } from '../components/EditDrawer';
import { PageHead } from '../components/PageHead';
import { Segmented } from '../components/Segmented';
import type { PageProps } from './shared';

type Show = 'Waiting' | 'Collected' | 'All';
type KindFilter = 'All' | MailKind;

export function Manage({ session, unit, notify }: PageProps) {
  const { repo } = session;
  const [show, setShow] = useStored<Show>('manage:show', 'Waiting');
  const [kind, setKind] = useStored<KindFilter>('manage:kind', 'All');
  const [query, setQuery] = useState('');
  const [courier, setCourier] = useState('');
  const [day, setDay] = useState('');
  const [editing, setEditing] = useState<MailItem | null>(null);

  const items = useAsync(() => loadUnit(repo, unit), [repo, unit]);
  const all = useMemo(() => items.data ?? [], [items.data]);
  const couriers = useMemo(
    () => [...new Set([...COURIERS, ...all.map((i) => i.courierCompany.trim()).filter(Boolean)])],
    [all],
  );

  const q = query.trim().toLowerCase();
  const visible = all.filter(
    (i) =>
      (show === 'All' || i.status === show) &&
      (kind === 'All' || i.kind === kind) &&
      (!courier || i.courierCompany.trim().toLowerCase() === courier.toLowerCase()) &&
      (!day || localDay(i.created) === day) &&
      (!q ||
        [i.courierNumber, i.sender, i.recipientName, i.recipientEmail, i.department, i.collectedByName, i.id].some((f) =>
          f.toLowerCase().includes(q),
        )),
  );
  const filtered = !!(q || courier || day);

  return (
    <div className="page">
      <PageHead
        title="Manage deliveries"
        text={`Edit details and record collections for the ${unit} mail room.`}
        loading={items.loading}
        onRefresh={() => void items.reload()}
      />

      <div className="toolbar">
        <Segmented
          label="Type"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'All', label: 'All types' },
            { value: 'Personal', label: 'Personal' },
            { value: 'Department', label: 'Department' },
          ]}
        />
        <Segmented
          label="Status"
          value={show}
          onChange={setShow}
          options={[
            { value: 'Waiting', label: 'Waiting' },
            { value: 'Collected', label: 'Collected' },
            { value: 'All', label: 'All' },
          ]}
        />
      </div>

      <div className="filters">
        <label className="search">
          <SearchIcon />
          <span className="sr-only">Search deliveries</span>
          <input
            type="search"
            value={query}
            placeholder="Courier number, person, department or sender"
            onChange={(e) => setQuery(e.target.value)}
          />
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
        <div className="table-skeleton" aria-hidden="true" />
      ) : visible.length === 0 ? (
        <div className="empty">
          <ListIcon width={30} height={30} />
          <p>{filtered ? 'No deliveries match these filters.' : 'No deliveries to show.'}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <caption className="sr-only">Deliveries</caption>
            <thead>
              <tr>
                <th scope="col">Courier number</th>
                <th scope="col">Courier</th>
                <th scope="col">For</th>
                <th scope="col">Sender</th>
                <th scope="col">Logged</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.slice(0, 300).map((i) => (
                <tr key={i.id} data-status={i.status.toLowerCase()} onClick={() => setEditing(i)}>
                  <td data-label="Courier number">
                    <button
                      type="button"
                      className="row-link"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(i);
                      }}
                    >
                      {i.courierNumber}
                    </button>
                  </td>
                  <td data-label="Courier">{i.courierCompany}</td>
                  <td data-label="For">
                    <span className="kind-tag">{i.kind === 'Personal' ? 'Personal' : 'Dept.'}</span>{' '}
                    {i.kind === 'Personal' ? i.recipientName || i.recipientEmail : i.department}
                  </td>
                  <td data-label="Sender">{i.sender}</td>
                  <td data-label="Logged" title={formatDateTime(i.created)}>
                    {timeAgo(i.created)}
                  </td>
                  <td data-label="Status">
                    <span className="status-dot" />
                    {i.status === 'Waiting' ? 'Waiting' : `Collected by ${i.collectedByName || '—'}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="more-note">
            {visible.length > 300 ? `Showing 300 of ${visible.length}. Use the filters to narrow down.` : `${visible.length} deliveries`}
          </p>
        </div>
      )}

      <EditDrawer
        item={editing}
        session={session}
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
