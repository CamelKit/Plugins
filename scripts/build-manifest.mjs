/**
 * Builds the official plugins distribution directory (`dist-publish/`) containing:
 *   - manifest.json (with SHA-256 hashes and raw GitHub CDN URLs)
 *   - bundles/<bundleName> (compiled ESM plugin bundles)
 *   - data/<file>.json (optional prebaked plugin data caches)
 */
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const packagesDir = join(repoRoot, 'packages');
const outDir = join(repoRoot, 'dist-publish');
const bundlesOutDir = join(outDir, 'bundles');
const dataOutDir = join(outDir, 'data');

const repoSlug = process.env.GITHUB_REPOSITORY || 'CamelKit/Plugins';
const distBranch = process.env.OFFICIAL_PLUGINS_BRANCH || 'dist';
const rawBaseUrl = `https://raw.githubusercontent.com/${repoSlug}/${distBranch}`;

let commitHash = process.env.GITHUB_SHA || '';
if (!commitHash) {
  try {
    commitHash = execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim();
  } catch {
    commitHash = 'unknown';
  }
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(bundlesOutDir, { recursive: true });
mkdirSync(dataOutDir, { recursive: true });

const plugins = [];

for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const pkgDir = join(packagesDir, entry.name);
  const pkgJsonPath = join(pkgDir, 'package.json');
  const distBundlePath = join(pkgDir, 'dist', 'plugin.js');

  if (!existsSync(pkgJsonPath) || !existsSync(distBundlePath)) continue;

  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
  const bundleName = pkgJson.camelkit?.bundleName || `${entry.name}.plugin.js`;
  const pluginName = pkgJson.camelkit?.pluginName || pkgJson.displayName || pkgJson.name;

  const bundleBytes = readFileSync(distBundlePath);
  const sha256 = createHash('sha256').update(bundleBytes).digest('hex');

  cpSync(distBundlePath, join(bundlesOutDir, bundleName));

  const dataFiles = [];
  const pkgDataDir = join(pkgDir, 'data');
  if (existsSync(pkgDataDir)) {
    for (const file of readdirSync(pkgDataDir)) {
      if (file.endsWith('.json')) {
        cpSync(join(pkgDataDir, file), join(dataOutDir, file));
        dataFiles.push(`${rawBaseUrl}/data/${file}`);
      }
    }
  }

  plugins.push({
    id: pkgJson.name,
    name: pluginName,
    description: pkgJson.description || '',
    author: pkgJson.author || 'CamelKit',
    version: pkgJson.version || '1.0.0',
    bundle_name: bundleName,
    download_url: `${rawBaseUrl}/bundles/${bundleName}`,
    url: `${rawBaseUrl}/bundles/${bundleName}`,
    github_url: `https://github.com/${repoSlug}/tree/main/packages/${entry.name}`,
    latest_commit_hash: commitHash,
    asset_sha: `sha256:${sha256}`,
    is_official: true,
    ...(dataFiles.length > 0 ? { data_urls: dataFiles } : {}),
  });
}

const manifest = {
  schema_version: 1,
  repository: repoSlug,
  commit: commitHash,
  generated_at: new Date().toISOString(),
  plugins,
};

writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`[build-manifest] Generated dist-publish/manifest.json with ${plugins.length} official plugin(s).`);
