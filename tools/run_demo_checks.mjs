// YAM-DEMO-01 candidate checks: actual demo suite, in-memory negative controls,
// and a read-only replay of the untouched historical suites on the pinned pre-edit
// source. Temporary mutation/replay files live in the OS temp directory.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, cpSync, rmSync, realpathSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

const root = new URL('..', import.meta.url);
const sourcePath = new URL('../src/ijn_battleship_yamato_1_1_scale_3d_simulation.html', import.meta.url);
const source = readFileSync(sourcePath, 'utf8');
const sha256 = text => createHash('sha256').update(text).digest('hex');
const evidence = new URL('../demo-evidence/', import.meta.url);
mkdirSync(evidence, { recursive: true });
const TEMP_ROOT = realpathSync(tmpdir());

// Only delete a just-created direct child of the OS temp root whose basename
// carries the declared prefix. The final resolved/real path is validated first.
function assertOwnedTempDir(directory, prefix) {
  const resolved = realpathSync(directory);
  const parent = realpathSync(join(resolved, '..'));
  const basename = resolved.split(/[\\/]/).pop();
  assert.notEqual(resolved, TEMP_ROOT, 'refuse to delete the OS temp root');
  assert.equal(parent, TEMP_ROOT, 'cleanup target must be a direct child of the intended OS temp root');
  assert.ok(basename.startsWith(prefix), `cleanup target must carry the ${prefix} prefix`);
  assert.equal(statSync(resolved).isDirectory(), true, 'cleanup target must be a directory');
  return resolved;
}
assert.throws(() => assertOwnedTempDir(TEMP_ROOT, 'yamato-demo-checks-'), /temp root|direct child/);
assert.throws(() => assertOwnedTempDir(fileURLToPath(new URL('.', import.meta.url)), 'yamato-demo-checks-'), /direct child/);

function parseTap(output) {
  return {
    pass: [...output.matchAll(/^ok \d+ - (.+)$/gm)].map(match => match[1]),
    fail: [...output.matchAll(/^not ok \d+ - (.+)$/gm)].map(match => match[1])
  };
}
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    ...options
  });
  if (result.error) throw result.error;
  return result;
}
function runDemoSuite(file, pattern) {
  const args = ['--test', '--test-reporter=tap'];
  if (pattern) args.push('--test-name-pattern', pattern);
  args.push('tests/demo.test.mjs');
  return run(process.execPath, args, { env: { ...process.env, YAMATO_SOURCE: file } });
}

