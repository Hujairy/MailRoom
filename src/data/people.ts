import { loadGeneratedService, type OperationResult } from './generated';
import type { Directory, Person, Profile } from './types';

type Call = (...args: unknown[]) => Promise<OperationResult<unknown>>;

/**
 * Company directory through the Office 365 Users connector, added with
 * `pa app add data-source --connector "shared_office365users" ...`.
 */
export class Office365Directory implements Directory {
  readonly searchable = true;
  private readonly service: Record<string, unknown>;
  private profile: Promise<Profile | null> | null = null;

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

  me(): Promise<Profile | null> {
    if (!this.profile) {
      this.profile = (async () => {
        if (typeof this.service.MyProfile !== 'function') return null;
        try {
          const result = await (this.service.MyProfile as Call).call(this.service);
          const u = (result?.data ?? {}) as Record<string, unknown>;
          const str = (k: string) => (typeof u[k] === 'string' ? (u[k] as string).trim() : '');
          const email = str('Mail').toLowerCase();
          const upn = str('UserPrincipalName').toLowerCase();
          if (!email && !upn) return null;
          return { name: str('DisplayName'), email: email || upn, upn: upn || email, department: str('Department') || undefined };
        } catch {
          return null;
        }
      })();
    }
    return this.profile;
  }

  async myDepartment(): Promise<string | null> {
    return (await this.me())?.department ?? null;
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
  async me(): Promise<Profile | null> {
    return null;
  }
}
