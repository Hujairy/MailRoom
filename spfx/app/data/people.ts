/* eslint-disable */
import { spContext } from './context';
import { sp } from './rest';
import type { Directory, Person, Profile } from './types';

interface PickerEntity {
  Key?: string;
  DisplayText?: string;
  EntityData?: { Email?: string; Department?: string; Title?: string };
}

/** The company directory through SharePoint's own people picker. No extra permissions needed. */
export class SharePointDirectory implements Directory {
  readonly searchable = true;
  private profile: Promise<Profile | null> | null = null;

  async search(term: string): Promise<Person[]> {
    const q = term.trim();
    if (q.length < 2) return [];
    const { webUrl } = spContext();
    const result = await sp<{ ClientPeoplePickerSearchUser?: string }>(
      `${webUrl}/_api/SP.UI.ApplicationPages.ClientPeoplePickerWebServiceInterface.clientPeoplePickerSearchUser`,
      {
        method: 'POST',
        verbose: true,
        body: {
          queryParams: {
            __metadata: { type: 'SP.UI.ApplicationPages.ClientPeoplePickerQueryParameters' },
            AllowEmailAddresses: false,
            AllowMultipleEntities: false,
            AllUrlZones: false,
            MaximumEntitySuggestions: 8,
            PrincipalSource: 15,
            PrincipalType: 1,
            QueryString: q,
          },
        },
      },
    );
    let entities: PickerEntity[] = [];
    try {
      entities = JSON.parse(result.ClientPeoplePickerSearchUser ?? '[]') as PickerEntity[];
    } catch {
      entities = [];
    }
    return entities.map(toPerson).filter((p): p is Person => p !== null);
  }

  /** The signed-in person, from the page, plus their department from their profile. */
  me(): Promise<Profile | null> {
    this.profile ??= (async () => {
      const { user, webUrl } = spContext();
      const email = user.email.trim().toLowerCase();
      const upn = user.loginName.replace(/^.*\|/, '').trim().toLowerCase();
      let department: string | undefined;
      try {
        const props = await sp<{ UserProfileProperties?: { Key: string; Value: string }[] }>(
          `${webUrl}/_api/SP.UserProfiles.PeopleManager/GetMyProperties?$select=UserProfileProperties`,
        );
        department = props.UserProfileProperties?.find((p) => p.Key === 'Department')?.Value?.trim() || undefined;
      } catch {
        department = undefined;
      }
      if (!email && !upn) return null;
      return { name: user.name, email: email || upn, upn: upn || email, department };
    })();
    return this.profile;
  }

  async myDepartment(): Promise<string | null> {
    return (await this.me())?.department ?? null;
  }
}

function toPerson(entity: PickerEntity): Person | null {
  const upn = (entity.Key ?? '').replace(/^.*\|/, '').trim().toLowerCase();
  const email = (entity.EntityData?.Email || upn).trim().toLowerCase();
  if (!email || !email.includes('@')) return null;
  return {
    name: (entity.DisplayText ?? '').trim() || email,
    email,
    department: entity.EntityData?.Department?.trim() || undefined,
    jobTitle: entity.EntityData?.Title?.trim() || undefined,
  };
}
