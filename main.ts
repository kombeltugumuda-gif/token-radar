// A token-radar-01 entry (Node 22, standard library only).
//
// The program reads the sealed snapshot from /input/snapshot.json (or
// --input <file|dir>), scores every pre-token protocol with the model in
// lib/model.ts, writes the ranked board to /output/board.json, and copies
// this repository's dashboard/ and screenshots/ to /output. Last, it writes
// /output/dossier.json, the summary the judge reads, with the vendored
// make.fun library.
//
// The dashboard is a static page, no framework and no network:
// dashboard/index.html, dashboard/app.css and dashboard/app.js read
// /output/data.js, which this program writes from the same board.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)));
const isMain = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];

/** Why the CLI's arguments are not usable, or null. */
function argsIssue(argv: string[]): string | null {
  const input = argv.find((a) => a === '--input') !== undefined ? argv[argv.indexOf('--input') + 1] : undefined;
  if (input === undefined) return null;
  if (input === '') return '--input needs a file or directory';
  return null;
}

/** The input's path, from --input, defaulting to /input/snapshot.json. */
function inputPath(argv: string[]): string {
  const i = argv.indexOf('--input');
  if (i === -1 || argv[i + 1] === undefined) return '/input/snapshot.json';
  return argv[i + 1];
}

/** The snapshot's text, from a file or from a directory's snapshot.json. */
function snapshotText(path: string): string {
  const stat = statSync(path);
  return readFileSync(stat.isDirectory() ? join(path, 'snapshot.json') : path, 'utf8');
}

/** The output's path: /output in the grader, MAKEFUN_OUTPUT_DIR locally. */
function outputPath(): string {
  return process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
}

/** Copy a directory's files to a directory: the dashboard's and the screenshots'. */
function copyDir(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const src = join(from, name);
    if (!statSync(src).isFile()) continue;
    copyFileSync(src, join(to, name));
    copied.push(name);
  }
  return copied;
}

/** The scorer's own caps (reference/gate.json): the text cap shapes the bytes, the rest refuse. */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** Run the build: read the snapshot, score the board, and write /output. */
export function run(argv: string[] = process.argv.slice(2)): void {
  const issue = argsIssue(argv);
  if (issue !== null) throw new Error(issue);
  const input = inputPath(argv);
  if (!existsSync(input)) throw new Error(`no snapshot at ${input}`);
  const snapshot = parseSnapshot(snapshotText(input));
  const { board, radar } = buildRadar(snapshot);
  const boardProblem = boardIssue(board, snapshot);
  if (boardProblem !== null) throw new Error(`board is not valid: ${boardProblem}`);

  const out = outputPath();
  mkdirSync(out, { recursive: true });
  // The board as { rows }: the shape the gate reads, as the starter writes it.
  writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
  writeFileSync(join(out, 'data.js'), dataScript(radar));
  copyDir(join(ROOT, 'dashboard'), join(out, 'dashboard'));
  const shots = copyDir(join(ROOT, 'screenshots'), join(out, 'screenshots'));
  if (shots.length < 3) throw new Error(`screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view`);
  for (const name of shots) {
    if (!IMAGE_NAME.test(name)) throw new Error(`screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters`);
  }
  // The dossier is written last, as the bytes buildDossier returns: the
  // scorer rebuilds it from this /output and compares bytes.
  writeFileSync(join(out, 'dossier.json'), buildDossier(out, { text_max_bytes: TEXT_MAX_BYTES, screenshots: SCREENSHOT_CAPS, dashboard: { max_files: 400, max_bytes: 4_194_304 } }));
  const watch = board.filter((r) => snapshot.watchlist.includes(r.slug)).length;
  console.log(
    `${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows scored (${board.length - watch} early, ${radar.live_size} live set aside)`,
  );
}

if (isMain) run();
