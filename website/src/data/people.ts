import { graph } from './graph';
import type { Directory, Person, Profile } from './types';

interface GraphUser {
  displayName?: string | null;
  mail?: string | null;
  userPrincipalName?: string | null;
  department?: string | null;
  jobTitle?: string | null;
}

/** The company directory through Microsoft Graph (User.Read and User.ReadBasic.All). */
export class GraphDirectory implements Directory {
  readonly searchable = true;
  private profile: Promise<Profile | null> | null = null;

  async search(term: string): Promise<Person[]> {
    const q = term.trim().replace(/"/g, '');
    if (q.length < 2) return [];
    const search = encodeURIComponent(`"displayName:${q}" OR "mail:${q}" OR "userPrincipalName:${q}"`);
    const result = await graph<{ value: GraphUser[] }>(
      `/users?$search=${search}&$select=displayName,mail,userPrincipalName&$top=8`,
      { headers: { ConsistencyLevel: 'eventual' } },
    );
    return result.value.map(toPerson).filter((p): p is Person => p !== null);
  }

  me(): Promise<Profile | null> {
    this.profile ??= graph<GraphUser>('/me?$select=displayName,mail,userPrincipalName,department').then(
      (u) => {
        const email = (u.mail ?? '').trim().toLowerCase();
        const upn = (u.userPrincipalName ?? '').trim().toLowerCase();
        if (!email && !upn) return null;
        return {
          name: (u.displayName ?? '').trim(),
          email: email || upn,
          upn: upn || email,
          department: u.department?.trim() || undefined,
        };
      },
      () => null,
    );
    return this.profile;
  }

  async myDepartment(): Promise<string | null> {
    return (await this.me())?.department ?? null;
  }
}

function toPerson(u: GraphUser): Person | null {
  const email = (u.mail || u.userPrincipalName || '').trim().toLowerCase();
  if (!email) return null;
  return {
    name: (u.displayName ?? '').trim() || email,
    email,
    department: u.department?.trim() || undefined,
    jobTitle: u.jobTitle?.trim() || undefined,
  };
}
