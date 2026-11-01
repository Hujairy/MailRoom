import type { Session } from '../data';

export type Page = 'home' | 'mine' | 'department' | 'log' | 'manage';

export const PAGES: Page[] = ['home', 'mine', 'department', 'log', 'manage'];

export interface PageProps {
  session: Session;
  unit: string;
  staff: boolean;
  go: (page: Page) => void;
  notify: (message: string) => void;
}
