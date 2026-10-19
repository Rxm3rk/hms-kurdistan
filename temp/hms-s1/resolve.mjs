// Resolve versions by the §4.1 rule: newest GA line (major.minor) that has had a patch release; newest patch in it.
import { execFileSync } from 'node:child_process';
const pkgs = process.argv.slice(2);
const isGA = (v) => /^\d+\.\d+\.\d+$/.test(v);
for (const p of pkgs) {
  const raw = execFileSync('corepack', ['pnpm', 'view', p, '--json'], { encoding: 'utf8', shell: true, maxBuffer: 64e6 });
  const m = JSON.parse(raw);
  const ga = m.versions.filter(isGA);
  const lines = new Map();
  for (const v of ga) { const [a, b, c] = v.split('.').map(Number); const k = `${a}.${b}`; const l = lines.get(k) ?? []; l.push([a, b, c, v]); lines.set(k, l); }
  const sorted = [...lines.entries()].sort((x, y) => { const [a1, b1] = x[0].split('.').map(Number); const [a2, b2] = y[0].split('.').map(Number); return a2 - a1 || b2 - b1; });
  const newestLine = sorted[0];
  const chosen = sorted.find(([, l]) => l.some((e) => e[2] >= 1));
  const pick = chosen[1].sort((x, y) => y[2] - x[2])[0][3];
  const newest = newestLine[1].sort((x, y) => y[2] - x[2])[0][3];
  console.log(`${p}\tlatest-tag=${m['dist-tags'].latest}\tnewest-GA=${newest} (${m.time[newest]?.slice(0,10)})\tPICK=${pick} (${m.time[pick]?.slice(0,10)})\tlicence=${m.license}`);
}
