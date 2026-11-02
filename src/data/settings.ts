import { SETTINGS_LISTS } from '../config';
import { unwrap, type Row, type TabularService } from './generated';
import { isAddressOf } from './rules';
import type { CurrentUser } from './types';

export type Role = 'Admin' | 'User';

export interface UnitRecord {
  id: string;
  name: string;
}

export interface MemberRecord {
  id: string;
  /** Lower-cased. */
  email: string;
  name: string;
  unit: string;
  role: Role;
}

export interface SettingsData {
  units: UnitRecord[];
  members: MemberRecord[];
}

/** Units and the people in them, managed on the Settings page. */
export interface SettingsStore {
  load(): Promise<SettingsData>;
  addUnit(name: string): Promise<UnitRecord>;
  /** Removes the unit and everyone in it. Its mail lists and records stay in SharePoint. */
  removeUnit(unit: UnitRecord, members: MemberRecord[]): Promise<void>;
  addMember(member: Omit<MemberRecord, 'id'>): Promise<MemberRecord>;
  setRole(member: MemberRecord, role: Role): Promise<MemberRecord>;
  removeMember(member: MemberRecord): Promise<void>;
}

const U = SETTINGS_LISTS.units;
const M = SETTINGS_LISTS.members;

const str = (row: Row, column: string) => {
  const v = row[column];
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (v && typeof v === 'object' && typeof (v as { Value?: unknown }).Value === 'string') return (v as { Value: string }).Value;
  return '';
};

const toUnit = (row: Row): UnitRecord => ({ id: str(row, U.id) || str(row, 'Id'), name: str(row, U.name).trim() });
const toMember = (row: Row): MemberRecord => ({
  id: str(row, M.id) || str(row, 'Id'),
  email: str(row, M.email).trim().toLowerCase(),
  name: str(row, M.name).trim(),
  unit: str(row, M.unit).trim(),
  role: str(row, M.role).trim().toLowerCase() === 'admin' ? 'Admin' : 'User',
});

/** Settings stored in the MailroomUnits and MailroomMembers SharePoint lists. */
export class SharePointSettings implements SettingsStore {
  private readonly units: TabularService;
  private readonly members: TabularService;

  constructor(units: TabularService, members: TabularService) {
    this.units = units;
    this.members = members;
  }

  async load(): Promise<SettingsData> {
    const [units, members] = await Promise.all([
      this.units.getAll({ orderBy: [`${U.name} asc`], top: 500 }),
      this.members.getAll({ top: 5000 }),
    ]);
    return {
      units: (unwrap(units, 'Loading units') ?? []).map(toUnit).filter((u) => u.name),
      members: (unwrap(members, 'Loading people') ?? []).map(toMember).filter((m) => m.email && m.unit),
    };
  }

  async addUnit(name: string): Promise<UnitRecord> {
    const record = { [U.name]: name.trim() };
    const created = unwrap(await this.units.create(record), 'Adding the unit');
    return toUnit(created ?? record);
  }

  async removeUnit(unit: UnitRecord, members: MemberRecord[]): Promise<void> {
    for (const m of members.filter((x) => x.unit === unit.name)) await this.removeMember(m);
    await remove(this.units, unit.id, 'Removing the unit');
  }

  async addMember(member: Omit<MemberRecord, 'id'>): Promise<MemberRecord> {
    const record = {
      [M.email]: member.email.trim().toLowerCase(),
      [M.name]: member.name.trim(),
      [M.unit]: member.unit,
      [M.role]: member.role,
    };
    const created = unwrap(await this.members.create(record), 'Adding the person');
    return toMember(created ?? record);
  }

  async setRole(member: MemberRecord, role: Role): Promise<MemberRecord> {
    unwrap(await this.members.update(member.id, { [M.role]: role }), 'Changing the role');
    return { ...member, role };
  }

  async removeMember(member: MemberRecord): Promise<void> {
    await remove(this.members, member.id, 'Removing the person');
  }
}

async function remove(service: TabularService, id: string, action: string) {
  if (typeof service.delete !== 'function') throw new Error(`${action} failed: this list can't delete items.`);
  const result = await service.delete(id);
  if (result) unwrap(result, action);
}

/** The units a person belongs to, with their role in each. */
export function membershipsOf(user: Pick<CurrentUser, 'email' | 'aliases'>, data: SettingsData): Map<string, Role> {
  const roles = new Map<string, Role>();
  for (const m of data.members) {
    if (!isAddressOf(user, m.email)) continue;
    if (!data.units.some((u) => u.name === m.unit)) continue;
    if (roles.get(m.unit) !== 'Admin') roles.set(m.unit, m.role);
  }
  return roles;
}
