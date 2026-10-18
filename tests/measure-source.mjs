import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createHarness, deckMetrics } from './source-harness.mjs';
const results = [];
for (const [label, path] of [['original', '../baseline/recovered-original.html'], ['candidate', '../src/ijn_battleship_yamato_1_1_scale_3d_simulation.html']]) {
  const bytes = readFileSync(new URL(path, import.meta.url));
  const h = createHarness(bytes.toString()), hull = h.makeHull();
  const geometry = {};
  for (const material of ['teakDeck', 'nonSlipGrey']) {
    const mesh = hull.children.find(m => m.material === h.context.MAT[material]);
    geometry[material] = { side: mesh.material.side, ...deckMetrics(mesh) };
  }
  const mark = h.resources.length;
  h.context.triggerMainSalvo(); h.drainTimers();
  h.context.aaDrillActive = true; h.context.spawnAATracers(); h.context.aaDrillActive = false;
  h.tick(16);
  const effects = h.resources.slice(mark);
  results.push({ label, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), geometry,
    lifecycle: { allocatedPrivateResources: effects.length, disposedExactlyOnce: effects.filter(r => r.disposeCount === 1).length,
      notDisposed: effects.filter(r => r.disposeCount === 0).length, remainingEffects: h.context.shellEffects.length + h.context.aaTracers.length },
    evidenceLimit: 'Actual extracted source functions with dependency-free test doubles; no browser, Three.js execution or GPU-memory measurement.' });
}
console.log(JSON.stringify(results, null, 2));
