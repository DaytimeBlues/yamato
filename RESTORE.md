# Restore a reviewed source checkpoint

The reviewed ZIP contains `MANIFEST.json`, `source.bundle`, and `source/` with every tracked file. Its externally recorded ZIP SHA256, full HEAD and tree identify the release. Obtain those values from the accompanying release receipt; a hash stored inside the ZIP cannot authenticate the ZIP itself. Preserve older packages and restore into a new directory.

`source/` is a readable snapshot, not a Git checkout. The demo runner deliberately rejects that directory, including when it is nested inside an unrelated repository. Restore the bundle into its own Git root before running it.

## Verify and restore with PowerShell, Git and Python 3

No package installation is required. Replace the five example values below with your chosen local paths and the external release receipt. `restoreRoot` must not exist. First compare the ZIP hash; then inspect its member list before extraction. Only the expected manifest, bundle and safe `source/` paths should be present, without links, duplicates, absolute paths or `..` segments.

```powershell
$zipPath = [IO.Path]::GetFullPath('C:\chosen\reviewed-package.zip')
$restoreRoot = [IO.Path]::GetFullPath('C:\chosen\fresh-yamato-restore')
$expectedZipSha = 'COPY_EXTERNAL_ZIP_SHA256'
$expectedHead = 'COPY_EXTERNAL_FULL_HEAD'
$expectedTree = 'COPY_EXTERNAL_FULL_TREE'
if ((Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expectedZipSha) { throw 'ZIP hash mismatch' }
if (Test-Path -LiteralPath $restoreRoot) { throw 'Choose a new restore directory' }
python -m zipfile -l $zipPath
# Inspect the list as described above before continuing.
Expand-Archive -LiteralPath $zipPath -DestinationPath $restoreRoot
$manifest = Get-Content -LiteralPath (Join-Path $restoreRoot 'MANIFEST.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.head -ne $expectedHead -or $manifest.tree -ne $expectedTree) { throw 'Release identity mismatch' }

function Check-ManifestFiles($directory, $records) {
  foreach ($item in $records.PSObject.Properties) {
    if ($item.Name -match '(^/|\\|:|(^|/)\.\.(/|$))') { throw 'Unsafe manifest path' }
    $filePath = Join-Path $directory $item.Name
    if ((Get-Item -LiteralPath $filePath).Length -ne $item.Value.bytes) { throw 'Source size mismatch' }
    if ((Get-FileHash -LiteralPath $filePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $item.Value.sha256) { throw 'Source hash mismatch' }
  }
}
Check-ManifestFiles (Join-Path $restoreRoot 'source') $manifest.files
$bundlePath = [IO.Path]::GetFullPath((Join-Path $restoreRoot 'source.bundle'))
if ((Get-Item -LiteralPath $bundlePath).Length -ne $manifest.bundle.bytes -or
    (Get-FileHash -LiteralPath $bundlePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $manifest.bundle.sha256) { throw 'Bundle mismatch' }

function Git-Checked { & git @args; if ($LASTEXITCODE -ne 0) { throw 'Git command failed' } }
$repoPath = Join-Path $restoreRoot 'git-restored'
Git-Checked init --quiet $repoPath
Git-Checked -C $repoPath bundle verify $bundlePath
Git-Checked -C $repoPath fetch --no-tags $bundlePath HEAD
Git-Checked -c core.autocrlf=false -c core.eol=lf -C $repoPath checkout --detach $expectedHead
if ((Git-Checked -C $repoPath rev-parse HEAD) -ne $expectedHead -or
    (Git-Checked -C $repoPath rev-parse 'HEAD^{tree}') -ne $expectedTree) { throw 'Restored identity mismatch' }
Git-Checked -C $repoPath fsck --full --strict
Check-ManifestFiles $repoPath $manifest.files
if (Git-Checked -c core.autocrlf=false -C $repoPath status --porcelain=v1 --untracked-files=all) { throw 'Restore is not clean' }
Set-Location -LiteralPath $repoPath
```

Do not use the retained `CHECKPOINT_SPEC.json` or `tools/local_checkpoint.py` to package this release: they deliberately retain older source pins. The reviewed ZIP's manifest and external receipt bind this newer source and its selected public Git ancestry. It does not restore the separate private original history.

## Run checks in the exact restored Git root

The Windows example below confines Git LF options and Python UTF8 to a child shell. It changes no persistent Git/provider settings. The parent shell must already be in `git-restored`.

```powershell
pwsh -NoProfile -Command {
  $env:GIT_CONFIG_COUNT = '2'
  $env:GIT_CONFIG_KEY_0 = 'core.autocrlf'
  $env:GIT_CONFIG_VALUE_0 = 'false'
  $env:GIT_CONFIG_KEY_1 = 'core.eol'
  $env:GIT_CONFIG_VALUE_1 = 'lf'
  $env:PYTHONUTF8 = '1'
  node tools/run_demo_checks.mjs
  exit $LASTEXITCODE
}
```

On other platforms run `node tools/run_demo_checks.mjs` from that exact checkout, with inherited Git filters that preserve the verified bytes. The runner performs 19 demo groups, seven behavioral negative controls, two checkout-prerequisite rejection checks, inline compilation and 42 historical groups **only on the pinned pre-edit baseline**. It creates new receipts in `demo-evidence/`; verify tracked source hashes again after testing. This is source-level evidence, without WebGL, device input, visual or performance acceptance.

For a manual preview open `src/ijn_battleship_yamato_1_1_scale_3d_simulation.html` and follow [DEMO.md](DEMO.md). Runtime Three.js, Tailwind and Fonts still come from inherited remote CDNs: the checkpoint is source-complete, not an offline-complete runtime. Never submit the optional Gemini, voice, TTS, analysis, scenario or Search controls during the walkthrough.
