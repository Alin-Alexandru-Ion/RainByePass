# RainByePass implementation and actual verification

> Historical v0.1.0 implementation and artwork-acquisition record. The settings-first flow, viewer gestures, celestial direction/scale, rendering policy and current test results have been superseded by v0.2.0. Read [VIEWER_RESOURCE_REPORT.md](VIEWER_RESOURCE_REPORT.md) and the current README for those results. The older CPU/memory samples below describe the earlier renderer. Its pending-license statements are historical; the current original-work license is [MIT](LICENSE).

Recorded 14 October 2026, Europe/Berlin. This is a runnable unpublished implementation, with provisional illustrative artwork. It is not a public-release signoff.

## Delivered

The project was created in its own `RainByePass` folder. The supplied consolidated attachment was reconstructed into a local handover folder beside the project, with the implementation brief, visual-asset plan, acceptance checklist, candidate catalogue, settings example and source register. No existing RainByePass implementation or applicable AGENTS.md was found. Other projects in the workspace were preserved.

Implemented a frameless Electron window, secondary-monitor selection, fullscreen, recoverable accessible settings, and a local layered animated scene. It includes offline seasonal SunCalc daylight, selected-zone formatting, approximate location presets/coordinate overrides, held manual moods, independent celestial visibility, all nine layer switches, all four independent motion preferences, frozen simulation/pose parameters, manual overrides/comfort bounds, 24 original cloud variants with recent-history exclusion, four outlooks, four frame materials/crossbars, foliage pivots, and a reduced-resolution occlusion-aware ray pass. Static frames and stopped layers are cached. Every layer can be off while controls remain available.

The optional main-process MET adapter includes one shared location-keyed cache, covered-timeline interpolation, approximately weekly refresh, explicit opt-in and genuine contact-URL gating, HTTPS, four-decimal coordinates, body/time limits, cancellation, HTTP expiry/conditional 304 handling, persistent throttling/backoff, no-store handling, and manual fallback. Forecasts do not drive precipitation/cloud coverage/sky darkness. There is no fabricated public project/contact URL and no live MET request was made.

Validated settings are serialized atomically under Electron userData, with known v0 migration and corruption backup/recovery. The renderer has context isolation, Node integration off, sandboxing, a production CSP, local-asset path restrictions, navigation/window blocking, and a narrow sender-validated preload bridge. No account, service, startup entry, telemetry, publishing or display-setting mutation was introduced.

Canvas2D was used instead of the recommended PixiJS stack. Electron and SunCalc were agreed requirements; PixiJS was explicitly an adjustable recommendation. This implementation uses local cached geometry/masks and no runtime CDN or development server. It does not claim Pixi/WebGL benchmark or context-loss verification.

## Exact toolchain

| Component | Version |
|---|---|
| Electron | 44.7.2 |
| SunCalc | 2.1.1, installed degree-based API and null events verified |
| TypeScript | 5.9.3 |
| esbuild | 0.28.1, including the tsx override |
| tsx | 4.21.0 |
| Electron Packager | 20.3.0 |
| Host Node / npm | 24.12.0 / 11.12.1 |
| Packaged Node / Chromium | 24.21.0 / 152.0.7977.149 |

`package-lock.json` pins the resolved dependencies. The final online npm advisory check reported zero vulnerabilities. An earlier stale nested esbuild dependency was resolved by recreating only this project's generated dependencies/lockfile. `npm ls esbuild` then showed the patched version deduplicated.

## Commands actually run

| Command/check | Actual result |
|---|---|
| `npm install`, explicit `node node_modules/electron/install.js` | Passed; development dependencies/runtime installed |
| `npm run typecheck` | Passed on final source |
| `npm test` | **102 passed, 0 failed, 0 skipped** on Windows host |
| `npm run build` | Passed; local main/preload/renderer/assets output |
| `npm run smoke` | Development Electron launched; 29 behavior checks passed, no final runtime errors |
| `npm run package` | Passed; unsigned Windows x64 asar package produced |
| Packaged `--smoke-test` | Real package launched; five 20-second performance samples and responsive captures; exit **0** |
| Final packaged `--smoke-test --quick-smoke` | **29 passed, 0 failed**; no runtime errors; exit **0**, plus keyboard/minimize/monitor checks below |
| Packaged `--exit-test` | Normal renderer close and final unsaved-setting flush passed; exit **0** |
| `npm run notices` | Generated imported-art and dependency notices; SunCalc notice preserved verbatim |
| `npm audit --json` | **0 advisories** at the recorded check |
| `Get-AuthenticodeSignature` | `NotSigned` |
| asar inventory inspection | Local runtime textures, HTML, main/preload and notices present; raw acquisition archives excluded |

