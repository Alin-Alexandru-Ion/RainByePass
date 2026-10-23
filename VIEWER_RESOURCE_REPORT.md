# RainByePass v0.2.0 — historical viewer and resource verification

Verified on 14 October 2026. This records the v0.2.0 build before the 17 October foliage-composition update; its memory/CPU samples must not be presented as measurements of the newer artwork. The app is runnable, unsigned and unpublished. This supersedes the v0.1.0 flow, solar direction/size and performance results in IMPLEMENTATION_REPORT.md. No productivity features were added. Its pending-license statement is historical; the current original-work license is [MIT](LICENSE).

## Delivered behavior

The app always starts as a movable settings window. Users choose a monitor and Windowed fullscreen (borderless) or Regular fullscreen, then press **Mood Boost**. A saved fullscreen choice never starts the viewer automatically. **Stop** or Escape returns to the original settings-window bounds, and **Exit** closes the app from either mode. Single click/tap toggles the overlay after a 400 ms double-tap recognition interval; double click/tap changes viewer mode without flashing the overlay. Controls, Switch mode, Stop and Exit remain visible. F11 changes mode; S toggles the overlay. Parameter controls retain all nine visibility switches and independent cloud/sway/forecast preferences, with separate motion sliders and optional twinkle speed.

Sunrise/solar noon/sunset determine a stylistic right/east-to-left/west arch. The disk is largest at the central crest. Entry and exit extend below the viewport, with horizon/landscape clipping as it rises and sets. The moon uses the same arch during sunset to next sunrise. Its position is artistic, not a physical lunar ephemeris. Palette, stars and darkness blend through twilight. Four held manual moods remain available, with safe polar fallback.

Regular fullscreen is Electron's operating-system fullscreen, **not DXGI exclusive fullscreen**. Electron exposes `setFullScreen`; true exclusive display ownership is not implemented. See the [official BrowserWindow documentation](https://www.electronjs.org/docs/latest/api/browser-window).

## Efficiency changes

- Default 15 fps, 921,600 backing-pixel ceiling; optional rays and twinkle default off. The efficient-defaults button restores these choices without changing independent cloud/sway preferences. Larger budgets and 30/60 fps are selectable.
- No scene or textures are allocated before the first Mood Boost. Needed textures/cloud shapes are loaded/generated lazily. Cached layers are updated only as necessary; hidden buffers shrink to 1×1.
- A timer schedules one animation frame at the chosen rate. The app no longer polls at monitor refresh rate. Test histories are recorded only in smoke mode.
- Stop cancels render callbacks, releases scene textures and shrinks the seven canvas buffers to 1×1. No automatic forecast download runs in settings. Chromium may retain allocated memory after release; Stop is not a promise of immediate OS-memory reclamation.
- Held manual scenes with all movement off have no continuing render callbacks. Automatic static daylight updates at 1 Hz. Minimized/hidden viewers pause drawing; unfocused visible viewers continue animating.
- Low detail is deliberately softer on a large screen. At 2560×1440 it renders a 1280×720 backing canvas. Electron's process/memory baseline remains material; this is not a claim of minimum possible desktop-app memory use.

## Checks actually run

| Check | Result |
|---|---|
| TypeScript and build | Passed on final application source |
| Unit tests | **113 passed, 0 failed, 0 skipped** |
| Windows x64 package | Produced successfully; signature is NotSigned |
| Final packaged full smoke | **36 passed, 0 failed**, no renderer/runtime errors; exit 0 |
| Packaged regression after CPU-counter correction | **36 passed, 0 failed**, all native input/lifecycle checks passed; exit 0 |
| Real mouse input | Single show/hide and double switch to fullscreen/back to borderless all passed |
| Real keyboard input | Small-overlay checkbox toggle, F11 and Escape-to-settings passed |
| Monitor selection | Both real 2560×1440 displays reached correctly, including the secondary display at y=-1440 |
| Responsive captures | 1280×720, 2560×1440, 3840×2160, 2560×1080, 720×1280 and 520×420; pixel budget respected |
| Minimized/unfocused | 0 frames minimized; 15 frames during one unfocused second |
| Settings after Stop | Not fullscreen, original bounds restored, 7 buffer pixels, 0 texture pixels, 0 continuing frames |
| Settings Exit / viewer Exit | Both normal close paths passed, including final preference persistence; exit 0 each |
| Touch/pen | Gesture logic passed fake-timer unit tests; physical hardware not tested |

