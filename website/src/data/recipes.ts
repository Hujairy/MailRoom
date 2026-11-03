import { DEPARTMENT_MAIL_LIST, PERSONAL_MAIL_LIST, SETTINGS_LISTS, unitListNames } from '../config';

/** A SharePoint list the app needs: its exact name and columns. */
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
  {
    name: SETTINGS_LISTS.units,
    title: 'the unit name',
    columns: [{ name: SETTINGS_LISTS.unitColumns.siteUrl }],
  },
  {
    name: SETTINGS_LISTS.members,
    title: 'the person’s email',
    columns: Object.values(SETTINGS_LISTS.memberColumns)
      .filter((name) => name !== 'Title')
      .map((name) => ({ name })),
  },
];

export function unitRecipes(unit: string): Recipe[] {
  const names = unitListNames(unit);
  return [
    { name: names.personal, title: 'the courier number', columns: mailColumns(PERSONAL_MAIL_LIST.columns) },
    { name: names.department, title: 'the courier number', columns: mailColumns(DEPARTMENT_MAIL_LIST.columns) },
  ];
}
