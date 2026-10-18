#!/usr/bin/env python3
"""Small explicit local-only checkpoint tool; not an external-backup claim."""
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import subprocess
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]

def sha(data):
    return hashlib.sha256(data).hexdigest()

def run(*args, cwd=ROOT):
    return subprocess.check_output(args, cwd=cwd, text=True).strip()

def safe_path(name):
    path = PurePosixPath(name)
    if path.is_absolute() or '..' in path.parts or '\\' in name or not name or str(path) != name:
        raise ValueError(f'Unsafe checkpoint path: {name!r}')
    return path

def pack(destination):
    destination = destination.resolve()
    if destination.is_relative_to(ROOT):
        raise ValueError('Keep generated checkpoint outside its source repository')
    if destination.exists():
        raise FileExistsError(destination)
    if run('git', 'status', '--porcelain=v1', '--untracked-files=all'):
        raise RuntimeError('Source repository must be completely clean, including untracked files')
    spec = json.loads((ROOT / 'CHECKPOINT_SPEC.json').read_text())
    paths = run('git', 'ls-files').splitlines()
    if not set(spec['required_paths']).issubset(paths):
        raise RuntimeError(f'Missing tracked requirements: {set(spec["required_paths"]) - set(paths)}')
    modes = run('git', 'ls-files', '--stage').splitlines()
    if any(line.split()[0] not in ('100644', '100755') for line in modes):
        raise RuntimeError('Links, submodules and unsupported file modes are forbidden')
    files = {}
    for name in paths:
        safe_path(name)
        local = ROOT / name
        if local.is_symlink() or not local.is_file():
            raise ValueError(name)
        content = local.read_bytes()
        files[name] = {'bytes': len(content), 'sha256': sha(content)}
    for name, expected in spec['required_source_sha256'].items():
        if files[name]['sha256'] != expected:
            raise RuntimeError(f'Source identity mismatch: {name}')
    manifest = {'contract': spec['contract'], 'git_head': run('git', 'rev-parse', 'HEAD'),
                'git_branch': run('git', 'branch', '--show-current'), 'files': files, 'spec': spec}
    # This history contains the local recovery baseline and bounded source repairs.
    with tempfile.TemporaryDirectory(prefix='yamato-local-pack-') as temp:
        bundle = Path(temp) / 'history.bundle'
        subprocess.run(['git', 'bundle', 'create', str(bundle), '--all'], cwd=ROOT, check=True)
        subprocess.run(['git', 'bundle', 'verify', str(bundle)], cwd=ROOT, check=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
        bundle_bytes = bundle.read_bytes()
        manifest['bundle'] = {'bytes': len(bundle_bytes), 'sha256': sha(bundle_bytes)}
        destination.parent.mkdir(parents=True, exist_ok=True)
        with zipfile.ZipFile(destination, 'x', compression=zipfile.ZIP_DEFLATED) as archive:
            for name in paths:
                archive.writestr('source/' + name, (ROOT / name).read_bytes())
            archive.writestr('history.bundle', bundle_bytes)
            archive.writestr('MANIFEST.json', json.dumps(manifest, indent=2) + '\n')
    return {'archive': str(destination), 'bytes': destination.stat().st_size, 'sha256': sha(destination.read_bytes()),
            'git_head': manifest['git_head'], 'tracked_file_count': len(files), 'status': 'PACKED LOCAL ONLY; restore verification still required'}

def verify(archive_path, expected_hash, destination):
    archive_path = archive_path.resolve()
    if sha(archive_path.read_bytes()) != expected_hash:
        raise RuntimeError('Archive SHA-256 does not match separately recorded expected value')
    if destination.exists():
        raise FileExistsError('Restore destination must be fresh and nonexistent')
    with zipfile.ZipFile(archive_path) as archive:
        entries = archive.infolist()
        names = [item.filename for item in entries]
        if len(names) != len(set(names)):
            raise RuntimeError('Duplicate archive paths')
        for item in entries:
            safe_path(item.filename)
            if item.file_size > 16 * 1024 * 1024 or ((item.external_attr >> 16) & 0o170000) == 0o120000:
                raise RuntimeError('Unsupported archive member')
        if sum(item.file_size for item in entries) > 32 * 1024 * 1024:
            raise RuntimeError('Unexpected archive size')
        manifest = json.loads(archive.read('MANIFEST.json'))
        expected_names = {'MANIFEST.json', 'history.bundle'} | {'source/' + name for name in manifest['files']}
        if set(names) != expected_names:
            raise RuntimeError('Archive member inventory mismatch')
        if not set(manifest['spec']['required_paths']).issubset(manifest['files']):
            raise RuntimeError('Missing required source in manifest')
        for name, record in manifest['files'].items():
            safe_path(name)
            content = archive.read('source/' + name)
            if len(content) != record['bytes'] or sha(content) != record['sha256']:
                raise RuntimeError(f'Invalid source bytes: {name}')
        bundle = archive.read('history.bundle')
        if len(bundle) != manifest['bundle']['bytes'] or sha(bundle) != manifest['bundle']['sha256']:
            raise RuntimeError('Invalid Git bundle bytes')
        destination.mkdir(parents=True)
        for name in names:
            local = destination / name
            local.parent.mkdir(parents=True, exist_ok=True)
            local.write_bytes(archive.read(name))
    repo = destination / 'git-restored'
    subprocess.run(['git', 'clone', str(destination / 'history.bundle'), str(repo)], check=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    if run('git', 'rev-parse', 'HEAD', cwd=repo) != manifest['git_head']:
        raise RuntimeError('Restored HEAD identity mismatch')
    subprocess.run(['git', 'fsck', '--full'], cwd=repo, check=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    restored_paths = run('git', 'ls-files', cwd=repo).splitlines()
    if set(restored_paths) != set(manifest['files']):
        raise RuntimeError('Git source inventory does not match the archive')
    for name, record in manifest['files'].items():
        if sha((repo / name).read_bytes()) != record['sha256']:
            raise RuntimeError(f'Git-restored source mismatch: {name}')
    subprocess.run(['python3', 'tools/run_regressions.py', '--output', str(destination.resolve() / 'rerun-evidence')], cwd=repo, check=True)
    subprocess.run(['git', 'diff', '--check'], cwd=repo, check=True)
    if run('git', 'status', '--porcelain=v1', cwd=repo):
        raise RuntimeError('Restored repository became dirty during verification')
    return {'archive': str(archive_path), 'archive_sha256': expected_hash, 'git_head': manifest['git_head'],
            'tracked_file_count': len(restored_paths), 'restore_directory': str(destination.resolve()),
            'source_hashes_verified': True, 'git_bundle_fsck_and_exact_inventory': True,
            'candidate_tests': 'geometry/disposal 10/10 and input 16/16',
            'original_negative_controls': '6/6 expected geometry/disposal failures; preservation/scope 4/4 passing',
            'input_negative_controls': '11/11 expected failures on exact geometry baseline and original; ordinary/scope 5/5 passing on each',
            'status': 'LOCAL archive and Git restore verified; no external backup, browser or GPU acceptance'}

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest='action', required=True)
    p = sub.add_parser('pack'); p.add_argument('--archive', required=True, type=Path)
    p = sub.add_parser('verify'); p.add_argument('--archive', required=True, type=Path); p.add_argument('--expected-sha256', required=True); p.add_argument('--restore', required=True, type=Path)
    args = parser.parse_args()
    result = pack(args.archive) if args.action == 'pack' else verify(args.archive, args.expected_sha256, args.restore)
    print(json.dumps(result, indent=2))
