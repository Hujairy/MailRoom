/* eslint-disable */
import { SETTINGS_LISTS } from '../config';
import { addColumn, createList, findList, resolveSite, type ListRef } from './rest';
import type { Recipe } from './recipes';

/**
 * Creates whichever of these lists aren't on the site yet, with the exact
 * columns the app expects. Needs permission to manage lists on that site.
 * Returns the names of the lists it created.
 */
export async function createMissingLists(siteUrl: string, recipes: Recipe[]): Promise<string[]> {
  const site = await resolveSite(siteUrl);
  const created: string[] = [];
  for (const recipe of recipes) {
    if (await findList(site, recipe.name)) continue;
    await createList(site, recipe);
    created.push(recipe.name);
  }
  return created;
}

/** Adds the SiteUrl column to a MailroomUnits list made before it existed. */
export async function addSiteColumn(units: Pick<ListRef, 'site' | 'id'>): Promise<void> {
  await addColumn(units, { name: SETTINGS_LISTS.unitColumns.siteUrl });
}

/** Finds MailroomUnits on the settings site. */
export async function unitsList(settingsSiteUrl: string): Promise<ListRef | null> {
  return findList(await resolveSite(settingsSiteUrl), SETTINGS_LISTS.units);
}
