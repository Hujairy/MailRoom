/* eslint-disable */
import * as React from 'react';
import { useState } from 'react';
import { APP_TITLE } from '../config';
import type { SetupNeeded } from '../data';
import { appConfig } from '../data/context';
import { errorMessage } from '../data/rest';
import { createMissingLists } from '../data/provision';
import { SETTINGS_RECIPES } from '../data/recipes';
import { ColumnHelp, ListRecipe } from '../components/ListRecipe';
import { tileUrl } from '../assets';

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
              then reload this page.
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
          Check the web part’s <strong>Settings site</strong> property (edit the page, then the web part’s settings). It’s now{' '}
          <a href={appConfig.settingsSiteUrl} target="_blank" rel="noreferrer">
            {appConfig.settingsSiteUrl}
          </a>
          . Also check that <strong>{user.email}</strong> can open that site.
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
          “Create them for me” needs permission to create lists on that site (site owner or Full Control). Otherwise, create them
          by hand.
        </p>
        <ColumnHelp />
      </section>
    </div>
  );
}
