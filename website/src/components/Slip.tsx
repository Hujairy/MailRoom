import { useState, type CSSProperties } from 'react';
import type { MailItem } from '../data/types';
import { daysWaiting, formatDateTime, formatDayMonth, formatTime, timeAgo, waitingFor } from '../lib/format';
import { wait } from '../lib/motion';
import { Postmark } from './Postmark';

interface Props {
  item: MailItem;
  /** Position in the list, used to stagger the entrance. */
  index?: number;
  /** Show who the delivery is for (recipient or department). */
  showFor?: boolean;
  /** Present when the viewer may mark it as received. */
  onConfirm?: () => Promise<void>;
  /** Called once the receipt animation has finished. */
  onSettled?: () => void;
  /** Collapse the slip after it's received (e.g. in a "Not received" list). */
  leaveOnConfirm?: boolean;
  /** Plays a drop-in entrance (a delivery just added). */
  fresh?: boolean;
  /** Smaller slip for side lists. */
  compact?: boolean;
}

type Phase = 'idle' | 'busy' | 'tearing' | 'leaving';

/**
 * A delivery drawn as a courier slip. While not received it has a tear-off
 * stub; marking it received tears the stub away and postmarks the slip.
 */
export function Slip({ item, index = 0, showFor, onConfirm, onSettled, leaveOnConfirm, fresh, compact }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [stampedAt, setStampedAt] = useState<string | null>(null);

  const received = item.status === 'Received' || phase === 'tearing' || phase === 'leaving';
  const receivedAt = item.receivedTimeStamp ?? stampedAt;
  const late = !received && daysWaiting(item.created) >= 3;

  async function confirm() {
    if (!onConfirm || phase !== 'idle') return;
    setError(null);
    setPhase('busy');
    try {
      await onConfirm();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('idle');
      return;
    }
    setStampedAt(new Date().toISOString());
    setPhase('tearing');
    await wait(1150);
    if (leaveOnConfirm) {
      setPhase('leaving');
      await wait(380);
    }
    onSettled?.();
  }

  const forLabel = item.kind === 'Department' ? item.department : item.recipient || item.recipientEmail;

  return (
    <li
      className={`slip-row ${fresh ? 'is-fresh' : ''} ${phase === 'leaving' ? 'is-leaving' : ''}`}
      style={{ '--i': Math.min(index, 8) } as CSSProperties}
    >
      <div className="slip-row-inner">
        <article
          className={`slip ${compact ? 'slip-compact' : ''} ${received ? 'is-collected' : 'is-waiting'} ${phase === 'tearing' ? 'is-tearing' : ''}`}
          aria-label={`${item.courierCompany} ${item.courierNumber}, ${received ? 'received' : 'not received'}`}
        >
          <div className="slip-body-wrap">
            <div className="slip-body">
              <div className="slip-top">
                <span className="courier">{item.courierCompany || 'Courier'}</span>
                {showFor && forLabel && <span className="slip-for">For {forLabel}</span>}
                <span className="slip-id">#{item.id}</span>
              </div>
              <p className="slip-number">{item.courierNumber}</p>
              <p className="slip-from">
                <span className="slip-label">{item.kind === 'Department' ? 'Sender company' : 'Sender'}</span>{' '}
                <strong>{item.sender || '—'}</strong>
              </p>
              <p className="slip-meta">
                {received ? (
                  item.status === 'Received' ? (
                    <>
                      Received by {item.receivedBy || 'someone'}
                      {item.onBehalf && <> on behalf of {item.onBehalf}</>} on {formatDayMonth(receivedAt)} at{' '}
                      {formatTime(receivedAt)}
                    </>
                  ) : (
                    <>Received just now</>
                  )
                ) : (
                  <span title={`Creation time stamp: ${formatDateTime(item.created)}`}>
                    Created {timeAgo(item.created)}
                    {item.createdBy && <> by {item.createdBy}</>}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="slip-side">
            {(!received || phase === 'tearing') && (
              <div className="slip-stub-wrap">
                <div className={`slip-stub ${late ? 'is-late' : ''}`}>
                  <p className="stub-label">Not received</p>
                  <p className="stub-time">for {waitingFor(item.created)}</p>
                  {onConfirm ? (
                    <button type="button" className="stub-btn" disabled={phase !== 'idle'} onClick={() => void confirm()}>
                      {phase === 'busy' ? 'Saving…' : 'Mark as received'}
                    </button>
                  ) : (
                    <p className="stub-hint">At the mail room</p>
                  )}
                </div>
              </div>
            )}
            {received && <Postmark unit={item.unit} date={receivedAt} />}
          </div>
        </article>
        {error && (
          <p className="slip-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </li>
  );
}
