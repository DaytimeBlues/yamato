# Yamato: bounded local camera-cadence repair candidate

Current slice: camera easing now uses `1 - Math.pow(0.9, dt * 60)` for all four interpolation factors, with the existing clamped delta. This preserves the 60 Hz response and makes fixed-pose smoothing depend on accepted time. See `CAMERA_CADENCE.md` and `evidence/camera-cadence/` for the separately pinned scope, executed baseline reproduction, checks, and limitations. The input/geometry description and older receipts below are retained historical context; their checks are rerun for this slice.

This isolated worktree continues the reviewed geometry/disposal repair at exact commit `3aec7086416b991240d45dd4ddd8cdadea83b67d`. The original recovery repository/worktree remains untouched. This is newly initialized recovery history, not recovered historical Git history. The supplied original remains unchanged in `baseline/recovered-original.html`; the exact geometry-repair source is pinned in `baseline/geometry-cleanup-3aec708.html`. The candidate is in `src/ijn_battleship_yamato_1_1_scale_3d_simulation.html`.

## Implemented scope

1. Reverse weather-deck and recessed stern-deck triangle winding so their single-sided front faces point upward.
2. On effect expiry, remove each privately owned salvo/tracer mesh, then dispose its geometry and material. The shared ship materials and reusable geometry never enter this cleanup path.
3. Within `setupEventListeners` only, release camera keys, drag/pan and touch ownership when the window loses focus, the page hides, an editable control takes focus or composition starts. Prevent typing/shortcuts/IME events from moving the camera; keyup always releases. Cancel stale pointer/pinch state, reject unfocused input and require a fresh keydown/touchstart after cancellation.

No dimensions, ocean physics, art, crew, models, runtime dependencies, credentials or AI configuration changed. The current camera slice changes only smoothing timing; all other simulation timing is preserved. Ordinary WASD, orbit, shift/right pan, wheel and touch control math is preserved. An exact source/function hash and normalization gate binds the input change to `3aec708`; the retained historical winding/disposal inverse-edit test then restores the supplied original bytes. Source outside the exact reviewed listener replacement remains byte-identical.

## Reproduce source-level checks

Requirements: Node.js with built-in `node:test` and Python 3. No package installation, network access, downloaded code, browser or GUI is needed for these checks.

```sh
python3 tools/run_regressions.py --output /tmp/yamato-regression-evidence
python3 tools/probe_input_mutations.py --output /tmp/yamato-input-mutation-evidence
node tests/measure-source.mjs
git diff --check
```

The candidate passes the retained 10 geometry/disposal tests and 16 input tests. The geometry/disposal suite on the original deliberately fails the 2 deck-facing and 4 effect-lifecycle tests while passing 4 preservation/scope checks. The input suite deliberately reproduces 11 failures on both the exact geometry baseline and original, while 5 normal-control/scope checks pass. All 12 targeted source mutations are caught. Tests execute actual extracted HTML functions, the complete production `setupEventListeners` and its registered handlers, plus `animate`, with dependency-free doubles. They do not execute Three.js, render WebGL, measure actual GPU memory, prove visual quality, or establish real-device acceptance.

## Runtime and remaining gates

The HTML retains Three.js r128 from its existing versioned CDN URL, Tailwind's unversioned CDN script and Google Fonts. These runtime resources are not vendored; this is not a complete offline runtime. The inherited Gemini API key remains empty. Do not insert credentials to test this repair.

Independent source/test review and local checkpoint/restore evidence are required before handoff. A successful local checkpoint is not a Drive backup. No upload, publishing, user-computer operation or browser/GPU test is authorized in this step.

After a reviewed checkpoint, the safe next step is an explicitly authorized transfer of these exact candidate bytes for a separate PC-GPU acceptance gate. Check top-side deck visibility, lighting, ordinary and interrupted controls (including typing in the AI fields), repeated broadside/AA use and browser console/network errors there. The inherited runtime CDN is currently reported unreachable in the cloud browser; the source-listener harness is not visual/browser acceptance. Coupled ocean physics remains outside this repair.

See `PROVENANCE.md`, `DEPENDENCIES.json` and `evidence/input-ownership/` for current source identity, measurements and limitations. Root-level `evidence/` receipts and `evidence/review.md` are retained historical geometry-repair evidence; they do not approve the later input delta.
