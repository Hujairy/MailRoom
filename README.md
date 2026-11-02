<img src="docs/app-icon.png" alt="" width="72" align="right">

# Mail Room

A mail room app for Bank ABC, built as a [Power Apps code app](https://learn.microsoft.com/power-apps/developer/code-apps/) (React + TypeScript + Vite). It keeps the screens, fields and lists of the original **Bahrain Mail Room** SharePoint site, with a modern design and the Bank ABC brand.

![Home with deliveries waiting](docs/home.png)

## What it does

**Everyone in a unit**
- **Home** shows the personal mail waiting for you, with **Mark as received** on each delivery.
- **My Personal Mail** lets you find your personal delivery, not received or received.
- **Department Mail** lets you find delivery for a department, with the original filters: Courier Number, Department, Date, Courier Company, Sender Company and Received.

**Mail room admins only**
- **Add Personal Mail** has the fields Courier Number, Courier Company, Sender and Recipient.
- **Add Department Mail** has the fields Courier Number, Courier Company, Department and Sender Company.
- Both forms show the live time stamp, with Submit, Reset and Cancel. They work with barcode scanners, and **BY HAND** fills in a time-stamp reference.
- **Maintenance** shows the original list columns. Use it to edit a delivery, mark it received (on behalf of the recipient if someone else collects), or set it back to not received.

**General admins only**
- **Settings** is where you add and remove units, and add people to each unit as a **User** or an **Admin**.

![Settings](docs/settings.png)

## Units, people and admins

Everything is managed on the **Settings** page, which only general admins can see.

| Who | Sees |
| --- | --- |
| **User** of a unit | Home, My Personal Mail and Department Mail, for their unit only |
| **Admin** of a unit | The same, plus Add Mail and Maintenance for that unit |
| **General admin** | Every unit as an admin, plus Settings |
| Anyone else | A "no access" message |

- Someone can be in several units (for example a supervisor). They get a unit switcher.
- Pages someone can't use don't exist for them. There is no navigation, no tile, and a link to the page opens Home instead.
- **General admins** are listed in `GENERAL_ADMINS` in [`src/config.ts`](src/config.ts), not in Settings, so nobody can lock them out. Right now that's only `hawra.alhujairy@bank-abc.com`.

**Each unit's data is separate**, with two locks:
1. Every unit (Bahrain, Egypt, …) keeps its mail in its own two SharePoint lists, ideally on its own site, as with the original `/sites/MailRoom/Bahrain`. Only that unit's people get access to the site, so nobody else can open its records, in the app or in SharePoint.
2. The app only opens the units a person is a member of in Settings. Other units' lists are never queried, and their names never appear.

Keep in mind:
- The admin role is enforced by the app. Users still need Edit permission on their unit's lists so they can mark mail as received, which means they could edit list items directly in SharePoint. If that matters, the next step is a Power Automate flow that marks items received for them, so users only need Read access.
- The settings lists must be **read-only for everyone except the general admins**. Otherwise people could add themselves to a unit directly in SharePoint.

## Lists and fields

Each unit has two lists named after it, for example **BahrainPersonalMail** and **BahrainDepartmentMail**:

| Personal mail | Department mail | Notes |
| --- | --- | --- |
| ID | ID | Built in |
| Courier Number | Courier Number | The built-in Title column, renamed |
| Courier Company | Courier Company | |
| Sender | Sender Company | |
| Recipient | Department | |
| Recipient Email | | Used to find each person's mail |
| On Behalf | | Filled when someone collects for the recipient |
| Creation Time Stamp | Creation Time Stamp | The built-in Created column |
| Created By | Created By | The built-in Created By column |
| Received | Received | `Yes` or `No` |
| Received By | Received By | |
| Received By Email | Received By Email | |
| Received Time Stamp | Received Time Stamp | |

The two **settings lists** hold the units and their people:

| MailroomUnits | MailroomMembers |
| --- | --- |
| Unit (the built-in Title column, renamed) | Email (the built-in Title column, renamed) |
| | Name (`MemberName`) |
| | Unit |
| | Role: `Admin` or `User` |

Until the lists are connected, the app runs on **demo data**, saved in your browser only. The demo deliveries copy the original site, such as 11624 / BY HAND / TRADE FINANCE DEPT. / BAHRAIN STEEL. People's names are placeholders because this repository is public. In demo mode you're a general admin: add people in Settings, then use **View as** to see the app as each of them.

## Deploy

Use a **Command Prompt** terminal in VS Code. If you see a certificate error, run `set NODE_USE_SYSTEM_CA=1` first.

```
cd %USERPROFILE%\Documents
git clone https://github.com/Hujairy/MailRoom.git
cd MailRoom
npm install
pa app init --display-name "Mail Room" --environment-id <your-environment-id>
npm run build
pa app push
```

If you already cloned it, run `git pull` and `npm install` in the folder instead, then `npm run build` and `pa app push`.

**App icon:** `docs/app-icon.png` is the Bank ABC tile, 512 × 512. If Power Apps offers an icon setting for the app, upload it there.

## Set up the lists

All the scripts need PowerShell 7.4+ and [PnP.PowerShell](https://pnp.github.io/powershell/). Run `pa connection list` to find your SharePoint connection id for the `pa app add data-source` commands.

### 1. The settings lists (once)

Create a SharePoint site for them, for example *Mail Room Settings*. Give everyone who uses the app **Read** access, and only the general admins **Edit** (or Owner) access. Then:

```powershell
./scripts/Create-MailroomSettingsLists.ps1 -SiteUrl https://<tenant>.sharepoint.com/sites/<settings-site> -ClientId <entra-app-client-id>
```

```
pa app add data-source --connector "shared_sharepointonline" --connection-id "<id>" --dataset "https://<tenant>.sharepoint.com/sites/<settings-site>" --table "MailroomUnits"
pa app add data-source --connector "shared_sharepointonline" --connection-id "<id>" --dataset "https://<tenant>.sharepoint.com/sites/<settings-site>" --table "MailroomMembers"
```

### 2. Each unit's lists

Do this once per unit, starting with Bahrain. Once the app is published, **Add unit** in Settings shows these commands with the unit's names filled in.

**Create the unit's site and lists.** Create a SharePoint site for the unit (for example *Mail Room – Bahrain*), then:

```powershell
./scripts/Create-MailroomLists.ps1 -Unit Bahrain -SiteUrl https://<tenant>.sharepoint.com/sites/<bahrain-site> -ClientId <entra-app-client-id>
```

It creates `BahrainPersonalMail` and `BahrainDepartmentMail` with all the fields above. A unit with spaces in its name drops them: *Saudi Arabia* uses `SaudiArabiaPersonalMail`.

<details>
<summary>Creating the lists by hand instead</summary>

Use list names without spaces. Create each column with the internal name shown, then rename it to the display name:

- **&lt;Unit&gt;PersonalMail**: `CourierCompany`, `Sender`, `Recipient`, `RecipientEmail`, `OnBehalf`, `Received`, `ReceivedBy`, `ReceivedByEmail` (all single line of text), and `ReceivedTimeStamp` (date and time).
- **&lt;Unit&gt;DepartmentMail**: `CourierCompany`, `Department`, `SenderCompany`, `Received`, `ReceivedBy`, `ReceivedByEmail` (all single line of text), and `ReceivedTimeStamp` (date and time).
- **MailroomUnits**: just the Title column.
- **MailroomMembers**: `MemberName`, `Unit` and `Role` (all single line of text). Title holds the email.

Index `Received` on both mail lists, and `RecipientEmail` on the personal list.
</details>

**Set permissions.** Give the unit's people (ideally one Entra ID group) **Edit** access to the unit's site, and nobody else.

**Add the lists to the app:**

```
pa app add data-source --connector "shared_sharepointonline" --connection-id "<id>" --dataset "https://<tenant>.sharepoint.com/sites/<bahrain-site>" --table "BahrainPersonalMail"
pa app add data-source --connector "shared_sharepointonline" --connection-id "<id>" --dataset "https://<tenant>.sharepoint.com/sites/<bahrain-site>" --table "BahrainDepartmentMail"
```

### 3. Publish, then add units and people

```
npm run build
pa app push
git add -A
git commit -m "Add Bahrain lists"
git push
```

Open the app and go to **Settings**. Add each unit with the same name you used for its lists, then add its people as Users or Admins.

- People and roles take effect as soon as you save. Nothing needs rebuilding.
- A unit whose lists aren't added yet shows **Lists not added** with the commands to run. Its people see "not set up yet" until you add the lists and publish.
- **Remove unit** takes the unit and its people out of the app. Its SharePoint lists and deliveries are kept.

### Optional: company directory search

Add Office 365 Users so admins can find recipients by name. Department Mail will also open on each person's own department.

```
pa app add data-source --connector "shared_office365users" --connection-id "<office365users-connection-id>"
```

## Notifications

The original forms "notify individuals" and "notify department". Add a Power Automate flow on each unit's lists:

- **Personal mail**: trigger **When an item is created**, then **Send an email (V2)** to `RecipientEmail`. For example: *"A delivery from {Sender} ({Courier Company} {Courier Number}) is waiting for you at the mail room."*
- **Department mail**: the same trigger, then a **Switch** on `Department` that emails each department's mailbox.

To link straight to a page, add `page=mine` or `page=department` to the app's link (`&page=…` if the link already contains `?`).

## Configure

Units and people are managed in **Settings**. For everything else, edit [`src/config.ts`](src/config.ts), then rebuild and push:

| Setting | What it changes |
| --- | --- |
| `GENERAL_ADMINS` | People with full access, including Settings |
| `COURIERS`, `BY_HAND` | Courier Company buttons |
| `DEPARTMENTS` | Extra department suggestions |
| `DATE_LOCALE` | Date format (default `en-GB`: 1 Nov 2026) |
| `PERSONAL_MAIL_LIST`, `DEPARTMENT_MAIL_LIST` | Column internal names, the same for every unit |
| `SETTINGS_LISTS` | Column internal names of the settings lists |

Brand colours are at the top of [`src/styles.css`](src/styles.css): cyan `#009CBD`, blue `#007096`, deep blue `#005670`, grey `#53565A`.

## Troubleshooting

- **"The Mail Room settings lists aren't added to the app yet"**: add MailroomUnits and MailroomMembers (step 1 above), then build and push.
- **"Everyone who uses the app needs Read access…"**: the person can't read the settings lists. Give them Read access to the settings site.
- **"You don't have access to a mail room yet"**: the person isn't in any unit. Add them in Settings. Emails are matched without regard to case.
- **"You can't open the … mail room yet"**: they're in the unit, but can't open its lists. Check the unit site's permissions.
- **A unit shows "Lists not added"**: its two lists aren't in the app, or their names don't match the unit's name. The unit's card shows the names it expects.
- **Settings doesn't appear**: only the emails in `GENERAL_ADMINS` see it.
- **"Column 'X' does not exist"**: a column's internal name differs. Check `src/generated/models/` and update the `columns` in `src/config.ts`.
- **A list's columns changed**: run `pa app refresh data-source --name <data-source-name>`.

<img src="docs/mobile.png" alt="Department Mail on a phone" width="300">
