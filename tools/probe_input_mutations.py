#!/usr/bin/env python3
"""Ephemeral in-memory source mutations must fail targeted actual-listener tests."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'src/ijn_battleship_yamato_1_1_scale_3d_simulation.html'
parser = argparse.ArgumentParser()
parser.add_argument('--output', required=True, type=Path)
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
source = SOURCE.read_text()
mutations = [
    ('omit-blur', "window.addEventListener('blur', cancelCameraInput);", '', 'window blur cancels'),
    ('omit-pagehide', "window.addEventListener('pagehide', cancelCameraInput);", '', 'pagehide cancels'),
    ('omit-visibility', 'if (document.hidden) cancelCameraInput();', '', 'hidden documents cancel'),
    ('omit-focus-clear', 'if (isEditableTarget(e.target)) clearCameraInput();', '', 'focus transfer to editable'),
    ('disable-editable-guard', 'return target && (target.isContentEditable', 'return false && (target.isContentEditable', 'editable event targets'),
    ('omit-ctrl-guard', 'e.ctrlKey || e.altKey || e.metaKey', 'e.altKey || e.metaKey', 'modifier shortcuts'),
    ('omit-composition-state', '|| inputComposing;', ';', 'composition lifecycle'),
    ('omit-touchcancel', "dom.addEventListener('touchcancel', clearCameraInput);", '', 'touchcancel and focus loss'),
    ('omit-touch-ownership', 'if (!touchActive) return;', '', 'touchcancel and focus loss'),
    ('omit-no-button-clear', 'if (e.buttons === 0) { clearPointerInput(); return; }', '', 'new mouse presses'),
    ('allow-repeat-rearm', '&& (!e.repeat || camState.keys[k])', '', 'window blur cancels'),
    ('allow-zero-distance', 'touchPrevDist > 0 && dist > 0', 'touchPrevDist > 0', 'touchend discards pinch')
]
records = []
with tempfile.TemporaryDirectory(prefix='yamato-input-mutations-') as temporary:
    for name, before, after, pattern in mutations:
        assert source.count(before) == 1, (name, source.count(before))
        target = Path(temporary) / 'mutation.html'  # Reuse one bounded source file.
        target.write_text(source.replace(before, after))
        command = ['node', '--test', '--test-reporter=tap', '--test-name-pattern', pattern, 'tests/input.test.mjs']
        result = subprocess.run(command, cwd=ROOT, env=dict(os.environ, YAMATO_SOURCE=str(target)),
                                text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        (args.output / f'{name}.tap').write_text(result.stdout)
        assert result.returncode == 1 and '\nnot ok ' in result.stdout, (name, result.stdout)
        records.append({'mutation': name, 'target_test_pattern': pattern, 'returncode': result.returncode,
                        'expected_defect_detected': True})
receipt = {'mutations': records, 'status': f'PASS: all {len(records)} targeted source mutations were detected',
           'limit': 'Source-listener doubles only; no rendered input or browser/GPU acceptance.'}
(args.output / 'mutation-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
print(receipt['status'])
