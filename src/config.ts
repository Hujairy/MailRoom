/**
 * App settings. Edit this file, then rebuild (`npm run build`) and
 * republish (`pa app push`).
 */

export const APP_TITLE = 'Mail Room';

/** Mail room locations. Each delivery belongs to one unit. */
export const UNITS = ['Bahrain', 'Egypt'];

/** Unit selected the first time someone opens the app. */
export const DEFAULT_UNIT = 'Bahrain';

/**
 * Who can log and manage deliveries, by unit. Use '*' for people who can
 * work in every unit. Emails are matched without regard to case.
 *
 * While this is empty, everyone sees the mail room desk, which is handy for
 * testing. Fill it in before you share the app.
 */
export const MAILROOM_STAFF: Record<string, string[]> = {
  // Bahrain: ['mailroom.bahrain@company.com'],
  // Egypt: ['mailroom.egypt@company.com'],
  // '*': ['mailroom.supervisor@company.com'],
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

/**
 * The two SharePoint lists, as in the original mail room site (README:
 * "PersonalMail" and "DepartmentMail"). `service` is the name of the service
 * the Power Apps CLI generates for each list; spaces and "Service" are
 * ignored when matching. `columns` are the internal column names.
 */
export const PERSONAL_MAIL_LIST = {
  service: 'PersonalMailService',
  columns: {
    id: 'ID',
    courierNumber: 'Title',
    courierCompany: 'CourierCompany',
    sender: 'Sender',
    recipient: 'Recipient',
    recipientEmail: 'RecipientEmail',
    onBehalf: 'OnBehalf',
    unit: 'Unit',
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
  service: 'DepartmentMailService',
  columns: {
    id: 'ID',
    courierNumber: 'Title',
    courierCompany: 'CourierCompany',
    department: 'Department',
    senderCompany: 'SenderCompany',
    unit: 'Unit',
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
