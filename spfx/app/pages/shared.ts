/* eslint-disable */
import type { Session } from '../data';
import type { MailKind, MailRepository } from '../data/types';

export type Page = 'home' | 'mine' | 'department' | 'add' | 'maintenance' | 'settings';

export const PAGES: Page[] = ['home', 'mine', 'department', 'add', 'maintenance', 'settings'];

export interface PageProps {
  session: Session;
  /** The current unit's name and lists. */
  unit: string;
  repo: MailRepository;
  /** Mail room admin of this unit: may add mail and use Maintenance. */
  admin: boolean;
  /** Which form "Add mail" opens on. */
  addKind: MailKind;
  go: (page: Page, options?: { kind?: MailKind }) => void;
  notify: (message: string) => void;
}
