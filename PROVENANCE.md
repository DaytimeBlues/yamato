# Source identity and provenance

- Supplied recovered original: `baseline/recovered-original.html`, 156,963 bytes, SHA-256 `228d3e4c4421965e21b50e49dbabf9116ae7b6a71ff8f269c60522746f893c1d`.
- Reviewed geometry baseline: commit `3aec7086416b991240d45dd4ddd8cdadea83b67d`, source 157,433 bytes, SHA-256 `3ef3661c981e2464869dc57de326a09651b14ad698034df5a574b81e84bff4f7`. Its exact source is retained in `baseline/geometry-cleanup-3aec708.html`.
- Current input candidate: `src/ijn_battleship_yamato_1_1_scale_3d_simulation.html`, 160,546 bytes, SHA-256 `418f1d2ce3481a9d53e2c225889d4528fee57615c4beeb4fb1d545b17f8bdae1`.
- The parent task supplied the original as exact Library v0 recovery. This worker independently verified the local byte count/hash and copied those bytes without modification; it did not perform another Library download.
- Historical commit `798ec1ca2178253bf6f0b50d67b0bd2933ca0ccb` is unverified for these bytes. It is not used as the Git identity or ancestry of this candidate.
- This repository was freshly initialized on 16 October 2026 with the honestly labelled recovered-original baseline. No remote is configured and no history was invented.
- Original source uses procedural Three.js geometry and generated canvas textures; this bounded change imports no models or external art. Original authorship/licensing is inherited and not independently established. Do not infer distribution rights from the recovery.

## Confirmed source findings and bounded correction

Both defects were confirmed from the supplied source before editing. The original weather deck has 220 downward-facing triangles and the stern overlay has 52. The candidate has 220 and 52 upward-facing triangles, with unchanged positions, UVs, primitive dimensions, material settings and all other source bytes outside the approved edits.

The original effect producers allocate a new geometry and material for each flash, smoke, shell and tracer. Expiry originally removed their meshes but called neither resource's `dispose`. The helper added here is used only for those privately allocated meshes. It is not a scene-wide disposal traversal and never visits `MAT`, hull stanchions or other reusable assets.

## Renderer contract references

- Existing pinned renderer version: Three.js r128, as stated in the original HTML CDN path. Its served bytes/SRI were not independently captured; no renderer package or dependency was upgraded.
- [r128 Material source](https://raw.githubusercontent.com/mrdoob/three.js/r128/src/materials/Material.js) sets the material default to `FrontSide` and provides material disposal. [r128 constants](https://raw.githubusercontent.com/mrdoob/three.js/r128/src/constants.js) define the side constants.
- [r128 BufferGeometry source](https://raw.githubusercontent.com/mrdoob/three.js/r128/src/core/BufferGeometry.js) exposes geometry disposal. These references were read as source documentation only, never executed or installed.
- No full offline-runtime claim is made. See `DEPENDENCIES.json` for all runtime network endpoints retained in the supplied HTML.

## Evidence boundaries

The test harness extracts the actual `initMaterials`, hull helpers/`buildHull`, effect producers and full `animate` function from the selected HTML. It captures Float32 vertex data and computes each triangle's cross-product Y independently. The harness's normal-computation method only records that the real function requests normal recomputation; it is not a substitute Three.js normal calculator.

Lifecycle tests instrument allocation, scene removal and disposal calls. Identity muzzle transforms, disabled automatic AA spawning and empty crew/radar/flag fixtures isolate lifecycle behavior. They verify call ownership and expiry, not rendering, graphics-driver reclamation or real memory performance.

## Subsequent bounded input-ownership repair

The candidate continues exact `3aec708` in a separate worktree on `local/yamato-input-ownership`. The parent verified the previous external Library checkpoint as item `PRIVATE_CHECKPOINT_REFERENCE` v0, 155,878 bytes, archive SHA-256 `4b8d7a79a56ea688d0fb4527fa5f2fc5a220dcbaa6cb932e6f7113129890518b`. This task relied on the exact local Git/source baseline and did not upload, replace or claim external backup of the new candidate.

Before source edits, the complete real `setupEventListeners` was extracted and invoked to register its production listeners on minimal DOM event targets. The initial retained probe output showed 11 baseline failures and 4 ordinary-control/release passes. The finalized suite adds an explicit exact-delta scope check; both unchanged baselines reproduce the same 11 failures and pass 5 tests. The source change is confined to that one function. The approved-delta fixture pins the baseline commit and source hash, the full candidate hash and exact listener-function hash; tests restore the prior listener function and require every remaining source byte to match the geometry baseline. The historical exact winding/disposal inverse gate remains in place after normalization.

The input harness dispatches into the actual production listeners and calls the actual animation function to verify movement and release. It covers editable event targets/active fields, inherited contenteditable and textbox targets, IME start/end/events, modifier/default-prevented events, unconditional keyup, focus transfer, blur, visibility changes, pagehide, stale mouse holds, ordinary orbit/pan/wheel, touch orbit/pinch/cancel and zero-distance pinch. Repeat keydown cannot rearm a cancelled key. Twelve independently mutated handler/guard variants must fail targeted behavioral tests. These are source-logic checks using doubles, not browser event-delivery, visual quality, touchscreen hardware or real GPU evidence.

The current repair leaves animation/physics timing, AI connectivity, art evaluation, historical scale accuracy and coupled-water behavior unchanged and unaccepted. Real rendered ordinary/interrupted controls remain a separate gate; the inherited CDN reachability blocker was reported by the parent and was not bypassed. Historical geometry receipts/review remain preserved and apply only to their original bounded source identities.
