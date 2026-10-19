# YAM-VIS-001 local candidate

This descendant of accepted41396fa26f8e3a9b3a9e9997f64959bd8a512cc8 improves the illustrative ocean and initial ship overview. It is a local candidate pending parent acceptance, with no publication or deployment.

## Changed experience

- Overview radius352m fits the full263m hull at1450x1223 and1280x720 with margin. Inspector and optional AI panel bodies start collapsed; their normal toggles remain usable.
- The900m near-water patch has5m vertex spacing, replacing17.9m spacing. State-scaled crest colour makes Calm/Moderate/Rough differ in shading as well as the inherited shared wave parameters.
- The same water sampler still drives mesh, hull and foam. Wave detail is unchanged within240m and smoothly fades to flat water by430m. Four flat distant quads continue the ocean to the inherited1km boundary, without overlapping the detailed patch.
- Foam uses shorter interrupted tapered runs. Bow foam follows the hull exterior, and stern runs begin aft of the hull. Each ribbon edge still samples its own surface position. This is stylised foam, not a simulated fluid or validated ship wake.
- The badge now says “1:1 Metres / Illustrative Detail”; the inspector states the historical/geometry and far-field limitations. No new historical assertion, geometry system, ammunition/interior feature, service or audio was added.

The inherited camera input listener, recoil lifecycle, reduced-motion scale0.12, AA cadence and owned-effect cleanup remain protected by the existing behavior suite.

## Focused checks

No package.json, npm scripts, lint or typecheck command exists in this repository. Use installed Node built-ins:

```sh
node --test --test-reporter=tap tests/sea-readability.test.mjs tests/demo.test.mjs tests/checkout-guard.test.mjs tests/runner-source-binding.test.mjs
git diff --check
```

The26groups pass. Three retained red-to-green increments expose cropped overview, coarse near-water geometry and long untapered foam before their corrections. Additional controlled negatives flatten crest contrast or reintroduce a long foam run and must fail. The actual runner binding/guard tests exercise its first four stages and inherited seven behavioral mutations; unchanged historical42-group replay was not rerun. The runner write envelope only adds this note and the exact new test file. Do not treat a runner-only pass as the new visual suite: run the focused command above.

## Render evidence and limits

The separately retained evidence directory contains file-bound headless Chromium151.0.7922.34 captures, real continuous WebM recordings, source hashes and requestAnimationFrame wall intervals. This uses an already installed renderer with an ephemeral context, no user browser profile/window and no preview server. Inherited Three.js/Tailwind/fonts are allowed; all other network origins are blocked. Runtime AI/TTS controls were not invoked. UI state was changed through normal DOM controls/wheel input; no private production state or source was injected. A separate timing observer records frame callbacks only.

Default captures verify both released viewport sizes. Matching sea comparisons use twelve normal wheel-down events in both sources to reach the unchanged440m clamp, Noon lighting, markers off and collapsed panels. Timing runs retain their own framing and are not a controlled GPU benchmark. Their median wall intervals were116.7ms before and133.4ms after; p95149.9ms before and166.6ms after. This is slow offscreen playback with a measured regression, not smooth desktop/FPS acceptance. Ordinary user interaction and target-device GPU performance remain unaccepted. Still images alone do not prove motion or physical realism; continuous samples are retained for parent inspection.

First baseline capture stopped at a hidden lighting-control timeout and closed its renderer; corrected control ordering succeeded. All failures and earlier accepted checkpoints are preserved. Existing runtime CDN dependencies remain unvendored, so recovery restores exact source/Git history but does not create an offline-complete runtime.

## Authorship and next owner

Existing Pi direct deepseek/deepseek-flash High returned one tools-disabled technical proposal; Sol applied it and corrected shared-sampler envelope placement, horizon continuation and hull-exterior foam placement, then wrote tests and inspected actual pixels. No new worker, model substitution or provider configuration change. High was selected; backend version/billing attribution is not independently attested. Sol's final inspection is a coordinator self-review, not an independent implementation audit. Existing parent owns acceptance of the real before/after evidence and any further performance/foam refinement.
