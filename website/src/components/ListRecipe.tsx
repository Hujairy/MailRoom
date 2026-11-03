import type { Recipe } from '../data/recipes';

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

/** How to add the columns by hand so their internal names match what the app expects. */
export function ColumnHelp() {
  return (
    <p className="recipe-help">
      By hand: in each list choose <strong>+ Add column</strong>, then <strong>Single line of text</strong>, and type the name
      exactly as shown, with no spaces. You can rename a column afterwards; the app uses the first name. For{' '}
      <code>ReceivedTimeStamp</code> choose <strong>Date and time</strong> and turn on <strong>Include time</strong>.{' '}
      <code>Received</code> is text, not a Yes/No column.
    </p>
  );
}
