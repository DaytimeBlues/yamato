#!/usr/bin/env python3
"""Bounded dependent checkpoint. No network, full clone, full bundle or assets."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
BASE = 'f206799b4f05251e3e4e9fd4a6cb9704efce9988'
BASE_TREE = '0014366586bf30ca25be682282974ba704034fe9'
SOURCE = 'src/ijn_battleship_yamato_1_1_scale_3d_simulation.html'
BASE_SHA = '418f1d2ce3481a9d53e2c225889d4528fee57615c4beeb4fb1d545b17f8bdae1'
SOURCE_SHA = '14a976b94d621050d28efbab9090f3a72a59cc81cfe82fd812ce7a560fe324fd'
FLOOR = 2147483648
MAX_ARCHIVE = 262144

def run(*args, cwd=ROOT, input=None):
    return subprocess.check_output(args, cwd=cwd, input=input, stderr=subprocess.STDOUT)

def sha(data):
    return hashlib.sha256(data).hexdigest()

def reserve(path, additional=MAX_ARCHIVE):
    assert shutil.disk_usage(path).free >= FLOOR + additional, 'strict free-space reserve would be breached'

def safe_path(name):
    p = PurePosixPath(name)
    assert not p.is_absolute() and '..' not in p.parts and p.as_posix() == name
    return p

def base_identity(repo):
    assert run('git', 'rev-parse', 'HEAD', cwd=repo).decode().strip() == BASE
    assert run('git', 'rev-parse', 'HEAD^{tree}', cwd=repo).decode().strip() == BASE_TREE
    assert sha(run('git', 'show', f'HEAD:{SOURCE}', cwd=repo)) == BASE_SHA
    assert not run('git', 'status', '--porcelain', cwd=repo).strip(), 'baseline must be clean'

def pack(args):
    reserve(ROOT)
    assert not args.output.exists() and args.output.parent.is_dir()
    assert not run('git', 'status', '--porcelain').strip(), 'freeze and commit before packing'
    head = run('git', 'rev-parse', 'HEAD').decode().strip()
    tree = run('git', 'rev-parse', 'HEAD^{tree}').decode().strip()
    assert head != BASE
    run('git', 'merge-base', '--is-ancestor', BASE, head)
    assert sha(run('git', 'show', f'{head}:{SOURCE}')) == SOURCE_SHA
    # Only additions/modifications are authorized; no omitted tracked path deletion.
    statuses = run('git', 'diff', '--name-status', BASE, head).decode().splitlines()
    assert all(line.startswith(('A\t', 'M\t')) for line in statuses)
    changed = []
    for line in statuses:
        status, name = line.split('\t')
        safe_path(name)
        entry = run('git', 'ls-tree', head, '--', name).decode().strip().split()
        data = run('git', 'show', f'{head}:{name}')
        changed.append({'path': name, 'status': status, 'mode': entry[0], 'blob': entry[2], 'size': len(data), 'sha256': sha(data)})
    review = args.review.read_bytes()
    assert 0 < len(review) <= 200000, 'review must be supplied and bounded'
    with tempfile.TemporaryDirectory(prefix='yamato-camera-delta-') as temporary:
        bundle = Path(temporary) / 'incremental.bundle'
        run('git', 'bundle', 'create', str(bundle), 'HEAD', f'^{BASE}')
        run('git', 'bundle', 'verify', str(bundle))
        members = {'incremental.bundle': bundle.read_bytes(),
                   'source.patch': run('git', 'diff', '--binary', '--full-index', BASE, head),
                   'independent-review.md': review,
                   'RESTORE.md': ("# Dependent recovery\n\nRequires the complete externally verified f206799 checkpoint described in manifest.json; this ZIP is not standalone. Verify this ZIP against its separately retained SHA-256 before extraction. Check each member size/mode/SHA against manifest.json. In a fresh clean exact-base working tree, use git bundle verify incremental.bundle, fetch its advertised final commit, then check out the manifest final commit. Verify HEAD tree, full source SHA, every changed-file mode/blob/SHA and source.patch against git diff --binary --full-index BASE FINAL. No network fetch is required.\n\nThe reviewed tools/camera_delta_checkpoint.py verify command automates fresh sparse shared-object restoration and reruns camera, geometry/disposal, input, historical negative controls and both mutation sets. Run it from the preserved candidate with --archive EXACT_DOWNLOADED_ZIP --expected-sha256 SEPARATELY_RETAINED_ZIP_SHA --base CLEAN_EXACT_F206799_REPO --restore NEW_ABSOLUTE_RESTORE_PATH --evidence NEW_ABSOLUTE_EVIDENCE_PATH. Recheck total lane storage <=4 MiB and free space >=2 GiB before execution. Do not run the old full checkpoint tool. Keep browser/GPU/ordinary-device acceptance separate.\n").encode()}
        manifest = {
            'format': 'yamato-camera-dependent-delta-v1',
            'required_base': {'commit': BASE, 'tree': BASE_TREE, 'source_sha256': BASE_SHA,
                'library_file_id': 'PRIVATE_CHECKPOINT_REFERENCE', 'archive_size': 261101,
                'archive_sha256': 'bdc355f23176d75e3de7aa25a0c13ba5a60a594e64b98504796b91342bf4e554'},
            'final': {'commit': head, 'tree': tree, 'source_sha256': SOURCE_SHA},
            'changed_files': changed,
            'members': {name: {'mode': '100644', 'size': len(data), 'sha256': sha(data)} for name, data in members.items()},
            'limit': 'Dependent on exact externally verified f206799 base; not standalone/offline-complete. Source-only acceptance.'}
        members['manifest.json'] = (json.dumps(manifest, indent=2) + '\n').encode()
        assert sum(map(len, members.values())) <= 700000
        reserve(ROOT)
        with zipfile.ZipFile(args.output, 'x', compression=zipfile.ZIP_DEFLATED) as archive:
            for name, data in members.items():
                info = zipfile.ZipInfo(name)
                info.external_attr = (0o100644 << 16)
                info.compress_type = zipfile.ZIP_DEFLATED
                archive.writestr(info, data)
        assert args.output.stat().st_size <= MAX_ARCHIVE
    print(json.dumps({'archive': str(args.output), 'bytes': args.output.stat().st_size,
                      'sha256': sha(args.output.read_bytes()), 'final': manifest['final']}, indent=2))

def verify(args):
    reserve(ROOT, 1000000)
    assert sha(args.archive.read_bytes()) == args.expected_sha256
    assert args.archive.stat().st_size <= MAX_ARCHIVE
    assert not args.restore.exists() and not args.evidence.exists()
    base_identity(args.base)
    with zipfile.ZipFile(args.archive) as archive:
        names = archive.namelist()
        assert len(names) == len(set(names)) == 5
        assert set(names) == {'manifest.json', 'incremental.bundle', 'source.patch', 'independent-review.md', 'RESTORE.md'}
        assert sum(i.file_size for i in archive.infolist()) <= 700000
        for info in archive.infolist():
            safe_path(info.filename)
            assert info.external_attr >> 16 == 0o100644
        manifest = json.loads(archive.read('manifest.json'))
        assert manifest['format'] == 'yamato-camera-dependent-delta-v1'
        assert manifest['required_base']['commit'] == BASE and manifest['required_base']['tree'] == BASE_TREE
        assert manifest['required_base']['source_sha256'] == BASE_SHA
        assert manifest['final']['source_sha256'] == SOURCE_SHA
        members = {name: archive.read(name) for name in manifest['members']}
        assert set(members) == set(names) - {'manifest.json'}
        for name, data in members.items():
            assert sha(data) == manifest['members'][name]['sha256']
            assert len(data) == manifest['members'][name]['size']
        with tempfile.TemporaryDirectory(prefix='yamato-camera-replay-') as temporary:
            bundle = Path(temporary) / 'incremental.bundle'
            bundle.write_bytes(members['incremental.bundle'])
            heads = run('git', 'bundle', 'list-heads', str(bundle), cwd=args.base).decode().splitlines()
            assert heads == [manifest['final']['commit'] + ' HEAD'], 'downloaded bundle must advertise the exact final commit'
            absent = subprocess.run(['git', 'cat-file', '-e', manifest['final']['commit'] + '^{commit}'],
                                    cwd=args.base, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            assert absent.returncode != 0, 'use an independent exact-base object store without candidate objects'
            run('git', 'bundle', 'verify', str(bundle), cwd=args.base)
            run('git', 'worktree', 'add', '--detach', '--no-checkout', str(args.restore), BASE, cwd=args.base)
            run('git', 'sparse-checkout', 'init', '--no-cone', cwd=args.restore)
            run('git', 'sparse-checkout', 'set', '--no-cone', '--stdin', cwd=args.restore,
                input=b'/src/\n/tests/\n/baseline/\n/tools/\n/README.md\n/CAMERA_CADENCE.md\n/DEPENDENCIES.json\n/CHECKPOINT_SPEC.json\n/PROVENANCE.md\n')
            run('git', 'fetch', str(bundle), manifest['final']['commit'], cwd=args.restore)
            assert run('git', 'diff', '--binary', '--full-index', BASE, manifest['final']['commit'], cwd=args.restore) == members['source.patch']
            run('git', 'checkout', '--detach', manifest['final']['commit'], cwd=args.restore)
    assert run('git', 'rev-parse', 'HEAD', cwd=args.restore).decode().strip() == manifest['final']['commit']
    assert run('git', 'rev-parse', 'HEAD^{tree}', cwd=args.restore).decode().strip() == manifest['final']['tree']
    assert not run('git', 'status', '--porcelain', cwd=args.restore).strip()
    assert sha((args.restore / SOURCE).read_bytes()) == SOURCE_SHA
    actual_changes = run('git', 'diff', '--name-only', BASE, 'HEAD', cwd=args.restore).decode().splitlines()
    assert set(actual_changes) == {item['path'] for item in manifest['changed_files']}
    for item in manifest['changed_files']:
        safe_path(item['path'])
        data = run('git', 'show', f"HEAD:{item['path']}", cwd=args.restore)
        entry = run('git', 'ls-tree', 'HEAD', '--', item['path'], cwd=args.restore).decode().strip().split()
        assert sha(data) == item['sha256'] and len(data) == item['size']
        assert entry[0] == item['mode'] and entry[2] == item['blob']
    reserve(ROOT, 300000)
    args.evidence.mkdir(parents=True)
    commands = [
        ['node', '--test', '--test-reporter=tap', 'tests/camera.test.mjs'],
        ['node', 'tools/probe_camera_mutations.mjs'],
        ['python3', 'tools/run_regressions.py', '--output', str(args.evidence / 'retained')],
        ['python3', 'tools/probe_input_mutations.py', '--output', str(args.evidence / 'input-mutations')],
        ['git', 'diff', '--check', BASE, 'HEAD']]
    for index, command in enumerate(commands):
        reserve(ROOT, 200000)
        (args.evidence / f'check-{index}.txt').write_bytes(run(*command, cwd=args.restore))
    base_identity(args.base)
    print(json.dumps({'status': 'PASS: downloaded delta member/patch/bundle/full-tree/file identities and executable restored checks',
        'archive_sha256': args.expected_sha256, 'final': manifest['final'],
        'restore': str(args.restore), 'limit': manifest['limit']}, indent=2))

parser = argparse.ArgumentParser(description=__doc__)
sub = parser.add_subparsers(dest='action', required=True)
p = sub.add_parser('pack')
p.add_argument('--review', required=True, type=Path)
p.add_argument('--output', required=True, type=Path)
v = sub.add_parser('verify')
v.add_argument('--archive', required=True, type=Path)
v.add_argument('--expected-sha256', required=True)
v.add_argument('--base', required=True, type=Path)
v.add_argument('--restore', required=True, type=Path)
v.add_argument('--evidence', required=True, type=Path)
args = parser.parse_args()
for key in ['review', 'output', 'archive', 'base', 'restore', 'evidence']:
    if hasattr(args, key): setattr(args, key, getattr(args, key).resolve())
pack(args) if args.action == 'pack' else verify(args)
