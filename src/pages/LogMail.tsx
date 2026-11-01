import { useMemo, useRef, useState, type FormEvent } from 'react';
import { DEPARTMENTS, MAX_WAITING } from '../config';
import { departmentOptions, EMAIL_PATTERN, isByHand } from '../data/rules';
import type { MailKind, Person } from '../data/types';
import { byHandRef, formatDateTime, isToday } from '../lib/format';
import { useStored } from '../lib/stored';
import { useAsync } from '../lib/useAsync';
import { ScanIcon } from '../components/icons';
import { CourierPicker } from '../components/CourierPicker';
import { PageHead } from '../components/PageHead';
import { PeoplePicker } from '../components/PeoplePicker';
import { Segmented } from '../components/Segmented';
import { Slip } from '../components/Slip';
import type { PageProps } from './shared';

type Field = 'courierNumber' | 'courier' | 'sender' | 'recipient' | 'department';
type Errors = Partial<Record<Field, string>>;

const compact = (s: string) => s.replace(/\s+/g, '').toLowerCase();

export function LogMail({ session, unit, notify }: PageProps) {
  const { user, repo, directory } = session;
  const [kind, setKind] = useStored<MailKind>('log:kind', 'Personal');
  const [courier, setCourier] = useStored<string>('log:courier', '');
  const [courierNumber, setCourierNumber] = useState('');
  const [autoRef, setAutoRef] = useState<string | null>(null);
  const [sender, setSender] = useState('');
  const [recipient, setRecipient] = useState<Person | null>(null);
  const [department, setDepartment] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fresh, setFresh] = useState<string[]>([]);
  const numberRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const waiting = useAsync(() => repo.list({ unit, status: 'Waiting' }, MAX_WAITING), [repo, unit]);
  const recent = useAsync(() => repo.list({ unit }, 80), [repo, unit]);
  const loggedToday = useMemo(() => (recent.data ?? []).filter((i) => isToday(i.created)), [recent.data]);
  const departments = useMemo(
    () => departmentOptions([...(waiting.data ?? []), ...(recent.data ?? [])], DEPARTMENTS),
    [waiting.data, recent.data],
  );

  const duplicate = useMemo(() => {
    const key = compact(courierNumber);
    if (key.length < 4 || courierNumber === autoRef) return null;
    return (waiting.data ?? []).find((i) => compact(i.courierNumber) === key) ?? null;
  }, [courierNumber, autoRef, waiting.data]);

  function chooseCourier(value: string) {
    setCourier(value);
    if (isByHand(value)) {
      if (!courierNumber || courierNumber === autoRef) {
        const ref = byHandRef();
        setCourierNumber(ref);
        setAutoRef(ref);
      }
    } else if (autoRef && courierNumber === autoRef) {
      setCourierNumber('');
      setAutoRef(null);
    }
  }

  function focusField(name: string) {
    const form = formRef.current;
    if (!form) return;
    const target =
      name === 'courier'
        ? (form.querySelector<HTMLElement>('.courier-picker input:checked') ?? form.querySelector<HTMLElement>('.courier-picker input'))
        : name === 'recipient'
          ? form.querySelector<HTMLElement>('#recipient-input, .person-chosen button')
          : form.querySelector<HTMLElement>(`[name="${name}"]`);
    target?.focus();
  }

  function validate(): Errors {
    const e: Errors = {};
    if (!courierNumber.trim() && !isByHand(courier)) e.courierNumber = 'Scan or type the courier number.';
    if (!courier.trim()) e.courier = 'Choose the courier.';
    if (!sender.trim()) e.sender = kind === 'Personal' ? 'Enter who sent it.' : 'Enter the sender company.';
    if (kind === 'Personal') {
      if (!recipient) e.recipient = 'Choose who it’s for.';
      else if (!EMAIL_PATTERN.test(recipient.email)) e.recipient = 'The recipient needs a valid email.';
    } else if (!department.trim()) {
      e.department = 'Enter the department.';
    }
    return e;
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (saving) return;
    setSubmitError(null);
    const found = validate();
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      focusField(first);
      return;
    }
    setSaving(true);
    // Hand deliveries get a fresh date-and-time reference at the moment they're logged.
    const number = isByHand(courier) && (!courierNumber.trim() || courierNumber === autoRef) ? byHandRef() : courierNumber;
    try {
      const created = await repo.create(
        {
          kind,
          unit,
          courierNumber: number,
          courierCompany: courier,
          sender,
          recipientName: kind === 'Personal' ? recipient!.name : '',
          recipientEmail: kind === 'Personal' ? recipient!.email : '',
          department: kind === 'Department' ? department : '',
          notes,
        },
        user,
      );
      setFresh((f) => [created.id, ...f]);
      const who = kind === 'Personal' ? recipient!.name : department;
      notify(isByHand(courier) ? `Logged hand delivery for ${who}` : `Logged ${courier} ${created.courierNumber} for ${who}`);
      setCourierNumber('');
      setAutoRef(null);
      setSender('');
      setRecipient(null);
      setDepartment('');
      setNotes('');
      setErrors({});
      void recent.reload();
      void waiting.reload();
      setTimeout(() => numberRef.current?.focus(), 0);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const describe = (f: Field) => (errors[f] ? `${f}-error` : undefined);

  return (
    <div className="page">
      <PageHead title="Log a delivery" text={`Register mail arriving at the ${unit} mail room.`}>
        <Segmented
          label="Delivery type"
          value={kind}
          onChange={(k) => {
            setKind(k);
            setErrors({});
          }}
          options={[
            { value: 'Personal', label: 'Personal' },
            { value: 'Department', label: 'Department' },
          ]}
        />
      </PageHead>

      <div className="log-layout">
        <form
          ref={formRef}
          className="log-form panel"
          noValidate
          onSubmit={submit}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              void submit();
            }
          }}
        >
          <label className="field">
            <span className="field-label">Courier number</span>
            <span className="scan-input">
              <ScanIcon />
              <input
                ref={numberRef}
                name="courierNumber"
                value={courierNumber}
                autoFocus
                autoComplete="off"
                spellCheck={false}
                placeholder={isByHand(courier) ? 'Added automatically for hand deliveries' : 'Scan the barcode or type it'}
                aria-invalid={!!errors.courierNumber}
                aria-describedby={describe('courierNumber') ?? (duplicate ? 'dup-note' : undefined)}
                onChange={(e) => {
                  setCourierNumber(e.target.value);
                  if (autoRef && e.target.value !== autoRef) setAutoRef(null);
                }}
                onKeyDown={(e) => {
                  // Barcode scanners press Enter after the number: move on instead of submitting.
                  if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                    focusField(courier ? 'sender' : 'courier');
                  }
                }}
              />
            </span>
            {errors.courierNumber && <span id="courierNumber-error" className="field-error">{errors.courierNumber}</span>}
            {duplicate && !errors.courierNumber && (
              <span id="dup-note" className="field-warn">
                Already logged on {formatDateTime(duplicate.created)} for{' '}
                {duplicate.kind === 'Personal' ? duplicate.recipientName : duplicate.department}, still waiting. Check it isn’t a
                second scan.
              </span>
            )}
          </label>

          <div>
            <CourierPicker value={courier} onChange={chooseCourier} invalid={!!errors.courier} describedBy={describe('courier')} />
            {errors.courier && <span id="courier-error" className="field-error">{errors.courier}</span>}
          </div>

          <label className="field">
            <span className="field-label">{kind === 'Personal' ? 'Sender' : 'Sender company'}</span>
            <input
              name="sender"
              value={sender}
              autoComplete="off"
              placeholder={kind === 'Personal' ? 'Person or company it’s from' : 'Company it’s from'}
              aria-invalid={!!errors.sender}
              aria-describedby={describe('sender')}
              onChange={(e) => setSender(e.target.value)}
            />
            {errors.sender && <span id="sender-error" className="field-error">{errors.sender}</span>}
          </label>

          {kind === 'Personal' ? (
            <div className="field">
              <label className="field-label" htmlFor="recipient-input">
                Recipient
              </label>
              <PeoplePicker
                inputId="recipient-input"
                directory={directory}
                value={recipient}
                onChange={setRecipient}
                invalid={!!errors.recipient}
                describedBy={describe('recipient')}
              />
              {errors.recipient && <span id="recipient-error" className="field-error">{errors.recipient}</span>}
            </div>
          ) : (
            <label className="field">
              <span className="field-label">Department</span>
              <input
                name="department"
                list="department-options"
                value={department}
                autoComplete="off"
                placeholder="Start typing to reuse an existing name"
                aria-invalid={!!errors.department}
                aria-describedby={describe('department')}
                onChange={(e) => setDepartment(e.target.value)}
              />
              <datalist id="department-options">
                {departments.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
              {errors.department && <span id="department-error" className="field-error">{errors.department}</span>}
            </label>
          )}

          <label className="field">
            <span className="field-label">
              Notes <em>optional</em>
            </span>
            <input
              name="notes"
              value={notes}
              autoComplete="off"
              placeholder="Size, shelf, anything the recipient should know"
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>

          {submitError && <p className="error-box" role="alert">{submitError}</p>}

          <div className="form-foot">
            <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
              {saving ? 'Logging…' : 'Log delivery'}
            </button>
            <span className="kbd-hint">Ctrl + Enter</span>
          </div>
        </form>

        <section className="logged-today" aria-labelledby="today-title">
          <h2 id="today-title" className="section-title">
            Logged today <span className="count">{loggedToday.length}</span>
          </h2>
          {loggedToday.length === 0 ? (
            <p className="muted">{recent.loading ? 'Loading…' : 'Deliveries you log appear here.'}</p>
          ) : (
            <ul className="slips slips-compact">
              {loggedToday.slice(0, 30).map((item, i) => (
                <Slip key={item.id} item={item} index={i} showFor fresh={fresh.includes(item.id)} compact />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
