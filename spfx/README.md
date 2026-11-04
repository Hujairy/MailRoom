# Mail Room for SharePoint (SPFx)

Mail Room as a SharePoint Framework web part. It runs on a SharePoint page, uses the signed-in person's SharePoint session, and reads and writes the same lists through the SharePoint REST API (`SPHttpClient`).

- **No Power Apps licence, no app registration, no hosting.** A SharePoint admin installs one `.sppkg` package.
- **Same screens and roles** as the other versions, including Settings.
- **People search** uses SharePoint's own people picker, so no Microsoft Graph permissions are needed.

Setup, step by step: [SPFX-SETUP.txt](../SPFX-SETUP.txt).

## What's here

| | |
| --- | --- |
| [`install.mjs`](install.mjs) | Copies Mail Room into a project made by `yo @microsoft/sharepoint` (web part, React template, SPFx 1.24.1 or later), and adjusts `tsconfig.json`, the manifest (full width, app pages, Teams tabs) and `package-solution.json` |
| [`MailRoomWebPart.ts`](MailRoomWebPart.ts) | The web part: React 18 `createRoot`, and two properties, **Settings site** and **General admins** |
| [`app/`](app) | The app. The data layer is SharePoint REST ([`app/data/rest.ts`](app/data/rest.ts)) |
| [`tools/scope-css.py`](tools/scope-css.py) | Builds `app/styles.ts` from the website's stylesheet, scoped under `.mailroom-root` so nothing affects the rest of the page |

## Notes

- Styles are injected once as a `<style>` element, and every rule is scoped to the web part. Keyframes are prefixed `mr-`. The web part is light-themed like SharePoint pages.
- Images are inlined in `app/assets.ts`, so the build needs no image or CSS loaders.
- The settings site defaults to the site the page is on; put the page on the Mail Room Settings site.
- General admins come from the web part's **General admins** property, or `DEFAULT_GENERAL_ADMINS` in [`app/config.ts`](app/config.ts). Only people who can edit the page can change it, so keep the settings site's edit rights to general admins.