The initial sandbox Electron launch returned exit 1 without useful diagnostics. Sandbox persistence tests failed on temporary-file renames with EPERM, causing a secondary cache-restart failure. The same tests passed on the Windows host. An early smoke harness mistakenly counted its intentional CSP-blocked request as an error; the corrected harness records that probe separately. These initial failures were not presented as app successes.

## Behavior and acceptance evidence

| Handover area | Result and practical limit |
|---|---|
| A: launch/offline | Pass for real development/package launch with renderer networking blocked and forecast opt-out. All scripts/assets/fonts/solar computations are local. System adapters were not physically disconnected. |
| B: responsive view | Real Electron captures at 1280×720, 2560×1440, 3840×2160, 2560×1080, 720×1280 and 520×420. Disk/glow containment additionally checked in pure tests. Both actual monitors were exercised. Different-density moves were **not run**; both connected displays are at 1×. |
| C: daylight/timezones | Unit tests pass for Hamburg winter/summer intervals, machine-zone independence, selected-local midnight/date-line cases, spring/autumn DST offsets, fractional-offset Kolkata, polar day/night, v2 degrees/null events and manual/automatic restoration. Physical sleep/resume and external-almanac comparison were **not run**. |
| D: visibility | Nine independent UI controls, separate sun/moon/stars, exactly four held manual modes, all-hidden neutral scene/control recovery, and horizon-safe sun geometry verified. Visual layer order and four moods reviewed from actual captures. Exhaustive pixel-by-pixel occlusion proof was **not run**. |
| E: motion | All 16 control combinations exercised with valid, missing and invalid wind, plus hidden components. Exhausted/wrong-location/gapped forecast handling tested separately. Renderer clock/identity freezing, semantic checkbox handlers, saved manual values, zero motion, comfort bounds and gentle thaw of paused forecast parameters verified. |
| F: clouds/foliage/rays | Source alpha review, actual scene/mood/outlook/frame captures and recent-selection exclusion tests passed. Original illustrative foliage/terrain/cloud style remains provisional. Several complete cloud crossings were **not visually reviewed**; deterministic exclusion was tested over 1,000 selections. |
| G: forecast/cache | Fake transport tests pass for shared request, restart reuse, seven-day 304, generation-vs-download timestamps, nine-day coverage exhaustion, outage/manual fallback, 429/Retry-After, persisted backoff, cancellation and no-store. Actual MET service integration is **not live-tested**, awaiting real owner identification. |
| H: assets/licensing | Three actual raw candidate downloads obtained and inspected; only A02/A06 selected ingredients imported. Raw/derivative hashes, exact URLs, dimensions, alpha, creator, review and transformations recorded. Third-party notices retained. App/original-art license and release audit remain open. |
| I: platforms/performance | Real Windows x64 development and production-path execution; short native-resolution frame-pacing/CPU/memory observations below. Linux/macOS, multi-hour soak, GPU utilization/VRAM measurement and forced context loss/recreation were **not run**. |

Final keyboard check used Electron input events at 520×420: Tab navigation reached the automatic daylight checkbox and Space toggled it. F11 entered fullscreen and Escape exited it through the actual keyboard handlers. The normal-close test changed a checkbox and immediately used the normal close button; the saved file retained that change.

In the final packaged smoke, rendering advanced **0 frames while minimized** during the measured interval, and **15 frames in 0.5 seconds while unfocused** at the 30 fps setting. Monitor requests matched both actual display IDs. Fullscreen/control recovery passed.

## Actual Windows environment and performance

Windows kernel/build 10.0.26200, x64; Intel Core i5-12600K, 16 logical CPUs, approximately 64 GiB installed-class memory. Electron identified an NVIDIA GeForce RTX 5060 Ti and reported Canvas2D/GPU compositing enabled. GPU utilization and VRAM use were not sampled.

Connected displays: HP X27q 2560×1440 at 165 Hz and Odyssey G5 2560×1440 at 120 Hz, both scale factor 1. No display settings were changed.

