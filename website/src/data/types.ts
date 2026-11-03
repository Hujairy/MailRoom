export type MailKind = 'Personal' | 'Department';
/** "Received: No" is Waiting; "Received: Yes" is Received. */
export type MailStatus = 'Waiting' | 'Received';

/**
 * One delivery from the Personal Mail or Department Mail list. IDs are only
 * unique within a list, so use `mailKey()` when you need a unique key.
 */
export interface MailItem {
  id: string;
  kind: MailKind;
  unit: string;
  courierNumber: string;
  courierCompany: string;
  /** Sender (personal mail) or Sender Company (department mail). */
  sender: string;
  /** Personal mail: the recipient's name and email. */
  recipient: string;
  recipientEmail: string;
  /** Personal mail: who the recipient's mail was received for, when someone else collected it. */
  onBehalf: string;
  /** Department mail. */
  department: string;
  status: MailStatus;
  receivedBy: string;
  receivedByEmail: string;
  /** ISO timestamp, or null when not received. */
  receivedTimeStamp: string | null;
  /** "Created By" — who logged the delivery. */
  createdBy: string;
  /** "Creation Time Stamp" — ISO timestamp the delivery was logged. */
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
  /**
   * Every address the person is known by, lower-cased: the user principal
   * name they sign in with and, with the company directory connected, their
   * email address. Settings and personal mail match any of them.
   */
  aliases: string[];
}

export interface NewMailInput {
  kind: MailKind;
  courierNumber: string;
  courierCompany: string;
  sender: string;
  recipient: string;
  recipientEmail: string;
  department: string;
}

export type MailChanges = Partial<
  Pick<MailItem, 'courierNumber' | 'courierCompany' | 'sender' | 'recipient' | 'recipientEmail' | 'onBehalf' | 'department'>
>;

/** Filters within one unit's lists. */
export interface MailQuery {
  /** Omit to read both lists. */
  kind?: MailKind;
  status?: MailStatus;
  /** Personal mail for any of these addresses. */
  recipientEmail?: string | string[];
}

export interface MailRepository {
  /** The unit whose lists this repository reads. */
  readonly unit: string;
  /** Newest first. */
  list(query: MailQuery, top: number): Promise<MailItem[]>;
  create(input: NewMailInput, user: CurrentUser): Promise<MailItem>;
  update(item: MailItem, changes: MailChanges): Promise<MailItem>;
  /** Marks a delivery as received. Fails if it was already received. */
  receive(item: MailItem, receivedBy: Person): Promise<MailItem>;
  /** Puts a received delivery back to not received. */
  reopen(item: MailItem): Promise<MailItem>;
}

export interface Directory {
  /** True when people can be searched by name (company directory). */
  readonly searchable: boolean;
  search(term: string): Promise<Person[]>;
  /** The signed-in person's department, when the directory knows it. */
  myDepartment(): Promise<string | null>;
  /** The signed-in person's directory profile, when there is a directory. */
  me(): Promise<Profile | null>;
}

export interface Profile {
  name: string;
  /** Lower-cased email address. */
  email: string;
  /** Lower-cased user principal name. */
  upn: string;
  department?: string;
}

export const mailKey = (item: Pick<MailItem, 'kind' | 'id'>) => `${item.kind}-${item.id}`;
