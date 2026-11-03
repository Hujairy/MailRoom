import { SETTINGS_LISTS } from '../config';
import { createItem, deleteItem, getItems, graph, updateItem, type ListRef, type Row } from './graph';
import { isAddressOf } from './rules';
import type { CurrentUser } from './types';

export type Role = 'Admin' | 'User';

export interface UnitRecord {
  id: string;
  name: string;
  /** The unit's SharePoint site. Empty means the settings site. */
  siteUrl: string;
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
  /** False when MailroomUnits has no SiteUrl column yet; every unit then uses the settings site. */
  hasSiteColumn: boolean;
}

/** Units and the people in them, managed on the Settings page. */
export interface SettingsStore {
  load(): Promise<SettingsData>;
  addUnit(name: string, siteUrl: string): Promise<UnitRecord>;
  setUnitSite(unit: UnitRecord, siteUrl: string): Promise<UnitRecord>;
  /** Removes the unit and everyone in it. Its mail lists and records stay in SharePoint. */
  removeUnit(unit: UnitRecord, members: MemberRecord[]): Promise<void>;
  addMember(member: Omit<MemberRecord, 'id'>): Promise<MemberRecord>;
  setRole(member: MemberRecord, role: Role): Promise<MemberRecord>;
  removeMember(member: MemberRecord): Promise<void>;
}

const U = SETTINGS_LISTS.unitColumns;
const M = SETTINGS_LISTS.memberColumns;

const str = (row: Row, column: string) => {
  const v = row[column];
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return '';
};

const toUnit = (row: Row): UnitRecord => ({ id: str(row, 'ID'), name: str(row, U.name).trim(), siteUrl: str(row, U.siteUrl).trim() });
const toMember = (row: Row): MemberRecord => ({
  id: str(row, 'ID'),
  email: str(row, M.email).trim().toLowerCase(),
  name: str(row, M.name).trim(),
  unit: str(row, M.unit).trim(),
  role: str(row, M.role).trim().toLowerCase() === 'admin' ? 'Admin' : 'User',
});

/** Settings stored in the MailroomUnits and MailroomMembers lists, on the settings site. */
export class SharePointSettings implements SettingsStore {
  private readonly units: ListRef;
  private readonly members: ListRef;
  private hasSiteColumn: Promise<boolean> | null = null;

  constructor(units: ListRef, members: ListRef) {
    this.units = units;
    this.members = members;
  }

  async load(): Promise<SettingsData> {
    const [unitRows, memberRows] = await Promise.all([
      this.loadUnits(),
      getItems(this.members, { select: Object.values(M), top: 5000 }),
    ]);
    return {
      units: unitRows.map(toUnit).filter((u) => u.name).sort((a, b) => a.name.localeCompare(b.name)),
      members: memberRows.map(toMember).filter((m) => m.email && m.unit),
      hasSiteColumn: await this.siteColumn(),
    };
  }

  /** Reads units with their SiteUrl column, or without it on lists made before it existed. */
  private async loadUnits(): Promise<Row[]> {
    const select = (await this.siteColumn()) ? [U.name, U.siteUrl] : [U.name];
    return getItems(this.units, { select, top: 500 });
  }

  /** Whether MailroomUnits has a SiteUrl column. Only a "yes" is remembered, so adding the column shows up straight away. */
  private siteColumn(): Promise<boolean> {
    this.hasSiteColumn ??= graph<{ value: { name: string }[] }>(`/sites/${this.units.site.id}/lists/${this.units.id}/columns?$select=name`).then(
      (columns) => columns.value.some((c) => c.name.toLowerCase() === U.siteUrl.toLowerCase()),
      () => false,
    );
    const answer = this.hasSiteColumn;
    void answer.then((yes) => {
      if (!yes && this.hasSiteColumn === answer) this.hasSiteColumn = null;
    });
    return answer;
  }

  async addUnit(name: string, siteUrl: string): Promise<UnitRecord> {
    const record: Row = { [U.name]: name.trim() };
    if (siteUrl.trim()) record[U.siteUrl] = siteUrl.trim();
    return toUnit(await createItem(this.units, record));
  }

  async setUnitSite(unit: UnitRecord, siteUrl: string): Promise<UnitRecord> {
    await updateItem(this.units, unit.id, { [U.siteUrl]: siteUrl.trim() });
    return { ...unit, siteUrl: siteUrl.trim() };
  }

  async removeUnit(unit: UnitRecord, members: MemberRecord[]): Promise<void> {
    for (const m of members.filter((x) => x.unit === unit.name)) await this.removeMember(m);
    await deleteItem(this.units, unit.id);
  }

  async addMember(member: Omit<MemberRecord, 'id'>): Promise<MemberRecord> {
    const record = {
      [M.email]: member.email.trim().toLowerCase(),
      [M.name]: member.name.trim(),
      [M.unit]: member.unit,
      [M.role]: member.role,
    };
    return toMember({ ...record, ...(await createItem(this.members, record)) });
  }

  async setRole(member: MemberRecord, role: Role): Promise<MemberRecord> {
    await updateItem(this.members, member.id, { [M.role]: role });
    return { ...member, role };
  }

  async removeMember(member: MemberRecord): Promise<void> {
    await deleteItem(this.members, member.id);
  }
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
