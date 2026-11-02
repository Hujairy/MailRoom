import { useMemo, useState, type FormEvent } from 'react';
import { GENERAL_ADMINS, unitListNames } from '../config';
import type { Session } from '../data';
import { isAddressOf, sameEmail } from '../data/rules';
import type { MemberRecord, Role, SettingsData, UnitRecord } from '../data/settings';
import type { Person } from '../data/types';
import { initials, plural } from '../lib/format';
import { BuildingIcon, PlusIcon, TrashIcon, UsersIcon } from '../components/icons';
import { addDataSourceCommands, ColumnHelp, Command, ListRecipe, unitRecipes } from '../components/ListRecipe';
import { PageHead } from '../components/PageHead';
import { PeoplePicker } from '../components/PeoplePicker';
import { Segmented } from '../components/Segmented';

interface Props {
  session: Session;
  notify: (message: string) => void;
  /** Called after every change so the rest of the app picks it up. */
  onChanged: () => void;
}

type Status = 'ready' | 'lists' | 'locked';

const UNIT_NAME = /^[A-Za-z][A-Za-z0-9 ]{1,39}$/;
const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'User', label: 'User' },
  { value: 'Admin', label: 'Admin' },
];

/** General admins only: units, and who is a user or an admin in each. */
export function Settings({ session, notify, onChanged }: Props) {
  const { settings, user } = session;
  const [data, setData] = useState<SettingsData>(session.data);
  const [selected, setSelected] = useState(() => data.units[0]?.name ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const unit = data.units.find((u) => u.name === selected) ?? data.units[0] ?? null;
  const people = useMemo(
    () =>
      unit
        ? data.members
            .filter((m) => m.unit === unit.name)
            .sort((a, b) => (a.role === b.role ? (a.name || a.email).localeCompare(b.name || b.email) : a.role === 'Admin' ? -1 : 1))
        : [],
    [data.members, unit],
  );

  const statusOf = (name: string): Status => {
    const setup = session.setup.find((s) => s.name === name);
    if (!setup?.connected) return 'lists';
    return session.blocked.some((b) => b.name === name) ? 'locked' : 'ready';
  };

  async function run(key: string, action: () => Promise<unknown>, message: string): Promise<boolean> {
    setBusy(key);
    setError(null);
    try {
      await action();
      setData(await settings.load());
      notify(message);
      onChanged();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="page settings">
      <PageHead
        title="Settings"
        text="Units, and who uses or runs each unit’s mail room. Only general admins can see this page."
      />

      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}

      <div className="settings-layout">
        <UnitsColumn
          data={data}
          selected={unit?.name ?? ''}
          busy={busy}
          statusOf={statusOf}
          onSelect={setSelected}
          onAdd={async (name) => {
            const ok = await run('add-unit', () => settings.addUnit(name), `Added the ${name} unit`);
            if (ok) setSelected(name);
            return ok;
          }}
        />

        {unit ? (
          <UnitPanel
            key={unit.id}
            session={session}
            unit={unit}
            people={people}
            status={statusOf(unit.name)}
            busy={busy}
            onRemoveUnit={async () => {
              const ok = await run(
                'remove-unit',
                () => settings.removeUnit(unit, data.members),
                `Removed the ${unit.name} unit`,
              );
              if (ok) setSelected(data.units.find((u) => u.id !== unit.id)?.name ?? '');
            }}
            onAdd={(person, role) => {
              const existing = people.find((m) => sameEmail(m.email, person.email));
              if (existing) {
                setError(`${existing.name || existing.email} is already in ${unit.name} as ${existing.role === 'Admin' ? 'an admin' : 'a user'}.`);
                return Promise.resolve(false);
              }
              return run(
                'add-person',
                () => settings.addMember({ email: person.email, name: person.name, unit: unit.name, role }),
                `Added ${person.name} to ${unit.name} as ${role === 'Admin' ? 'an admin' : 'a user'}`,
              );
            }}
            onRole={(member, role) =>
              void run(`role-${member.id}`, () => settings.setRole(member, role), `${member.name || member.email} is now ${role === 'Admin' ? 'an admin' : 'a user'} in ${unit.name}`)
            }
            onRemove={(member) =>
              void run(`remove-${member.id}`, () => settings.removeMember(member), `Removed ${member.name || member.email} from ${unit.name}`)
            }
          />
        ) : (
          <section className="panel unit-panel unit-panel-empty">
            <BuildingIcon width={30} height={30} />
            <p>Add your first unit, for example Bahrain. Then add its admins and users.</p>
          </section>
        )}
      </div>

      <section className="panel general-admins" aria-labelledby="general-admins-title">
        <h2 className="section-title" id="general-admins-title">
          General admins <span className="count">{GENERAL_ADMINS.length}</span>
        </h2>
        <p className="muted">
          Full access: every unit, the admin pages, and this page. The list is set in <code>src/config.ts</code> so nobody can be
          locked out from here.
        </p>
        <ul className="admin-list">
          {GENERAL_ADMINS.map((email) => (
            <li key={email}>
              <span className="person-avatar">{initials(email.replace(/@.*/, '').replace(/[._]/g, ' '))}</span>
              <span className="admin-email">{email}</span>
              {isAddressOf(user, email) && <span className="kind-tag">You</span>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function UnitsColumn({
  data,
  selected,
  busy,
  statusOf,
  onSelect,
  onAdd,
}: {
  data: SettingsData;
  selected: string;
  busy: string | null;
  statusOf: (name: string) => Status;
  onSelect: (name: string) => void;
  onAdd: (name: string) => Promise<boolean>;
}) {
  const [name, setName] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const clean = name.trim().replace(/\s+/g, ' ');
    if (!UNIT_NAME.test(clean)) {
      setProblem('Use 2 to 40 letters, numbers or spaces, starting with a letter.');
      return;
    }
    const key = unitListNames(clean).key.toLowerCase();
    const clash = data.units.find((u) => unitListNames(u.name).key.toLowerCase() === key);
    if (clash) {
      setProblem(`There’s already a unit called ${clash.name}.`);
      return;
    }
    setProblem(null);
    void onAdd(clean).then((ok) => ok && setName(''));
  }

  return (
    <section className="settings-units" aria-labelledby="units-title">
      <h2 className="section-title" id="units-title">
        Units <span className="count">{data.units.length}</span>
      </h2>
      <ul className="unit-list">
        {data.units.map((u) => {
          const members = data.members.filter((m) => m.unit === u.name);
          const admins = members.filter((m) => m.role === 'Admin').length;
          const status = statusOf(u.name);
          return (
            <li key={u.id}>
              <button
                type="button"
                className="unit-card"
                aria-pressed={u.name === selected}
                onClick={() => onSelect(u.name)}
              >
                <span className="unit-card-name">{u.name}</span>
                <span className="unit-card-meta">
                  {plural(admins, 'admin', 'admins')} · {plural(members.length - admins, 'user', 'users')}
                </span>
                <span className={`setup-tag is-${status}`}>
                  {status === 'ready' ? 'Ready' : status === 'lists' ? 'Lists not added' : 'No SharePoint access for you'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <form className="add-unit" onSubmit={submit} noValidate>
        <label className="field">
          <span className="field-label">New unit</span>
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setProblem(null);
            }}
            placeholder="For example Kuwait"
            aria-invalid={problem ? true : undefined}
            aria-describedby={problem ? 'unit-problem' : undefined}
            maxLength={40}
          />
        </label>
        <button type="submit" className="btn btn-ghost" disabled={busy !== null}>
          <PlusIcon width={18} height={18} /> {busy === 'add-unit' ? 'Adding…' : 'Add unit'}
        </button>
        {problem && (
          <p className="field-error" id="unit-problem" role="alert">
            {problem}
          </p>
        )}
      </form>
    </section>
  );
}

function UnitPanel({
  session,
  unit,
  people,
  status,
  busy,
  onRemoveUnit,
  onAdd,
  onRole,
  onRemove,
}: {
  session: Session;
  unit: UnitRecord;
  people: MemberRecord[];
  status: Status;
  busy: string | null;
  onRemoveUnit: () => Promise<void>;
  onAdd: (person: Person, role: Role) => Promise<boolean>;
  onRole: (member: MemberRecord, role: Role) => void;
  onRemove: (member: MemberRecord) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [person, setPerson] = useState<Person | null>(null);
  const [role, setRole] = useState<Role>('User');
  const admins = people.filter((m) => m.role === 'Admin').length;

  function add(event: FormEvent) {
    event.preventDefault();
    if (!person) return;
    void onAdd(person, role).then((ok) => {
      if (ok) {
        setPerson(null);
        setRole('User');
      }
    });
  }

  return (
    <section className="panel unit-panel" aria-labelledby="unit-title">
      <header className="unit-head">
        <div>
          <p className="sheet-kicker">Unit</p>
          <h2 id="unit-title">{unit.name}</h2>
        </div>
        {!confirming && (
          <button type="button" className="btn btn-ghost btn-quiet-danger" disabled={busy !== null} onClick={() => setConfirming(true)}>
            <TrashIcon width={18} height={18} /> Remove unit
          </button>
        )}
      </header>

      {confirming && (
        <div className="confirm-box" role="alertdialog" aria-labelledby="confirm-text">
          <p id="confirm-text">
            Remove <strong>{unit.name}</strong>
            {people.length > 0 && <> and its {plural(people.length, 'person', 'people')}</>} from the app? Its SharePoint lists and
            deliveries are kept.
          </p>
          <div className="confirm-actions">
            <button type="button" className="btn btn-danger" disabled={busy !== null} onClick={() => void onRemoveUnit()}>
              {busy === 'remove-unit' ? 'Removing…' : `Remove ${unit.name}`}
            </button>
            <button type="button" className="btn btn-ghost" disabled={busy !== null} onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {status === 'lists' && <SetupSteps unit={unit.name} />}
      {status === 'locked' && (
        <p className="note-box">
          The lists are added, but your account can’t open them. Ask the site owner to give you access to {unit.name}’s
          SharePoint site.
        </p>
      )}

      <h3 className="sheet-sub people-title">
        <UsersIcon width={18} height={18} /> People <span className="count">{people.length}</span>
        {people.length > 0 && admins === 0 && <span className="warn-tag">No admin yet</span>}
      </h3>

      {people.length === 0 ? (
        <p className="muted">Nobody is in {unit.name} yet. Add the unit’s mail room admins and users below.</p>
      ) : (
        <div className="table-wrap people-wrap">
          <table className="table people-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Role</th>
                <th scope="col">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {people.map((m) => (
                <tr key={m.id}>
                  <td data-label="Name">
                    <span className="member">
                      <span className="person-avatar">{initials(m.name || m.email)}</span>
                      <span className="person-text">
                        <strong>{m.name || m.email}</strong>
                        <span>{m.email}</span>
                      </span>
                    </span>
                  </td>
                  <td data-label="Role" className="role-cell">
                    <Segmented
                      label={`Role for ${m.name || m.email}`}
                      size="sm"
                      value={m.role}
                      options={ROLE_OPTIONS}
                      onChange={(r) => r !== m.role && busy === null && onRole(m, r)}
                    />
                  </td>
                  <td className="edit-cell">
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Remove ${m.name || m.email} from ${unit.name}`}
                      title="Remove"
                      disabled={busy !== null}
                      onClick={() => onRemove(m)}
                    >
                      <TrashIcon width={18} height={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form className="add-person" onSubmit={add} noValidate>
        <div className="field">
          <span className="field-label" id="add-person-label">
            Add a person to {unit.name}
          </span>
          <PeoplePicker directory={session.directory} value={person} onChange={setPerson} describedBy="add-person-label" />
        </div>
        <div className="field">
          <span className="field-label">Role</span>
          <Segmented label="Role" value={role} options={ROLE_OPTIONS} onChange={setRole} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={!person || busy !== null}>
          {busy === 'add-person' ? 'Adding…' : 'Add'}
        </button>
      </form>
      <p className="muted small role-help">
        <strong>Users</strong> see their own mail and Department Mail. <strong>Admins</strong> also add mail and use Maintenance.
        {' '}Everyone here also needs the app shared with them, and edit access to {unit.name}’s SharePoint site.
      </p>
    </section>
  );
}

/** What it takes to connect a new unit: its two lists, added to the app and published. */
function SetupSteps({ unit }: { unit: string }) {
  const [site, setSite] = useState('');
  const recipes = unitRecipes(unit);
  const commands = [addDataSourceCommands(site, recipes.map((r) => r.name)), 'npm run build', 'pa app push'].join('\n');

  return (
    <div className="setup-box">
      <p className="setup-lede">
        <strong>{unit} isn’t ready yet.</strong> Its people won’t see it until its two lists are created and added to the app.
      </p>
      <ol className="setup-steps">
        <li>
          Create these lists on {unit}’s SharePoint site, and give only {unit}’s people edit access to it:
          <div className="recipes">
            {recipes.map((r) => (
              <ListRecipe key={r.name} recipe={r} />
            ))}
          </div>
          <ColumnHelp />
        </li>
        <li>
          In the app’s folder, add the lists and publish. Paste the site address to fill in the commands:
          <label className="field setup-site">
            <span className="sr-only">{unit} site address</span>
            <input
              value={site}
              onChange={(e) => setSite(e.target.value)}
              placeholder={`https://bankabc.sharepoint.com/sites/MailRoom${unitListNames(unit).key}`}
              spellCheck={false}
            />
          </label>
          <Command text={commands} />
        </li>
      </ol>
    </div>
  );
}
