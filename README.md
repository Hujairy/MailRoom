# Mail Room

A mail room app built as a [Power Apps code app](https://learn.microsoft.com/power-apps/developer/code-apps/) (React + TypeScript + Vite). Mail room staff log deliveries as they arrive, and employees see what's waiting for them and confirm when they've collected it.

![Home with deliveries waiting](docs/home.png)

## What it does

**For everyone**
- **Home** greets you and shows what's waiting for you at your mail room, with a button to confirm you've collected each item.
- **My mail** lists your deliveries, waiting and collected.
- **Department mail** lists deliveries for a department. Pick your department once and the app remembers it. Anyone in the department can confirm collection.
- **Mail room picker** switches between units (Bahrain, Egypt).

**For mail room staff**
- **Log delivery** handles personal or department mail. It's built for barcode scanners: scan the courier number and the cursor moves on by itself. It warns you if the same number is already waiting. Choosing *By hand* creates a date-and-time reference, like `1/11/2026_12:42:54`. A recipient search finds people in the company directory.
- **Manage** shows every delivery, with filters. Click a delivery to edit it, record who collected it (including on someone's behalf), or reopen it.

Each delivery is shown as a courier slip. Confirming collection tears off the stub and stamps the slip with a postmark.

## How the data works

| Mode | When | Where data lives |
| --- | --- | --- |
| **Demo** | Before the SharePoint list is connected | This browser only, with sample deliveries |
| **SharePoint** | After `pa app add data-source` for the list | The `MailroomItems` SharePoint list, shared by everyone |

The app switches automatically. In demo mode, a bar at the top lets you view the app as an employee or as mail room staff.

## Deploy

You already have Node.js, Git and the Power Apps CLI from the first app. Use a **Command Prompt** terminal in VS Code, not PowerShell. If you see a certificate error, run `set NODE_USE_SYSTEM_CA=1` first.

```
cd %USERPROFILE%\Documents
git clone https://github.com/Hujairy/mailroom.git
cd mailroom
npm install
pa app init --display-name "Mail Room" --environment-id <your-environment-id>
npm run build
pa app push
```

`pa app push` prints the app's link. The app now runs with demo data.

## Connect SharePoint

### 1. Create the list

Create a list named **MailroomItems** on a SharePoint Online site. The built-in **Title** column holds the courier number. Add these columns with exactly these names, without spaces:

| Column | Type |
| --- | --- |
| Kind | Single line of text (`Personal` or `Department`) |
| Unit | Single line of text (`Bahrain`, `Egypt`) |
| CourierCompany | Single line of text |
| Sender | Single line of text |
| RecipientName | Single line of text |
| RecipientEmail | Single line of text |
| Department | Single line of text |
| Status | Single line of text (`Waiting` or `Collected`) |
| CollectedByName | Single line of text |
| CollectedByEmail | Single line of text |
| CollectedOn | Date and time, including time |
| LoggedByName | Single line of text |
| LoggedByEmail | Single line of text |
| Notes | Multiple lines of text, plain |

Index **Unit**, **Status**, **Kind** and **RecipientEmail** (List settings › Indexed columns). The app sets every value itself, so plain text columns are simplest.

Or let the script create it all (PowerShell 7.4+ with [PnP.PowerShell](https://pnp.github.io/powershell/)):

```powershell
./scripts/Create-MailroomList.ps1 -SiteUrl https://<tenant>.sharepoint.com/sites/<site> -ClientId <entra-app-client-id>
```

Permissions: employees need **Contribute** on the list so they can confirm collection.

### 2. Add the list to the app

```
pa connection list
pa app add data-source --connector "shared_sharepointonline" --connection-id "<sharepoint-connection-id>" --dataset "https://<tenant>.sharepoint.com/sites/<site>" --table "MailroomItems"
```

If `pa connection list` doesn't show a SharePoint connection, create one at make.powerapps.com › **Connections** › **New connection** › **SharePoint**.

### 3. Optional: company directory search

To search recipients by name and open Department mail on each person's own department, add Office 365 Users:

```
pa app add data-source --connector "shared_office365users" --connection-id "<office365users-connection-id>"
```

Without it, staff type the recipient's email address instead.

### 4. Publish

```
npm run build
pa app push
git add -A
git commit -m "Connect SharePoint"
git push
```

Then share the app (`pa app share --principal <user-or-group> --access play`) and fill in `MAILROOM_STAFF` in `src/config.ts` (see below).

## Email notifications

The app doesn't send email itself. Add a Power Automate flow on the list:

1. Trigger: **SharePoint › When an item is created**, on `MailroomItems`.
2. **Condition**: `Kind` is equal to `Personal`.
   - If yes: **Office 365 Outlook › Send an email (V2)** to `RecipientEmail`, for example *"A delivery from {Sender} ({CourierCompany} {Title}) is waiting for you at the {Unit} mail room."*
   - If no: send to the department's mailbox. A **Switch** on `Department` works well.
3. To link straight to the right page, add `page=mine` to the app's link (`&page=mine` if the link already contains `?`). The app also accepts `unit=Egypt`.

## Configure

Edit [`src/config.ts`](src/config.ts), then rebuild and push:

| Setting | What it changes |
| --- | --- |
| `UNITS`, `DEFAULT_UNIT` | Mail room locations |
| `MAILROOM_STAFF` | Who sees **Log delivery** and **Manage**, per unit (`'*'` = every unit). While it's empty, everyone does. |
| `COURIERS`, `BY_HAND` | Courier buttons on the log form |
| `DEPARTMENTS` | Extra department suggestions |
| `DATE_LOCALE` | Date format (default `en-GB`: 1 Nov 2026) |
| `SHAREPOINT_SERVICE_NAME` | Change if your list has a different name |
| `COLUMNS` | Change if a column's internal name differs |

## Your existing on-premises mail room site

This app uses a new SharePoint Online list. Your current Bahrain Mail Room site runs on SharePoint Server, with separate lists for personal and department mail. Power Apps can reach SharePoint Server only through an **on-premises data gateway**, which IT sets up. The app can be adapted to read those lists, but the column names and person fields differ, so it needs changes in `src/data/sharePoint.ts`.

## Project structure

```
src/
  App.tsx                 Header, navigation, unit picker, page switching
  config.ts               Settings you're expected to edit
  pages/                  Home, My mail, Department mail, Log delivery, Manage
  components/Slip.tsx     The courier slip, tear-off and postmark
  data/
    index.ts              Picks demo or SharePoint; reads the signed-in user
    sharePoint.ts         Reads/writes the list via the generated service
    people.ts             Office 365 Users directory search
    demo.ts               Browser-only demo data
    rules.ts              Who can do what; department matching
  styles.css              Design tokens, animations, light and dark
scripts/Create-MailroomList.ps1
```

## Troubleshooting

- **Still showing demo data after connecting the list.** Check that `src/generated/services/MailroomItemsService.ts` exists. If it has a different name, set `SHAREPOINT_SERVICE_NAME`. Putting `VITE_DATA_MODE=sharepoint` in `.env.local` shows an error that lists the services found.
- **"Column 'X' does not exist".** A column's internal name differs. Check `src/generated/models/` and update `COLUMNS`.
- **Access denied when confirming.** The person needs edit (Contribute) permission on the list.
- **List schema changed.** Run `pa app refresh data-source --name <data-source-name>`.

<img src="docs/mobile.png" alt="My mail on a phone" width="300">
