import { useRef, useState } from 'react';
import { DEPARTMENT_MAIL_LIST, PERSONAL_MAIL_LIST, SETTINGS_LISTS, unitListNames } from '../config';
import { CopyIcon } from './icons';

export interface Recipe {
  name: string;
  /** What the built-in Title column holds. */
  title: string;
  columns: { name: string; date?: boolean }[];
}

const BUILT_IN = new Set(['ID', 'Title', 'Author', 'Created', 'Modified']);
const mailColumns = (columns: Record<string, string>) =>
  Object.entries(columns)
    .filter(([, name]) => !BUILT_IN.has(name))
    .map(([key, name]) => ({ name, date: key === 'receivedTimeStamp' }));

export const SETTINGS_RECIPES: Recipe[] = [
  { name: 'MailroomUnits', title: 'the unit name', columns: [] },
  {
    name: 'MailroomMembers',
    title: 'the person’s email',
    columns: Object.entries(SETTINGS_LISTS.members)
      .filter(([key]) => key !== 'id' && key !== 'email')
      .map(([, name]) => ({ name })),
  },
];

export function unitRecipes(unit: string): Recipe[] {
  const names = unitListNames(unit);
  return [
    { name: names.personal, title: 'the courier number', columns: mailColumns(PERSONAL_MAIL_LIST.columns) },
    { name: names.department, title: 'the courier number', columns: mailColumns(DEPARTMENT_MAIL_LIST.columns) },
  ];
}

/** One SharePoint list to create by hand: its exact name and columns. */
export function ListRecipe({ recipe }: { recipe: Recipe }) {
  return (
    <div className="recipe">
      <p className="recipe-name">
        <span className="recipe-kicker">List</span>
        <code>{recipe.name}</code>
      </p>
      {recipe.columns.length === 0 ? (
        <p className="recipe-note">No columns to add. The built-in Title column holds {recipe.title}.</p>
      ) : (
        <>
          <ul className="recipe-columns" aria-label={`Columns of ${recipe.name}`}>
            {recipe.columns.map((c) => (
              <li key={c.name} className={c.date ? 'is-date' : undefined}>
                <code>{c.name}</code>
                {c.date && <span>Date and time</span>}
              </li>
            ))}
          </ul>
          <p className="recipe-note">The built-in Title column holds {recipe.title}.</p>
        </>
      )}
    </div>
  );
}

/** How to add the columns so their internal names match what the app expects. */
export function ColumnHelp() {
  return (
    <p className="recipe-help">
      In each list choose <strong>+ Add column</strong>, then <strong>Single line of text</strong>, and type the name exactly as
      shown, with no spaces. You can rename a column afterwards; the app uses the first name. For{' '}
      <code>ReceivedTimeStamp</code> choose <strong>Date and time</strong> and turn on <strong>Include time</strong>.{' '}
      <code>Received</code> is text, not a Yes/No column.
    </p>
  );
}

/** A command to copy into the terminal. */
export function Command({ text }: { text: string }) {
  const ref = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked (e.g. inside the Power Apps frame): select the text instead.
      const range = document.createRange();
      if (ref.current) range.selectNodeContents(ref.current);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }
  return (
    <div className="command">
      <pre ref={ref}>{text}</pre>
      <button type="button" className="icon-btn" aria-label={copied ? 'Copied' : 'Copy'} title={copied ? 'Copied' : 'Copy'} onClick={() => void copy()}>
        <CopyIcon width={17} height={17} />
      </button>
    </div>
  );
}

/** The `pa app add data-source` lines for some lists on one site. */
export function addDataSourceCommands(siteUrl: string, lists: string[]): string {
  const site = siteUrl.trim().replace(/\/+$/, '') || 'https://<tenant>.sharepoint.com/sites/<site>';
  return lists
    .map((l) => `pa app add data-source --connector "shared_sharepointonline" --connection-id "<id>" --dataset "${site}" --table "${l}"`)
    .join('\n');
}
