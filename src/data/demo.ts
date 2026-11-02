import { byHandRef } from '../lib/format';
import { byNewest, onBehalfFor, sameEmail } from './rules';
import type {
  CurrentUser,
  Directory,
  MailChanges,
  MailItem,
  MailQuery,
  MailRepository,
  NewMailInput,
  Person,
} from './types';

/**
 * Demo data store. Keeps deliveries in this browser's localStorage so the
 * app is fully usable before the SharePoint lists are connected. Nothing is
 * shared with anyone else in this mode. The sample deliveries follow the
 * original Bahrain Mail Room lists; people's names are placeholders.
 */
export class DemoRepository implements MailRepository {
  readonly mode = 'demo' as const;
  private memory: MailItem[] | null = null;
  private readonly user: CurrentUser;

  constructor(user: CurrentUser) {
    this.user = user;
  }

  async list(query: MailQuery, top: number): Promise<MailItem[]> {
    await pause(180);
    return this.load()
      .filter(
        (i) =>
          i.unit === query.unit &&
          (!query.kind || i.kind === query.kind) &&
          (!query.status || i.status === query.status) &&
          (!query.recipientEmail || sameEmail(i.recipientEmail, query.recipientEmail)),
      )
      .sort(byNewest)
      .slice(0, top);
  }

  async create(input: NewMailInput, user: CurrentUser): Promise<MailItem> {
    const items = this.load();
    const nextId = items.filter((i) => i.kind === input.kind).reduce((max, i) => Math.max(max, Number(i.id) || 0), 0) + 1;
    const now = new Date().toISOString();
    const item: MailItem = {
      ...input,
      id: String(nextId),
      courierNumber: input.courierNumber.trim(),
      recipientEmail: input.recipientEmail.trim().toLowerCase(),
      onBehalf: '',
      status: 'Waiting',
      receivedBy: '',
      receivedByEmail: '',
      receivedTimeStamp: null,
      createdBy: user.name,
      created: now,
      modified: now,
    };
    this.save([...items, item]);
    await pause(300);
    return item;
  }

  async update(target: MailItem, changes: MailChanges): Promise<MailItem> {
    return this.change(target, (i) => ({
      ...i,
      ...changes,
      recipientEmail: (changes.recipientEmail ?? i.recipientEmail).toLowerCase(),
    }));
  }

  async receive(target: MailItem, receivedBy: Person): Promise<MailItem> {
    return this.change(target, (i) => {
      if (i.status === 'Received') throw new Error(`Already received by ${i.receivedBy || 'someone else'}.`);
      return {
        ...i,
        status: 'Received',
        receivedBy: receivedBy.name,
        receivedByEmail: receivedBy.email.toLowerCase(),
        receivedTimeStamp: new Date().toISOString(),
        onBehalf: onBehalfFor(i, receivedBy),
      };
    });
  }

  async reopen(target: MailItem): Promise<MailItem> {
    return this.change(target, (i) => ({
      ...i,
      status: 'Waiting',
      receivedBy: '',
      receivedByEmail: '',
      receivedTimeStamp: null,
      onBehalf: '',
    }));
  }

  /** Clears demo data and restores the sample deliveries. */
  reset(): void {
    this.memory = null;
    try {
      localStorage.removeItem(this.key());
    } catch {
      // storage unavailable; memory was cleared above
    }
  }

  private async change(target: MailItem, update: (i: MailItem) => MailItem): Promise<MailItem> {
    const items = this.load();
    const index = items.findIndex((i) => i.kind === target.kind && i.id === target.id);
    if (index < 0) throw new Error('This delivery no longer exists.');
    const updated = { ...update(items[index]), modified: new Date().toISOString() };
    const next = [...items];
    next[index] = updated;
    this.save(next);
    await pause(450);
    return updated;
  }

  private key() {
    return `mailroom:demo:v2:${this.user.email}`;
  }

  private load(): MailItem[] {
    if (this.memory) return this.memory;
    try {
      const raw = localStorage.getItem(this.key());
      if (raw) {
        this.memory = JSON.parse(raw) as MailItem[];
        return this.memory;
      }
    } catch {
      // fall through to sample data
    }
    this.memory = seed(this.user);
    this.persist();
    return this.memory;
  }

