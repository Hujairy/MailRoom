import { getContext } from '@microsoft/power-apps/app';
import { PEOPLE_SERVICE_NAME, SETTINGS_LISTS, unitListNames } from '../config';
import { DemoDirectory, DemoRepository } from './demo';
import { errorMessage, generatedServiceNames, isTabularService, loadGeneratedService } from './generated';
import { NoDirectory, Office365Directory } from './people';
import { isGeneralAdmin } from './rules';
import { DemoSettings, membershipsOf, SharePointSettings, type MemberRecord, type SettingsData, type SettingsStore } from './settings';
import { SharePointRepository } from './sharePoint';
import type { CurrentUser, DataMode, Directory, MailRepository } from './types';

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
  /** The person using the app. In demo mode this can be a previewed member. */
  user: CurrentUser;
  /** The member being previewed in demo mode. */
  previewing: MemberRecord | null;
  /** Demo mode: the signed-in person may see the app as other members. */
  canPreview: boolean;
  mode: DataMode;
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

export interface SessionOptions {
  /** Demo mode only: the id of a member to see the app as. */
  previewAs?: string;
}

const DEMO_USER: CurrentUser = { name: 'Demo User', email: 'demo.user@contoso.com', fromPowerApps: false };

/**
 * Opens the session. With no generated list services, the app runs on demo
 * data. Otherwise the units and their people come from the Mail Room
 * settings lists, each unit's mail is in its own two lists, and a person only
 * gets the units they're a member of and that SharePoint lets them read.
 * Force a mode with VITE_DATA_MODE=demo|sharepoint in a `.env.local` file.
 */
export async function openSession(options: SessionOptions = {}): Promise<Session> {
  const { user: signedIn, params } = await readContext();
  const setting = import.meta.env.VITE_DATA_MODE ?? 'auto';
  const listServices = generatedServiceNames().filter((n) => !looseEq(n, PEOPLE_SERVICE_NAME));

  if (setting === 'demo' || (setting !== 'sharepoint' && listServices.length === 0)) {
    return openDemo(signedIn, params, options);
  }

  const [unitsService, membersService] = await Promise.all([
    loadGeneratedService(SETTINGS_LISTS.unitsService),
    loadGeneratedService(SETTINGS_LISTS.membersService),
  ]);
  if (!isTabularService(unitsService) || !isTabularService(membersService)) {
    throw new Error(
      `The Mail Room settings lists aren't added to the app yet (missing ${[
        !isTabularService(unitsService) && 'MailroomUnits',
        !isTabularService(membersService) && 'MailroomMembers',
      ]
        .filter(Boolean)
        .join(' and ')}). Create them with scripts/Create-MailroomSettingsLists.ps1 and add them with "pa app add data-source" (see README). ` +
        (listServices.length ? `Lists found: ${listServices.join(', ')}.` : ''),
    );
  }
  const settings = new SharePointSettings(unitsService, membersService);
  let data: SettingsData;
  try {
    data = await settings.load();
  } catch (e) {
    throw new Error(
      `${errorMessage(e)} Everyone who uses the app needs Read access to the MailroomUnits and MailroomMembers lists.`,
    );
  }

  const generalAdmin = isGeneralAdmin(signedIn);
  const roles = membershipsOf(signedIn.email, data);
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

  const directory = (await Office365Directory.open(PEOPLE_SERVICE_NAME)) ?? new NoDirectory();
  return {
    user: signedIn,
    previewing: null,
    canPreview: false,
    params,
    mode: 'sharepoint',
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

const demoSettings = new DemoSettings();

/**
 * Demo mode. Running locally, or as a general admin in Power Apps, you're a
 * general admin and can preview the app as any member you add in Settings.
 * Anyone else in Power Apps gets no access, as with real data.
 */
async function openDemo(signedIn: CurrentUser, params: Record<string, string>, options: SessionOptions): Promise<Session> {
  const data = await demoSettings.load();
  const owner = !signedIn.fromPowerApps || isGeneralAdmin(signedIn);
  const previewing = owner ? (data.members.find((m) => m.id === options.previewAs) ?? null) : null;
  const user: CurrentUser = previewing
    ? { name: previewing.name || previewing.email, email: previewing.email, fromPowerApps: false }
    : signedIn;
  const generalAdmin = owner && !previewing;
  const roles = membershipsOf(user.email, data);
  return {
    user,
    previewing,
    canPreview: owner,
    params,
    mode: 'demo',
    generalAdmin,
    settings: demoSettings,
    data,
    units: data.units
      .filter((u) => generalAdmin || roles.has(u.name))
      // Demo deliveries are kept per unit for the signed-in person, so previews share them.
      .map((u) => ({ name: u.name, repo: new DemoRepository(signedIn, u.name), admin: generalAdmin || roles.get(u.name) === 'Admin' })),
    blocked: [],
    setup: generalAdmin
      ? data.units.map((u) => {
          const names = unitListNames(u.name);
          return { name: u.name, personalList: names.personal, departmentList: names.department, connected: true };
        })
      : [],
    directory: new DemoDirectory(signedIn),
  };
}

/** Clears the demo deliveries and settings kept in this browser. */
export function resetDemo() {
  demoSettings.reset();
  try {
    const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i) ?? '');
    keys.filter((k) => k.startsWith('mailroom:demo:v')).forEach((k) => localStorage.removeItem(k));
  } catch {
    // storage unavailable; nothing was saved
  }
}

function looseEq(a: string, b: string): boolean {
  const n = (s: string) => s.replace(/[^a-z0-9]/gi, '').toLowerCase().replace(/service$/, '');
  return n(a) === n(b);
}

async function readContext(): Promise<{ user: CurrentUser; params: Record<string, string> }> {
  try {
    const context = await withTimeout(getContext(), 5000);
    const email = (context.user.userPrincipalName ?? '').trim().toLowerCase();
    const params = context.app.queryParams ?? {};
    if (!email) return { user: DEMO_USER, params };
    return { user: { name: context.user.fullName || email, email, fromPowerApps: true }, params };
  } catch {
    return { user: DEMO_USER, params: {} };
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
