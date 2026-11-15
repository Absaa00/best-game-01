// Lumen Tide — the entry program for best-game-01 (Node 22, stdlib only).
//
// The game itself lives in this repository as plain static files under game/
// (an index.html plus the canvas sources it loads), and the screenshots in
// screenshots/ are real renders of that code. This program hands both in:
// it copies game/ and screenshots/ into the output directory and writes the
// dossier.json the judge reads, built with the kit's vendored library.
//
// The program does no work of its own beyond the copy: it makes no network
// calls, reads nothing outside this repository, and writes exactly the same
// bytes on every run, so the grader's two runs agree.
//
// Local check:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');

if (!existsSync(join(gameDir, 'index.html'))) {
  throw new Error('Lumen Tide: game/index.html is missing, nothing to hand in');
}

mkdirSync(outDir, { recursive: true });
cpSync(gameDir, join(outDir, 'game'), { recursive: true });

mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) {
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
}

// The caps are the competition's own gate caps (see vendor/makefun-game.ts):
// at most 163840 bytes of dossier text, 4 screenshots of at most 256 KiB,
// game/ at most 993 entries and 48 MiB, no game path over 1000 bytes.
// Passing them here makes this program fail exactly where the scorer
// would refuse the entry, instead of handing in something doomed.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});

writeFileSync(join(outDir, 'dossier.json'), dossier);
