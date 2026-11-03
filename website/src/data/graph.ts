import { getToken } from './auth';

/**
 * A small Microsoft Graph client for the SharePoint lists. Every call runs as
 * the signed-in person, so SharePoint permissions decide what they can see.
 */

const GRAPH = 'https://graph.microsoft.com/v1.0';

export type Row = Record<string, unknown>;

export class GraphError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

interface CallOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  scopes?: string[];
}

export async function graph<T>(path: string, options: CallOptions = {}): Promise<T> {
  const token = await getToken(options.scopes);
  const url = path.startsWith('https://') ? path : `${GRAPH}${path}`;
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    // Throttled: wait as asked, a few times.
    if ((response.status === 429 || response.status === 503) && attempt < 3) {
      const seconds = Number(response.headers.get('Retry-After')) || 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, Math.min(seconds, 10) * 1000));
      continue;
    }
    if (response.status === 204) return undefined as T;
    const text = await response.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!response.ok) {
      const error = (json as { error?: { code?: string; message?: string } } | null)?.error;
      throw new GraphError(response.status, error?.code ?? '', error?.message || response.statusText || `HTTP ${response.status}`);
    }
    return json as T;
  }
}

/** Follows @odata.nextLink until `limit` rows are read. */
export async function graphPages<T>(path: string, limit: number, headers?: Record<string, string>): Promise<T[]> {
  const rows: T[] = [];
  let next: string | undefined = path;
  while (next && rows.length < limit) {
    const page: { value?: T[]; '@odata.nextLink'?: string } = await graph(next, { headers });
    rows.push(...(page.value ?? []));
    next = page['@odata.nextLink'];
  }
  return rows.slice(0, limit);
}

