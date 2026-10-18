# Yamato reviewed source import

The current simulation entry is copied byte-for-byte from reviewed local commit `732fa38a94edcb5326b5def8526693c054b5d56d` (original tree `9bed8bf82f61ed704014e4b9e0ae45aa9d97ff29`). The entry HTML is 161,488 bytes, SHA-256 `f59f4c1d3cdb0ad691b4a9c20dc65cdef4774489e2837b39e81031999545e61d`.

All 93 reviewed project files are included. Ninety files are unchanged. Exactly three private Library checkpoint identifiers, in three recovery metadata files, are replaced with the literal `PRIVATE_CHECKPOINT_REFERENCE`. No simulation, test or dependency bytes are changed. `IMPORT_MANIFEST.json` lists the complete original/import file hashes and substitutions. The original seven-commit recovery history is preserved privately in a verified self-contained bundle. This GitHub import has its own commit identity; it does not recreate that original branch ancestry.

## Run and check

Serve this directory using an ordinary local HTTP server, for example `python3 -m http.server 8000`, then open `/src/ijn_battleship_yamato_1_1_scale_3d_simulation.html` in a browser with working WebGL. Existing Three.js r128, Tailwind CDN and Google Fonts remain external runtime dependencies. No package installation is needed for the source tests: run `node tools/run_aa_regressions.mjs`. The inherited optional Gemini key is empty; no key is needed for the visual simulation. Do not place private API credentials into public source.

## Evidence boundaries

The reviewed source-level checks cover AA scheduling, geometry/resource disposal, input ownership and camera cadence using dependency-free doubles and meaningful negative controls. Actual hull/deck rendering and an ordinary camera/AA/salvo browser journey still need acceptance in a working WebGL environment. This import makes no browser/GPU, performance, device or complete-offline claim.

The existing README and recovery receipts are historical project records. Their older slice descriptions, source hashes and permissions do not override this import manifest or establish current rendered acceptance. Source recovery began with the supplied recovered HTML; earlier historical Git identity was not established. Geometry/textures are procedural, with no imported external models/art added. Original authorship/licensing remains inherited and was not independently established; no new source or asset licence is granted here.

No deployment, GitHub Pages or workflow setup is performed by this source import.
