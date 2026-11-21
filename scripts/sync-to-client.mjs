/**
 * Syncs compiled official plugins (`packages/<pkg>/dist/plugin.js` and `data/*.json`)
 * into the sibling Client repository (`../Client/packages/client/src/renderer/client/plugins/`).
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const packagesDir = join(repoRoot, 'packages');

const clientRepoRoot = process.env.CAMELKIT_CLIENT_DIR
  ? resolve(process.env.CAMELKIT_CLIENT_DIR)
  : resolve(repoRoot, '..', 'Client');

const clientPluginsDir = join(clientRepoRoot, 'packages', 'client', 'src', 'renderer', 'client', 'plugins');
const clientDataDir = join(clientPluginsDir, 'data');

if (!existsSync(join(clientRepoRoot, 'packages', 'client'))) {
  console.warn(`[sync-to-client] Client repository not found at ${clientRepoRoot}. Skipping sync.`);
  process.exit(0);
}

mkdirSync(clientPluginsDir, { recursive: true });
mkdirSync(clientDataDir, { recursive: true });

let syncedCount = 0;

for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const pkgDir = join(packagesDir, entry.name);
  const pkgJsonPath = join(pkgDir, 'package.json');
  const bundlePath = join(pkgDir, 'dist', 'plugin.js');

  if (!existsSync(pkgJsonPath) || !existsSync(bundlePath)) continue;

  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
  const bundleFileName = pkgJson.camelkit?.bundleName || `${entry.name}.plugin.js`;
  const destBundlePath = join(clientPluginsDir, bundleFileName);

  cpSync(bundlePath, destBundlePath);
  console.log(`[sync-to-client] Synced ${pkgJson.name}@${pkgJson.version} -> ${destBundlePath}`);
  syncedCount++;

  const pkgDataDir = join(pkgDir, 'data');
  if (existsSync(pkgDataDir)) {
    for (const dataFile of readdirSync(pkgDataDir)) {
      if (dataFile.endsWith('.json')) {
        cpSync(join(pkgDataDir, dataFile), join(clientDataDir, dataFile));
        console.log(`[sync-to-client] Synced data asset ${dataFile} -> ${clientDataDir}`);
      }
    }
  }
}

console.log(`[sync-to-client] Done (${syncedCount} plugin bundle(s) synced).`);