export function errorMessage(error: unknown): string {
  if (error instanceof GraphError) {
    if (error.status === 401) return 'Your sign-in has expired. Reload the page to sign in again.';
    if (error.status === 403) return `You don’t have permission to do this in SharePoint. ${error.message}`;
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

export const isDenied = (e: unknown) => e instanceof GraphError && (e.status === 401 || e.status === 403);
export const isNotFound = (e: unknown) => e instanceof GraphError && e.status === 404;

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
  const key = normalizeSiteUrl(siteUrl).toLowerCase();
  let site = sites.get(key);
  if (!site) {
    const url = new URL(normalizeSiteUrl(siteUrl));
    const path = url.pathname && url.pathname !== '/' ? `:${encodeURI(url.pathname)}` : '';
    site = graph<SiteRef>(`/sites/${url.hostname}${path}?$select=id,webUrl`);
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
}

const loose = (s: string) => s.replace(/[^a-z0-9]/gi, '').toLowerCase();
const listCache = new Map<string, Promise<{ id: string; name: string; displayName: string }[]>>();

function siteLists(site: SiteRef) {
  let lists = listCache.get(site.id);
  if (!lists) {
    lists = graphPages<{ id: string; name: string; displayName: string }>(
      `/sites/${site.id}/lists?$select=id,name,displayName&$top=500`,
      2000,
    );
    lists.catch(() => listCache.delete(site.id));
    listCache.set(site.id, lists);
  }
  return lists;
}

/** Finds a list on a site by its name (spaces and case don't matter). Null when it isn't there. */
export async function findList(site: SiteRef, name: string): Promise<ListRef | null> {
  const wanted = loose(name);
  const match = (await siteLists(site)).find((l) => loose(l.name) === wanted || loose(l.displayName) === wanted);
  return match ? { site, id: match.id, name: match.displayName || match.name } : null;
}

export function forgetLists(site: SiteRef) {
  listCache.delete(site.id);
}

/* ---------------- Items ---------------- */

interface GraphItem {
  id: string;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  createdBy?: { user?: { displayName?: string; email?: string } };
  fields?: Row;
}

/** Flattens a Graph list item into one row of columns, like SharePoint's own. */
function toRow(item: GraphItem): Row {
  return {
    ...(item.fields ?? {}),
    ID: item.id,
    Created: item.fields?.Created ?? item.createdDateTime,
    Modified: item.fields?.Modified ?? item.lastModifiedDateTime,
    Author: item.createdBy?.user?.displayName ?? '',
  };
}

// Lets filters run on columns that aren't indexed. Index the filtered columns
// once a list has thousands of items (see README).
const LENIENT = { Prefer: 'HonorNonIndexedQueriesWarningMayFailRandomly' };

export interface ItemQuery {
  /** OData filter on columns, e.g. `fields/Received eq 'No'`. */
  filter?: string;
  /** Columns to read. */
  select: string[];
  top: number;
  /** Newest first. */
  newestFirst?: boolean;
}

export async function getItems(list: ListRef, query: ItemQuery): Promise<Row[]> {
  const base = `/sites/${list.site.id}/lists/${list.id}/items`;
  const params = [`$expand=fields($select=${query.select.map(encodeURIComponent).join(',')})`];
  if (query.filter) params.push(`$filter=${encodeURIComponent(query.filter)}`);
  const pageSize = Math.min(Math.max(query.top, 1), 500);
  const run = async (orderBy: boolean, limit: number) => {
    const extra = orderBy ? [`$orderby=${encodeURIComponent('fields/Created desc')}`] : [];
    const url = `${base}?${[...params, ...extra, `$top=${pageSize}`].join('&')}`;
    return (await graphPages<GraphItem>(url, limit, LENIENT)).map(toRow);
  };
  let rows: Row[];
  if (query.newestFirst) {
    try {
      rows = await run(true, query.top);
    } catch (e) {
      // Some lists refuse to sort on Created; read more and sort here instead.
      if (!(e instanceof GraphError) || e.status !== 400) throw e;
      rows = await run(false, Math.max(query.top * 4, 2000));
    }
    rows.sort((a, b) => String(b.Created ?? '').localeCompare(String(a.Created ?? '')));
  } else {
    rows = await run(false, query.top);
  }
  return rows.slice(0, query.top);
}

export async function getItem(list: ListRef, id: string): Promise<Row | null> {
  try {
    const item = await graph<GraphItem>(`/sites/${list.site.id}/lists/${list.id}/items/${encodeURIComponent(id)}?$expand=fields`);
    return toRow(item);
  } catch (e) {
    if (isNotFound(e)) return null;
    throw e;
  }
}

export async function createItem(list: ListRef, fields: Row): Promise<Row> {
  const item = await graph<GraphItem>(`/sites/${list.site.id}/lists/${list.id}/items`, { method: 'POST', body: { fields } });
  return toRow(item);
}

/** Changes some columns. Returns every column after the change. */
export async function updateItem(list: ListRef, id: string, fields: Row): Promise<Row> {
  const updated = await graph<Row>(`/sites/${list.site.id}/lists/${list.id}/items/${encodeURIComponent(id)}/fields`, {
    method: 'PATCH',
    body: fields,
  });
  return { ...updated, ID: id };
}

export async function deleteItem(list: ListRef, id: string): Promise<void> {
  await graph(`/sites/${list.site.id}/lists/${list.id}/items/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/** Quotes a value for an OData filter. */
export function odata(value: string): string {
  return `'${value.trim().replace(/'/g, "''")}'`;
}

/* ---------------- Creating lists ---------------- */

export interface ListDefinition {
  name: string;
  columns: { name: string; date?: boolean }[];
}

/**
 * Creates a list with plain text columns (and date-and-time ones), so the
 * column names are exactly what the app expects. Needs Sites.Manage.All and
 * permission to manage lists on the site.
 */
export async function createList(site: SiteRef, definition: ListDefinition, scopes: string[]): Promise<void> {
  await graph(`/sites/${site.id}/lists`, {
    method: 'POST',
    scopes,
    body: {
      displayName: definition.name,
      list: { template: 'genericList' },
      columns: definition.columns.map((c) =>
        c.date ? { name: c.name, dateTime: { format: 'dateTime' } } : { name: c.name, text: {} },
      ),
    },
  });
  forgetLists(site);
}
