import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
} from '@azure/msal-browser';
import { SIGN_IN_SCOPES } from '../config';

/** Settings read at startup from `mailroom.config.json`, next to index.html. */
export interface AppConfig {
  /** Entra ID tenant: the directory (tenant) ID, or a domain such as bank-abc.com. */
  tenantId: string;
  /** The website's app registration: Application (client) ID. */
  clientId: string;
  /** The SharePoint site with the MailroomUnits and MailroomMembers lists. */
  settingsSiteUrl: string;
  /** Full access to every unit and to Settings. */
  generalAdmins: string[];
  /** Optional. Defaults to the address the website is opened from. */
  redirectUri?: string;
}

/** Filled in by loadConfig() before anything else runs. */
export const appConfig: AppConfig = { tenantId: '', clientId: '', settingsSiteUrl: '', generalAdmins: [] };

/** The config file is missing or still has placeholders. */
export class ConfigNeeded extends Error {
  readonly missing: string[];
  constructor(missing: string[], message: string) {
    super(message);
    this.missing = missing;
  }
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const unset = (value: unknown) => typeof value !== 'string' || !value.trim() || /PASTE|<|>/i.test(value);

export async function loadConfig(): Promise<AppConfig> {
  let raw: Partial<AppConfig>;
  try {
    const response = await fetch('./mailroom.config.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    raw = (await response.json()) as Partial<AppConfig>;
  } catch (e) {
    throw new ConfigNeeded(['mailroom.config.json'], `mailroom.config.json couldn’t be read (${e instanceof Error ? e.message : e}).`);
  }
  const missing: string[] = [];
  if (unset(raw.tenantId)) missing.push('tenantId');
  if (unset(raw.clientId) || !GUID.test(raw.clientId!.trim())) missing.push('clientId');
  if (unset(raw.settingsSiteUrl) || !/^https:\/\/[^/]+\.sharepoint\.com\//i.test(raw.settingsSiteUrl!.trim())) missing.push('settingsSiteUrl');
  const admins = Array.isArray(raw.generalAdmins) ? raw.generalAdmins.filter((a) => !unset(a) && a.includes('@')) : [];
  if (admins.length === 0) missing.push('generalAdmins');
  if (missing.length) throw new ConfigNeeded(missing, `mailroom.config.json still needs: ${missing.join(', ')}.`);

  Object.assign(appConfig, {
    tenantId: raw.tenantId!.trim(),
    clientId: raw.clientId!.trim(),
    settingsSiteUrl: raw.settingsSiteUrl!.trim(),
    generalAdmins: admins.map((a) => a.trim().toLowerCase()),
    redirectUri: unset(raw.redirectUri) ? undefined : raw.redirectUri!.trim(),
  });
  return appConfig;
}

let msal: PublicClientApplication | null = null;
let account: AccountInfo | null = null;

/** The address Entra ID sends people back to after signing in. Register it in the app registration. */
export function redirectUri(): string {
  return appConfig.redirectUri ?? `${window.location.origin}${window.location.pathname.replace(/[^/]*\.html$/, '')}`;
}

/**
 * Starts MSAL and finishes a sign-in redirect if there is one. Returns the
 * signed-in account, or null when the person still has to sign in.
 */
export function startAuth(): Promise<AccountInfo | null> {
  // Only once per page load, even when React runs effects twice in development.
  started ??= start();
  return started;
}

let started: Promise<AccountInfo | null> | null = null;

async function start(): Promise<AccountInfo | null> {
  msal = new PublicClientApplication({
    auth: {
      clientId: appConfig.clientId,
      authority: `https://login.microsoftonline.com/${appConfig.tenantId}`,
      redirectUri: redirectUri(),
      postLogoutRedirectUri: redirectUri(),
    },
    cache: { cacheLocation: 'localStorage' },
  });
  await msal.initialize();
  const result = await msal.handleRedirectPromise();
  account = result?.account ?? msal.getActiveAccount() ?? msal.getAllAccounts()[0] ?? null;
  if (account) msal.setActiveAccount(account);
  return account;
}

export function signedInAccount(): AccountInfo | null {
  return account;
}

export async function signIn(): Promise<void> {
  await client().loginRedirect({ scopes: SIGN_IN_SCOPES, prompt: 'select_account' });
}

export async function signOut(): Promise<void> {
  await client().logoutRedirect({ account: account ?? undefined });
}

/**
 * An access token for Microsoft Graph. When Entra ID needs the person to
 * sign in again or approve a permission, this redirects and never resolves.
 */
export async function getToken(scopes: string[] = SIGN_IN_SCOPES): Promise<string> {
  const app = client();
  if (!account) throw new Error('You’re signed out. Reload the page to sign in again.');
  try {
    const result = await app.acquireTokenSilent({ scopes, account });
    return result.accessToken;
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError) {
      await app.acquireTokenRedirect({ scopes, account });
      return new Promise<string>(() => undefined);
    }
    throw e;
  }
}

function client(): PublicClientApplication {
  if (!msal) throw new Error('Sign-in hasn’t started yet.');
  return msal;
}