The optimized packaged scene used **balanced quality**, 1× actual backing density, held Day, enabled cloud/leaf motion, and the indicated ray setting. Each row sampled 20 seconds; results are measured observations on this machine, not a cross-platform guarantee.

| Logical size / mode | Target | Observed fps | Mean draw time | p95 frame interval | Rays |
|---|---:|---:|---:|---:|---|
| 1280×800 windowed | 60 | 59.99 | 1.04 ms | 18.3 ms | On |
| 1280×800 windowed | 30 | 30.02 | 1.49 ms | 36.5 ms | On |
| 1280×800 windowed | 60 | 59.95 | 0.56 ms | 18.3 ms | Off |
| 2560×1440 fullscreen | 60 | 59.99 | 1.02 ms | 18.3 ms | On |
| 2560×1440 fullscreen | 30 | 30.02 | 1.46 ms | 36.5 ms | On |

At fullscreen 60 fps the summed process CPU time was 4.86 seconds over 20.01 wall-clock seconds, roughly 24% of one CPU core (not 24% of the entire 16-thread CPU). At fullscreen 30 fps it was 3.03 CPU seconds over 20.00 seconds. Turning rays off reduced measured windowed draw time. The summed process working sets after the resize exercise were approximately 615–630 MiB; shared pages may be counted more than once. These snapshots are not a unique-RAM/VRAM figure or proof against long-term growth. Low/high quality and non-1× physical displays still need separate profiling.

Detailed observations: `evidence/final-packaged/smoke-results.json` and `evidence/verified-final/smoke-results.json`. The longer performance sample preceded the final paused-parameter/comfort guards; the same renderer and normal manual-motion path then passed the final short package recheck. PNGs include all four moods/outlooks/frames and the small-window keyboard view. `evidence/final-packaged/exit-test.json` records normal close persistence. Test profiles are separate from normal app userData.

## Artwork actually used

| Candidate | Acquisition / review | Runtime status |
|---|---|---|
| A01 WickedInsignia cloud pack | Actual 28,480,966-byte archive, ten alpha PNGs inspected against blue/orange/night backgrounds; no runtime preview substitution | **Rejected** for smoky/dark/diffuse appearance. Original temporary fair-weather cloud geometry used. |
| A02 Kenney Foliage Sprites | Actual archive acquired and safely extracted; selected flat masks reviewed for alpha/dimensions/embedded marks | Five masks imported: 30, 31, 32, 35, 38. Original branches/pivots provide motion. |
| A06 Poly Haven Wood Table / Dimitrios Savva | Actual 1024×1024 diffuse map obtained via authoritative metadata and inspected | One graded wood material imported onto original segmented frame geometry. |
| A03–A05, A07–A10 | Optional candidates remain unacquired | Not shipped or credited as runtime assets. |

The selected A02/A06 ingredients are declared CC0 by their publishers: [Kenney source](https://kenney.nl/assets/foliage-sprites), [Kenney licensing](https://kenney.nl/support), [Wood Table author/source](https://polyhaven.com/a/wood_table), [Poly Haven license](https://polyhaven.com/license). Complete project provenance is in `assets/asset-manifest.json`, with stable acquisition/inspection records and selected originals in `assets/source/`. No watermark removal, branded previews, supplier logos or bundled machine fonts were used.

## Remaining work and release gates

- Art polish and owner approval: landscapes are original illustrative geometry; rooftops/ridges remain simple, branch/leaf silhouettes need art direction, clouds are original temporary geometry after A01 rejection, rays need additional visual occlusion review, and a final project app icon/identity is unfinished. The frame material and leaf ingredients are reviewed, not a claim of final integrated-art approval.
- Live MET identification/verification remains gated. The full offline/manual/fixture behavior is available indefinitely without it.
- Complete real Linux/macOS runs, different-density monitor checks, physical sleep/resume, longer soak/GPU profiling, forced graphics recovery and more cloud-crossing visual review before calling the acceptance checklist finished.
- Confirm app/original-art license and rights holder, review name availability, finalize release notices and signing/distribution decisions before publication. This package is unsigned. Nothing was published and no final application license was chosen.

The directly runnable local executable is `releases/RainByePass-win32-x64/RainByePass.exe`. Development launch is `npm start` from this project directory.
