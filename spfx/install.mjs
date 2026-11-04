#!/usr/bin/env node
/**
 * Puts Mail Room into a SharePoint Framework project made by the SharePoint
 * generator (yo @microsoft/sharepoint, web part, React template).
 *
 * Run it from the generated project's folder (the one with package.json):
 *   node %USERPROFILE%\Documents\MailRoom\spfx\install.mjs
 *
 * It copies the Mail Room code into the web part, then adjusts tsconfig.json,
 * the web part manifest and config/package-solution.json. Safe to run again
 * after a `git pull`, to update the code.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const project = process.cwd();
const done = (message) => console.log(`  ✓ ${message}`);
const fail = (message) => {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
};

/** JSON with comments (tsconfig.json and manifests have them). */
function readJsonc(file) {
  const text = fs.readFileSync(file, 'utf8');
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inString) {
      out += ch;
      if (ch === '\\') out += text[++i];
      else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
      out += ch;
    } else if (ch === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (ch === '/' && next === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i++;
    } else {
      out += ch;
    }
  }
  // Trailing commas.
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);

console.log('\nMail Room → SharePoint Framework project\n');

// 1. Is this an SPFx project?
const packageFile = path.join(project, 'package.json');
if (!fs.existsSync(packageFile)) fail(`No package.json in ${project}. Run this from the SPFx project's folder.`);
const pkg = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
const deps = { ...pkg.dependencies, ...pkg.devDependencies };
const spfxVersion = deps['@microsoft/sp-webpart-base'];
if (!spfxVersion) fail('This isn’t a SharePoint Framework web part project (no @microsoft/sp-webpart-base in package.json).');
done(`SharePoint Framework ${spfxVersion} project: ${pkg.name}`);

// 2. Find the web part.
const webpartsDir = path.join(project, 'src', 'webparts');
const candidates = fs.existsSync(webpartsDir)
  ? fs.readdirSync(webpartsDir).filter((d) => fs.readdirSync(path.join(webpartsDir, d)).some((f) => /WebPart\.ts$/.test(f)))
  : [];
if (candidates.length === 0) fail('No web part found in src/webparts. Create the project with the "WebPart" component type.');
const folder = candidates.find((d) => d.toLowerCase() === 'mailroom') ?? candidates[0];
const webpartDir = path.join(webpartsDir, folder);
const webpartFile = fs.readdirSync(webpartDir).find((f) => /WebPart\.ts$/.test(f));
const manifestFile = fs.readdirSync(webpartDir).find((f) => /WebPart\.manifest\.json$/.test(f));
done(`Web part: src/webparts/${folder}/${webpartFile}`);

// 3. Copy Mail Room in.
fs.rmSync(path.join(webpartDir, 'app'), { recursive: true, force: true });
fs.cpSync(path.join(here, 'app'), path.join(webpartDir, 'app'), { recursive: true });
fs.copyFileSync(path.join(here, 'MailRoomWebPart.ts'), path.join(webpartDir, webpartFile));
// The generator's sample component isn't used any more.
fs.rmSync(path.join(webpartDir, 'components'), { recursive: true, force: true });
done('Copied the Mail Room code into the web part');

// 4. Packages Mail Room uses directly.
let added = false;
const want = {
  '@microsoft/sp-http': spfxVersion,
  '@microsoft/sp-property-pane': spfxVersion,
  '@microsoft/sp-core-library': spfxVersion,
  react: '18.3.1',
  'react-dom': '18.3.1',
};
pkg.dependencies ??= {};
for (const [name, version] of Object.entries(want)) {
  if (!deps[name]) {
    pkg.dependencies[name] = version;
    added = true;
    done(`Added ${name} ${version} to package.json`);
  }
}
const reactVersion = (deps.react ?? '').replace(/^[^\d]*/, '');
if (reactVersion && !reactVersion.startsWith('18')) {
  console.warn(`  ! React ${reactVersion} found. Mail Room needs React 18 (SharePoint Framework 1.24 or later).`);
}
if (added) writeJson(packageFile, pkg);

// 5. TypeScript: modern library types, and iterating Sets and Maps.
const tsconfigFile = path.join(project, 'tsconfig.json');
const tsconfig = readJsonc(tsconfigFile);
tsconfig.compilerOptions ??= {};
const lib = new Set([...(tsconfig.compilerOptions.lib ?? []).map((l) => l.toLowerCase()), 'es2020', 'dom', 'dom.iterable']);
tsconfig.compilerOptions.lib = [...lib].filter((l) => !/^es(5|2015\.\w+)$/.test(l));
// Spreading a Set needs this when the output is ES5.
const target = String(tsconfig.compilerOptions.target ?? 'es5').toLowerCase();
if (target === 'es5' || target === 'es3') tsconfig.compilerOptions.downlevelIteration = true;
tsconfig.compilerOptions.skipLibCheck = true;
writeJson(tsconfigFile, tsconfig);
done('Updated tsconfig.json');

// 6. The web part's manifest: title, icon, full width and app pages.
if (manifestFile) {
  const file = path.join(webpartDir, manifestFile);
  const manifest = readJsonc(file);
  manifest.supportsFullBleed = true;
  manifest.supportedHosts = [...new Set([...(manifest.supportedHosts ?? []), 'SharePointWebPart', 'SharePointFullPage', 'TeamsTab'])];
  const entry = (manifest.preconfiguredEntries ?? [])[0] ?? {};
  entry.title = { default: 'Mail Room' };
  entry.description = { default: 'Log deliveries, notify people and confirm collection.' };
  entry.officeFabricIconFontName = 'Mail';
  entry.properties = { settingsSiteUrl: '', generalAdmins: '' };
  manifest.preconfiguredEntries = [entry, ...(manifest.preconfiguredEntries ?? []).slice(1)];
  writeJson(file, manifest);
  done(`Updated ${manifestFile}`);
}

// 7. The package: a new version each time, and it may be deployed to all sites.
const solutionFile = path.join(project, 'config', 'package-solution.json');
if (fs.existsSync(solutionFile)) {
  const solution = readJsonc(solutionFile);
  solution.solution ??= {};
  solution.solution.name = 'Mail Room';
  solution.solution.skipFeatureDeployment = true;
  solution.solution.includeClientSideAssets = true;
  const parts = String(solution.solution.version ?? '1.0.0.0').split('.').map((n) => Number(n) || 0);
  while (parts.length < 4) parts.push(0);
  parts[3] += 1;
  solution.solution.version = parts.join('.');
  for (const feature of solution.solution.features ?? []) {
    feature.title = 'Mail Room';
    feature.version = solution.solution.version;
  }
  writeJson(solutionFile, solution);
  done(`Package version ${solution.solution.version}`);
}

console.log(`
Next:
  ${added ? 'npm install\n  ' : ''}npm run build

The package is then in sharepoint\\solution\\ (a .sppkg file). See SPFX-SETUP.txt.
`);
