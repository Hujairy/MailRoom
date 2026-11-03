import { CREATE_LISTS_SCOPES, SETTINGS_LISTS } from '../config';
import { createList, findList, graph, resolveSite, type ListRef } from './graph';
import type { Recipe } from './recipes';

/**
 * Creates whichever of these lists aren't on the site yet, with the exact
 * columns the app expects. Asks the general admin to approve Sites.Manage.All
 * the first time. Returns the names of the lists it created.
 */
export async function createMissingLists(siteUrl: string, recipes: Recipe[]): Promise<string[]> {
  const site = await resolveSite(siteUrl);
  const created: string[] = [];
  for (const recipe of recipes) {
    if (await findList(site, recipe.name)) continue;
    await createList(site, recipe, CREATE_LISTS_SCOPES);
    created.push(recipe.name);
  }
  return created;
}

/** Adds the SiteUrl column to a MailroomUnits list made before it existed. */
export async function addSiteColumn(units: Pick<ListRef, 'site' | 'id'>): Promise<void> {
  await graph(`/sites/${units.site.id}/lists/${units.id}/columns`, {
    method: 'POST',
    scopes: CREATE_LISTS_SCOPES,
    body: { name: SETTINGS_LISTS.unitColumns.siteUrl, text: {} },
  });
}

/** Finds MailroomUnits on the settings site. */
export async function unitsList(settingsSiteUrl: string): Promise<ListRef | null> {
  return findList(await resolveSite(settingsSiteUrl), SETTINGS_LISTS.units);
}
