/**
 * App settings that are built into the website. Edit, then `npm run build`
 * and copy the new `dist` folder to the web server.
 *
 * Settings that differ per organisation (sign-in, the settings site, general
 * admins) are in `public/mailroom.config.json`, which can be edited on the
 * web server without rebuilding.
 */

export const APP_TITLE = 'Mail Room';

/** The two lists that hold units and their people, on the settings site. */
export const SETTINGS_LISTS = {
  units: 'MailroomUnits',
  members: 'MailroomMembers',
  unitColumns: { name: 'Title', siteUrl: 'SiteUrl' },
  memberColumns: { email: 'Title', name: 'MemberName', unit: 'Unit', role: 'Role' },
} as const;

/**
 * Each unit keeps its mail in its own two lists, named after the unit without
 * spaces: a unit called "Saudi Arabia" uses SaudiArabiaPersonalMail and
 * SaudiArabiaDepartmentMail, on the unit's SharePoint site.
 */
export const unitListNames = (unit: string) => {
  const key = unit.replace(/[^A-Za-z0-9]/g, '');
  return { key, personal: `${key}PersonalMail`, department: `${key}DepartmentMail` };
};

/** Microsoft Graph permissions the website asks for when people sign in. */
export const SIGN_IN_SCOPES = ['User.Read', 'User.ReadBasic.All', 'Sites.ReadWrite.All'];

/** Asked for only when a general admin creates lists from the website. */
export const CREATE_LISTS_SCOPES = ['Sites.Manage.All'];

/** Courier company buttons on the add forms. Staff can still type any other courier. */
export const COURIERS = ['DHL', 'ARAMEX', 'FEDEX', 'UPS', 'BY HAND'];

/**
 * Courier company for hand deliveries. Choosing it fills the courier number
 * with a date-and-time reference such as 1/11/2026_12:42:54.
 */
export const BY_HAND = 'BY HAND';

/**
 * Departments suggested on the department form and filter, on top of the
 * ones already used in past deliveries.
 */
export const DEPARTMENTS: string[] = ['TRADE FINANCE DEPT.'];

/** Dates are shown in this locale, e.g. "1 Nov 2026, 12:42". */
export const DATE_LOCALE = 'en-GB';


/** Internal column names of each unit's Personal Mail and Department Mail lists (see README). */
export const PERSONAL_MAIL_LIST = {
  columns: {
    id: 'ID',
    courierNumber: 'Title',
    courierCompany: 'CourierCompany',
    sender: 'Sender',
    recipient: 'Recipient',
    recipientEmail: 'RecipientEmail',
    onBehalf: 'OnBehalf',
    received: 'Received',
    receivedBy: 'ReceivedBy',
    receivedByEmail: 'ReceivedByEmail',
    receivedTimeStamp: 'ReceivedTimeStamp',
    createdBy: 'Author',
    created: 'Created',
    modified: 'Modified',
  },
} as const;

export const DEPARTMENT_MAIL_LIST = {
  columns: {
    id: 'ID',
    courierNumber: 'Title',
    courierCompany: 'CourierCompany',
    department: 'Department',
    senderCompany: 'SenderCompany',
    received: 'Received',
    receivedBy: 'ReceivedBy',
    receivedByEmail: 'ReceivedByEmail',
    receivedTimeStamp: 'ReceivedTimeStamp',
    createdBy: 'Author',
    created: 'Created',
    modified: 'Modified',
  },
} as const;

/** How many not-received and received deliveries each view loads. */
export const MAX_WAITING = 500;
export const MAX_RECEIVED = 300;
