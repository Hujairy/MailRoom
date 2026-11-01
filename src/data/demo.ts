import { byHandRef } from '../lib/format';
import { byNewest, sameEmail } from './rules';
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
 * app is fully usable before the SharePoint list is connected. Nothing is
 * shared with anyone else in this mode.
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
    const nextId = items.reduce((max, i) => Math.max(max, Number(i.id) || 0), 11600) + 1;
    const now = new Date().toISOString();
    const item: MailItem = {
      ...input,
      id: String(nextId),
      courierNumber: input.courierNumber.trim(),
      recipientEmail: input.recipientEmail.trim().toLowerCase(),
      status: 'Waiting',
      collectedByName: '',
      collectedByEmail: '',
      collectedOn: null,
      loggedByName: user.name,
      loggedByEmail: user.email,
      created: now,
      modified: now,
    };
    this.save([...items, item]);
    await pause(300);
    return item;
  }

  async update(id: string, changes: MailChanges): Promise<MailItem> {
    return this.change(id, (i) => ({ ...i, ...changes, recipientEmail: (changes.recipientEmail ?? i.recipientEmail).toLowerCase() }));
  }

  async collect(id: string, collector: Person): Promise<MailItem> {
    return this.change(id, (i) => {
      if (i.status !== 'Waiting') throw new Error(`Already collected by ${i.collectedByName || 'someone else'}.`);
      return {
        ...i,
        status: 'Collected',
        collectedByName: collector.name,
        collectedByEmail: collector.email.toLowerCase(),
        collectedOn: new Date().toISOString(),
      };
    });
  }

  async reopen(id: string): Promise<MailItem> {
    return this.change(id, (i) => ({ ...i, status: 'Waiting', collectedByName: '', collectedByEmail: '', collectedOn: null }));
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

  private async change(id: string, update: (i: MailItem) => MailItem): Promise<MailItem> {
    const items = this.load();
    const index = items.findIndex((i) => i.id === id);
    if (index < 0) throw new Error('This delivery no longer exists.');
    const updated = { ...update(items[index]), modified: new Date().toISOString() };
    const next = [...items];
    next[index] = updated;
    this.save(next);
    await pause(450);
    return updated;
  }

  private key() {
    return `mailroom:demo:v1:${this.user.email}`;
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

/** Invented colleagues for the demo directory. */
export const DEMO_PEOPLE: Person[] = [
  { name: 'Mariam Al-Sayed', email: 'mariam.alsayed@contoso.com', department: 'Trade Finance Dept.', jobTitle: 'Trade Finance Officer' },
  { name: 'Yousif Haddad', email: 'yousif.haddad@contoso.com', department: 'Treasury', jobTitle: 'Treasury Dealer' },
  { name: 'Noora Kamal', email: 'noora.kamal@contoso.com', department: 'Human Resources', jobTitle: 'HR Business Partner' },
  { name: 'Faisal Rahman', email: 'faisal.rahman@contoso.com', department: 'Compliance', jobTitle: 'Compliance Analyst' },
  { name: 'Leena Joseph', email: 'leena.joseph@contoso.com', department: 'Information Technology', jobTitle: 'Systems Engineer' },
  { name: 'Hamad Saleh', email: 'hamad.saleh@contoso.com', department: 'Corporate Banking', jobTitle: 'Relationship Manager' },
  { name: 'Sara Mansoor', email: 'sara.mansoor@contoso.com', department: 'Legal', jobTitle: 'Legal Counsel' },
  { name: 'Omar Fathi', email: 'omar.fathi@contoso.com', department: 'Operations', jobTitle: 'Mail Room Coordinator' },
];

export class DemoDirectory implements Directory {
  readonly searchable = true;
  private readonly people: Person[];

  constructor(user: CurrentUser) {
    this.people = [{ name: user.name, email: user.email, department: 'Trade Finance Dept.' }, ...DEMO_PEOPLE];
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
    return 'Trade Finance Dept.';
  }
}

function at(daysAgo: number, hour: number, minute: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, Math.floor(Math.random() * 60), 0);
  return d.toISOString();
}

function seed(user: CurrentUser): MailItem[] {
  const staff = { loggedByName: 'Omar Fathi', loggedByEmail: 'omar.fathi@contoso.com' };
  const blank = { recipientName: '', recipientEmail: '', department: '', notes: '', collectedByName: '', collectedByEmail: '', collectedOn: null };
  const me = { recipientName: user.name, recipientEmail: user.email };
  const p = (i: number) => ({ recipientName: DEMO_PEOPLE[i].name, recipientEmail: DEMO_PEOPLE[i].email });

  type Seed = Omit<MailItem, 'modified'>;
  const rows: Seed[] = [
    { ...blank, ...staff, ...me, id: '11631', kind: 'Personal', unit: 'Bahrain', courierNumber: '4424108776', courierCompany: 'DHL', sender: 'Gulf Metals Co.', status: 'Waiting', created: at(0, 9, 12) },
    { ...blank, ...staff, ...me, id: '11628', kind: 'Personal', unit: 'Bahrain', courierNumber: '37351856916', courierCompany: 'Aramex', sender: 'Seef Logistics', status: 'Waiting', created: at(2, 13, 40), notes: 'Small box, kept on shelf B' },
    { ...blank, ...staff, ...me, id: '11590', kind: 'Personal', unit: 'Bahrain', courierNumber: '7731 9902 1184', courierCompany: 'FedEx', sender: 'Al Noor Trading', status: 'Collected', created: at(9, 10, 5), collectedByName: user.name, collectedByEmail: user.email, collectedOn: at(9, 14, 22) },
    { ...blank, ...staff, ...p(2), id: '11630', kind: 'Personal', unit: 'Bahrain', courierNumber: '1Z999AA10123456784', courierCompany: 'UPS', sender: 'Northwind Insurance', status: 'Waiting', created: at(0, 8, 31) },
    { ...blank, ...staff, ...p(5), id: '11626', kind: 'Personal', unit: 'Bahrain', courierNumber: '5521877340', courierCompany: 'DHL', sender: 'Harbour Advisory', status: 'Collected', created: at(1, 11, 2), collectedByName: 'Hamad Saleh', collectedByEmail: 'hamad.saleh@contoso.com', collectedOn: at(1, 15, 48) },
    { ...blank, ...staff, id: '11629', kind: 'Department', unit: 'Bahrain', courierNumber: byHandRef(at(0, 12, 42)), courierCompany: 'By hand', sender: 'Gulf Metals Co.', department: 'Trade Finance Dept.', status: 'Waiting', created: at(0, 12, 42) },
    { ...blank, ...staff, id: '11627', kind: 'Department', unit: 'Bahrain', courierNumber: '4424108771', courierCompany: 'DHL', sender: 'Riverside Foods', department: 'Trade Finance Dept.', status: 'Waiting', created: at(1, 8, 29) },
    { ...blank, ...staff, id: '11625', kind: 'Department', unit: 'Bahrain', courierNumber: '37351856902', courierCompany: 'Aramex', sender: 'Crescent Shipping', department: 'Treasury', status: 'Waiting', created: at(1, 16, 5) },
    { ...blank, ...staff, id: '11624', kind: 'Department', unit: 'Bahrain', courierNumber: byHandRef(at(2, 12, 42)), courierCompany: 'By hand', sender: 'Al Noor Trading', department: 'Trade Finance Dept.', status: 'Collected', created: at(2, 12, 42), collectedByName: 'Mariam Al-Sayed', collectedByEmail: 'mariam.alsayed@contoso.com', collectedOn: at(2, 13, 12) },
    { ...blank, ...staff, id: '11619', kind: 'Department', unit: 'Bahrain', courierNumber: '7731 9902 1101', courierCompany: 'FedEx', sender: 'Ministry Liaison Office', department: 'Legal', status: 'Collected', created: at(4, 9, 49), collectedByName: 'Sara Mansoor', collectedByEmail: 'sara.mansoor@contoso.com', collectedOn: at(4, 10, 30) },
    { ...blank, ...staff, id: '11617', kind: 'Department', unit: 'Bahrain', courierNumber: '5521877002', courierCompany: 'DHL', sender: 'Harbour Advisory', department: 'Human Resources', status: 'Waiting', created: at(5, 11, 20) },
    { ...blank, loggedByName: 'Nadia Samir', loggedByEmail: 'nadia.samir@contoso.com', ...me, id: '11632', kind: 'Personal', unit: 'Egypt', courierNumber: '7745 0012 8890', courierCompany: 'FedEx', sender: 'Nile Valley Imports', status: 'Waiting', created: at(1, 10, 15) },
    { ...blank, loggedByName: 'Nadia Samir', loggedByEmail: 'nadia.samir@contoso.com', id: '11633', kind: 'Department', unit: 'Egypt', courierNumber: '37351857100', courierCompany: 'Aramex', sender: 'Delta Textiles', department: 'Corporate Banking', status: 'Waiting', created: at(0, 11, 0) },
  ];
  return rows.map((r) => ({ ...r, modified: r.collectedOn ?? r.created }));
}
