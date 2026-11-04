/* eslint-disable */
import type { SPHttpClient } from '@microsoft/sp-http';

/** Settings from the web part's property pane. */
export interface AppConfig {
  /** The SharePoint site with the MailroomUnits and MailroomMembers lists. */
  settingsSiteUrl: string;
  /** Full access to every unit and to Settings, lower-cased. */
  generalAdmins: string[];
}

/** What SharePoint tells the web part about the page and the signed-in person. */
export interface SpContext {
  http: SPHttpClient;
  /** The site the page is on. */
  webUrl: string;
  user: { name: string; email: string; loginName: string };
}

export const appConfig: AppConfig = { settingsSiteUrl: '', generalAdmins: [] };

let context: SpContext | null = null;

/** Called by the web part every time it renders. */
export function configure(next: SpContext, config: AppConfig): void {
  context = next;
  appConfig.settingsSiteUrl = config.settingsSiteUrl;
  appConfig.generalAdmins = config.generalAdmins.map((a) => a.trim().toLowerCase()).filter((a) => a.includes('@'));
}

export function spContext(): SpContext {
  if (!context) throw new Error('The Mail Room web part hasn’t started yet.');
  return context;
}
