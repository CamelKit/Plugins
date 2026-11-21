import * as esbuild from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Shared esbuild bundler for CamelKit monorepo plugins.
 * Bundles multi-file TypeScript/CSS/assets into a single ESM `dist/plugin.js`
 * while keeping `@camelkit/core` and `@babylonjs/*` external for runtime import maps.
 */
export async function buildPlugin({ cwd = process.cwd(), watch = process.argv.includes('--watch') } = {}) {
  const pkgPath = path.join(cwd, 'package.json');
  const pkgJson = JSON.parse(await fs.readFile(pkgPath, 'utf8'));
  const entryPoint = path.join(cwd, pkgJson.main || 'src/index.ts');
  const outfile = path.join(cwd, 'dist/plugin.js');

  const CSSMinifyPlugin = {
    name: 'CSSMinifyPlugin',
    setup(build) {
      build.onLoad({ filter: /\.css$/ }, async (args) => {
        const source = await fs.readFile(args.path, 'utf8');
        const minified = await esbuild.transform(source, { loader: 'css', minify: true });
        return { loader: 'text', contents: minified.code };
      });
    },
  };

  const buildOptions = {
    absWorkingDir: cwd,
    entryPoints: [entryPoint],
    outfile,
    bundle: true,
    minify: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2020',
    sourcemap: true,
    define: {
      __PLUGIN_VERSION__: JSON.stringify(pkgJson.version || '1.0.0'),
    },
    external: [
      '@camelkit/core',
      '@camelkit/core/*',
      '@babylonjs/*',
      '@babylonjs/core',
    ],
    plugins: [CSSMinifyPlugin],
    loader: {
      '.html': 'text',
      '.png': 'dataurl',
      '.jpg': 'dataurl',
      '.jpeg': 'dataurl',
      '.gif': 'dataurl',
      '.svg': 'dataurl',
      '.webp': 'dataurl',
      '.wav': 'dataurl',
      '.mp3': 'dataurl',
    },
  };

  if (watch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log(`[CamelKit Plugins] Watching ${pkgJson.name} for changes...`);
  } else {
    await esbuild.build(buildOptions);
    console.log(`[CamelKit Plugins] Built ${pkgJson.name}@${pkgJson.version} -> dist/plugin.js`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await buildPlugin();
}

