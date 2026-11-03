import { SETTINGS_LISTS } from '../config';
import { appConfig, signedInAccount } from './auth';
import { errorMessage, findList, isDenied, isNotFound, resolveSite, type ListRef } from './graph';
import { GraphDirectory } from './people';
import { isGeneralAdmin } from './rules';
import { membershipsOf, SharePointSettings, type SettingsData, type SettingsStore, type UnitRecord } from './settings';
import { SharePointRepository } from './sharePoint';
import type { CurrentUser, Directory, MailRepository } from './types';

/** A unit the person can open. */
export interface UnitAccess {
  name: string;
  repo: MailRepository;
  /** Mail room admin here: an Admin member of the unit, or a general admin. */
  admin: boolean;
}

/** A unit's SharePoint setup, shown on the Settings page. */
export interface UnitSetup {
  name: string;
  /** The site its lists are on. */
  siteUrl: string;
  /** ready: lists found and readable. lists: the site has no lists for it yet. locked: the site can't be opened. */
  status: 'ready' | 'lists' | 'locked';
  /** Lists still to create when status is "lists". */
  missing: string[];
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
  /** Query parameters from the address, e.g. ?page=mine&unit=Egypt. */
  params: Record<string, string>;
}

/** The website can't run until its settings lists exist and can be read. */
export class SetupNeeded extends Error {
  readonly user: CurrentUser;
  readonly generalAdmin: boolean;
  readonly reason: 'no-settings-lists' | 'settings-unreadable';
  /** Settings lists still to create. */
  readonly missing: string[];

  constructor(reason: SetupNeeded['reason'], user: CurrentUser, generalAdmin: boolean, missing: string[], message: string) {
    super(message);
    this.reason = reason;
    this.user = user;
    this.generalAdmin = generalAdmin;
    this.missing = missing;
  }
}

/** The unit's site, or the settings site when none is set. */
export const unitSite = (unit: Pick<UnitRecord, 'siteUrl'>) => unit.siteUrl || appConfig.settingsSiteUrl;

/**
 * Opens the session for the signed-in person. Units and their people come
 * from the settings lists; each unit's mail is in its own two lists on its own
 * site; a person only gets the units they're a member of and that SharePoint
 * lets them open.
 */
export async function openSession(): Promise<Session> {
  const directory = new GraphDirectory();
  const user = await currentUser(directory);
  const generalAdmin = isGeneralAdmin(user);

  // The settings lists.
  let lists: { units: ListRef | null; members: ListRef | null };
  try {
    const site = await resolveSite(appConfig.settingsSiteUrl);
    const [units, members] = await Promise.all([findList(site, SETTINGS_LISTS.units), findList(site, SETTINGS_LISTS.members)]);
    lists = { units, members };
  } catch (e) {
    throw new SetupNeeded('settings-unreadable', user, generalAdmin, [], errorMessage(e));
  }
  if (!lists.units || !lists.members) {
    const missing: string[] = [];
    if (!lists.units) missing.push(SETTINGS_LISTS.units);
    if (!lists.members) missing.push(SETTINGS_LISTS.members);
    throw new SetupNeeded('no-settings-lists', user, generalAdmin, missing, `Missing ${missing.join(' and ')}.`);
  }
  const settings = new SharePointSettings(lists.units, lists.members);
  let data: SettingsData;
  try {
    data = await settings.load();
  } catch (e) {
    throw new SetupNeeded('settings-unreadable', user, generalAdmin, [], errorMessage(e));
  }

  const roles = membershipsOf(user, data);
  const relevant = data.units.filter((u) => generalAdmin || roles.has(u.name));

  const checked = await Promise.all(
    relevant.map(async (u) => {
      const repo = new SharePointRepository(u.name, unitSite(u));
      let result: Awaited<ReturnType<SharePointRepository['check']>>;
      try {
        result = await repo.check();
      } catch (e) {
        if (!isDenied(e) && !isNotFound(e)) console.warn(`Couldn't check ${u.name}:`, e);
        result = { ok: false, problem: 'no-site-access', missing: [] };
      }
      return { unit: u, repo, result };
    }),
  );

  const units: UnitAccess[] = [];
  const blocked: Session['blocked'] = [];
  for (const { unit, repo, result } of checked) {
    if (!generalAdmin && !roles.has(unit.name)) continue;
    if (result.ok) units.push({ name: unit.name, repo, admin: generalAdmin || roles.get(unit.name) === 'Admin' });
    else blocked.push({ name: unit.name, reason: result.problem === 'lists-missing' ? 'not-connected' : 'no-permission' });
  }

  return {
    user,
    params: Object.fromEntries(new URLSearchParams(window.location.search)),
    generalAdmin,
    settings,
    data,
    units,
    blocked,
    setup: generalAdmin
      ? checked.map(({ unit, result }) => ({
          name: unit.name,
          siteUrl: unitSite(unit),
          status: result.ok ? 'ready' : result.problem === 'lists-missing' ? 'lists' : 'locked',
          missing: result.ok ? [] : result.missing,
        }))
      : [],
    directory,
  };
}

/**
 * The signed-in person, known by their sign-in name and their email address,
 * which aren't always the same.
 */
async function currentUser(directory: Directory): Promise<CurrentUser> {
  const account = signedInAccount();
  const upn = (account?.username ?? '').trim().toLowerCase();
  const profile = await directory.me();
  const email = profile?.email || upn;
  return {
    name: account?.name || profile?.name || email,
    email,
    aliases: [...new Set([upn, profile?.email, profile?.upn].filter((a): a is string => !!a))],
  };
}
