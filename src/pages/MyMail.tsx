import { useMemo } from 'react';
import { MAX_COLLECTED } from '../config';
import { useStored } from '../lib/stored';
import { useAsync } from '../lib/useAsync';
import { EnvelopeIcon } from '../components/icons';
import { Segmented } from '../components/Segmented';
import { Slip } from '../components/Slip';
import { PageHead } from '../components/PageHead';
import type { PageProps } from './shared';

type Show = 'Waiting' | 'Collected' | 'All';

export function MyMail({ session, unit, notify }: PageProps) {
  const { user, repo } = session;
  const [show, setShow] = useStored<Show>('mine:show', 'Waiting');
  const items = useAsync(
    () => repo.list({ unit, kind: 'Personal', recipientEmail: user.email }, MAX_COLLECTED),
    [repo, unit, user.email],
  );

  const all = useMemo(() => items.data ?? [], [items.data]);
  const counts = useMemo(
    () => ({
      Waiting: all.filter((i) => i.status === 'Waiting').length,
      Collected: all.filter((i) => i.status === 'Collected').length,
      All: all.length,
    }),
    [all],
  );
  const visible = show === 'All' ? all : all.filter((i) => i.status === show);

  return (
    <div className="page">
      <PageHead
        title="My mail"
        text={`Deliveries addressed to you at the ${unit} mail room.`}
        loading={items.loading}
        onRefresh={() => void items.reload()}
      >
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
      </PageHead>

      {items.error && <p className="error-box" role="alert">{items.error}</p>}

      {!items.data && items.loading ? (
        <SlipSkeleton />
      ) : visible.length === 0 ? (
        <div className="empty">
          <EnvelopeIcon width={30} height={30} />
          <p>
            {show === 'Waiting'
              ? 'Nothing is waiting for you. New deliveries appear here as soon as the mail room logs them.'
              : 'No deliveries to show yet.'}
          </p>
        </div>
      ) : (
        <ul className="slips" key={show}>
          {visible.map((item, i) => (
            <Slip
              key={item.id}
              item={item}
              index={i}
              leaveOnConfirm={show === 'Waiting'}
              onConfirm={item.status === 'Waiting' ? async () => void (await repo.collect(item.id, user)) : undefined}
              onSettled={() => {
                notify(`Collected ${item.courierCompany} ${item.courierNumber}`);
                void items.reload();
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

export function SlipSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <ul className="slips" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="slip-skeleton" />
      ))}
    </ul>
  );
}
