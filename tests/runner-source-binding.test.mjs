import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const entry = 'src/ijn_battleship_yamato_1_1_scale_3d_simulation.html';
const hash = value => createHash('sha256').update(value).digest('hex');

test('ambient good-source override cannot hide a failing candidate from the runner', t => {
  const tempRoot = realpathSync(tmpdir());
  const owned = mkdtempSync(join(tempRoot, 'yamato-source-binding-'));
  try {
    const env = { ...process.env, GIT_CEILING_DIRECTORIES: owned };
    for (const key of Object.keys(env)) {
      if (['YAMATO_SOURCE', 'NODE_TEST_CONTEXT', 'GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE'].includes(key.toUpperCase())) delete env[key];
    }
    const run = (command, args, cwd, extraEnv = {}) => {
      const result = spawnSync(command, args, { cwd, env: { ...env, ...extraEnv }, encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024 });
      assert.ifError(result.error);
      return result;
    };
    const git = (args, cwd) => {
      const result = run('git', ['-c', 'core.autocrlf=false', '-c', 'core.eol=lf', ...args], cwd);
      assert.equal(result.status, 0, 'owned fixture Git operation must succeed');
      return result.stdout;
    };
    const project = join(owned, 'checkout');
    mkdirSync(project);
    for (const name of git(['ls-files', '-z'], root).split('\0').filter(Boolean)) {
      assert.ok(!name.startsWith('/') && !name.includes('..') && !name.includes('\\'), 'tracked fixture path must remain relative');
      const target = join(project, name);
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(join(root, name), target);
    }
    git(['init', '--quiet'], project);
    git(['add', '--all'], project);
    git(['-c', 'user.name=Yamato test fixture', '-c', 'user.email=yamato-fixture@example.invalid', 'commit', '--quiet', '-m', 'Owned source-binding regression fixture'], project);

    // Preserve real runner stages 1-4, including main/mutation subprocesses and
    // checkout/write guards. Stop before the unchanged 42-group baseline replay.
    const runnerPath = join(project, 'tools/run_demo_checks.mjs');
    const runner = readFileSync(runnerPath, 'utf8');
    const marker = '  // 5. Read-only replay of the unchanged historical suites';
    assert.equal(runner.split(marker).length, 2, 'one historical replay boundary');
    writeFileSync(runnerPath, runner.split(marker)[0] +
      '  console.log(JSON.stringify({fixtureScope:"STAGES_1_TO_4_ONLY",receipt}));\n' +
      '} finally {\n  rmSync(assertOwnedTempDir(temp, "yamato-demo-checks-"), {recursive:true, force:true});\n}\n');

    const fixtureEntry = join(project, entry);
    const good = readFileSync(fixtureEntry, 'utf8');
    const mutation = 'group.rotation.z = applied.pitch;';
    assert.equal(good.split(mutation).length, 2, 'one actual hull-axis mutation site');
    const bad = good.replace(mutation, 'group.rotation.z = -applied.pitch;');
    writeFileSync(fixtureEntry, bad);
    const external = join(owned, 'external-source.html');
    writeFileSync(external, good);
    const direct = run(process.execPath, ['--test', '--test-reporter=tap', '--test-name-pattern', 'planar water world transforms', 'tests/demo.test.mjs'], project);
    assert.equal(direct.status, 1, 'wrong-pitch fixture must independently fail its planar transform test');
    assert.match(direct.stdout, /not ok .*planar water world transforms/);
    const masked = run(process.execPath, ['tools/run_demo_checks.mjs'], project, { YAMATO_SOURCE: external });
    t.diagnostic(JSON.stringify({ candidateSHA256: hash(bad), externalGoodSHA256: hash(good), directWrongPitchExit: direct.status, runnerWithExternalGoodExit: masked.status, historicalReplayRun: false }));
    assert.equal(masked.status, 1, 'external good source must not mask the failing candidate');
    const failedTap = readFileSync(join(project, 'demo-evidence/demo-suite.tap'), 'utf8');
    assert.match(failedTap, /not ok .*planar water world transforms/, 'runner must exercise the failing candidate behavior');

    // Conversely, a broken ambient file must not poison a valid candidate.
    // Seven real mutation controls still choose their own deliberately bad files.
    writeFileSync(fixtureEntry, good);
    writeFileSync(external, 'invalid external source; never the candidate');
    const valid = run(process.execPath, ['tools/run_demo_checks.mjs'], project, { YAMATO_SOURCE: external });
    assert.equal(valid.status, 0, valid.stderr);
    const report = JSON.parse(valid.stdout);
    assert.equal(report.fixtureScope, 'STAGES_1_TO_4_ONLY');
    assert.equal(report.receipt.source.sha256, hash(good));
    assert.equal(report.receipt.demoSuite.pass, 19);
    assert.equal(report.receipt.negativeControls.length, 7);
    assert.ok(report.receipt.negativeControls.every(control => control.detected));
    assert.equal(report.receipt.checkoutGuard.pass, 2);
    t.diagnostic(JSON.stringify({ validCandidateExit: valid.status, demoPass: 19, mutationControlsDetected: 7, checkoutChecks: 2, historicalReplayRun: false }));
  } finally {
    const resolved = realpathSync(owned);
    assert.equal(dirname(resolved), tempRoot, 'cleanup must stay within the resolved OS temp root');
    assert.ok(basename(resolved).startsWith('yamato-source-binding-'));
    assert.notEqual(resolved, tempRoot);
    rmSync(resolved, { recursive: true, force: true });
  }
});
