# Bounded camera-cadence repair

## Source contract

Base: `f206799b4f05251e3e4e9fd4a6cb9704efce9988`, tree `0014366586bf30ca25be682282974ba704034fe9`, HTML SHA-256 `418f1d2ce3481a9d53e2c225889d4528fee57615c4beeb4fb1d545b17f8bdae1`.

Candidate HTML SHA-256: `14a976b94d621050d28efbab9090f3a72a59cc81cfe82fd812ce7a560fe324fd`.

Only the camera smoothing block changes. A single `1 - Math.pow(0.9, dt * 60)` factor replaces all four fixed 0.1 factors. The exact existing `Math.min(clock.getDelta(), 0.1)` and subsequent `clock.getElapsedTime()` remain intact. Clock ownership, keys/moveSpeed, listeners, AA spawning, swell, effect updates/lifetimes, timers, materials, geometry, UI, external URLs and the empty API key are unchanged.

The separately pinned camera inverse restores every byte of exact f206799, after which the unchanged approved-input fixture and original input hash gate restore exact 3aec708. The retained historical winding/disposal inverse then restores the supplied original HTML. Behavioral tests run the unnormalized candidate.

## Executed writer evidence

- Baseline reproduction preceded production editing and used the read-only exact f206799 HTML. At 0.1 seconds, actual target x is 0.271 / 0.468559 / 0.717570463519 at 30 / 60 / 120 Hz. All six components at 0.1, 0.2 and 1 second match the old geometric-series oracle. Full measurements are in `evidence/camera-cadence/baseline-red.json`.
- Seven camera test groups pass: pinned scope; baseline red; +/-/settled fixed poses at three cadences and durations; all components of 180 baseline 60 Hz frames; matched target-change segments with irregular and zero deltas; zero/1-120/1-60/1-30/0.1/0.5/10 delta boundaries; actual registered lifecycle listeners with continued easing and fresh input rearming.
- The independent camera oracle uses exp/log rather than the production pow expression. Absolute per-component tolerance is 1e-10 for tested magnitudes (radius <=420); baseline/candidate 60 Hz equality uses 1e-11.
- All four in-memory behavioral mutations are detected: fixed 0.1, theta left fixed, missing 60 multiplier, uncapped raw delta.
- All retained 10 geometry/disposal checks and 16 input checks pass. Original geometry controls have exactly six expected failures; both historical input sources have exactly eleven expected failures. These are overlapping suites, not unique issue totals. All twelve retained input mutations are detected, now using one sequential temporary HTML file instead of twelve retained copies.
- Full actual inline-script compilation, external URL/empty-key assertions, historical exact inverse gates and git whitespace checks pass in the retained suite.

Commands, from this worktree:

```sh
node tools/probe_camera_baseline.mjs ../yamato-input-ownership-candidate-20261016/src/ijn_battleship_yamato_1_1_scale_3d_simulation.html
node --test --test-reporter=tap tests/camera.test.mjs
node tools/probe_camera_mutations.mjs
python3 tools/run_regressions.py --output /tmp/yamato-camera-retained-results
python3 tools/probe_input_mutations.py --output /tmp/yamato-camera-input-mutations
git diff --check
```

The first command requires the exact preserved baseline path, or any verified materialization with that same source hash. The camera suite also reconstructs and verifies exact f206799 from the pinned candidate for a portable baseline check.

## Timing and acceptance limits

Fixed desired poses converge according to accepted elapsed time. This does not establish whole-simulation or moving-target/WASD/orbit invariance. Zero delta advances no smoothing while existing callback/render behavior continues. No callbacks means no smoothing; a subsequent raw stall is capped at the existing 0.1 seconds. There is no queued motion, catch-up loop, new clock or focus-induced freeze/snap.

Source/function tests use dependency-free doubles, not Three.js, WebGL, browser scheduling or GPU memory. No browser/GPU/device acceptance, asset fetch, dependency install, CDN vendoring, publication, GitHub write, PC operation or transfer is performed by this slice. The existing cloud CDN/rendering blocker remains open. Source/test review and dependent external readback/reconstruction must be reported separately from these writer checks.

## Recovery contract

The original geometry/input worktrees and all their dirty/untracked state are preserved; they were clean at preflight. The candidate uses one sparse shared-Git worktree and retains every omitted tracked file in its tree. Total lane allocation, including Git growth, temporary files, review, delta, readback and restoration, must remain <=4 MiB and filesystem free space >=2 GiB. No old archive, asset or dependency copy is created or deleted.

Only after independent frozen-byte review, `tools/camera_delta_checkpoint.py pack` can prepare a tiny dependent delta. It contains an incremental bundle with exact f206799 as prerequisite, a binary/full-index patch, all changed/new file identities, bounded committed evidence, and the independent review. It requires the already externally verified complete baseline ZIP: Library `PRIVATE_CHECKPOINT_REFERENCE`, 261101 bytes, SHA-256 `bdc355f23176d75e3de7aa25a0c13ba5a60a594e64b98504796b91342bf4e554`.

The delta is not standalone or an offline-complete runtime. Upload permission and exact-object provider readback are managed by the parent. A new downloaded delta must hash-match the packed archive, verify its members, restore the exact final commit/tree through the incremental bundle into a fresh sparse shared-object worktree based on exact f206799, and rerun the camera/retained suites and mutations. The script does not upload or fetch network content. The inherited full-history checkpoint tool is not used.
