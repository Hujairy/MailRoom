/* eslint-disable */
import * as React from 'react';
import { useMemo } from 'react';
import { MAX_RECEIVED } from '../config';
import { mailKey } from '../data/types';
import { useStored } from '../lib/stored';
import { useAsync } from '../lib/useAsync';
import { EnvelopeIcon } from '../components/icons';
import { PageHead } from '../components/PageHead';
import { ReceivedFilter, type Show } from '../components/ReceivedFilter';
import { Slip } from '../components/Slip';
import type { PageProps } from './shared';

export function MyMail({ session, unit, repo, notify }: PageProps) {
  const { user } = session;
  const [show, setShow] = useStored<Show>('mine:received', 'Waiting');
  const items = useAsync(
    () => repo.list({ kind: 'Personal', recipientEmail: [user.email, ...user.aliases] }, MAX_RECEIVED),
    [repo, user],
  );

  const all = useMemo(() => items.data ?? [], [items.data]);
  const visible = show === 'All' ? all : all.filter((i) => i.status === show);

  return (
    <div className="page">
      <PageHead
        title="My Personal Mail"
        text={`Find your personal delivery at the ${unit} mail room.`}
        loading={items.loading}
        onRefresh={() => void items.reload()}
      >
        <ReceivedFilter value={show} onChange={setShow} items={all} />
      </PageHead>

      {items.error && <p className="error-box" role="alert">{items.error}</p>}

      {!items.data && items.loading ? (
        <SlipSkeleton />
      ) : visible.length === 0 ? (
        <div className="empty">
          <EnvelopeIcon width={30} height={30} />
          <p>
            {show === 'Waiting'
              ? 'You have no personal mail waiting. New deliveries appear here as soon as the mail room adds them.'
              : 'No deliveries to show yet.'}
          </p>
        </div>
      ) : (
        <ul className="slips" key={show}>
          {visible.map((item, i) => (
            <Slip
              key={mailKey(item)}
              item={item}
              index={i}
              leaveOnConfirm={show === 'Waiting'}
              onConfirm={item.status === 'Waiting' ? async () => void (await repo.receive(item, user)) : undefined}
              onSettled={() => {
                notify(`Marked ${item.courierCompany} ${item.courierNumber} as received`);
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
