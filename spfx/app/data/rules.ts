/* eslint-disable */
import { BY_HAND, MAX_RECEIVED, MAX_WAITING } from '../config';
import { appConfig } from './context';
import type { CurrentUser, MailItem, MailKind, MailRepository, Person } from './types';

const norm = (value: string) => value.trim().toLowerCase();

export const sameEmail = (a: string, b: string) => !!a && norm(a) === norm(b);

/** True when the address belongs to the person, by their email or any sign-in alias. */
export function isAddressOf(person: { email: string; aliases?: string[] }, address: string): boolean {
  return [person.email, ...(person.aliases ?? [])].some((a) => sameEmail(a, address));
}

/** Matches department names loosely, so "Trade Finance Dept." and "TRADE FINANCE DEPT" are the same. */
export function departmentKey(value: string): string {
  return value.toLowerCase().replace(/[.\s]+$/g, '').replace(/\s+/g, ' ').trim();
}

/** General admins (set in the web part's properties) manage Settings and are admins in every unit. */
export function isGeneralAdmin(user: Pick<CurrentUser, 'email' | 'aliases'>): boolean {
  return appConfig.generalAdmins.some((email) => isAddressOf(user, email));
}

export function isByHand(courier: string): boolean {
  return norm(courier) === norm(BY_HAND);
}

/** Who may press "Mark as received" on a delivery. */
export function canConfirm(item: MailItem, user: CurrentUser, admin: boolean): boolean {
  if (item.status !== 'Waiting') return false;
  if (admin || item.kind === 'Department') return true;
  return isAddressOf(user, item.recipientEmail);
}

/**
 * "On Behalf": when someone other than the recipient receives personal mail,
 * it's recorded as received on behalf of the recipient.
 */
export function onBehalfFor(item: MailItem, receivedBy: Person & { aliases?: string[] }): string {
  if (item.kind !== 'Personal' || !item.recipientEmail || isAddressOf(receivedBy, item.recipientEmail)) return '';
  return item.recipient || item.recipientEmail;
}

export function byNewest(a: MailItem, b: MailItem): number {
  return b.created.localeCompare(a.created);
}

/** Loads every not-received delivery plus the most recent received ones. */
export async function loadUnit(repo: MailRepository, kind?: MailKind): Promise<MailItem[]> {
  const [waiting, received] = await Promise.all([
    repo.list({ kind, status: 'Waiting' }, MAX_WAITING),
    repo.list({ kind, status: 'Received' }, MAX_RECEIVED),
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
