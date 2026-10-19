# YAM-UI-003: ship-first HUD layout

This local descendant preserves acceptedbc4c20b38e8b674436a270248d9f382dacb73f31 and fixes the header/panel overlap. It changes layout/accessibility and the coupled narrow overview pose; no services, historical content, renderer, water, recoil or input cadence were replaced.

## What changed

The identity/telemetry header wraps without hiding its marker and AI-panel controls below a breakpoint. A measured dock starts below the actual header and ends above the actual footer. ResizeObserver handles font/layout changes; viewport resize remeasures. There is no new animation-frame polling. The ship explorer comes first in document order; optional AI comms has a quieter collapsed heading. Expanded bodies scroll within bounded panels, including when both are open. Existing disclosure/AI visibility click handlers remain unchanged.

Native disclosure buttons expose aria-expanded/controls and accurate expand/collapse names. Focus outlines are visible; toolbar and preset controls remain reachable. Preset focus explicitly reveals a partially clipped button, because native Chrome focus left the last button partly outside at1280px. Normal text in the changed HUD regions is at least12px, with opaque panel surfaces and clearer placeholders. Turret/elevation fields and AI text fields gain programmatic labels without changing their handlers or access.

Desktop overview remains352m. Portrait/near-square overview turns longitudinally and chooses a radius within the inherited440mzoom limit from the hull bounds; other authored station poses remain unchanged. The active station is tracked so a viewport resize refits only the overview. Expanding panels does not move the camera. Default world markers remain enabled and can still crowd the narrow scene; that separate issue is not claimed fixed.

## Verification

```sh
node --test --test-reporter=tap tests/ui-layout.test.mjs tests/water-performance.test.mjs tests/sea-readability.test.mjs tests/demo.test.mjs tests/checkout-guard.test.mjs tests/runner-source-binding.test.mjs
git diff --check
```

31source groups pass. The new test executes actual overview selection and independently projects the hull corners at1450x1223,1280x720,768x1024and390x844; the unchanged narrow pose failed before correction. Prior water/recoil/input/AA/scope/binding tests and meaningful mutations remain intact. No package/npm/lint/typecheck scripts exist. The unchanged42historical groups were not rerun.

The separate source-bound offscreen checker passes88geometry/keyboard/text checks across those four viewports. Its baseline recorded29failures among72initial checks; final coverage additionally checks text contrast and both-open focus. Native Tab reaches the inspector, Space/Enter expand/collapse, final controls remain unobscured, AI visibility restores through its existing control, and the last camera button is fully revealed. Checked normal/focus HUD text is at least12px; minimum computed CSS contrast is4.829:1 including gradient endpoints. These are scoped checks, not full WCAG conformance. Lighthouse/axe tools were unavailable without installation; native screen-reader, zoom/high-contrast and desktop GPU/motion acceptance were not performed.

Actual default/expanded/both-open/focus PNGs and accessibility snapshots were captured from the literal HTML with installed headless Chromium, normal DOM controls and no private application-state/source injection. No optional scenario/send/voice/search/analyze action was activated. All contexts closed. The user browser/profile/window and preview server stayed closed. Runtime CDNs remain inherited and unvendored.

The complete demo runtime and optional API section, plus critical input/render/geometry functions, are byte-identical to the accepted base. Only initialization and overview selection are coupled to the new layout helpers. A broad diagnostic function scan stopped on an existing simple extractor limitation for escapeHtml; complete section comparisons replaced that diagnostic without weakening or editing the old harness.

Existing Pi direct DeepSeek High returned one no-tools technical proposal. Sol applied/adapted the dock/disclosure/framing idea, compact narrow rows, native footer auto-reveal and public geometry/keyboard/contrast checks. This is coordinator self-review with parent acceptance pending; it is not an independent audit. Previous sources, checkpoints and failure receipts remain preserved. No publication, push, dependency/provider/settings change or new historical claim.