Captures include settings startup/Stop, four moods, eight solar/night-arch times and the small overlay. Initial screenshot capture required waiting for the first compositor frame; the harness retries capture. A responsive-test issue caused fixed-size Windows bounds to reject shrinking; the harness now enables resizing during its viewport exercise, and native transitions enable resizing before setting the target monitor bounds.

## Measured resource use

Final package, seven 20-second samples, Intel i5-12600K / 16 logical CPUs, RTX 5060 Ti, Windows 10.0.26200. Both connected 2560×1440 displays use 1× scaling. Animated samples use both cloud movement and leaf sway, held Day, native 2560×1440 viewport and the efficient pixel budget. These are short observations, not a long-duration hardware benchmark.

| State | CPU: one core | Frames in 20 s | Observed fps | Mean draw ms | Summed working set MiB | Summed private bytes MiB |
|---|---:|---:|---:|---:|---:|---:|
| Settings before Mood Boost | unavailable* | 0 | — | — | 333.8 | 236.5 |
| 15 fps, rays off | 6.20% | 300 | 14.99 | 0.59 | 416.6 | 298.7 |
| 15 fps, rays on | 6.72% | 300 | 15.00 | 1.23 | 418.0 | 287.0 |
| 30 fps, rays off | 11.44% | 600 | 30.00 | 0.57 | 417.5 | 280.7 |
| 60 fps, rays off | 21.64% | 1201 | 60.02 | 0.57 | 417.7 | 280.2 |
| Held manual, all movement off | 0.17% | 0 | — | — | 394.8 | 263.0 |
| Settings after Stop | 0.12% | 0 | — | — | 417.3 | 368.6 |

CPU is calculated from the cumulative CPU-time delta across the app's processes. 6.20% of one core is about **0.39% of total capacity** across 16 logical CPUs. Working-set sums include shared pages and are not unique physical RAM or VRAM; private bytes measure process-private committed memory rather than resident RAM. No GPU utilization or VRAM measurement was performed. The retained memory after Stop is recorded explicitly.

*The startup cumulative counter decreased during sampling, producing an invalid negative delta in the original raw result. That sample is unavailable, not negative CPU or zero CPU. The harness was subsequently corrected to flag a counter reset and emit null rather than a misleading percentage. This evidence-only correction does not change the application or the resource measurements above.

Raw evidence: `evidence/viewer-v2-final/smoke-results.json`, screenshots in the same directory, and `exit-test.json` / `viewer-exit-test.json`. The corrected harness's 2.5-second regression is in `viewer-v2-regression`; startup CPU in that shorter run was 0.21% of one core. Earlier development and packaged evidence remains in `viewer-v2-quick` and `viewer-v2-packaged`. The final normal app does not expose renderer fixture hooks. GPU inventory identifies the installed RTX card, but an active hardware-rendering backend was not established from that inventory; no GPU-acceleration performance claim is made.

## Remaining limits

Only **Windows x64** was genuinely executed. Linux/macOS, real mixed-density monitor moves, physical touch/pen input, unplugged monitors, sleep/resume, multi-hour soak and forced graphics-context restoration remain untested. No live MET provider request was made; opt-in/contact identity remains required and network/cache behavior has fake-transport coverage.

Illustrative scenery, clouds, branches and lighting remain provisional original geometry. Previously acquired and visually reviewed Kenney foliage masks and Poly Haven wood are retained, with their CC0 licenses/provenance in assets/asset-manifest.json and THIRD_PARTY_ASSETS.md. No new unreviewed artwork was imported. The original application/artwork license is pending the owner's choice; no publication or license finalization occurred.
