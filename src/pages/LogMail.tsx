import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { DEPARTMENTS, MAX_WAITING } from '../config';
import { departmentOptions, EMAIL_PATTERN, isByHand, uniqueOptions } from '../data/rules';
import { mailKey, type MailKind, type Person } from '../data/types';
import { byHandRef, formatDateTime, isToday } from '../lib/format';
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

/** Add Personal Mail / Add Department Mail, with the same fields as the original forms. */
export function LogMail({ session, unit, addKind, go, notify }: PageProps) {
  const { user, repo, directory } = session;
  const [kind, setKind] = useState<MailKind>(addKind);
  const [courier, setCourier] = useState('');
  const [courierNumber, setCourierNumber] = useState('');
  const [autoRef, setAutoRef] = useState<string | null>(null);
  const [sender, setSender] = useState('');
  const [recipient, setRecipient] = useState<Person | null>(null);
  const [department, setDepartment] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fresh, setFresh] = useState<string[]>([]);
  const [clock, setClock] = useState(() => byHandRef());
  const [formKey, setFormKey] = useState(0);
  const numberRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // The live time stamp shown on the form, as on the original site.
  useEffect(() => {
    const timer = setInterval(() => setClock(byHandRef()), 1000);
    return () => clearInterval(timer);
  }, []);

  const waiting = useAsync(() => repo.list({ unit, status: 'Waiting' }, MAX_WAITING), [repo, unit]);
  const recent = useAsync(() => repo.list({ unit }, 80), [repo, unit]);
  const addedToday = useMemo(() => (recent.data ?? []).filter((i) => isToday(i.created)), [recent.data]);
  const known = useMemo(() => [...(waiting.data ?? []), ...(recent.data ?? [])], [waiting.data, recent.data]);
  const departments = useMemo(() => departmentOptions(known, DEPARTMENTS), [known]);
  const senderCompanies = useMemo(
    () => uniqueOptions(known.filter((i) => i.kind === 'Department').map((i) => i.sender)),
    [known],
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

  function reset(keepCourier: boolean) {
    setCourierNumber('');
    setAutoRef(null);
    setSender('');
    setRecipient(null);
    setDepartment('');
    setErrors({});
    setSubmitError(null);
    if (!keepCourier) {
      setCourier('');
      setFormKey((k) => k + 1);
    }
    setTimeout(() => numberRef.current?.focus(), 0);
  }

  function validate(): Errors {
    const e: Errors = {};
    if (!courierNumber.trim() && !isByHand(courier)) e.courierNumber = 'Scan or type the courier number.';
    if (!courier.trim()) e.courier = 'Choose the courier company.';
    if (!sender.trim()) e.sender = kind === 'Personal' ? 'Enter the sender.' : 'Enter the sender company.';
    if (kind === 'Personal') {
      if (!recipient) e.recipient = 'Choose the recipient.';
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
    // Hand deliveries get a fresh date-and-time reference at the moment they're submitted.
    const number = isByHand(courier) && (!courierNumber.trim() || courierNumber === autoRef) ? byHandRef() : courierNumber;
    try {
      const created = await repo.create(
        {
          kind,
          unit,
          courierNumber: number,
          courierCompany: courier,
          sender,
          recipient: kind === 'Personal' ? recipient!.name : '',
          recipientEmail: kind === 'Personal' ? recipient!.email : '',
          department: kind === 'Department' ? department : '',
        },
        user,
      );
      setFresh((f) => [mailKey(created), ...f]);
      const who = kind === 'Personal' ? recipient!.name : department;
      notify(`Added ${courier} ${created.courierNumber} for ${who}`);
      reset(true);
      void recent.reload();
      void waiting.reload();
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const describe = (f: Field) => (errors[f] ? `${f}-error` : undefined);
  const title = kind === 'Personal' ? 'Add Personal Mail' : 'Add Department Mail';

  return (
    <div className="page">
      <PageHead
        title={title}
        text={
          kind === 'Personal'
            ? `Register new personal delivery at the ${unit} mail room and notify the recipient.`
            : `Register new delivery at the ${unit} mail room and notify the department.`
        }
      >
        <Segmented
          label="Mail type"
          value={kind}
          onChange={(k) => {
            setKind(k);
            setErrors({});
          }}
          options={[
            { value: 'Personal', label: 'Personal Mail' },
            { value: 'Department', label: 'Department Mail' },
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
          <p className="form-clock" aria-label="Current time stamp">
            {clock}
          </p>

          <label className="field">
            <span className="field-label">
              Courier Number <span className="req">*</span>
            </span>
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
                    focusField(courier ? (kind === 'Personal' ? 'sender' : 'department') : 'courier');
                  }
                }}
              />
            </span>
            {errors.courierNumber && <span id="courierNumber-error" className="field-error">{errors.courierNumber}</span>}
            {duplicate && !errors.courierNumber && (
              <span id="dup-note" className="field-warn">
                Already added on {formatDateTime(duplicate.created)} for{' '}
                {duplicate.kind === 'Personal' ? duplicate.recipient : duplicate.department} and not received yet. Check it isn’t a
                second scan.
              </span>
            )}
          </label>

          <div>
            <CourierPicker
              key={formKey}
              label={
                <>
                  Courier Company <span className="req">*</span>
                </>
              }
              value={courier}
              onChange={chooseCourier}
              invalid={!!errors.courier}
              describedBy={describe('courier')}
            />
            {errors.courier && <span id="courier-error" className="field-error">{errors.courier}</span>}
          </div>

          {kind === 'Personal' ? (
            <>
              <label className="field">
                <span className="field-label">
                  Sender <span className="req">*</span>
                </span>
                <input
                  name="sender"
                  value={sender}
                  autoComplete="off"
                  aria-invalid={!!errors.sender}
                  aria-describedby={describe('sender')}
                  onChange={(e) => setSender(e.target.value)}
                />
                {errors.sender && <span id="sender-error" className="field-error">{errors.sender}</span>}
              </label>
              <div className="field">
                <label className="field-label" htmlFor="recipient-input">
                  Recipient <span className="req">*</span>
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
            </>
          ) : (
            <>
              <label className="field">
                <span className="field-label">
                  Department <span className="req">*</span>
                </span>
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
              <label className="field">
                <span className="field-label">
                  Sender Company <span className="req">*</span>
                </span>
                <input
                  name="sender"
                  list="sender-options"
                  value={sender}
                  autoComplete="off"
                  aria-invalid={!!errors.sender}
                  aria-describedby={describe('sender')}
                  onChange={(e) => setSender(e.target.value)}
                />
                <datalist id="sender-options">
                  {senderCompanies.map((d) => (
                    <option key={d} value={d} />
                  ))}
                </datalist>
                {errors.sender && <span id="sender-error" className="field-error">{errors.sender}</span>}
              </label>
            </>
          )}

          {submitError && <p className="error-box" role="alert">{submitError}</p>}

          <div className="form-foot">
            <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
              {saving ? 'Submitting…' : 'Submit'}
            </button>
            <button type="button" className="btn btn-ghost btn-lg" disabled={saving} onClick={() => reset(false)}>
              Reset
            </button>
            <button type="button" className="btn btn-ghost btn-lg" disabled={saving} onClick={() => go('home')}>
              Cancel
            </button>
            <span className="kbd-hint">Ctrl + Enter submits</span>
          </div>
        </form>

        <section className="logged-today" aria-labelledby="today-title">
          <h2 id="today-title" className="section-title">
            Added today <span className="count">{addedToday.length}</span>
          </h2>
          {addedToday.length === 0 ? (
            <p className="muted">{recent.loading ? 'Loading…' : 'Deliveries you add appear here.'}</p>
          ) : (
            <ul className="slips slips-compact">
              {addedToday.slice(0, 30).map((item, i) => (
                <Slip key={mailKey(item)} item={item} index={i} showFor fresh={fresh.includes(mailKey(item))} compact />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
