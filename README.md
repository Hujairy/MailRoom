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

## Units and admins

**Each unit's data is separate.** Every unit (Bahrain, Egypt, …) has its own two SharePoint lists, ideally on its own site, as with the original `/sites/MailRoom/Bahrain`.
- Give each unit's people access to their unit's site only. The app checks which units' lists a person can open and shows only those.
- People in one unit never see another unit, its records, or even its name.
- Someone with access to several units (for example a supervisor) gets a unit switcher.
- Someone with access to none sees a "no access" message.

**Admins** are listed per unit in `src/config.ts`, plus optional super admins who are admins in every unit they can open. Everyone else gets no Add Mail or Maintenance pages, no navigation to them, no admin tiles on Home, and opening a link to an admin page just shows Home.

Keep in mind:
- Unit separation is enforced by SharePoint permissions, so it holds even outside the app.
- The admin role is enforced by the app. Normal users still need edit (Contribute) permission on their unit's lists so they can mark mail as received, which means they could edit list items directly in SharePoint. If that matters, the next step is a Power Automate flow that marks items received on the user's behalf, so normal users only need read access.

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

Until the lists are connected, the app runs on **demo data**, saved in your browser only. The demo deliveries copy the original site, such as 11624 / BY HAND / TRADE FINANCE DEPT. / BAHRAIN STEEL. People's names are placeholders because this repository is public. In demo mode, **View as** switches between an employee (Bahrain only, no admin pages) and an admin (every unit).

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

## Add a unit

Do this once per unit, starting with Bahrain.

**1. Create the unit's site and lists.** Create a SharePoint Online site for the unit (for example *Mail Room – Bahrain*), then run the script with PowerShell 7.4+ and [PnP.PowerShell](https://pnp.github.io/powershell/):

```powershell
./scripts/Create-MailroomLists.ps1 -Unit Bahrain -SiteUrl https://<tenant>.sharepoint.com/sites/<bahrain-site> -ClientId <entra-app-client-id>
```

It creates `BahrainPersonalMail` and `BahrainDepartmentMail` with all the fields above.

<details>
<summary>Creating the lists by hand instead</summary>

Use list names without spaces. Create each column with the internal name shown, then rename it to the display name:

- **&lt;Unit&gt;PersonalMail**: `CourierCompany`, `Sender`, `Recipient`, `RecipientEmail`, `OnBehalf`, `Received`, `ReceivedBy`, `ReceivedByEmail` (all single line of text), and `ReceivedTimeStamp` (date and time).
- **&lt;Unit&gt;DepartmentMail**: `CourierCompany`, `Department`, `SenderCompany`, `Received`, `ReceivedBy`, `ReceivedByEmail` (all single line of text), and `ReceivedTimeStamp` (date and time).

Index `Received` on both lists, and `RecipientEmail` on the personal list.
</details>

**2. Set permissions.** Give the unit's people (ideally one Entra ID group) **Edit** access to the unit's site, and nobody else. Site owners can be the unit's mail room admins.

**3. Add the lists to the app:**

```
pa connection list
pa app add data-source --connector "shared_sharepointonline" --connection-id "<id>" --dataset "https://<tenant>.sharepoint.com/sites/<bahrain-site>" --table "BahrainPersonalMail"
pa app add data-source --connector "shared_sharepointonline" --connection-id "<id>" --dataset "https://<tenant>.sharepoint.com/sites/<bahrain-site>" --table "BahrainDepartmentMail"
```

**4. Add the unit to `src/config.ts`** with its admins:

```ts
{
  name: 'Bahrain',
  personalMailService: 'BahrainPersonalMailService',
  departmentMailService: 'BahrainDepartmentMailService',
  admins: ['mailroom.bahrain@bank-abc.com'],
},
```

**5. Publish:**

```
npm run build
pa app push
git add -A
git commit -m "Add Bahrain unit"
git push
```

If a unit is in `config.ts` but its lists aren't added yet, the app skips it. To remove a unit, delete its entry.

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

Edit [`src/config.ts`](src/config.ts), then rebuild and push:

| Setting | What it changes |
| --- | --- |
| `UNITS` | Each unit's name, list services and admins |
| `SUPER_ADMINS` | People who are admins in every unit they can open |
| `COURIERS`, `BY_HAND` | Courier Company buttons |
| `DEPARTMENTS` | Extra department suggestions |
| `DATE_LOCALE` | Date format (default `en-GB`: 1 Nov 2026) |
| `PERSONAL_MAIL_LIST`, `DEPARTMENT_MAIL_LIST` | Column internal names, the same for every unit |

Brand colours are at the top of [`src/styles.css`](src/styles.css): cyan `#009CBD`, blue `#007096`, deep blue `#005670`, grey `#53565A`.

## Troubleshooting

- **"None of the units in src/config.ts have their lists added yet"**: the generated service names don't match `config.ts`. The message lists the services found; update `personalMailService` and `departmentMailService`.
- **A unit doesn't appear for someone**: they can't read that unit's lists. Check the site permissions.
- **Admin pages don't appear**: the person's email isn't in that unit's `admins` (or `SUPER_ADMINS`). Emails are matched without regard to case.
- **"Column 'X' does not exist"**: a column's internal name differs. Check `src/generated/models/` and update the `columns` in `src/config.ts`.
- **A list's columns changed**: run `pa app refresh data-source --name <data-source-name>`.

<img src="docs/mobile.png" alt="Department Mail on a phone" width="300">
