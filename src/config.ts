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

/** Courier buttons on the log form. Staff can still type any other courier. */
export const COURIERS = ['DHL', 'Aramex', 'FedEx', 'UPS', 'By hand'];

/**
 * Courier name for hand deliveries. Choosing it fills the courier number
 * with a date-and-time reference such as 1/11/2026_12:42:54.
 */
export const BY_HAND = 'By hand';

/**
 * Departments suggested on the log form and department filter, on top of
 * the ones already used in past deliveries.
 */
export const DEPARTMENTS: string[] = [
  // 'Trade Finance Dept.',
  // 'Treasury',
];

/** Dates are shown in this locale, e.g. "1 Nov 2026, 12:42". */
export const DATE_LOCALE = 'en-GB';

/**
 * Name of the generated SharePoint service. The Power Apps CLI names it
 * after the list, so a list called "MailroomItems" produces
 * src/generated/services/MailroomItemsService.ts.
 */
export const SHAREPOINT_SERVICE_NAME = 'MailroomItemsService';

/**
 * Optional Office 365 Users service. When it's added, the log form searches
 * the company directory for recipients, and department mail opens on the
 * signed-in person's department.
 */
export const PEOPLE_SERVICE_NAME = 'Office365UsersService';

/** Internal names of the SharePoint columns (see README). */
export const COLUMNS = {
  id: 'ID',
  courierNumber: 'Title',
  kind: 'Kind',
  unit: 'Unit',
  courierCompany: 'CourierCompany',
  sender: 'Sender',
  recipientName: 'RecipientName',
  recipientEmail: 'RecipientEmail',
  department: 'Department',
  status: 'Status',
  collectedByName: 'CollectedByName',
  collectedByEmail: 'CollectedByEmail',
  collectedOn: 'CollectedOn',
  loggedByName: 'LoggedByName',
  loggedByEmail: 'LoggedByEmail',
  notes: 'Notes',
  created: 'Created',
  modified: 'Modified',
} as const;

/** How many waiting and collected deliveries each view loads. */
export const MAX_WAITING = 500;
export const MAX_COLLECTED = 300;
