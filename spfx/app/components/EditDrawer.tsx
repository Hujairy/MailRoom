/* eslint-disable */
import * as React from 'react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Session } from '../data';
import { EMAIL_PATTERN, onBehalfFor } from '../data/rules';
import { mailKey, type MailChanges, type MailItem, type MailRepository, type Person } from '../data/types';
import { formatDateTime } from '../lib/format';
import { CourierPicker } from './CourierPicker';
import { CloseIcon, UndoIcon } from './icons';
import { PeoplePicker } from './PeoplePicker';

interface Props {
  item: MailItem | null;
  session: Session;
  repo: MailRepository;
  onClose: () => void;
  onSaved: (message: string) => void;
}

/** Side sheet for editing a delivery and recording who received it. */
export function EditDrawer({ item, session, repo, onClose, onSaved }: Props) {
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
      {item && (
        <EditForm
          key={`${mailKey(item)}-${item.modified}`}
          item={item}
          session={session}
          repo={repo}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
    </dialog>
  );
}

function EditForm({ item, session, repo, onClose, onSaved }: Omit<Props, 'item'> & { item: MailItem }) {
  const { directory } = session;
  const personal = item.kind === 'Personal';
  const [courierNumber, setCourierNumber] = useState(item.courierNumber);
  const [courier, setCourier] = useState(item.courierCompany);
  const [sender, setSender] = useState(item.sender);
  const [recipient, setRecipient] = useState<Person | null>(
    item.recipientEmail ? { name: item.recipient || item.recipientEmail, email: item.recipientEmail } : null,
  );
  const [onBehalf, setOnBehalf] = useState(item.onBehalf);
  const [department, setDepartment] = useState(item.department);
  const [receiver, setReceiver] = useState<Person | null>(
    personal && item.recipientEmail ? { name: item.recipient || item.recipientEmail, email: item.recipientEmail } : null,
  );
  const [busy, setBusy] = useState<'save' | 'receive' | 'reopen' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: 'save' | 'receive' | 'reopen', action: () => Promise<unknown>, message: string) {
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
      setError(`Courier Number, Courier Company and ${personal ? 'Sender' : 'Sender Company'} are required.`);
      return;
    }
    if (personal && (!recipient || !EMAIL_PATTERN.test(recipient.email))) {
      setError('Choose a recipient with a valid email.');
      return;
    }
    if (!personal && !department.trim()) {
      setError('Enter the department.');
      return;
    }
    const changes: MailChanges = { courierNumber, courierCompany: courier, sender };
    if (personal) {
      changes.recipient = recipient!.name;
      changes.recipientEmail = recipient!.email;
      changes.onBehalf = onBehalf;
    } else {
      changes.department = department;
    }
    void run('save', () => repo.update(item, changes), 'Changes saved');
  }

  const behalfPreview = receiver ? onBehalfFor(item, receiver) : '';

  return (
    <form className="sheet-form" onSubmit={save} noValidate>
      <header className="sheet-head">
        <div>
          <p className="sheet-kicker">
            {personal ? 'Personal Mail' : 'Department Mail'} — ID {item.id}
          </p>
          <h2 id="edit-title">{item.courierNumber}</h2>
        </div>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>
      </header>

      <div className="sheet-body">
        <section className={`collect-box is-${item.status === 'Received' ? 'collected' : 'waiting'}`} aria-label="Received">
          {item.status === 'Waiting' ? (
            <>
              <h3 className="sheet-sub">Received: No</h3>
              <p className="muted">Creation time stamp {formatDateTime(item.created)}.</p>
              <div className="field">
                <span className="field-label">Received By</span>
                <PeoplePicker directory={directory} value={receiver} onChange={setReceiver} />
              </div>
              {behalfPreview && <p className="muted small">Recorded as received on behalf of {behalfPreview}.</p>}
              <button
                type="button"
                className="btn btn-collect"
                disabled={busy !== null || !receiver}
                onClick={() => void run('receive', () => repo.receive(item, receiver!), `Marked as received by ${receiver!.name}`)}
              >
                {busy === 'receive' ? 'Saving…' : 'Mark as received'}
              </button>
            </>
          ) : (
            <>
              <h3 className="sheet-sub">Received: Yes</h3>
              <dl className="mini-facts">
                <div>
                  <dt>Received By</dt>
                  <dd>{item.receivedBy || '—'}</dd>
                </div>
                <div>
                  <dt>Received Time Stamp</dt>
                  <dd>{formatDateTime(item.receivedTimeStamp)}</dd>
                </div>
                {personal && item.onBehalf && (
                  <div>
                    <dt>On Behalf</dt>
                    <dd>{item.onBehalf}</dd>
                  </div>
                )}
              </dl>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy !== null}
                onClick={() => void run('reopen', () => repo.reopen(item), 'Set back to not received')}
              >
                <UndoIcon width={18} height={18} /> {busy === 'reopen' ? 'Saving…' : 'Set back to not received'}
              </button>
            </>
          )}
        </section>

        <h3 className="sheet-sub">Details</h3>
        <label className="field">
          <span className="field-label">Courier Number</span>
          <input value={courierNumber} onChange={(e) => setCourierNumber(e.target.value)} spellCheck={false} />
        </label>
        <CourierPicker value={courier} onChange={setCourier} />
        {personal ? (
          <>
            <label className="field">
              <span className="field-label">Sender</span>
              <input value={sender} onChange={(e) => setSender(e.target.value)} />
            </label>
            <div className="field">
              <span className="field-label">Recipient</span>
              <PeoplePicker directory={directory} value={recipient} onChange={setRecipient} />
            </div>
            <label className="field">
              <span className="field-label">
                On Behalf <em>optional</em>
              </span>
              <input value={onBehalf} onChange={(e) => setOnBehalf(e.target.value)} />
            </label>
          </>
        ) : (
          <>
            <label className="field">
              <span className="field-label">Department</span>
              <input value={department} onChange={(e) => setDepartment(e.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">Sender Company</span>
              <input value={sender} onChange={(e) => setSender(e.target.value)} />
            </label>
          </>
        )}
        <p className="muted small">
          Created {formatDateTime(item.created)}
          {item.createdBy && <> by {item.createdBy}</>}.
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