const receipt = {
  status: 'PENDING',
  source: { bytes: Buffer.byteLength(source), sha256: sha256(source) },
  tempCleanupGuard: { checkedBeforeEachRecursiveDelete: true, rejectionChecksPassed: true }
};
const temp = assertOwnedTempDir(mkdtempSync(join(tmpdir(), 'yamato-demo-checks-')), 'yamato-demo-checks-');
try {
  // 1. Real candidate suite.
  const suite = run(process.execPath, ['--test', '--test-reporter=tap', 'tests/demo.test.mjs']);
  writeFileSync(new URL('./demo-suite.tap', evidence), suite.stdout);
  const suiteTap = parseTap(suite.stdout);
  assert.equal(suite.status, 0, suite.stdout + suite.stderr);
  assert.equal(suiteTap.pass.length, 19, JSON.stringify(suiteTap));
  assert.equal(suiteTap.fail.length, 0);
  receipt.demoSuite = { returncode: suite.status, pass: suiteTap.pass.length, fail: 0 };

  // 2. Actual integrated inline script compiles.
  const scripts = [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter(match => !/\bsrc\s*=/.test(match[1]));
  assert.equal(scripts.length, 1);
  new vm.Script(scripts[0][2], { filename: 'candidate-inline-script.js' });
  receipt.inlineScriptCompiles = true;

  // 3. Negative controls: each mutation must fail a targeted behavioral test.
  const mutations = [
    ['no-recoil-travel', 'return -DEMO_GUN.recoilTravel * rise * dampedReturn;', 'return 0;', 'nine main barrels'],
    ['no-neutral-restore', 'barrel.rig.position.copy(barrel.neutralPosition);', 'barrel.rig.position.set(0.01, 0, 0);', 'nine main barrels'],
    ['hull-uncoupled', 'group.position.y = applied.heave;', 'group.position.y = 0;', 'hull pose comes from'],
    ['single-sea-state', 'return Object.prototype.hasOwnProperty.call(DEMO_SEA_PRESETS, key) ? DEMO_SEA_PRESETS[key] : DEMO_SEA_PRESETS.moderate;', 'return DEMO_SEA_PRESETS.moderate;', 'illustrative water'],
    ['crew-visible', 'const DEMO_CREW_RENDERED = false;', 'const DEMO_CREW_RENDERED = true;', 'crew is excluded'],
    ['foam-centreline', 'const leftY = sample(leftX, leftZ, time, key) + 0.06;\n                    const rightY = sample(rightX, rightZ, time, key) + 0.06;', 'const leftY = sample(point.x, point.z, time, key) + 0.06;\n                    const rightY = sample(point.x, point.z, time, key) + 0.06;', 'foam edge vertices'],
    ['smoke-visible-early', 'const visibleAtBirth = bornAt <= now;', 'const visibleAtBirth = true;', 'scheduled smoke']
  ];
  receipt.negativeControls = [];
  for (const [name, before, after, pattern] of mutations) {
    assert.equal(source.split(before).length, 2, `${name}: exact mutation site`);
    const file = join(temp, `${name}.html`);
    writeFileSync(file, source.replace(before, after));
    const result = runDemoSuite(file, pattern);
    const tap = parseTap(result.stdout);
    writeFileSync(new URL(`./negative-${name}.tap`, evidence), result.stdout);
    assert.equal(result.status, 1, `${name} must fail`);
    assert.ok(tap.fail.length >= 1, `${name} must produce a behavioral failure`);
    receipt.negativeControls.push({ mutation: name, detected: true, failed_tests: tap.fail });
  }

  // 4. Write envelope: only the declared candidate paths may diverge.
  const status = run('git', ['status', '--porcelain']).stdout.trim().split(/\r?\n/).filter(Boolean)
    .map(line => line.trim().split(/\s+/).slice(1).join(' '));
  const allowed = [
    /^src\/ijn_battleship_yamato_1_1_scale_3d_simulation\.html$/,
    /^tests\/demo\.test\.mjs$/,
    /^tests\/demo-harness\.mjs$/,
    /^tools\/run_demo_checks\.mjs$/,
    /^DEMO\.md$/,
    /^DEMO-IMPLEMENTATION-RESULT\.md$/,
    /^DEMO-DEPENDENCIES\.json$/,
    /^demo-evidence\//
  ];
  const outside = status.filter(file => !allowed.some(pattern => pattern.test(file)));
  assert.deepEqual(outside, [], 'changes stay inside the YAM-DEMO-01 write envelope');
  receipt.writeScope = { changedPaths: status, allWithinEnvelope: true };

  // 5. Read-only replay of the unchanged historical suites on the exact pinned
  // pre-edit source. Baseline fixtures and tests are copied to OS temp only.
  const replay = assertOwnedTempDir(mkdtempSync(join(tmpdir(), 'yamato-baseline-replay-')), 'yamato-baseline-replay-');
  try {
    cpSync(new URL('../tests/', import.meta.url), join(replay, 'tests'), { recursive: true });
    cpSync(new URL('../baseline/', import.meta.url), join(replay, 'baseline'), { recursive: true });
    mkdirSync(join(replay, 'src'));
    cpSync(new URL('../demo-evidence/pre-edit/source-pin.html', import.meta.url),
      join(replay, 'src/ijn_battleship_yamato_1_1_scale_3d_simulation.html'));
    const expected = { 'regression.test.mjs': 10, 'input.test.mjs': 16, 'camera.test.mjs': 7, 'aa.test.mjs': 9 };
    receipt.historicalBaselineReplay = {};
    for (const [file, count] of Object.entries(expected)) {
      const result = run(process.execPath, ['--test', '--test-reporter=tap', `tests/${file}`], { cwd: replay });
      writeFileSync(new URL(`./baseline-replay-${file}.tap`, evidence), result.stdout);
      const tap = parseTap(result.stdout);
      assert.equal(result.status, 0, `${file} on pinned baseline: ${result.stdout}${result.stderr}`);
      assert.equal(tap.pass.length, count, `${file}: ${JSON.stringify(tap)}`);
      assert.equal(tap.fail.length, 0);
      receipt.historicalBaselineReplay[file] = { pass: tap.pass.length, fail: 0 };
    }
    const pinnedBytes = readFileSync(join(replay, 'src/ijn_battleship_yamato_1_1_scale_3d_simulation.html'));
    receipt.historicalBaselineReplay.source = {
      bytes: pinnedBytes.length,
      sha256: createHash('sha256').update(pinnedBytes).digest('hex')
    };
  } finally {
    rmSync(assertOwnedTempDir(replay, 'yamato-baseline-replay-'), { recursive: true, force: true });
  }

  receipt.status = 'PASS: demo suite 19/19, seven negative controls detected, unchanged historical suites 42/42 on the pinned pre-edit source';
  receipt.limit = 'Dependency-free doubles around actual extracted functions and production-registered listeners; no browser, Three.js execution, WebGL, GPU, FPS or visual acceptance.';
  console.log(JSON.stringify(receipt, null, 2));
} finally {
  rmSync(assertOwnedTempDir(temp, 'yamato-demo-checks-'), { recursive: true, force: true });
}
writeFileSync(new URL('./run-demo-checks.json', evidence), JSON.stringify(receipt, null, 2) + '\n');