  private save(items: MailItem[]) {
    this.memory = items;
    this.persist();
  }

  private persist() {
    try {
      localStorage.setItem(this.key(), JSON.stringify(this.memory));
    } catch {
      // storage unavailable; keep in memory
    }
  }
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Placeholder colleagues for the demo directory. */
export const DEMO_PEOPLE: Person[] = [
  { name: 'Fatema Hasan', email: 'fatema.hasan@contoso.com', department: 'TRADE FINANCE DEPT.', jobTitle: 'Trade Finance Officer' },
  { name: 'Yusuf Mahmood', email: 'yusuf.mahmood@contoso.com', department: 'TRADE FINANCE DEPT.', jobTitle: 'Trade Finance Officer' },
  { name: 'Maryam Abdulla', email: 'maryam.abdulla@contoso.com', department: 'TREASURY', jobTitle: 'Treasury Dealer' },
  { name: 'Hussain Ebrahim', email: 'hussain.ebrahim@contoso.com', department: 'HUMAN RESOURCES', jobTitle: 'HR Officer' },
  { name: 'Zahra Mansoor', email: 'zahra.mansoor@contoso.com', department: 'LEGAL', jobTitle: 'Legal Counsel' },
  { name: 'Ahmed Jaffar', email: 'ahmed.jaffar@contoso.com', department: 'GENERAL SERVICES', jobTitle: 'Mail Room Officer' },
  { name: 'Noor Salman', email: 'noor.salman@contoso.com', department: 'GENERAL SERVICES', jobTitle: 'Mail Room Officer' },
];

export class DemoDirectory implements Directory {
  readonly searchable = true;
  private readonly people: Person[];

  constructor(user: CurrentUser) {
    this.people = [{ name: user.name, email: user.email, department: 'TRADE FINANCE DEPT.' }, ...DEMO_PEOPLE];
  }

  async search(term: string): Promise<Person[]> {
    const q = term.trim().toLowerCase();
    if (!q) return [];
    await pause(120);
    return this.people
      .filter((p) => p.name.toLowerCase().includes(q) || p.email.includes(q) || (p.department ?? '').toLowerCase().includes(q))
      .slice(0, 8);
  }

  async myDepartment(): Promise<string | null> {
    return 'TRADE FINANCE DEPT.';
  }
}

/** Today's deliveries: a number of hours ago, so they're never in the future. */
function ago(hours: number): string {
  return new Date(Date.now() - hours * 3600e3).toISOString();
}

function at(daysAgo: number, hour: number, minute: number, second = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, second, 0);
  return d.toISOString();
}

