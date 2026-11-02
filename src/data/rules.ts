import { BY_HAND, MAILROOM_STAFF, MAX_RECEIVED, MAX_WAITING } from '../config';
import type { CurrentUser, MailItem, MailKind, MailRepository, Person } from './types';

const norm = (value: string) => value.trim().toLowerCase();

export const sameEmail = (a: string, b: string) => !!a && norm(a) === norm(b);

/** Matches department names loosely, so "Trade Finance Dept." and "TRADE FINANCE DEPT" are the same. */
export function departmentKey(value: string): string {
  return value.toLowerCase().replace(/[.\s]+$/g, '').replace(/\s+/g, ' ').trim();
}

export function isStaff(user: CurrentUser, unit: string): boolean {
  const lists = Object.values(MAILROOM_STAFF);
  if (lists.every((l) => l.length === 0)) return true;
  const allowed = [...(MAILROOM_STAFF[unit] ?? []), ...(MAILROOM_STAFF['*'] ?? [])];
  return allowed.some((email) => sameEmail(email, user.email));
}

export function isByHand(courier: string): boolean {
  return norm(courier) === norm(BY_HAND);
}

/** Who may press "Received" on a delivery. */
export function canConfirm(item: MailItem, user: CurrentUser, staff: boolean): boolean {
  if (item.status !== 'Waiting') return false;
  if (staff || item.kind === 'Department') return true;
  return sameEmail(item.recipientEmail, user.email);
}

/**
 * "On Behalf": when someone other than the recipient receives personal mail,
 * it's recorded as received on behalf of the recipient.
 */
export function onBehalfFor(item: MailItem, receivedBy: Person): string {
  if (item.kind !== 'Personal' || !item.recipientEmail || sameEmail(item.recipientEmail, receivedBy.email)) return '';
  return item.recipient || item.recipientEmail;
}

export function byNewest(a: MailItem, b: MailItem): number {
  return b.created.localeCompare(a.created);
}

/** Loads every not-received delivery plus the most recent received ones. */
export async function loadUnit(repo: MailRepository, unit: string, kind?: MailKind): Promise<MailItem[]> {
  const [waiting, received] = await Promise.all([
    repo.list({ unit, kind, status: 'Waiting' }, MAX_WAITING),
    repo.list({ unit, kind, status: 'Received' }, MAX_RECEIVED),
  ]);
  return [...waiting, ...received].sort(byNewest);
}

/** Unique values, keeping the most common spelling of each (case and trailing dots ignored). */
export function uniqueOptions(values: string[], extra: string[] = []): string[] {
  const counts = new Map<string, Map<string, number>>();
  for (const value of [...extra, ...values]) {
    const label = value.trim();
    if (!label) continue;
    const key = departmentKey(label);
    const spellings = counts.get(key) ?? new Map<string, number>();
    spellings.set(label, (spellings.get(label) ?? 0) + 1);
    counts.set(key, spellings);
  }
  return [...counts.values()]
    .map((spellings) => [...spellings.entries()].sort((a, b) => b[1] - a[1])[0][0])
    .sort((a, b) => a.localeCompare(b));
}

export function departmentOptions(items: MailItem[], extra: string[]): string[] {
  return uniqueOptions(
    items.map((i) => i.department),
    extra,
  );
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
