#!/usr/bin/env python3
"""Run actual-source regressions and explicit original/input-baseline controls."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--output', required=True, type=Path)
args = parser.parse_args()
out = args.output.resolve()
out.mkdir(parents=True, exist_ok=True)
command = ['node', '--test', '--test-reporter=tap', 'tests/regression.test.mjs']
results = {}
for label, target in [('candidate', ROOT / 'src/ijn_battleship_yamato_1_1_scale_3d_simulation.html'), ('original', ROOT / 'baseline/recovered-original.html')]:
    env = dict(os.environ, YAMATO_SOURCE=str(target))
    result = subprocess.run(command, cwd=ROOT, env=env, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    (out / f'{label}-regression.tap').write_text(result.stdout)
    passed = re.findall(r'^ok \d+ - (.+)$', result.stdout, re.M)
    failed = re.findall(r'^not ok \d+ - (.+)$', result.stdout, re.M)
    results[label] = {'returncode': result.returncode, 'pass': len(passed), 'fail': len(failed), 'failed_tests': failed,
                      'source_bytes': target.stat().st_size, 'source_sha256': hashlib.sha256(target.read_bytes()).hexdigest()}
assert results['candidate']['returncode'] == 0 and results['candidate']['pass'] == 10 and results['candidate']['fail'] == 0, results
expected = {
    'teakDeck actual procedural triangles all face upward and remain single-sided',
    'nonSlipGrey actual procedural triangles all face upward and remain single-sided',
    'salvo resources remain live before expiry then are removed and disposed exactly once',
    'tracer resources obey disabled/enabled drill and expire with exactly-once cleanup',
    'staggered effects preserve newer allocations while older effects expire',
    '100 repeated mixed cycles release all private effect resources and preserve shared hull assets'
}
assert results['original']['returncode'] == 1 and results['original']['pass'] == 4 and set(results['original']['failed_tests']) == expected, results
input_command = ['node', '--test', '--test-reporter=tap', 'tests/input.test.mjs']
input_results = {}
expected_input_failures = {
    'editable event targets and active controls cannot claim camera keyboard input',
    'modifier shortcuts and IME key events cannot latch movement',
    'focus transfer to editable controls immediately clears held movement and pan',
    'window blur cancels held movement and pointer ownership without resuming on focus',
    'hidden documents cancel input while visible visibility changes preserve a live key',
    'pagehide cancels input and pageshow does not synthesize a new hold',
    'unfocused documents reject new keyboard mouse touch and wheel input',
    'composition lifecycle clears held input and requires a fresh post-composition keydown',
    'new mouse presses replace stale pan/drag and no-button move cancels missed mouseup',
    'touchcancel and focus loss reject stale pinch moves until a fresh touchstart',
    'touchend discards pinch ownership and zero-distance gestures cannot jump zoom'
}
for label, target in [('candidate', ROOT / 'src/ijn_battleship_yamato_1_1_scale_3d_simulation.html'),
                      ('geometry-baseline', ROOT / 'baseline/geometry-cleanup-3aec708.html'),
                      ('original', ROOT / 'baseline/recovered-original.html')]:
    env = dict(os.environ, YAMATO_SOURCE=str(target))
    result = subprocess.run(input_command, cwd=ROOT, env=env, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    (out / f'{label}-input-regression.tap').write_text(result.stdout)
    passed = re.findall(r'^ok \d+ - (.+)$', result.stdout, re.M)
    failed = re.findall(r'^not ok \d+ - (.+)$', result.stdout, re.M)
    input_results[label] = {'returncode': result.returncode, 'pass': len(passed), 'fail': len(failed), 'failed_tests': failed,
                            'source_bytes': target.stat().st_size, 'source_sha256': hashlib.sha256(target.read_bytes()).hexdigest()}
    if label == 'candidate':
        assert result.returncode == 0 and len(passed) == 16 and len(failed) == 0, input_results
    else:
        assert result.returncode == 1 and len(passed) == 5 and set(failed) == expected_input_failures, input_results
measure = subprocess.run(['node', 'tests/measure-source.mjs'], cwd=ROOT, check=True, text=True, stdout=subprocess.PIPE)
(out / 'source-measurements.json').write_text(measure.stdout)
receipt = {'command': command, 'input_command': input_command,
           'node_version': subprocess.check_output(['node', '--version'], text=True).strip(), 'results': results, 'input_results': input_results,
           'status': 'PASS: candidate geometry/disposal 10/10 and input 16/16; original six and each input-baseline eleven expected failures verified',
           'limit': 'Dependency-free doubles around actual extracted functions and production-registered input listeners. No browser/WebGL/Three.js/GPU-memory test.'}
(out / 'regression-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(receipt['status'])
