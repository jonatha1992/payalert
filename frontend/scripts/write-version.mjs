import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(await readFile(path.join(appDir, 'package.json'), 'utf8'));
let commit = 'desconocido';

try {
  commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: appDir, encoding: 'utf8' }).trim();
} catch (error) {
  if (error.code !== 'ENOENT' && error.status !== 128) throw error;
}

const output = path.join(appDir, 'public');
await mkdir(output, { recursive: true });
await writeFile(path.join(output, 'version.json'), `${JSON.stringify({ version, commit, builtAt: new Date().toISOString() }, null, 2)}\n`);
