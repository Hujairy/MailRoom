# Mail Room website

The same Mail Room as a standalone website, without Power Apps. People sign in with their Microsoft Entra ID (work) account, and everything is read and written in the same SharePoint lists through Microsoft Graph, as the signed-in person.

- **No Power Apps licence.** Users need their Microsoft 365 account and SharePoint access only.
- **Same screens and roles**: Home, My Personal Mail, Department Mail, Add Mail, Maintenance and Settings.
- **Units without rebuilding.** Each unit's SharePoint site is set in Settings (the `SiteUrl` column of MailroomUnits), and general admins can create a new unit's lists from the website.

Setup, step by step: [WEBSITE-SETUP.txt](../WEBSITE-SETUP.txt).

## Run and build

```
npm install
npm run dev      # http://localhost:5173/
npm run build    # static files in dist/
```

## Settings

[`public/mailroom.config.json`](public/mailroom.config.json) is read when the website opens, so it can be changed on the web server without rebuilding:

| Setting | |
| --- | --- |
| `tenantId` | Directory (tenant) ID of the app registration |
| `clientId` | Application (client) ID of the app registration |
| `settingsSiteUrl` | The site with MailroomUnits and MailroomMembers |
| `generalAdmins` | Emails with full access, including Settings |
| `redirectUri` | Optional. Defaults to the address the website is opened from |

The app registration is a **Single-page application** with Microsoft Graph delegated permissions `User.Read`, `User.ReadBasic.All` and `Sites.ReadWrite.All`, plus `Sites.Manage.All` if general admins should create lists from the website. Courier buttons, departments and column names are in [`src/config.ts`](src/config.ts).

## How it works

- Sign-in: [MSAL.js](https://github.com/AzureAD/microsoft-authentication-library-for-js) with redirects ([`src/data/auth.ts`](src/data/auth.ts)).
- Data: Microsoft Graph list items ([`src/data/graph.ts`](src/data/graph.ts), [`src/data/sharePoint.ts`](src/data/sharePoint.ts)). Filters use `Prefer: HonorNonIndexedQueriesWarningMayFailRandomly`; index `Received` and `RecipientEmail` once lists hold thousands of items.
- People search: `/users` with `$search`; the signed-in person's email and department from `/me`.
- A person sees a unit only when they're its member in Settings **and** SharePoint lets them open the unit's lists.
