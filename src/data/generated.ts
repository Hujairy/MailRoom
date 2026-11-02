/**
 * Finds services that the Power Apps CLI generates with
 * `pa app add data-source`. The app compiles and runs without them (demo
 * mode) and uses them automatically once the files exist.
 */

export type Row = Record<string, unknown>;

export interface OperationResult<T> {
  success?: boolean;
  data?: T;
  error?: unknown;
}

export interface GetAllOptions {
  select?: string[];
  filter?: string;
  orderBy?: string[];
  top?: number;
  skip?: number;
}

/** The parts of a generated SharePoint list service this app uses. */
export interface TabularService {
  getAll(options?: GetAllOptions): Promise<OperationResult<Row[]>>;
  get(id: string): Promise<OperationResult<Row>>;
  create(record: Row): Promise<OperationResult<Row>>;
  update(id: string, changedFields: Row): Promise<OperationResult<Row>>;
}

// Vite resolves this at build time; it's empty until the CLI generates a service.
const modules = import.meta.glob<Record<string, unknown>>(['../generated/services/*.ts', '../Services/*.ts']);

export function generatedServiceNames(): string[] {
  return Object.keys(modules).map((p) => p.split('/').pop()!.replace(/\.ts$/, ''));
}

/** "Personal Mail", "Personal%20Mail", "Personal_x0020_MailService" and "PersonalMailService" all become "personalmail". */
function loose(name: string): string {
  return name
    .replace(/_x0020_|%20/gi, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase()
    .replace(/service$/, '');
}

/** Loads a generated service class by (loosely matched) name, or null when it doesn't exist. */
export async function loadGeneratedService(name: string): Promise<Record<string, unknown> | null> {
  const wanted = loose(name);
  const path = Object.keys(modules).find((p) => loose(p.split('/').pop()!.replace(/\.ts$/, '')) === wanted);
  if (!path) return null;
  const module = await modules[path]();
  const key = Object.keys(module).find((k) => loose(k) === wanted) ?? Object.keys(module).find((k) => /Service$/.test(k));
  const service = key ? module[key] : undefined;
  return service && (typeof service === 'function' || typeof service === 'object')
    ? (service as Record<string, unknown>)
    : null;
}

export function isTabularService(value: unknown): value is TabularService {
  if (!value) return false;
  const v = value as Record<string, unknown>;
  return ['getAll', 'get', 'create', 'update'].every((m) => typeof v[m] === 'function');
}

/** Unwraps a generated-service result, turning connector errors into readable messages. */
export function unwrap<T>(result: OperationResult<T> | undefined, action: string): T {
  if (!result) throw new Error(`${action} failed: no response from the data source.`);
  if (result.success === false || (result.error && result.data === undefined)) {
    throw new Error(`${action} failed: ${errorMessage(result.error)}`);
  }
  return result.data as T;
}

export function errorMessage(error: unknown): string {
  if (!error) return 'unknown error.';
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return parseNested(error);
  const message = (error as { message?: unknown }).message;
  if (typeof message === 'string') return parseNested(message);
  try {
    return JSON.stringify(error);
  } catch {
    return 'unknown error.';
  }
}

function parseNested(message: string): string {
  try {
    const parsed = JSON.parse(message) as { message?: string; Message?: string; error?: { message?: string } };
    return parsed.error?.message ?? parsed.message ?? parsed.Message ?? message;
  } catch {
    return message;
  }
}