function seed(user: CurrentUser): MailItem[] {
  const blank = {
    sender: '',
    recipient: '',
    recipientEmail: '',
    onBehalf: '',
    department: '',
    receivedBy: '',
    receivedByEmail: '',
    receivedTimeStamp: null,
  };
  const staffA = DEMO_PEOPLE[5].name;
  const staffB = DEMO_PEOPLE[6].name;
  const tf = DEMO_PEOPLE[1];

  // Department Mail, as on the original site (yesterday's deliveries).
  const handA = at(1, 12, 42, 54);
  const handB = at(1, 12, 42, 13);
  const dept: Omit<MailItem, 'modified'>[] = [
    { ...blank, id: '11624', kind: 'Department', unit: 'Bahrain', courierNumber: byHandRef(handA), courierCompany: 'BY HAND', department: 'TRADE FINANCE DEPT.', sender: 'BAHRAIN STEEL', status: 'Waiting', createdBy: staffA, created: handA },
    { ...blank, id: '11623', kind: 'Department', unit: 'Bahrain', courierNumber: byHandRef(handB), courierCompany: 'BY HAND', department: 'TRADE FINANCE DEPT.', sender: 'SULB', status: 'Received', createdBy: staffA, created: handB, receivedBy: tf.name, receivedByEmail: tf.email, receivedTimeStamp: at(1, 13, 12) },
    { ...blank, id: '11622', kind: 'Department', unit: 'Bahrain', courierNumber: '37351856916', courierCompany: 'ARAMEX', department: 'TRADE FINANCE DEPT', sender: 'AL HAIDER TRADING', status: 'Received', createdBy: staffB, created: at(1, 8, 37), receivedBy: tf.name, receivedByEmail: tf.email, receivedTimeStamp: at(1, 9, 49) },
    { ...blank, id: '11588', kind: 'Department', unit: 'Bahrain', courierNumber: '4424108776', courierCompany: 'DHL', department: 'TRADE FINANCE DEPT', sender: 'BRF SA', status: 'Waiting', createdBy: staffB, created: at(1, 8, 29) },
    { ...blank, id: '11621', kind: 'Department', unit: 'Bahrain', courierNumber: '5521877340', courierCompany: 'DHL', department: 'TREASURY', sender: 'GULF INVESTMENT HOUSE', status: 'Waiting', createdBy: staffA, created: ago(1.5) },
    { ...blank, id: '11619', kind: 'Department', unit: 'Bahrain', courierNumber: '7731 9902 1101', courierCompany: 'FEDEX', department: 'LEGAL', sender: 'SEEF ADVISORY', status: 'Received', createdBy: staffB, created: at(3, 10, 5), receivedBy: 'Zahra Mansoor', receivedByEmail: 'zahra.mansoor@contoso.com', receivedTimeStamp: at(3, 11, 30) },
    { ...blank, id: '11617', kind: 'Department', unit: 'Bahrain', courierNumber: '37351856902', courierCompany: 'ARAMEX', department: 'HUMAN RESOURCES', sender: 'CORAL HOLDINGS', status: 'Waiting', createdBy: staffA, created: at(4, 11, 20) },
    { ...blank, id: '2210', kind: 'Department', unit: 'Egypt', courierNumber: '37351857100', courierCompany: 'ARAMEX', department: 'CORPORATE BANKING', sender: 'DELTA TEXTILES', status: 'Waiting', createdBy: 'Mona Adel', created: ago(2.2) },
  ];

  // Personal Mail for whoever is signed in.
  const me = { recipient: user.name, recipientEmail: user.email };
  const personal: Omit<MailItem, 'modified'>[] = [
    { ...blank, ...me, id: '4512', kind: 'Personal', unit: 'Bahrain', courierNumber: '4424108771', courierCompany: 'DHL', sender: 'BAHRAIN STEEL', status: 'Waiting', createdBy: staffA, created: ago(0.8) },
    { ...blank, ...me, id: '4509', kind: 'Personal', unit: 'Bahrain', courierNumber: byHandRef(at(2, 13, 40, 7)), courierCompany: 'BY HAND', sender: 'SULB', status: 'Waiting', createdBy: staffB, created: at(2, 13, 40, 7) },
    { ...blank, ...me, id: '4480', kind: 'Personal', unit: 'Bahrain', courierNumber: '7731 9902 1184', courierCompany: 'FEDEX', sender: 'BRF SA', status: 'Received', createdBy: staffA, created: at(9, 10, 5), receivedBy: tf.name, receivedByEmail: tf.email, receivedTimeStamp: at(9, 14, 22), onBehalf: user.name },
    { ...blank, recipient: 'Maryam Abdulla', recipientEmail: 'maryam.abdulla@contoso.com', id: '4511', kind: 'Personal', unit: 'Bahrain', courierNumber: '1Z999AA10123456784', courierCompany: 'UPS', sender: 'GULF INVESTMENT HOUSE', status: 'Waiting', createdBy: staffB, created: ago(1.1) },
    { ...blank, ...me, id: '1302', kind: 'Personal', unit: 'Egypt', courierNumber: '7745 0012 8890', courierCompany: 'FEDEX', sender: 'NILE VALLEY IMPORTS', status: 'Waiting', createdBy: 'Mona Adel', created: at(1, 10, 15) },
  ];

  return [...dept, ...personal].map((r) => ({ ...r, modified: r.receivedTimeStamp ?? r.created }));
}
