import { loadGeneratedService, type OperationResult } from './generated';
import type { Directory, Person } from './types';

type Call = (...args: unknown[]) => Promise<OperationResult<unknown>>;

/**
 * Company directory through the Office 365 Users connector, added with
 * `pa app add data-source --connector "shared_office365users" ...`.
 */
export class Office365Directory implements Directory {
  readonly searchable = true;
  private readonly service: Record<string, unknown>;
  private departmentCache: Promise<string | null> | null = null;

  constructor(service: Record<string, unknown>) {
    this.service = service;
  }

  static async open(name: string): Promise<Office365Directory | null> {
    const service = await loadGeneratedService(name);
    if (!service || typeof service.SearchUser !== 'function') return null;
    return new Office365Directory(service);
  }

  async search(term: string): Promise<Person[]> {
    const q = term.trim();
    if (q.length < 2) return [];
    const result = await (this.service.SearchUser as Call).call(this.service, q, 8);
    const data = result?.data as unknown;
    const rows = Array.isArray(data) ? data : ((data as { value?: unknown[] })?.value ?? []);
    return rows
      .map((u) => toPerson(u as Record<string, unknown>))
      .filter((p): p is Person => p !== null);
  }

  myDepartment(): Promise<string | null> {
    if (!this.departmentCache) {
      this.departmentCache = (async () => {
        if (typeof this.service.MyProfile !== 'function') return null;
        try {
          const result = await (this.service.MyProfile as Call).call(this.service);
          const dept = (result?.data as Record<string, unknown> | undefined)?.Department;
          return typeof dept === 'string' && dept.trim() ? dept.trim() : null;
        } catch {
          return null;
        }
      })();
    }
    return this.departmentCache;
  }
}

function toPerson(u: Record<string, unknown>): Person | null {
  const str = (k: string) => (typeof u[k] === 'string' ? (u[k] as string) : '');
  const email = (str('Mail') || str('UserPrincipalName')).toLowerCase();
  if (!email) return null;
  return {
    name: str('DisplayName') || email,
    email,
    department: str('Department') || undefined,
    jobTitle: str('JobTitle') || undefined,
  };
}

/** Used when the Office 365 Users connector isn't added: no search, no department. */
export class NoDirectory implements Directory {
  readonly searchable = false;
  async search(): Promise<Person[]> {
    return [];
  }
  async myDepartment(): Promise<string | null> {
    return null;
  }
}
