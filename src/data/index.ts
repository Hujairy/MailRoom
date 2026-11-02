import { getContext } from '@microsoft/power-apps/app';
import { DEPARTMENT_MAIL_LIST, PEOPLE_SERVICE_NAME, PERSONAL_MAIL_LIST } from '../config';
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
 * Opens the data store. Uses SharePoint when both generated list services
 * exist (Personal Mail and Department Mail), otherwise demo data. Force a
 * mode with VITE_DATA_MODE=demo|sharepoint in a `.env.local` file.
 */
export async function openSession(): Promise<Session> {
  const { user, params } = await readContext();
  const setting = import.meta.env.VITE_DATA_MODE ?? 'auto';

  const [personal, department] =
    setting === 'demo'
      ? [null, null]
      : await Promise.all([
          loadGeneratedService(PERSONAL_MAIL_LIST.service),
          loadGeneratedService(DEPARTMENT_MAIL_LIST.service),
        ]);
  if (!isTabularService(personal) || !isTabularService(department)) {
    const missing = [
      !isTabularService(personal) && PERSONAL_MAIL_LIST.service,
      !isTabularService(department) && DEPARTMENT_MAIL_LIST.service,
    ].filter(Boolean);
    if (setting === 'sharepoint' || (personal || department)) {
      const found = generatedServiceNames();
      throw new Error(
        `The app can't find ${missing.join(' and ')}. ` +
          (found.length ? `Generated services found: ${found.join(', ')}. ` : 'No generated services were found. ') +
          'Add both lists with "pa app add data-source" (see README), or update the service names in src/config.ts.',
      );
    }
    return { user, params, repo: new DemoRepository(user), directory: new DemoDirectory(user) };
  }

  const directory = (await Office365Directory.open(PEOPLE_SERVICE_NAME)) ?? new NoDirectory();
  return { user, params, repo: new SharePointRepository(personal, department), directory };
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
