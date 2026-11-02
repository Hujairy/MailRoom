import type { Session } from '../data';
import type { MailKind } from '../data/types';

export type Page = 'home' | 'mine' | 'department' | 'add' | 'maintenance';

export const PAGES: Page[] = ['home', 'mine', 'department', 'add', 'maintenance'];

export interface PageProps {
  session: Session;
  unit: string;
  staff: boolean;
  /** Which form "Add mail" opens on. */
  addKind: MailKind;
  go: (page: Page, options?: { kind?: MailKind }) => void;
  notify: (message: string) => void;
}
