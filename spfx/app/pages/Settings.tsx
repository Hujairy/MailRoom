/* eslint-disable */
import * as React from 'react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { unitListNames } from '../config';
import { unitSite, type Session, type UnitSetup } from '../data';
import { appConfig } from '../data/context';
import { errorMessage, normalizeSiteUrl } from '../data/rest';
import { addSiteColumn, createMissingLists, unitsList } from '../data/provision';
import { unitRecipes } from '../data/recipes';
import { isAddressOf, sameEmail } from '../data/rules';
import type { MemberRecord, Role, SettingsData, UnitRecord } from '../data/settings';
import type { Person } from '../data/types';
import { initials, plural } from '../lib/format';
import { BuildingIcon, PencilIcon, PlusIcon, TrashIcon, UsersIcon } from '../components/icons';
import { ColumnHelp, ListRecipe } from '../components/ListRecipe';
import { PageHead } from '../components/PageHead';
import { PeoplePicker } from '../components/PeoplePicker';
import { Segmented } from '../components/Segmented';

interface Props {
  session: Session;
  notify: (message: string) => void;
  /** Called after every change so the rest of the app picks it up. */
  onChanged: () => void;
}

type Status = UnitSetup['status'] | 'checking';

const SITE_URL = /^https:\/\/[^/]+\.sharepoint\.com(\/.*)?$/i;

/** Checks a pasted site address and tidies it, or returns a problem. */
function cleanSite(value: string): { url: string } | { problem: string } {
  if (!value.trim()) return { url: '' };
  if (!SITE_URL.test(value.trim())) return { problem: 'Paste the site’s address, starting with https:// and ending in sharepoint.com/sites/…' };
  try {
    return { url: normalizeSiteUrl(value) };
  } catch {
    return { problem: 'That isn’t a valid address.' };
  }
}

const UNIT_NAME = /^[A-Za-z][A-Za-z0-9 ]{1,39}$/;
const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'User', label: 'User' },
  { value: 'Admin', label: 'Admin' },
];

