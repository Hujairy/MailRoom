/* eslint-disable */
import { SPHttpClient, type ISPHttpClientOptions, type SPHttpClientResponse } from '@microsoft/sp-http';
import { spContext } from './context';

/**
 * A small SharePoint REST client on SPHttpClient. Every call runs as the
 * signed-in person, so SharePoint permissions decide what they can see. It
 * can reach any site in the tenant.
 */

export type Row = Record<string, unknown>;

export class SpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const NOMETADATA = 'application/json;odata=nometadata';
const VERBOSE = 'application/json;odata=verbose';

interface CallOptions {
  method?: 'GET' | 'POST' | 'MERGE' | 'DELETE';
  body?: unknown;
  /** odata=verbose, for writes that need a __metadata type. */
  verbose?: boolean;
}

export async function sp<T>(url: string, options: CallOptions = {}): Promise<T> {
  const { http } = spContext();
  const type = options.verbose ? VERBOSE : NOMETADATA;
  const headers: Record<string, string> = { Accept: type, 'odata-version': '' };
  if (options.body !== undefined) headers['Content-Type'] = type;
  if (options.method === 'MERGE' || options.method === 'DELETE') {
    headers['X-HTTP-Method'] = options.method;
    headers['IF-MATCH'] = '*';
  }
  const request: ISPHttpClientOptions = {
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  };
  for (let attempt = 0; ; attempt++) {
    const response: SPHttpClientResponse =
      !options.method || options.method === 'GET'
        ? await http.get(url, SPHttpClient.configurations.v1, request)
        : await http.post(url, SPHttpClient.configurations.v1, request);
    // Throttled: wait as asked, a few times.
    if ((response.status === 429 || response.status === 503) && attempt < 3) {
      const seconds = Number(response.headers.get('Retry-After')) || Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, Math.min(seconds, 10) * 1000));
      continue;
    }
    if (response.status === 204) return undefined as unknown as T;
    const text = await response.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!response.ok) {
      const error = json?.['odata.error'] ?? json?.error;
      const message = error?.message?.value ?? error?.message ?? response.statusText ?? '';
      throw new SpError(response.status, typeof message === 'string' && message ? message : `HTTP ${response.status}`);
    }
    return (options.verbose && json && 'd' in json ? json.d : json) as T;
  }
}

/** Follows odata.nextLink until `limit` rows are read. */
async function pages<T>(url: string, limit: number): Promise<T[]> {
  const rows: T[] = [];
  let next: string | undefined = url;
  while (next && rows.length < limit) {
    const page: { value?: T[]; 'odata.nextLink'?: string } = await sp(next);
    rows.push(...(page.value ?? []));
    next = page['odata.nextLink'];
  }
  return rows.slice(0, limit);
}

