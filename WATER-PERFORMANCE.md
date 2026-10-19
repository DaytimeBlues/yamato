# YAM-VIS-002 water update cost

This performance correction preserves the reviewed7fe4a574visual candidate. It supplements VISUAL-READABILITY.md's earlier measurements; that note remains the historical source of the sea/readability change.

## Correction

The canonical point sampler and dense grid use one cached set of wave coefficients. Each grid caches spatial sin/cos terms and the distance envelope for its current frozen sea preset. A steady frame needs six temporal trig calls rather than294849vertex-scaled calls. Preset changes rebuild the bounded current kernel. The cached field agrees with the canonical sampler within1e-6m;54retained values from the reviewed source preserve the canonical equation within1e-12. Beyond1e6seconds the grid uses the canonical point path to avoid large-phase addition precision drift and preserve finite-input behaviour.

Position, normal and colour attributes now share their typed update buffers. Dirty versions still advance for all three live buffers. Colours are normalized Uint8RGB:98283bytes/frame instead of393132floatRGBbytes. Relative crest contrast remains; maximum measured normalized channel difference against the reviewed field is0.001961, below1/255. Static far-water colours refresh only on a sea-state change. No mesh resolution, water amplitude, hull response, camera, renderer, shadow, DPR, clock or input change was used to manufacture a speedup.

## Measurements

Sequential actual-source CPU trials A/B/B/A, identical900m/180segment32761vertex grid, three states,12warmup+90measured frames/state:

| State | Reviewed median range(ms) | Corrected median range(ms) | Reduction of mean medians |
| --- | --- | --- | --- |
| Calm |76.52–76.64|22.16–22.68|70.7%|
| Moderate |78.12–78.68|23.36–23.92|69.8%|
| Rough |78.27–79.94|23.01–23.38|70.7%|

These NodeVM timings isolate actual production water code with Three/DOM boundary doubles; they are not rendering or FPS measurements. Cold kernel construction is recorded separately, and the current kernel uses seven Float32arrays(about0.9MB), replaced on a preset change.

Sequential fixed-camera headless profiles A/B/B/A used1450x1223,DPR1,Noon,Rough,markersoff,collapsed panels,normal wheel input to the unchanged440mclamp,10seconds warmup and15seconds measurement with video encoding off. Chrome CPU sampling estimates water-function self time at7.51–8.19ms/observed frame before and1.46–1.55ms after. This is approximate sampling, not an exact direct function timer. Whole-frame medians were116.7ms in all four trials; p95was about133.3–133.4ms. The queried renderer was ANGLE/Vulkan SwiftShader software rendering. Desktop GPU performance remains unverified and no FPS gain is claimed.

Initial overlapping Node/browser diagnostics were preserved but their wall timings excluded. Continuous same-camera sea/reduced-motion clips were captured separately, so video overhead does not enter the controlled timing trials. Source hashes, CPU profiles, intervals, network/page errors and cleanup receipts are retained outside the source checkpoint. Runtime CDN response bytes are not vendored.

## Checks

```sh
node --test --test-reporter=tap tests/water-performance.test.mjs tests/sea-readability.test.mjs tests/demo.test.mjs tests/checkout-guard.test.mjs tests/runner-source-binding.test.mjs
git diff --check
```

30groups pass. Meaningful red/green increments expose repeated spatial work and float/repeated-horizon uploads. Four actual-source negatives detect forced per-frame cache rebuild, stale sea kernel, unnormalized byte colour and missing normal dirty update. All98283tested grid vertices across three states agree with the canonical field; state transitions, extreme finite times, invalid/zero time, normalized byte storage and dirty versions are checked. Existing sea/readability,recoil,crew,input,AA,scope,binding and seven inherited mutation guards remain exercised. Historical42-group replay is unchanged and was not rerun. No package/npm/lint/typecheck scripts exist.

## Disposition

Measured water CPU/upload cost is reduced while actual captured sea appearance, shared field, foam and reduced-motion behaviour remain preserved within the stated precision. Sol applied the existing Pi direct DeepSeek High proposal, added the large-phase fallback and independent numeric/state/renderer-boundary checks, and inspected actual before/after pixels. This is coordinator self-review; parent acceptance remains pending. Full simulator quality, inherited panel overlap/stylised foam and ordinary desktop performance remain open. No new dependencies, optional AI/TTS call, user browser/window/server, deployment or push.
