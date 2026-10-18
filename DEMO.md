# YAM-DEMO-01 — integrated public-source demo

## Entry point

Open `src/ijn_battleship_yamato_1_1_scale_3d_simulation.html` directly in a browser (`file://`) or from a simple static HTTP root. It remains the actual runnable entry; no build step, package install or local server is required by this repository. The inherited Three.js r128, Tailwind CDN and Google Fonts requests still need network access; they are not vendored. The inherited Gemini text/TTS panel still has an empty API key and is not invoked by this demo or by any test.

## What this demo shows

- **No visible people.** Crew creation and crew animation are excluded at the `DEMO_CREW_RENDERED` / `populateCrew` boundary. The original crew builders remain in the source and in `baseline/recovered-original.html`; no crew meshes or animation entries are created. The personnel HUD, station pins and camera-preset labels now describe ship structure, not rendered people.
- **Nine main barrels.** All three 46cm triple turrets use a per-barrel local recoil rig with stored exact neutral transforms. A coordinated salvo ripples across turrets and barrels, each barrel recoils and returns with a damped profile, and every barrel is restored to its stored neutral transform after its declared lifetime. Sea pose, traverse and elevation are ancestors and cannot drift the local neutral.
- **Blast lifecycle.** Each shot gets a brief flash and a small set of expanding, fading smoke puffs placed beyond the muzzle. Effects own their geometry and material, are removed from the scene before disposal, and expire on declared lifetimes. No shell ballistics, damage, dye colour or audio is fabricated.
- **Repeat fire.** One live salvo at a time. A request during a live salvo coalesces into at most one queued salvo; further requests do not accumulate work. The queue drains at the end of the live salvo.
- **Three sea states.** Calm, Moderate and Rough controls change wave amplitude, wavelength, direction, speed, choppiness and restrained hull response. One shared `sampleWaterHeight` function drives the ocean mesh, the hull pose samples and the foam ribbons, so the cues cannot disagree. The previous unrelated sine rocking and the static filled wake polygon are gone; narrow foam/wake ribbons follow the water surface.
- **Reduced motion.** `prefers-reduced-motion: reduce` is honored at load, and the visible `Reduced Motion: ON/OFF` button provides an explicit override. Reduced motion scales hull heave/pitch/roll to 12% and there are no camera shake or impulse effects. Camera and gun state are independent of sea changes and motion preference.

This sea model is an **illustrative visual model, not validated hydrodynamics**. Wave parameters, hull-response scale and blast/recoil values are invented for visual legibility, not historical weather, firing timings or ballistics.

## Controls

| Control | Effect |
| --- | --- |
| Left drag / one-finger drag | Orbit camera |
| Right drag, Shift+drag / two-finger pinch | Pan / zoom |
| Scroll | Zoom |
| WASD | Walk the current camera target across the deck |
| Camera presets | Overview, Compass Bridge, Admiral's Bridge, Forecastle & Chrysanthemum, 46cm Turrets, AA Citadel, Stern Aviation, Deck Eye-Level |
| Turret traverse / barrel elevation sliders | Move all main and secondary turrets |
| **Fire 46cm Type 94 Broadside** | Requests a coordinated nine-barrel salvo |
| **25mm AA Drill** | Toggles inherited AA tracer cadence (unchanged) |
| Lighting button | Golden / Noon / Ten-Go lighting |
| **Calm / Moderate / Rough** | Switches the illustrative sea state without touching camera or gun state |
| **Reduced Motion: ON/OFF** | Explicit override; media preference is used until the button is pressed |

## Ordinary walkthrough

1. Open the HTML and let the overview settle.
2. Select **Rough**: the wave field, foam ribbons and restrained hull roll/pitch change; the camera target and turret settings stay where they were.
3. Select **Calm** and **Moderate** to compare wave scale, direction and choppiness.
4. Use the turret/elevation sliders, then press **Fire 46cm Type 94 Broadside**. Watch the three turrets ripple, each barrel recoil and return, and the flash/smoke clear. Press Fire again during the salvo: it queues at most one follow-up salvo.
5. Switch camera presets to inspect the nine barrels, forecastle, AA mounts and stern aviation deck. No crew figures appear at any station.
6. Toggle **Reduced Motion** and/or set the OS/browser reduced-motion preference: hull motion is strongly damped while camera, sea controls and guns remain usable.
7. To check editable-focus cancellation, type a harmless temporary string into an input, confirm camera keys stop responding, then clear the field and click back onto the canvas. **Do not press Enter/Send/Execute/Voice Order/Analyze Current 3D View, and do not enable Google Search or any AI/TTS/scenario control.** An empty API key is not permission to invoke those endpoints; this demo never requires them.

## Tuning

- `DEMO_GUN` in the demo runtime block: recoil travel/rise/decay/duration, flash/smoke lifetimes, smoke puff count/radius, turret/barrel stagger, repeat cooldown.
- `DEMO_SEA_PRESETS`: amplitude, wavelength, direction, speed, chop, foam opacity and hull-response scale for Calm/Moderate/Rough.
- `DEMO_MOTION_REDUCED_SCALE` (0.12): hull-motion scale under reduced motion.
- `createFoamRibbonSpecs()`: narrow foam/wake strip geometry.

## Verification (source-level only)

Run from the exact Git checkout root. A plain extracted source copy or a copy inside a different repository is deliberately rejected before tests or evidence writes. For ZIP/bundle restoration and transient Windows Git LF/Python UTF8 settings, follow [RESTORE.md](RESTORE.md).

```sh
node --test --test-reporter=tap tests/demo.test.mjs
node tools/run_demo_checks.mjs
PYTHONUTF8=1 python tools/probe_input_mutations.py --output demo-evidence/inherited-input-mutations
node tools/probe_camera_mutations.mjs
git diff --check
```

`tools/run_demo_checks.mjs` also checks two rejected checkout prerequisites and replays the unchanged historical suites against the exact pinned pre-edit source in a temporary directory. Results and receipts are under `demo-evidence/`. The exact inherited source-pin fixture retains its original blank-line whitespace; all other changed files pass `git diff --check`.

## Limits and open gates

- No browser, WebGL, GPU, FPS, visual-density, screenshot or ordinary-input device acceptance was performed. Source tests use dependency-free Three/DOM doubles around actual extracted functions and production-registered listeners.
- The sea, foam, hull response, recoil and smoke are illustrative and not physically calibrated.
- Runtime CDN dependencies are inherited; this is not an offline-complete runtime and nothing was vendored or installed.
- The inherited Gemini/TTS lane is unchanged, has an empty key, and was not invoked. This demo is silent. If manually checking editable-focus behavior, use only a harmless temporary string and never submit AI, voice, scenario, analyze or Google Search controls.
- Browser attachment, visual review and any checkpoint/transfer of these frozen bytes remain separate Sol/user gates.
