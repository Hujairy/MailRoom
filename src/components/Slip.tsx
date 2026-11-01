import { useState, type CSSProperties } from 'react';
import type { MailItem } from '../data/types';
import { sameEmail } from '../data/rules';
import { daysWaiting, formatDateTime, formatDayMonth, formatTime, timeAgo, waitingFor } from '../lib/format';
import { wait } from '../lib/motion';
import { Postmark } from './Postmark';

interface Props {
  item: MailItem;
  /** Position in the list, used to stagger the entrance. */
  index?: number;
  /** Show who the delivery is for (department mail, staff views). */
  showFor?: boolean;
  /** Present when the viewer may confirm collection. */
  onConfirm?: () => Promise<void>;
  /** Called once the collection animation has finished. */
  onSettled?: () => void;
  /** Collapse the slip after it's collected (e.g. in a "Waiting" list). */
  leaveOnConfirm?: boolean;
  /** Plays a drop-in entrance (a delivery just logged). */
  fresh?: boolean;
  /** Smaller slip for side lists. */
  compact?: boolean;
}

type Phase = 'idle' | 'busy' | 'tearing' | 'leaving';

/**
 * A delivery drawn as a courier slip. While waiting it has a tear-off stub;
 * confirming collection tears the stub away and postmarks the slip.
 */
export function Slip({ item, index = 0, showFor, onConfirm, onSettled, leaveOnConfirm, fresh, compact }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [stampedAt, setStampedAt] = useState<string | null>(null);

  const collected = item.status === 'Collected' || phase === 'tearing' || phase === 'leaving';
  const collectedOn = item.collectedOn ?? stampedAt;
  const late = !collected && daysWaiting(item.created) >= 3;

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

  const forLabel = item.kind === 'Department' ? item.department : item.recipientName || item.recipientEmail;
  const onBehalf =
    item.status === 'Collected' &&
    item.kind === 'Personal' &&
    item.collectedByEmail &&
    !sameEmail(item.collectedByEmail, item.recipientEmail);

  return (
    <li
      className={`slip-row ${fresh ? 'is-fresh' : ''} ${phase === 'leaving' ? 'is-leaving' : ''}`}
      style={{ '--i': Math.min(index, 8) } as CSSProperties}
    >
      <div className="slip-row-inner">
      <article
        className={`slip ${compact ? 'slip-compact' : ''} ${collected ? 'is-collected' : 'is-waiting'} ${phase === 'tearing' ? 'is-tearing' : ''}`}
        aria-label={`${item.courierCompany} ${item.courierNumber}, ${collected ? 'collected' : 'waiting'}`}
      >
        <div className="slip-body-wrap">
          <div className="slip-body">
            <div className="slip-top">
              <span className="courier">{item.courierCompany || 'Courier'}</span>
              {showFor && forLabel && <span className="slip-for">For {forLabel}</span>}
            </div>
            <p className="slip-number">{item.courierNumber}</p>
            <p className="slip-from">
              From <strong>{item.sender || 'unknown sender'}</strong>
            </p>
            <p className="slip-meta">
              {collected ? (
                item.status === 'Collected' ? (
                  <>
                    Collected by {item.collectedByName || 'someone'}
                    {onBehalf && <> for {item.recipientName || item.recipientEmail}</>} on {formatDayMonth(collectedOn)} at{' '}
                    {formatTime(collectedOn)}
                  </>
                ) : (
                  <>Collected just now</>
                )
              ) : (
                <span title={formatDateTime(item.created)}>
                  Logged {timeAgo(item.created)}
                  {item.loggedByName && <> by {item.loggedByName}</>}
                </span>
              )}
            </p>
            {item.notes && !compact && <p className="slip-note">{item.notes}</p>}
          </div>
        </div>

        <div className="slip-side">
          {(!collected || phase === 'tearing') && (
            <div className="slip-stub-wrap">
              <div className={`slip-stub ${late ? 'is-late' : ''}`}>
                <p className="stub-label">Waiting</p>
                <p className="stub-time">for {waitingFor(item.created)}</p>
                {onConfirm ? (
                  <button type="button" className="stub-btn" disabled={phase !== 'idle'} onClick={() => void confirm()}>
                    {phase === 'busy' ? 'Confirming…' : 'Confirm received'}
                  </button>
                ) : (
                  <p className="stub-hint">At the mail room</p>
                )}
              </div>
            </div>
          )}
          {collected && <Postmark unit={item.unit} date={collectedOn} />}
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
