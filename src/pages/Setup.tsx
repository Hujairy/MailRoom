import { useState } from 'react';
import { APP_TITLE, SETTINGS_LISTS, unitListNames } from '../config';
import type { SetupNeeded } from '../data';
import {
  addDataSourceCommands,
  ColumnHelp,
  Command,
  ListRecipe,
  SETTINGS_RECIPES,
  unitRecipes,
} from '../components/ListRecipe';
import tileUrl from '../assets/bankabc-tile.png';

const UNIT_NAME = /^[A-Za-z][A-Za-z0-9 ]{1,39}$/;

/** Shown until the app's SharePoint lists are connected. General admins get the steps. */
export function Setup({ problem }: { problem: SetupNeeded }) {
  const { user, generalAdmin, reason } = problem;

  if (!generalAdmin) {
    return (
      <div className="boot no-access" role="alert">
        <img className="boot-mark" src={tileUrl} alt="" width={72} height={72} />
        {reason === 'settings-unreadable' ? (
          <>
            <h1>You don’t have access to {APP_TITLE} yet</h1>
            <p>
              Ask a {APP_TITLE} general admin to give <strong>{user.email}</strong> access to the {APP_TITLE} settings site, then
              open the app again.
            </p>
          </>
        ) : (
          <>
            <h1>{APP_TITLE} isn’t set up yet</h1>
            <p>It will be ready as soon as a general admin connects it to SharePoint. Please check back later.</p>
          </>
        )}
      </div>
    );
  }

  if (reason === 'settings-unreadable') {
    return (
      <div className="setup-page">
        <SetupHead title={`${APP_TITLE} can’t read its settings lists`} />
        <p className="error-box" role="alert">
          {problem.message}
        </p>
        <p className="lede">
          Check that <strong>{user.email}</strong> can open the {SETTINGS_LISTS.unitsService.replace(/Service$/, '')} and{' '}
          {SETTINGS_LISTS.membersService.replace(/Service$/, '')} lists in SharePoint, then open the app again.
        </p>
      </div>
    );
  }

  return <SetupSteps problem={problem} />;
}

function SetupHead({ title, text }: { title: string; text?: string }) {
  return (
    <header className="setup-head">
      <img src={tileUrl} alt="" width={56} height={56} />
      <div>
        <h1 className="page-title">{title}</h1>
        {text && <p className="page-text">{text}</p>}
      </div>
    </header>
  );
}

function SetupSteps({ problem }: { problem: SetupNeeded }) {
  const [unit, setUnit] = useState('Bahrain');
  const [settingsSite, setSettingsSite] = useState('');
  const [unitSite, setUnitSite] = useState('');
  const unitOk = UNIT_NAME.test(unit.trim());
  const names = unitListNames(unitOk ? unit.trim() : 'Bahrain');
  const unitName = unitOk ? unit.trim() : 'Bahrain';

  const commands = [
    'pa connection list',
    addDataSourceCommands(settingsSite, SETTINGS_RECIPES.map((r) => r.name)),
    addDataSourceCommands(unitSite, [names.personal, names.department]),
    'pa app add data-source --connector "shared_office365users" --connection-id "<office365users-id>"',
    'npm run build',
    'pa app push',
  ].join('\n');

  return (
    <div className="setup-page">
      <SetupHead
        title={`Connect ${APP_TITLE} to SharePoint`}
        text="Units, people and deliveries are kept in SharePoint lists, so everyone you add sees the same data. Set them up once, then publish the app again."
      />

      {problem.found.length > 0 && (
        <p className="note-box is-info">Already added to the app: {problem.found.join(', ')}.</p>
      )}

      <ol className="setup-list">
        <li className="panel setup-step">
          <h2>Create the settings lists</h2>
          <p>
            Use a SharePoint site that everyone who uses the app can <strong>read</strong>, but only general admins can{' '}
            <strong>edit</strong>, for example a new <em>Mail Room Settings</em> site. Otherwise people could add themselves to a
            unit in SharePoint.
          </p>
          <div className="recipes">
            {SETTINGS_RECIPES.map((r) => (
              <ListRecipe key={r.name} recipe={r} />
            ))}
          </div>
          <ColumnHelp />
        </li>

        <li className="panel setup-step">
          <h2>Create your first unit’s lists</h2>
          <p>
            Each unit keeps its mail in its own two lists, ideally on its own site. Give only that unit’s people{' '}
            <strong>edit</strong> access to the site. That’s what keeps units apart.
          </p>
          <label className="field setup-unit">
            <span className="field-label">Unit name</span>
            <input value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={40} aria-invalid={!unitOk || undefined} />
            {!unitOk && <span className="field-error">Use 2 to 40 letters, numbers or spaces, starting with a letter.</span>}
          </label>
          <div className="recipes">
            {unitRecipes(unitName).map((r) => (
              <ListRecipe key={r.name} recipe={r} />
            ))}
          </div>
          <p className="recipe-help">
            Same columns for every unit. If you can run PowerShell with PnP, <code>scripts/Create-MailroomSettingsLists.ps1</code>{' '}
            and <code>scripts/Create-MailroomLists.ps1</code> create the lists for you.
          </p>
        </li>

        <li className="panel setup-step">
          <h2>Add the lists to the app and publish</h2>
          <p>
            Paste the two site addresses to fill in the commands. Run them in VS Code’s Command Prompt, in the MailRoom folder.
            Replace <code>&lt;id&gt;</code> with your SharePoint connection’s id from <code>pa connection list</code>. If there
            isn’t one, create it at make.powerapps.com, under Connections.
          </p>
          <div className="setup-sites">
            <label className="field">
              <span className="field-label">Settings site address</span>
              <input
                value={settingsSite}
                onChange={(e) => setSettingsSite(e.target.value)}
                placeholder="https://bankabc.sharepoint.com/sites/MailRoomSettings"
                spellCheck={false}
              />
            </label>
            <label className="field">
              <span className="field-label">{unitName} site address</span>
              <input
                value={unitSite}
                onChange={(e) => setUnitSite(e.target.value)}
                placeholder={`https://bankabc.sharepoint.com/sites/MailRoom${names.key}`}
                spellCheck={false}
              />
            </label>
          </div>
          <Command text={commands} />
          <p className="recipe-help">
            The Office 365 Users line is optional but recommended: it lets you find people by name, and matches people whose sign-in
            name differs from their email address.
          </p>
        </li>

        <li className="panel setup-step">
          <h2>Add {unitName} and its people</h2>
          <p>
            Open the app again. You’ll have a <strong>Settings</strong> page: add the <strong>{unitName}</strong> unit, then its
            users and admins. Each person also needs:
          </p>
          <ul className="setup-bullets">
            <li>The app shared with them in Power Apps, and a Power Apps Premium license.</li>
            <li>Read access to the settings site, and edit access to {unitName}’s site.</li>
          </ul>
        </li>
      </ol>
    </div>
  );
}
