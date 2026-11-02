/**
 * App settings. Edit this file, then rebuild (`npm run build`) and
 * republish (`pa app push`).
 */

export const APP_TITLE = 'Mail Room';

/**
 * Mail room units. Each unit has its own two SharePoint lists, so its data is
 * kept apart from every other unit: give each unit's people access to their
 * unit's lists only, and the app shows them only that unit.
 *
 * To add a unit: create its lists (scripts/Create-MailroomLists.ps1 -Unit Qatar),
 * add them with `pa app add data-source`, then add an entry here and republish.
 *
 * - name: shown in the app ("Bahrain Mail Room").
 * - personalMailService / departmentMailService: the services the Power Apps
 *   CLI generates for the unit's lists (spaces and "Service" are ignored
 *   when matching).
 * - admins: emails of the unit's mail room admins. Only they see Add Mail and
 *   Maintenance. Emails are matched without regard to case.
 */
export interface UnitConfig {
  name: string;
  personalMailService: string;
  departmentMailService: string;
  admins: string[];
}

export const UNITS: UnitConfig[] = [
  {
    name: 'Bahrain',
    personalMailService: 'BahrainPersonalMailService',
    departmentMailService: 'BahrainDepartmentMailService',
    admins: [
      // 'mailroom.bahrain@company.com',
    ],
  },
  {
    name: 'Egypt',
    personalMailService: 'EgyptPersonalMailService',
    departmentMailService: 'EgyptDepartmentMailService',
    admins: [
      // 'mailroom.egypt@company.com',
    ],
  },
];

/** Admins in every unit they can open, e.g. the mail room supervisor. */
export const SUPER_ADMINS: string[] = [
  // 'mailroom.supervisor@company.com',
];

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