export function errorMessage(error: unknown): string {
  if (error instanceof SpError) {
    if (error.status === 401 || error.status === 403) return `You don’t have permission to do this in SharePoint. ${error.message}`;
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

export const isDenied = (e: unknown) => e instanceof SpError && (e.status === 401 || e.status === 403);
export const isNotFound = (e: unknown) => e instanceof SpError && e.status === 404;

/* ---------------- Sites ---------------- */

export interface SiteRef {
  id: string;
  webUrl: string;
}

/**
 * Turns whatever was pasted (a page, a list, a library) into the site address:
 * https://bankabc.sharepoint.com/sites/MailRoom/Lists/X/AllItems.aspx
 * becomes https://bankabc.sharepoint.com/sites/MailRoom.
 */
export function normalizeSiteUrl(value: string): string {
  const url = new URL(value.trim());
  let path = decodeURIComponent(url.pathname);
  path = path.replace(/\/(Lists|SitePages|Shared Documents|SiteAssets|Pages|_layouts|Forms)(\/.*)?$/i, '');
  path = path.replace(/\/[^/]+\.aspx$/i, '').replace(/\/+$/, '');
  return `${url.origin}${path}`;
}

const sites = new Map<string, Promise<SiteRef>>();

export function resolveSite(siteUrl: string): Promise<SiteRef> {
  const webUrl = normalizeSiteUrl(siteUrl);
  const key = webUrl.toLowerCase();
  let site = sites.get(key);
  if (!site) {
    site = sp<{ Id: string; Url: string }>(`${encodeURI(webUrl)}/_api/web?$select=Id,Url`).then((w) => ({ id: w.Id, webUrl: encodeURI(w.Url || webUrl) }));
    site.catch(() => sites.delete(key));
    sites.set(key, site);
  }
  return site;
}

/* ---------------- Lists ---------------- */

export interface ListRef {
  site: SiteRef;
  id: string;
  name: string;
  /** For creating and updating items with odata=verbose. */
  entityType: string;
}

interface SpList {
  Id: string;
  Title: string;
  ListItemEntityTypeFullName: string;
  RootFolder?: { Name?: string };
}

const loose = (s: string) => s.replace(/[^a-z0-9]/gi, '').toLowerCase();
const listCache = new Map<string, Promise<SpList[]>>();

function siteLists(site: SiteRef): Promise<SpList[]> {
  let lists = listCache.get(site.webUrl);
  if (!lists) {
    lists = pages<SpList>(
      `${site.webUrl}/_api/web/lists?$select=Id,Title,ListItemEntityTypeFullName,RootFolder/Name&$expand=RootFolder&$filter=Hidden eq false&$top=500`,
      2000,
    );
    lists.catch(() => listCache.delete(site.webUrl));
    listCache.set(site.webUrl, lists);
  }
  return lists;
}

const listUrl = (list: Pick<ListRef, 'site' | 'id'>) => `${list.site.webUrl}/_api/web/lists(guid'${list.id}')`;

/** Finds a list on a site by its name (spaces and case don't matter). Null when it isn't there. */
export async function findList(site: SiteRef, name: string): Promise<ListRef | null> {
  const wanted = loose(name);
  const match = (await siteLists(site)).find((l) => loose(l.Title) === wanted || loose(l.RootFolder?.Name ?? '') === wanted);
  return match ? { site, id: match.Id, name: match.Title, entityType: match.ListItemEntityTypeFullName } : null;
}

export function forgetLists(site: SiteRef): void {
  listCache.delete(site.webUrl);
}

/* ---------------- Items ---------------- */

/** Flattens a REST list item into one row of columns. */
function toRow(item: Row): Row {
  const author = item.Author as { Title?: string } | undefined;
  return { ...item, ID: String(item.Id ?? item.ID ?? ''), Author: author?.Title ?? '' };
}

export interface ItemQuery {
  /** OData filter on columns, e.g. `Received eq 'No'`. */
  filter?: string;
  /** Columns to read. */
  select: string[];
  top: number;
  /** Newest first. */
  newestFirst?: boolean;
}

export async function getItems(list: ListRef, query: ItemQuery): Promise<Row[]> {
  const select = Array.from(new Set(['Id', 'Created', 'Modified', 'Author/Title', ...query.select]));
  const params = [`$select=${select.map(encodeURIComponent).join(',')}`, '$expand=Author', `$top=${Math.min(Math.max(query.top, 1), 5000)}`];
  if (query.filter) params.push(`$filter=${encodeURIComponent(query.filter)}`);
  if (query.newestFirst) params.push(`$orderby=${encodeURIComponent('Created desc')}`);
  const rows = (await pages<Row>(`${listUrl(list)}/items?${params.join('&')}`, query.top)).map(toRow);
  return rows.slice(0, query.top);
}

export async function getItem(list: ListRef, id: string): Promise<Row | null> {
  try {
    return toRow(await sp<Row>(`${listUrl(list)}/items(${Number(id)})?$select=*,Author/Title&$expand=Author`));
  } catch (e) {
    if (isNotFound(e)) return null;
    throw e;
  }
}

export async function createItem(list: ListRef, fields: Row): Promise<Row> {
  const created = await sp<Row>(`${listUrl(list)}/items`, {
    method: 'POST',
    verbose: true,
    body: { __metadata: { type: list.entityType }, ...fields },
  });
  // Read it back for Created By.
  return (await getItem(list, String(created.Id ?? created.ID))) ?? toRow(created);
}

/** Changes some columns. Returns every column after the change. */
export async function updateItem(list: ListRef, id: string, fields: Row): Promise<Row> {
  await sp(`${listUrl(list)}/items(${Number(id)})`, {
    method: 'MERGE',
    verbose: true,
    body: { __metadata: { type: list.entityType }, ...fields },
  });
  return (await getItem(list, id)) ?? { ...fields, ID: id };
}

export async function deleteItem(list: ListRef, id: string): Promise<void> {
  await sp(`${listUrl(list)}/items(${Number(id)})`, { method: 'DELETE' });
}

/** Quotes a value for an OData filter. */
export function odata(value: string): string {
  return `'${value.trim().replace(/'/g, "''")}'`;
}

/* ---------------- Lists and columns ---------------- */

export interface ListDefinition {
  name: string;
  columns: { name: string; date?: boolean }[];
}

const xmlName = (s: string) => s.replace(/[^A-Za-z0-9_]/g, '');

/** Adds a single line of text (or date and time) column whose internal name is exactly `name`. */
export async function addColumn(list: Pick<ListRef, 'site' | 'id'>, column: { name: string; date?: boolean }): Promise<void> {
  const name = xmlName(column.name);
  const schema = column.date
    ? `<Field Type="DateTime" Format="DateTime" Name="${name}" StaticName="${name}" DisplayName="${name}" />`
    : `<Field Type="Text" Name="${name}" StaticName="${name}" DisplayName="${name}" MaxLength="255" />`;
  await sp(`${listUrl(list)}/fields/CreateFieldAsXml`, {
    method: 'POST',
    verbose: true,
    // 8: use Name as the internal name; 16: add to the default view.
    body: { parameters: { __metadata: { type: 'SP.XmlSchemaFieldCreationInformation' }, SchemaXml: schema, Options: 24 } },
  });
}

export async function columnExists(list: Pick<ListRef, 'site' | 'id'>, name: string): Promise<boolean> {
  const result = await sp<{ value: unknown[] }>(
    `${listUrl(list)}/fields?$select=InternalName&$filter=${encodeURIComponent(`InternalName eq '${xmlName(name)}'`)}`,
  );
  return result.value.length > 0;
}

/**
 * Creates a list with the exact columns the app expects. Needs permission to
 * manage lists on the site.
 */
export async function createList(site: SiteRef, definition: ListDefinition): Promise<void> {
  const created = await sp<{ Id: string }>(`${site.webUrl}/_api/web/lists`, {
    method: 'POST',
    verbose: true,
    body: { __metadata: { type: 'SP.List' }, Title: definition.name, BaseTemplate: 100, Description: 'Mail Room' },
  });
  for (const column of definition.columns) await addColumn({ site, id: created.Id }, column);
  forgetLists(site);
}
