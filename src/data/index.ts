import { getContext } from '@microsoft/power-apps/app';
import { PEOPLE_SERVICE_NAME, SETTINGS_LISTS, unitListNames } from '../config';
import { errorMessage, generatedServiceNames, isTabularService, loadGeneratedService } from './generated';
import { NoDirectory, Office365Directory } from './people';
import { isGeneralAdmin } from './rules';
import { membershipsOf, SharePointSettings, type SettingsData, type SettingsStore } from './settings';
import { SharePointRepository } from './sharePoint';
import type { CurrentUser, Directory, MailRepository } from './types';

/** A unit the person can open. */
export interface UnitAccess {
  name: string;
  repo: MailRepository;
  /** Mail room admin here: an Admin member of the unit, or a general admin. */
  admin: boolean;
}

/** Whether a unit's two lists are part of this build. Shown on the Settings page. */
export interface UnitSetup {
  name: string;
  personalList: string;
  departmentList: string;
  connected: boolean;
}

export interface Session {
  user: CurrentUser;
  /** May open Settings, and is an admin in every unit. */
  generalAdmin: boolean;
  settings: SettingsStore;
  data: SettingsData;
  /** Only the units this person can open. Everything else stays out of the app. */
  units: UnitAccess[];
  /** Units this person belongs to but can't open yet. */
  blocked: { name: string; reason: 'not-connected' | 'no-permission' }[];
  /** Every unit's setup. Only filled in for general admins. */
  setup: UnitSetup[];
  directory: Directory;
  /** Query parameters from the Power Apps link, e.g. ?page=mine&unit=Egypt. */
  params: Record<string, string>;
}

/** The app can't run until its SharePoint lists are connected. */
export class SetupNeeded extends Error {
  readonly user: CurrentUser;
  readonly generalAdmin: boolean;
  readonly reason: 'no-settings-lists' | 'settings-unreadable';
  /** Lists already added to the app. */
  readonly found: string[];

  constructor(
    reason: SetupNeeded['reason'],
    user: CurrentUser,
    generalAdmin: boolean,
    found: string[],
    message: string,
  ) {
    super(message);
    this.reason = reason;
    this.user = user;
    this.generalAdmin = generalAdmin;
    this.found = found;
  }
}

const LOCAL_USER: CurrentUser = { name: 'Local developer', email: 'local@localhost', aliases: [], fromPowerApps: false };

/**
 * Opens the session. Units and their people come from the Mail Room settings
 * lists, each unit's mail is in its own two lists, and a person only gets the
 * units they're a member of and that SharePoint lets them read.
 * Throws SetupNeeded until the settings lists are added to the app.
 */
export async function openSession(): Promise<Session> {
  const context = await readContext();
  const directory = (await Office365Directory.open(PEOPLE_SERVICE_NAME)) ?? new NoDirectory();
  const user = await withProfile(context.user, directory);
  const generalAdmin = isGeneralAdmin(user);
  const found = generatedServiceNames()
    .filter((n) => !looseEq(n, PEOPLE_SERVICE_NAME))
    .map((n) => n.replace(/Service$/, ''));

  const [unitsService, membersService] = await Promise.all([
    loadGeneratedService(SETTINGS_LISTS.unitsService),
    loadGeneratedService(SETTINGS_LISTS.membersService),
  ]);
  if (!isTabularService(unitsService) || !isTabularService(membersService)) {
    throw new SetupNeeded('no-settings-lists', user, generalAdmin, found, 'The Mail Room lists aren’t connected yet.');
  }
  const settings = new SharePointSettings(unitsService, membersService);
  let data: SettingsData;
  try {
    data = await settings.load();
  } catch (e) {
    throw new SetupNeeded('settings-unreadable', user, generalAdmin, found, errorMessage(e));
  }

  const roles = membershipsOf(user, data);
  const mine = data.units.filter((u) => generalAdmin || roles.has(u.name));

  const resolved = await Promise.all(
    (generalAdmin ? data.units : mine).map(async (u) => {
      const names = unitListNames(u.name);
      const [personal, department] = await Promise.all([
        loadGeneratedService(`${names.personal}Service`),
        loadGeneratedService(`${names.department}Service`),
      ]);
      const repo =
        isTabularService(personal) && isTabularService(department)
          ? new SharePointRepository(u.name, personal, department)
          : null;
      return { name: u.name, names, repo };
    }),
  );

  const units: UnitAccess[] = [];
  const blocked: Session['blocked'] = [];
  await Promise.all(
    resolved
      .filter((r) => mine.some((u) => u.name === r.name))
      .map(async (r) => {
        if (!r.repo) return blocked.push({ name: r.name, reason: 'not-connected' });
        // SharePoint permissions keep units apart: no access to the lists, no unit.
        const { ok } = await r.repo.canOpen();
        if (ok) units.push({ name: r.name, repo: r.repo, admin: generalAdmin || roles.get(r.name) === 'Admin' });
        else blocked.push({ name: r.name, reason: 'no-permission' });
      }),
  );
  const order = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

  return {
    user,
    params: context.params,
    generalAdmin,
    settings,
    data,
    units: units.sort(order),
    blocked: blocked.sort(order),
    setup: generalAdmin
      ? resolved.map((r) => ({
          name: r.name,
          personalList: r.names.personal,
          departmentList: r.names.department,
          connected: r.repo !== null,
        }))
      : [],
    directory,
  };
}

/**
 * A person signs in with their user principal name, which isn't always their
 * email address. With the company directory connected, add their email so
 * Settings and personal mail find them by either.
 */
async function withProfile(user: CurrentUser, directory: Directory): Promise<CurrentUser> {
  const profile = await directory.me();
  if (!profile) return user;
  const aliases = [...new Set([...user.aliases, profile.email, profile.upn].filter((a): a is string => !!a))];
  return {
    ...user,
    name: user.name && user.name !== user.email ? user.name : profile.name || user.name,
    email: profile.email || user.email,
    aliases,
  };
}

function looseEq(a: string, b: string): boolean {
  const n = (s: string) => s.replace(/[^a-z0-9]/gi, '').toLowerCase().replace(/service$/, '');
  return n(a) === n(b);
}

async function readContext(): Promise<{ user: CurrentUser; params: Record<string, string> }> {
  try {
    const context = await withTimeout(getContext(), 5000);
    const upn = (context.user.userPrincipalName ?? '').trim().toLowerCase();
    const params = context.app.queryParams ?? {};
    if (!upn) return { user: LOCAL_USER, params };
    return { user: { name: context.user.fullName || upn, email: upn, aliases: [upn], fromPowerApps: true }, params };
  } catch {
    return { user: LOCAL_USER, params: {} };
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out reading Power Apps context.')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}
