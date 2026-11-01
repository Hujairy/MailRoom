export type MailKind = 'Personal' | 'Department';
export type MailStatus = 'Waiting' | 'Collected';
export type DataMode = 'demo' | 'sharepoint';

export interface MailItem {
  id: string;
  kind: MailKind;
  unit: string;
  courierNumber: string;
  courierCompany: string;
  /** Sender's name (personal) or sender company (department). */
  sender: string;
  recipientName: string;
  /** Lower-cased. Empty for department mail. */
  recipientEmail: string;
  department: string;
  status: MailStatus;
  collectedByName: string;
  collectedByEmail: string;
  /** ISO timestamp, or null while waiting. */
  collectedOn: string | null;
  loggedByName: string;
  loggedByEmail: string;
  notes: string;
  /** ISO timestamp the delivery was logged. */
  created: string;
  modified: string;
}

export interface Person {
  name: string;
  /** Lower-cased email / user principal name. */
  email: string;
  department?: string;
  jobTitle?: string;
}

export interface CurrentUser extends Person {
  /** False when running outside Power Apps, for example `npm run dev`. */
  fromPowerApps: boolean;
}

export interface NewMailInput {
  kind: MailKind;
  unit: string;
  courierNumber: string;
  courierCompany: string;
  sender: string;
  recipientName: string;
  recipientEmail: string;
  department: string;
  notes: string;
}

export type MailChanges = Partial<
  Pick<
    MailItem,
    'courierNumber' | 'courierCompany' | 'sender' | 'recipientName' | 'recipientEmail' | 'department' | 'notes'
  >
>;

export interface MailQuery {
  unit: string;
  kind?: MailKind;
  status?: MailStatus;
  recipientEmail?: string;
}

export interface MailRepository {
  readonly mode: DataMode;
  /** Newest first. */
  list(query: MailQuery, top: number): Promise<MailItem[]>;
  create(input: NewMailInput, user: CurrentUser): Promise<MailItem>;
  update(id: string, changes: MailChanges): Promise<MailItem>;
  /** Marks a waiting delivery as collected. Fails if someone already collected it. */
  collect(id: string, collector: Person): Promise<MailItem>;
  /** Puts a collected delivery back to waiting. */
  reopen(id: string): Promise<MailItem>;
}

export interface Directory {
  /** True when people can be searched by name (company directory or demo people). */
  readonly searchable: boolean;
  search(term: string): Promise<Person[]>;
  /** The signed-in person's department, when the directory knows it. */
  myDepartment(): Promise<string | null>;
}
