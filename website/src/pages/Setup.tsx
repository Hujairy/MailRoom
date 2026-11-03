import { useState } from 'react';
import { APP_TITLE } from '../config';
import type { SetupNeeded } from '../data';
import { appConfig, redirectUri, signIn, type ConfigNeeded } from '../data/auth';
import { errorMessage } from '../data/graph';
import { createMissingLists } from '../data/provision';
import { SETTINGS_RECIPES } from '../data/recipes';
import { ColumnHelp, ListRecipe } from '../components/ListRecipe';
import tileUrl from '../assets/bankabc-tile.png';
import wordmarkUrl from '../assets/bankabc-wordmark.png';

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

/** mailroom.config.json is missing or incomplete. Shown to whoever sets up the website. */
export function ConfigScreen({ problem }: { problem: ConfigNeeded }) {
  return (
    <div className="setup-page">
      <SetupHead title={`${APP_TITLE} needs its settings`} text={problem.message} />
      <section className="panel setup-step setup-step-plain">
        <h2>Fill in mailroom.config.json</h2>
        <p>
          It’s next to <code>index.html</code> on the web server (in the <code>public</code> folder before building). See
          WEBSITE-SETUP.txt in the repository for where each value comes from.
        </p>
        <pre className="config-sample">{`{
  "tenantId": "Directory (tenant) ID of the app registration",
  "clientId": "Application (client) ID of the app registration",
  "settingsSiteUrl": "https://bankabc.sharepoint.com/sites/MailRoomSettings",
  "generalAdmins": ["hawra.alhujairy@bank-abc.com"]
}`}</pre>
        <p className="recipe-help">
          In the app registration, add this address as a <strong>Single-page application</strong> redirect URI:{' '}
          <code>{redirectUri()}</code>
        </p>
      </section>
    </div>
  );
}

/** Shown until the person signs in. */
export function SignInScreen({ error }: { error?: string | null }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="boot sign-in">
      <img className="sign-in-logo" src={wordmarkUrl} alt="Bank ABC" width={214} height={40} />
      <h1>{APP_TITLE}</h1>
      <p>Sign in with your Bank ABC work account.</p>
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
      <button
        type="button"
        className="btn btn-primary btn-lg"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          signIn().catch(() => setBusy(false));
        }}
      >
        {busy ? 'Opening sign-in…' : 'Sign in'}
      </button>
    </div>
  );
}

/** The settings lists are missing or can't be read. General admins get the fix. */
export function Setup({ problem, onRetry }: { problem: SetupNeeded; onRetry: () => void }) {
  const { user, generalAdmin, reason } = problem;

  if (!generalAdmin) {
    return (
      <div className="boot no-access" role="alert">
        <img className="boot-mark" src={tileUrl} alt="" width={72} height={72} />
        {reason === 'settings-unreadable' ? (
          <>
            <h1>You don’t have access to {APP_TITLE} yet</h1>
            <p>
              Ask a {APP_TITLE} general admin to give <strong>{user.email}</strong> Read access to the {APP_TITLE} settings site,
              then open the website again.
            </p>
          </>
        ) : (
          <>
            <h1>{APP_TITLE} isn’t set up yet</h1>
            <p>It will be ready as soon as a general admin finishes setting it up. Please check back later.</p>
          </>
        )}
      </div>
    );
  }

  if (reason === 'settings-unreadable') {
    return (
      <div className="setup-page">
        <SetupHead title={`${APP_TITLE} can’t open its settings site`} />
        <p className="error-box" role="alert">
          {problem.message}
        </p>
        <p className="lede">
          Check that <code>settingsSiteUrl</code> in mailroom.config.json is right (now{' '}
          <a href={appConfig.settingsSiteUrl} target="_blank" rel="noreferrer">
            {appConfig.settingsSiteUrl}
          </a>
          ), and that <strong>{user.email}</strong> can open that site.
        </p>
        <button type="button" className="btn btn-ghost" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }

  return <CreateSettingsLists problem={problem} onDone={onRetry} />;
}

function CreateSettingsLists({ problem, onDone }: { problem: SetupNeeded; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recipes = SETTINGS_RECIPES.filter((r) => problem.missing.includes(r.name));

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await createMissingLists(appConfig.settingsSiteUrl, recipes);
      onDone();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <div className="setup-page">
      <SetupHead
        title={`Set up ${APP_TITLE}`}
        text="Units and people are kept in two lists on the settings site. Create them once; everything else is done in Settings."
      />
      <section className="panel setup-step setup-step-plain">
        <h2>Create the settings lists</h2>
        <p>
          On{' '}
          <a href={appConfig.settingsSiteUrl} target="_blank" rel="noreferrer">
            {appConfig.settingsSiteUrl}
          </a>
          . Everyone who uses {APP_TITLE} needs <strong>Read</strong> access to this site, and only general admins should be able
          to <strong>edit</strong> it.
        </p>
        <div className="recipes">
          {recipes.map((r) => (
            <ListRecipe key={r.name} recipe={r} />
          ))}
        </div>
        {error && (
          <p className="error-box" role="alert">
            {error}
          </p>
        )}
        <div className="setup-actions">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void create()}>
            {busy ? 'Creating…' : `Create ${recipes.length === 1 ? 'it' : 'them'} for me`}
          </button>
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onDone}>
            I’ve created them, check again
          </button>
        </div>
        <p className="recipe-help">
          “Create them for me” asks you to approve one more permission (Sites.Manage.All) the first time. If your organisation
          needs an admin to approve it, create the lists by hand instead.
        </p>
        <ColumnHelp />
      </section>
    </div>
  );
}
