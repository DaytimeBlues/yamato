import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';

const tempRoot = realpathSync(tmpdir());
const runner = new URL('../tools/run_demo_checks.mjs', import.meta.url);

function fixture(nestedRepository) {
  const owned = mkdtempSync(join(tempRoot, 'yamato-checkout-guard-'));
  try {
    const env = { ...process.env, GIT_CEILING_DIRECTORIES: owned };
    for (const key of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE']) delete env[key];
    const outer = join(owned, 'outer');
    mkdirSync(outer);
    if (nestedRepository) {
      const init = spawnSync('git', ['init', '--quiet', outer], { encoding: 'utf8', env });
      assert.equal(init.status, 0, 'fixture Git init must succeed');
    }
    const project = join(outer, 'source-copy');
    mkdirSync(join(project, 'tools'), { recursive: true });
    copyFileSync(runner, join(project, 'tools', 'run_demo_checks.mjs'));
    const result = spawnSync(process.execPath, ['tools/run_demo_checks.mjs'], {
      cwd: project, encoding: 'utf8', env, timeout: 10000
    });
    assert.ifError(result.error);
    assert.notEqual(result.status, 0, 'missing exact checkout must reject');
    assert.match(result.stderr, /YAMATO_CHECKOUT_REQUIRED/, 'reject the prerequisite before reading source or running suites');
    assert.doesNotMatch(result.stdout, /allWithinEnvelope|"status"\s*:\s*"PASS/);
    assert.equal(existsSync(join(project, 'demo-evidence')), false, 'no evidence writes before checkout validation');
    assert.equal(result.stderr.includes(outer), false, 'do not print enclosing checkout paths');
  } finally {
    const resolved = realpathSync(owned);
    assert.equal(dirname(resolved), tempRoot, 'cleanup must remain a direct child of the resolved temp root');
    assert.ok(basename(resolved).startsWith('yamato-checkout-guard-'));
    assert.notEqual(resolved, tempRoot);
    rmSync(resolved, { recursive: true, force: true });
  }
}

test('plain source copy rejects before tests or evidence writes', () => fixture(false));
test('source copy inside a different Git root rejects without exposing outer status', () => fixture(true));
