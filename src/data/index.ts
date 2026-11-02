import { getContext } from '@microsoft/power-apps/app';
import { PEOPLE_SERVICE_NAME, UNITS, type UnitConfig } from '../config';
import { DemoDirectory, DemoRepository } from './demo';
import { generatedServiceNames, isTabularService, loadGeneratedService } from './generated';
import { NoDirectory, Office365Directory } from './people';
import { isAdmin } from './rules';
import { SharePointRepository } from './sharePoint';
import type { CurrentUser, DataMode, Directory, MailRepository } from './types';

/** A unit the signed-in person can open. */
export interface UnitAccess {
  config: UnitConfig;
  repo: MailRepository;
  /** Listed as an admin for this unit (or a super admin). */
  admin: boolean;
}

export interface Session {
  user: CurrentUser;
  mode: DataMode;
  /** Only the units this person can open. Everything else stays out of the app. */
  units: UnitAccess[];
  directory: Directory;
  /** Query parameters from the Power Apps link, e.g. ?page=mine&unit=Egypt. */
  params: Record<string, string>;
}

const DEMO_USER: CurrentUser = { name: 'Demo User', email: 'demo.user@contoso.com', fromPowerApps: false };

/**
 * Opens the session. With no generated list services, the app runs on demo
 * data. Otherwise each unit in config.ts uses its own two lists, and the
 * person only gets the units whose lists SharePoint lets them read.
 * Force a mode with VITE_DATA_MODE=demo|sharepoint in a `.env.local` file.
 */
export async function openSession(): Promise<Session> {
  const { user, params } = await readContext();
  const setting = import.meta.env.VITE_DATA_MODE ?? 'auto';
  const listServices = generatedServiceNames().filter((n) => !looseEq(n, PEOPLE_SERVICE_NAME));

  if (setting === 'demo' || (setting !== 'sharepoint' && listServices.length === 0)) {
    return {
      user,
      params,
      mode: 'demo',
      units: UNITS.map((config) => ({ config, repo: new DemoRepository(user, config.name), admin: isAdmin(user, config) })),
      directory: new DemoDirectory(user),
    };
  }

  // Each configured unit needs both of its list services.
  const configured: { config: UnitConfig; repo: SharePointRepository }[] = [];
  const problems: string[] = [];
  for (const config of UNITS) {
    const [personal, department] = await Promise.all([
      loadGeneratedService(config.personalMailService),
      loadGeneratedService(config.departmentMailService),
    ]);
    if (isTabularService(personal) && isTabularService(department)) {
      configured.push({ config, repo: new SharePointRepository(config.name, personal, department) });
    } else if (personal || department) {
      problems.push(
        `${config.name} is missing ${!isTabularService(personal) ? config.personalMailService : config.departmentMailService}`,
      );
    }
  }
  if (configured.length === 0) {
    throw new Error(
      'None of the units in src/config.ts have their lists added yet. ' +
        (problems.length ? `${problems.join('. ')}. ` : '') +
        (listServices.length ? `Generated services found: ${listServices.join(', ')}. ` : '') +
        'Add each unit’s two lists with "pa app add data-source" (see README), or fix the service names in src/config.ts.',
    );
  }

  // SharePoint permissions decide which units this person belongs to.
  const access = await Promise.all(configured.map(async (u) => ({ ...u, ...(await u.repo.canOpen()) })));
  const units = access
    .filter((u) => u.ok)
    .map(({ config, repo }) => ({ config, repo, admin: isAdmin(user, config) }));

  const directory = (await Office365Directory.open(PEOPLE_SERVICE_NAME)) ?? new NoDirectory();
  return { user, params, mode: 'sharepoint', units, directory };
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
