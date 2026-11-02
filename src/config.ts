/**
 * App settings. Edit this file, then rebuild (`npm run build`) and
 * republish (`pa app push`).
 */

export const APP_TITLE = 'Mail Room';

/**
 * General admins can open the Settings page, add and remove units, and add
 * people to units as admins or users. They're also admins in every unit.
 * They're set here (not in Settings) so nobody can lock them out.
 */
export const GENERAL_ADMINS: string[] = ['hawra.alhujairy@bank-abc.com'];

/**
 * Units and people are managed in the app's Settings page and stored in two
 * SharePoint lists (see README). These are the services the Power Apps CLI
 * generates for them, and their internal column names.
 */
export const SETTINGS_LISTS = {
  unitsService: 'MailroomUnitsService',
  membersService: 'MailroomMembersService',
  units: { id: 'ID', name: 'Title' },
  members: { id: 'ID', email: 'Title', name: 'MemberName', unit: 'Unit', role: 'Role' },
} as const;

/**
 * Each unit keeps its mail in its own two lists, named after the unit without
 * spaces: a unit called "Saudi Arabia" uses SaudiArabiaPersonalMail and
 * SaudiArabiaDepartmentMail. The app finds their generated services by name.
 */
export const unitListNames = (unit: string) => {
  const key = unit.replace(/[^A-Za-z0-9]/g, '');
  return { key, personal: `${key}PersonalMail`, department: `${key}DepartmentMail` };
};

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

/**
 * Optional Office 365 Users service. When it's added, the add form searches
 * the company directory for recipients, and department mail opens on the
 * signed-in person's department.
 */
export const PEOPLE_SERVICE_NAME = 'Office365UsersService';

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
