/* eslint-disable */
import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Version } from '@microsoft/sp-core-library';
import { PropertyPaneTextField, type IPropertyPaneConfiguration } from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import App from './app/App';
import { DEFAULT_GENERAL_ADMINS } from './app/config';
import { configure, type AppConfig } from './app/data/context';
import { MAIL_ROOM_CSS } from './app/styles';

export interface IMailRoomWebPartProps {
  /** The site with MailroomUnits and MailroomMembers. Empty: the site this page is on. */
  settingsSiteUrl: string;
  /** Emails with full access, one per line. Empty: DEFAULT_GENERAL_ADMINS. */
  generalAdmins: string;
}

/** Mail Room as a SharePoint web part. Put it on a full-width section, or on an app page. */
export default class MailRoomWebPart extends BaseClientSideWebPart<IMailRoomWebPartProps> {
  private root: Root | undefined;
  private timers: number[] = [];

  protected onInit(): Promise<void> {
    injectStyles();
    window.addEventListener('resize', this.fit);
    return super.onInit();
  }

  /**
   * Makes Mail Room at least as tall as the window below where it starts, so
   * it fills the page instead of stopping after its content.
   */
  private fit = (): void => {
    const root = this.domElement.firstElementChild as HTMLElement | null;
    if (!root) return;
    const scroller = scrollParent(this.domElement);
    const scrolled = scroller ? scroller.scrollTop : window.scrollY;
    const top = root.getBoundingClientRect().top + scrolled;
    root.style.minHeight = `${Math.max(420, Math.floor(window.innerHeight - top))}px`;
  };

  public render(): void {
    const { pageContext, spHttpClient } = this.context;
    const config = this.config();
    configure(
      {
        http: spHttpClient,
        webUrl: pageContext.web.absoluteUrl,
        user: {
          name: pageContext.user.displayName,
          email: pageContext.user.email ?? '',
          loginName: pageContext.user.loginName ?? '',
        },
      },
      config,
    );
    if (!this.root) this.root = createRoot(this.domElement);
    // A new key starts Mail Room again when the web part's properties change.
    this.root.render(
      React.createElement('div', { className: 'mailroom-root' }, React.createElement(App, { key: JSON.stringify(config) })),
    );
    // SharePoint finishes laying out the page (header, command bar) after the web part renders.
    this.timers.forEach((t) => window.clearTimeout(t));
    this.timers = [0, 300, 1000, 2500].map((ms) => window.setTimeout(this.fit, ms));
  }

  protected onDispose(): void {
    window.removeEventListener('resize', this.fit);
    this.timers.forEach((t) => window.clearTimeout(t));
    this.root?.unmount();
    this.root = undefined;
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  /** Changes apply when "Apply" is pressed, not on every keystroke. */
  protected get disableReactivePropertyChanges(): boolean {
    return true;
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: { description: 'Mail Room settings. Units and people are managed on the Settings page inside Mail Room.' },
          groups: [
            {
              groupName: 'Mail Room',
              groupFields: [
                PropertyPaneTextField('settingsSiteUrl', {
                  label: 'Settings site',
                  description: 'The SharePoint site with the MailroomUnits and MailroomMembers lists. Leave empty to use this site.',
                  placeholder: this.context.pageContext.web.absoluteUrl,
                }),
                PropertyPaneTextField('generalAdmins', {
                  label: 'General admins',
                  description: 'Emails with full access to every unit and to Settings, one per line.',
                  multiline: true,
                  rows: 4,
                  placeholder: DEFAULT_GENERAL_ADMINS.join('\n'),
                }),
              ],
            },
          ],
        },
      ],
    };
  }

  private config(): AppConfig {
    const admins = (this.properties.generalAdmins ?? '')
      .split(/[\s,;]+/)
      .map((a) => a.trim().toLowerCase())
      .filter((a) => a.includes('@'));
    return {
      settingsSiteUrl: (this.properties.settingsSiteUrl ?? '').trim() || this.context.pageContext.web.absoluteUrl,
      generalAdmins: admins.length > 0 ? admins : DEFAULT_GENERAL_ADMINS,
    };
  }
}

/** The element SharePoint scrolls the page in (it isn't the window). */
function scrollParent(element: HTMLElement): HTMLElement | null {
  for (let el = element.parentElement; el; el = el.parentElement) {
    const overflow = getComputedStyle(el).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll') && el.scrollHeight > el.clientHeight) return el;
  }
  return null;
}

/** Adds Mail Room's styles to the page once. They're all scoped under .mailroom-root. */
function injectStyles(): void {
  if (document.getElementById('mailroom-styles')) return;
  const style = document.createElement('style');
  style.id = 'mailroom-styles';
  style.textContent = MAIL_ROOM_CSS;
  document.head.appendChild(style);
}
