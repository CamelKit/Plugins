import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildPlugin } from '../../scripts/build-plugin.mjs';

const cwd = dirname(fileURLToPath(import.meta.url));
await buildPlugin({ cwd });

