import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Session } from '../data';
import { EMAIL_PATTERN } from '../data/rules';
import type { MailChanges, MailItem, Person } from '../data/types';
import { formatDateTime } from '../lib/format';
import { CourierPicker } from './CourierPicker';
import { CloseIcon, UndoIcon } from './icons';
import { PeoplePicker } from './PeoplePicker';

interface Props {
  item: MailItem | null;
  session: Session;
  onClose: () => void;
  onSaved: (message: string) => void;
}

/** Side sheet for editing a delivery and recording who collected it. */
export function EditDrawer({ item, session, onClose, onSaved }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (item && !dialog.open) dialog.showModal();
    if (!item && dialog.open) dialog.close();
  }, [item]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby="edit-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {item && <EditForm key={`${item.id}-${item.modified}`} item={item} session={session} onClose={onClose} onSaved={onSaved} />}
    </dialog>
  );
}

function EditForm({ item, session, onClose, onSaved }: Omit<Props, 'item'> & { item: MailItem }) {
  const { repo, directory } = session;
  const [courierNumber, setCourierNumber] = useState(item.courierNumber);
  const [courier, setCourier] = useState(item.courierCompany);
  const [sender, setSender] = useState(item.sender);
  const [recipient, setRecipient] = useState<Person | null>(
    item.recipientEmail ? { name: item.recipientName || item.recipientEmail, email: item.recipientEmail } : null,
  );
  const [department, setDepartment] = useState(item.department);
  const [notes, setNotes] = useState(item.notes);
  const [collector, setCollector] = useState<Person | null>(
    item.kind === 'Personal' && item.recipientEmail ? { name: item.recipientName || item.recipientEmail, email: item.recipientEmail } : null,
  );
  const [busy, setBusy] = useState<'save' | 'collect' | 'reopen' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: 'save' | 'collect' | 'reopen', action: () => Promise<unknown>, message: string) {
    setError(null);
    setBusy(kind);
    try {
      await action();
      onSaved(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(null);
    }
  }

  function save(event: FormEvent) {
    event.preventDefault();
    if (!courierNumber.trim() || !courier.trim() || !sender.trim()) {
      setError('Courier number, courier and sender are required.');
      return;
    }
    if (item.kind === 'Personal' && (!recipient || !EMAIL_PATTERN.test(recipient.email))) {
      setError('Choose a recipient with a valid email.');
      return;
    }
    if (item.kind === 'Department' && !department.trim()) {
      setError('Enter the department.');
      return;
    }
    const changes: MailChanges = { courierNumber, courierCompany: courier, sender, notes };
    if (item.kind === 'Personal') {
      changes.recipientName = recipient!.name;
      changes.recipientEmail = recipient!.email;
    } else {
      changes.department = department;
    }
    void run('save', () => repo.update(item.id, changes), 'Changes saved');
  }

  return (
    <form className="sheet-form" onSubmit={save} noValidate>
      <header className="sheet-head">
        <div>
          <p className="sheet-kicker">
            {item.kind} delivery #{item.id}
          </p>
          <h2 id="edit-title">{item.courierNumber}</h2>
        </div>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>
      </header>

      <div className="sheet-body">
        <section className={`collect-box is-${item.status.toLowerCase()}`} aria-label="Collection">
          {item.status === 'Waiting' ? (
            <>
              <h3 className="sheet-sub">Record collection</h3>
              <p className="muted">Waiting since {formatDateTime(item.created)}.</p>
              <div className="field">
                <span className="field-label">Collected by</span>
                <PeoplePicker directory={directory} value={collector} onChange={setCollector} />
              </div>
              <button
                type="button"
                className="btn btn-collect"
                disabled={busy !== null || !collector}
                onClick={() =>
                  void run('collect', () => repo.collect(item.id, collector!), `Marked as collected by ${collector!.name}`)
                }
              >
                {busy === 'collect' ? 'Saving…' : 'Mark as collected'}
              </button>
            </>
          ) : (
            <>
              <h3 className="sheet-sub">Collected by {item.collectedByName || '—'}</h3>
              <p className="muted">
                {formatDateTime(item.collectedOn)}
                {item.collectedByEmail && <> — {item.collectedByEmail}</>}
              </p>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy !== null}
                onClick={() => void run('reopen', () => repo.reopen(item.id), 'Delivery moved back to waiting')}
              >
                <UndoIcon width={18} height={18} /> {busy === 'reopen' ? 'Reopening…' : 'Reopen as waiting'}
              </button>
            </>
          )}
        </section>

        <h3 className="sheet-sub">Details</h3>
        <label className="field">
          <span className="field-label">Courier number</span>
          <input value={courierNumber} onChange={(e) => setCourierNumber(e.target.value)} spellCheck={false} />
        </label>
        <CourierPicker value={courier} onChange={setCourier} />
        <label className="field">
          <span className="field-label">{item.kind === 'Personal' ? 'Sender' : 'Sender company'}</span>
          <input value={sender} onChange={(e) => setSender(e.target.value)} />
        </label>
        {item.kind === 'Personal' ? (
          <div className="field">
            <span className="field-label">Recipient</span>
            <PeoplePicker directory={directory} value={recipient} onChange={setRecipient} />
          </div>
        ) : (
          <label className="field">
            <span className="field-label">Department</span>
            <input value={department} onChange={(e) => setDepartment(e.target.value)} />
          </label>
        )}
        <label className="field">
          <span className="field-label">
            Notes <em>optional</em>
          </span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <p className="muted small">
          Logged {formatDateTime(item.created)}
          {item.loggedByName && <> by {item.loggedByName}</>}.
        </p>
        {error && <p className="error-box" role="alert">{error}</p>}
      </div>

      <footer className="sheet-foot">
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy !== null}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy !== null}>
          {busy === 'save' ? 'Saving…' : 'Save changes'}
        </button>
      </footer>
    </form>
  );
}
