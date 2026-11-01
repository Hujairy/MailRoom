import { getContext } from '@microsoft/power-apps/app';
import { PEOPLE_SERVICE_NAME, SHAREPOINT_SERVICE_NAME } from '../config';
import { DemoDirectory, DemoRepository } from './demo';
import { generatedServiceNames, isTabularService, loadGeneratedService } from './generated';
import { NoDirectory, Office365Directory } from './people';
import { SharePointRepository } from './sharePoint';
import type { CurrentUser, Directory, MailRepository } from './types';

export interface Session {
  user: CurrentUser;
  repo: MailRepository;
  directory: Directory;
  /** Query parameters from the Power Apps link, e.g. ?page=mine&unit=Egypt. */
  params: Record<string, string>;
}

const DEMO_USER: CurrentUser = { name: 'Demo User', email: 'demo.user@contoso.com', fromPowerApps: false };

/**
 * Opens the data store. Uses SharePoint when the generated list service
 * exists, otherwise demo data. Force a mode with VITE_DATA_MODE=demo|sharepoint
 * in a `.env.local` file.
 */
export async function openSession(): Promise<Session> {
  const { user, params } = await readContext();
  const setting = import.meta.env.VITE_DATA_MODE ?? 'auto';

  const service = setting === 'demo' ? null : await loadGeneratedService(SHAREPOINT_SERVICE_NAME);
  if (!isTabularService(service)) {
    if (setting === 'sharepoint') {
      const found = generatedServiceNames();
      throw new Error(
        `The app is set to use SharePoint, but ${SHAREPOINT_SERVICE_NAME} isn't generated yet. ` +
          (found.length ? `Generated services found: ${found.join(', ')}. ` : 'No generated services were found. ') +
          'Run "pa app add data-source" for your list (see README), or update SHAREPOINT_SERVICE_NAME in src/config.ts.',
      );
    }
    return { user, params, repo: new DemoRepository(user), directory: new DemoDirectory(user) };
  }

  const directory = (await Office365Directory.open(PEOPLE_SERVICE_NAME)) ?? new NoDirectory();
  return { user, params, repo: new SharePointRepository(service), directory };
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
