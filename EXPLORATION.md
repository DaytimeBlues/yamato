# Landmark discovery and exploration evidence

The accepted UI-003 source is the base for this slice. A native **Explore ship** picker exposes all eight authored views and their existing educational descriptions. The selected name wraps in the footer, outside the narrow vessel view. At widths below 900 CSS pixels, floating labels yield to this stable discovery surface. The label toggle controls the selected footer label and wide-screen callouts; the picker and existing preset buttons remain available when labels are off.

Wide-screen callouts are native buttons. A pure rectangle policy gives keyboard focus and selection priority, clips to measured header/footer rails, and culls collisions with other labels and visible panels. All culled landmarks remain in the picker. Label sizes and panel obstacles are measured on layout changes and font readiness, never each animation frame. If a focused callout becomes unavailable, focus returns to the stable picker. Camera presets expose the selected view programmatically.

The camera-help disclosure states the implemented mappings: mouse orbit/pan/wheel zoom, one-finger touch orbit, two-finger pinch zoom, and WASD free-camera translation without collision. It explicitly states that touch pan is unsupported. These instructions do not imply physical touch testing or a collision-aware deck walk.

The production camera input handlers, preset poses/selection, accepted responsive overview, water/salvo/recoil runtime, optional API section and historical station definitions remain byte-identical to UI-003. No new service, dependency, history claim, crew, interior, ammunition or authentic fire-control system is introduced.

## Focused source checks

Run from this exact Git checkout:

```powershell
node --test --test-reporter=tap tests/landmarks.test.mjs tests/ui-layout.test.mjs tests/water-performance.test.mjs tests/sea-readability.test.mjs tests/demo.test.mjs tests/checkout-guard.test.mjs tests/runner-source-binding.test.mjs
```

The four new groups execute the actual production rectangle helper. Independent fixtures check priority, spacing, panel exclusion, clipping, invalid sizes, focus and declaration order. In-memory mutants disabling collision, obstacle, clamp and priority guards must be detected. The pre-implementation source failed all four new groups because the required policy was absent; the corrected source and the 31 retained groups pass. Existing numeric recoil/queue, neutral-return, sea coupling, reduced-motion, camera/input and source-binding checks remain intact. There are no package, lint or typecheck scripts to invent.

## Actual browser evidence

The separate private review archive contains source-bound before/after PNGs at 1450x1223, 1280x720, 768x1024 and 390x844, ordinary keyboard discovery and disclosure checks, and an uninterrupted 1280x720 exploration recording. The recording uses existing station selection, mouse/keyboard camera input, real turret/elevation range inputs, two salvo-button requests, sea-state changes, manual neutral return and ordinary reload reset. Reload and manual neutral return are demonstrated recovery paths; no new in-app reset feature is claimed.

Browser evidence uses the already authorised installed ephemeral headless file route, with actual loaded entry-byte hashes compared to the frozen source. No private simulation state/clock injection, ordinary browser window/profile or preview server is used. Optional AI/scenario/search/send/voice controls and endpoints are excluded. Raw model streams and operator configuration remain private/local.

Scripted input, numeric source tests, actual rendered pictures/video and human acceptance are distinct. Exact numeric nine-barrel recoil/neutral facts come from source tests; the continuous clip supplies visual interaction evidence. Software/headless rendering does not establish native desktop GPU performance, human feel, physical touch, screen-reader or complete WCAG acceptance. The inherited historical/content limitations and original experience gaps remain separate.
