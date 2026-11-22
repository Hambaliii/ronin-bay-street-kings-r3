// RONIN BAY: Street Kings — Make Fun entrypoint.
//
// This program packages the game in this repository into a dossier.json
// file using the vendored buildDossier helper. It runs from any working
// directory: the program root is derived from this module's own location,
// never from process.cwd().
//
// Output goes to process.env.MAKEFUN_OUTPUT_DIR ?? '/output'.
// The game/ and screenshots/ subtrees (when present) are copied into the
// output directory first, then the dossier bytes returned by buildDossier
// are written raw to <out>/dossier.json.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-ignore -- vendored TypeScript helper, run directly by Node 22
import { buildDossier } from './vendor/makefun-game.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });

for (const name of ['game', 'screenshots']) {
  const src = join(root, name);
  if (existsSync(src)) {
    cpSync(src, join(out, name), { recursive: true });
  }
}

// Ensure <out>/screenshots exists even if empty / not yet captured.
mkdirSync(join(out, 'screenshots'), { recursive: true });

const bytes = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

// buildDossier returns a Uint8Array — write it RAW, never stringify it.
writeFileSync(join(out, 'dossier.json'), bytes);