/** General admins only: units, and who is a user or an admin in each. */
export function Settings({ session, notify, onChanged }: Props) {
  const { settings, user } = session;
  const [data, setData] = useState<SettingsData>(session.data);
  // Pick up the latest lists whenever the app reloads (after every change).
  useEffect(() => setData(session.data), [session.data]);
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

  const setupOf = (name: string) => session.setup.find((s) => s.name === name);
  const statusOf = (name: string): Status => setupOf(name)?.status ?? 'checking';

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
      setError(errorMessage(e));
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

      {!data.hasSiteColumn && (
        <div className="note-box is-info site-column-note">
          <p>
            <strong>All units use the settings site.</strong> To keep each unit’s lists on its own site, MailroomUnits needs a{' '}
            <code>SiteUrl</code> column (single line of text).
          </p>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy !== null}
            onClick={() =>
              void run(
                'site-column',
                async () => {
                  const list = await unitsList(appConfig.settingsSiteUrl);
                  if (!list) throw new Error('MailroomUnits wasn’t found on the settings site.');
                  await addSiteColumn(list);
                },
                'Added the SiteUrl column',
              )
            }
          >
            {busy === 'site-column' ? 'Adding…' : 'Add it for me'}
          </button>
        </div>
      )}

      <div className="settings-layout">
        <UnitsColumn
          data={data}
          selected={unit?.name ?? ''}
          busy={busy}
          statusOf={statusOf}
          onSelect={setSelected}
          onAdd={async (name, siteUrl) => {
            const ok = await run('add-unit', () => settings.addUnit(name, siteUrl), `Added the ${name} unit`);
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
            setup={setupOf(unit.name)}
            canSetSite={data.hasSiteColumn}
            busy={busy}
            onSite={(siteUrl) =>
              run('site', () => settings.setUnitSite(unit, siteUrl), `${unit.name} now uses ${siteUrl || 'the settings site'}`)
            }
            onCreateLists={(missing) =>
              run(
                'create-lists',
                () => createMissingLists(unitSite(unit), unitRecipes(unit.name).filter((r) => missing.includes(r.name))),
                `Created the ${unit.name} lists`,
              )
            }
            onCheck={onChanged}
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
          General admins <span className="count">{appConfig.generalAdmins.length}</span>
        </h2>
        <p className="muted">
          Full access: every unit, the admin pages, and this page. The list is in the web part’s properties (edit the page, then
          the web part’s settings), so nobody can be locked out from here.
        </p>
        <ul className="admin-list">
          {appConfig.generalAdmins.map((email) => (
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
  onAdd: (name: string, siteUrl: string) => Promise<boolean>;
}) {
  const [name, setName] = useState('');
  const [site, setSite] = useState('');
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
    const siteUrl = cleanSite(site);
    if ('problem' in siteUrl) {
      setProblem(siteUrl.problem);
      return;
    }
    setProblem(null);
    void onAdd(clean, siteUrl.url).then((ok) => {
      if (ok) {
        setName('');
        setSite('');
      }
    });
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
                  {status === 'ready'
                    ? 'Ready'
                    : status === 'lists'
                      ? 'Lists not created'
                      : status === 'locked'
                        ? 'Can’t open its site'
                        : 'Checking…'}
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
        {data.hasSiteColumn && (
          <label className="field add-unit-site">
            <span className="field-label">
              SharePoint site <em>optional</em>
            </span>
            <input
              value={site}
              onChange={(e) => {
                setSite(e.target.value);
                setProblem(null);
              }}
              placeholder="Leave empty for the settings site"
              spellCheck={false}
            />
          </label>
        )}
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
  setup,
  canSetSite,
  busy,
  onSite,
  onCreateLists,
  onCheck,
  onRemoveUnit,
  onAdd,
  onRole,
  onRemove,
}: {
  session: Session;
  unit: UnitRecord;
  people: MemberRecord[];
  status: Status;
  setup: UnitSetup | undefined;
  canSetSite: boolean;
  busy: string | null;
  onSite: (siteUrl: string) => Promise<boolean>;
  onCreateLists: (missing: string[]) => Promise<boolean>;
  onCheck: () => void;
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

      <SiteRow unit={unit} canEdit={canSetSite} busy={busy} onSave={onSite} />

      {status === 'lists' && (
        <UnitLists unit={unit.name} missing={setup?.missing ?? []} busy={busy} onCreate={onCreateLists} onCheck={onCheck} />
      )}
      {status === 'locked' && (
        <p className="note-box">
          This site can’t be opened with your account. Check the address, or ask the site owner to give you access. Its people
          won’t see {unit.name} until it works.
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
          <Segmented<Role> label="Role" value={role} options={ROLE_OPTIONS} onChange={setRole} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={!person || busy !== null}>
          {busy === 'add-person' ? 'Adding…' : 'Add'}
        </button>
      </form>
      <p className="muted small role-help">
        <strong>Users</strong> see their own mail and Department Mail. <strong>Admins</strong> also add mail and use Maintenance.
        {' '}Everyone here also needs edit access to {unit.name}’s SharePoint site.
      </p>
    </section>
  );
}

/** The unit's SharePoint site, which a general admin can change. */
function SiteRow({
  unit,
  canEdit,
  busy,
  onSave,
}: {
  unit: UnitRecord;
  canEdit: boolean;
  busy: string | null;
  onSave: (siteUrl: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(unit.siteUrl);
  const [problem, setProblem] = useState<string | null>(null);
  const site = unitSite(unit);

  function save(event: FormEvent) {
    event.preventDefault();
    const cleaned = cleanSite(value);
    if ('problem' in cleaned) {
      setProblem(cleaned.problem);
      return;
    }
    void onSave(cleaned.url).then((ok) => ok && setEditing(false));
  }

  if (editing) {
    return (
      <form className="site-row is-editing" onSubmit={save} noValidate>
        <label className="field">
          <span className="field-label">SharePoint site</span>
          <input
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setProblem(null);
            }}
            placeholder="Leave empty for the settings site"
            spellCheck={false}
            autoFocus
          />
        </label>
        <div className="site-row-actions">
          <button type="submit" className="btn btn-primary" disabled={busy !== null}>
            {busy === 'site' ? 'Saving…' : 'Save'}
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy !== null} onClick={() => setEditing(false)}>
            Cancel
          </button>
        </div>
        {problem && <p className="field-error">{problem}</p>}
      </form>
    );
  }

  return (
    <div className="site-row">
      <span className="field-label">SharePoint site</span>
      <a href={site} target="_blank" rel="noreferrer" className="site-link">
        {site.replace(/^https:\/\//, '')}
      </a>
      {!unit.siteUrl && <span className="muted small">(the settings site)</span>}
      {canEdit && (
        <button type="button" className="icon-btn" aria-label="Change the SharePoint site" title="Change" onClick={() => setEditing(true)}>
          <PencilIcon width={17} height={17} />
        </button>
      )}
    </div>
  );
}

/** The unit's lists aren't on its site yet: create them, or by hand. */
function UnitLists({
  unit,
  missing,
  busy,
  onCreate,
  onCheck,
}: {
  unit: string;
  missing: string[];
  busy: string | null;
  onCreate: (missing: string[]) => Promise<boolean>;
  onCheck: () => void;
}) {
  const recipes = unitRecipes(unit).filter((r) => missing.length === 0 || missing.includes(r.name));
  return (
    <div className="setup-box">
      <p className="setup-lede">
        <strong>{unit} isn’t ready yet.</strong> Its people won’t see it until {recipes.length === 1 ? 'this list exists' : 'these lists exist'} on its
        site. Give only {unit}’s people edit access to that site.
      </p>
      <div className="recipes">
        {recipes.map((r) => (
          <ListRecipe key={r.name} recipe={r} />
        ))}
      </div>
      <div className="setup-actions">
        <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={() => void onCreate(recipes.map((r) => r.name))}>
          {busy === 'create-lists' ? 'Creating…' : 'Create them for me'}
        </button>
        <button type="button" className="btn btn-ghost" disabled={busy !== null} onClick={onCheck}>
          Check again
        </button>
      </div>
      <p className="recipe-help">
        “Create them for me” needs permission to create lists on that site (site owner or Full Control).
      </p>
      <ColumnHelp />
    </div>
  );
}
