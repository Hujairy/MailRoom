<img src="docs/app-icon.png" alt="" width="72" align="right">

# Mail Room

A mail room app for Bank ABC, built as a [Power Apps code app](https://learn.microsoft.com/power-apps/developer/code-apps/) (React + TypeScript + Vite). It keeps the screens, fields and lists of the original **Bahrain Mail Room** SharePoint site, with a modern design and the Bank ABC brand.

![Home with deliveries waiting](docs/home.png)

## What it does

**For everyone**
- **Home** shows the personal mail waiting for you, with **Mark as received** on each delivery.
- **My Personal Mail** lets you find your personal delivery, not received or received.
- **Department Mail** lets you find delivery for a department, with the original filters: Courier Number, Department, Date, Courier Company, Sender Company and Received. Anyone in the department can mark a delivery as received.
- **Select your unit** at the top: Bahrain or Egypt.

**For mail room staff**
- **Add Personal Mail** has the fields Courier Number, Courier Company, Sender and Recipient.
- **Add Department Mail** has the fields Courier Number, Courier Company, Department and Sender Company.
- Both forms show the live time stamp, with **Submit**, **Reset** and **Cancel**. They work with barcode scanners and warn about duplicate courier numbers. **BY HAND** fills the courier number with the time stamp, like `1/11/2026_12:42:54`.
- **Maintenance** shows the original list columns. Use the edit button on a delivery to change details or mark it received. When someone collects personal mail for the recipient, it's recorded as **On Behalf**.

Each delivery is shown as a courier slip. Marking it received tears off the stub and stamps a postmark.

## Lists and fields

The app uses two SharePoint Online lists, matching the original site:

| PersonalMail | DepartmentMail | Notes |
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
| Unit | Unit | `Bahrain` or `Egypt`, so one pair of lists serves every unit |

Until the lists are connected, the app runs on **demo data**, saved in your browser only. The demo deliveries copy the original site, such as 11624 / BY HAND / TRADE FINANCE DEPT. / BAHRAIN STEEL. People's names are placeholders because this repository is public. In demo mode, a bar at the top lets you view the app as an employee or as mail room staff.

## Deploy

You already have Node.js, Git and the Power Apps CLI from the first app. Use a **Command Prompt** terminal in VS Code. If you see a certificate error, run `set NODE_USE_SYSTEM_CA=1` first.

```
cd %USERPROFILE%\Documents
git clone https://github.com/Hujairy/MailRoom.git
cd MailRoom
npm install
pa app init --display-name "Mail Room" --environment-id <your-environment-id>
npm run build
pa app push
```

If you already cloned it, run `git pull` and `npm install` in the folder instead of `git clone`, then `npm run build` and `pa app push`.

**App icon:** `docs/app-icon.png` is the Bank ABC tile, 512 × 512. If Power Apps offers an icon setting for the app, upload it there.

## Connect SharePoint

### 1. Create the lists

Run the script (PowerShell 7.4+ with [PnP.PowerShell](https://pnp.github.io/powershell/)). It creates **PersonalMail** and **DepartmentMail** with all the fields above:

```powershell
./scripts/Create-MailroomLists.ps1 -SiteUrl https://<tenant>.sharepoint.com/sites/<site> -ClientId <entra-app-client-id>
```

To create them by hand instead, use the list names without spaces. Create each column with the internal name shown (no spaces), then rename it to the display name:

- **PersonalMail**: `CourierCompany`, `Sender`, `Recipient`, `RecipientEmail`, `OnBehalf`, `Unit`, `Received`, `ReceivedBy`, `ReceivedByEmail` (all single line of text), and `ReceivedTimeStamp` (date and time).
- **DepartmentMail**: `CourierCompany`, `Department`, `SenderCompany`, `Unit`, `Received`, `ReceivedBy`, `ReceivedByEmail` (all single line of text), and `ReceivedTimeStamp` (date and time).

Index `Unit` and `Received` on both lists, plus `RecipientEmail` on PersonalMail. Employees need **Contribute** permission so they can mark mail as received.

### 2. Add the lists to the app

```
pa connection list
pa app add data-source --connector "shared_sharepointonline" --connection-id "<id>" --dataset "https://<tenant>.sharepoint.com/sites/<site>" --table "PersonalMail"
pa app add data-source --connector "shared_sharepointonline" --connection-id "<id>" --dataset "https://<tenant>.sharepoint.com/sites/<site>" --table "DepartmentMail"
```

If there's no SharePoint connection, create one at make.powerapps.com › **Connections** › **New connection** › **SharePoint**.

### 3. Optional: company directory search

Add Office 365 Users so staff can find recipients by name. Department Mail will also open on each person's own department:

```
pa app add data-source --connector "shared_office365users" --connection-id "<office365users-connection-id>"
```

### 4. Publish

```
npm run build
pa app push
git add -A
git commit -m "Connect SharePoint lists"
git push
```

Then fill in `MAILROOM_STAFF` in `src/config.ts` so only the mail room team sees **Add Mail** and **Maintenance**.

## Notifications

The original forms "notify individuals" and "notify department". Do the same with a Power Automate flow on each list:

- **PersonalMail**: trigger **When an item is created**, then **Send an email (V2)** to `RecipientEmail`. For example: *"A delivery from {Sender} ({Courier Company} {Courier Number}) is waiting for you at the {Unit} mail room."*
- **DepartmentMail**: the same trigger, then a **Switch** on `Department` that emails each department's mailbox.

To link straight to the right page, add `page=mine` or `page=department` to the app's link (`&page=…` if the link already contains `?`). `unit=Egypt` also works.

## Configure

Edit [`src/config.ts`](src/config.ts), then rebuild and push:

| Setting | What it changes |
| --- | --- |
| `UNITS`, `DEFAULT_UNIT` | Mail room units |
| `MAILROOM_STAFF` | Who sees Add Mail and Maintenance, per unit (`'*'` = every unit). While it's empty, everyone does. |
| `COURIERS`, `BY_HAND` | Courier Company buttons |
| `DEPARTMENTS` | Extra department suggestions |
| `DATE_LOCALE` | Date format (default `en-GB`: 1 Nov 2026) |
| `PERSONAL_MAIL_LIST`, `DEPARTMENT_MAIL_LIST` | Generated service names and column internal names |

Brand colours are at the top of [`src/styles.css`](src/styles.css): cyan `#009CBD`, blue `#007096`, deep blue `#005670`, grey `#53565A`.

## Troubleshooting

- **"The app can't find PersonalMailService…"**: one list is added but not the other, or the generated service has a different name. The message lists the services it found; add the missing list, or set the `service` names in `src/config.ts`.
- **"Column 'X' does not exist"**: a column's internal name differs. Check `src/generated/models/` and update the `columns` in `src/config.ts`.
- **Access denied when marking received**: the person needs edit (Contribute) permission on the list.
- **A list's columns changed**: run `pa app refresh data-source --name <data-source-name>`.

<img src="docs/mobile.png" alt="Department Mail on a phone" width="300">
