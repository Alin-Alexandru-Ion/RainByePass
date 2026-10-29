# Regional landscape additions

Added locally in v0.4.0. The five new **Distant view** choices are illustrative scenes, not exact depictions of particular landmarks or exhaustive representations of the named regions.

| Choice | Scene ingredients |
|---|---|
| American mountains | Layered peaks and snow caps, evergreen treeline, green foothills and a pine foreground branch |
| Arabian desert | Four softly layered dune bands, subtle sand crests, stones and sparse arid brush |
| Irish lake | Cool hills, a small wooded island, blue-green lake, ripples, grassy banks and reeds |
| Japanese ocean | Open water, distant coastal ridges, shore headland, wave lines and a pine foreground branch |
| Latin American badlands | Flat-topped eroded mesas, colored strata, low ridges, an arid wash and sparse scrub |

The Latin American choice follows the owner's **arid badlands** preference. All five are drawn with original local Canvas2D geometry in `src/renderer/regional-landscapes.ts`. Irish lake uses the already inspected Kenney tree shapes, and American mountains and Irish lake reuse already inspected grass masks; their CC0 provenance remains in `assets/asset-manifest.json` and `ARTWORK_COMPOSITION.md`. No new third-party asset was acquired or imported for this addition.

Landscapes share the existing sun, moon, sky, stars, clouds, window frame and solar schedule. Selecting a distant view never changes coordinates or time zone. **Distant view** hides all terrain for every choice; **Nearby tree** independently hides the contextual foreground branch. The existing motion, ray and layer controls still apply. Terrain is deterministic and cached; it is regenerated on size, style or meaningful lighting changes, rather than every animation frame. The viewer still starts only after **Mood Boost** and releases canvases on **Stop**.

Tree roots in the American mountains now follow the actual piecewise ridge profile, and the Irish island trees follow its sloped shoreline. Both terrain fills cover the embedded trunk ends. Meadow forest trees use the same hill-height function as the grass and hill polygon; the distant row sits behind the hill and the nearer row meets its visible edge. These placement changes do not add per-frame work.

These are provisional stylized compositions. The Irish lake and Japanese ocean have subtle animated wave strokes drawn over the cached landscape. Arabian desert and Latin American badlands have original curved dust paths. Only a 15% segment of each path is visible at once: after a brief blank interval it travels from 0–15% to 85–100% of the curl in 1.5 seconds at speed 3. The independent 1.5–6 speed slider scales that time; each curl is staggered. Water and dust have separate movement switches and stop when their scene is hidden or their switch is off. Neither uses an extra full-screen canvas, downloaded art, simulation, or audio. Original procedural scenery is MIT licensed by Alin-Alexandru Ion; reused Kenney ingredients retain their CC0 provenance. Final visual art direction remains open.

## Windows resource and visual check

The following historical packaged Windows x64 smoke run predates moving water and the branch revision. It captured all five views in both day and night, passed 36/36 core checks, and reported no renderer errors. Its five regional samples ran at the default 15 fps for 5 seconds each on an i5-12600K with two 2560×1440 displays. CPU is summed across Electron processes as a percentage of one logical core; memory is summed working set at the end of each sample.

| View | Frames in 5 seconds | One-core CPU | Working set |
|---|---:|---:|---:|
| American mountains | 75 | 10.85% | 474 MiB |
| Arabian desert | 75 | 5.08% | 467 MiB |
| Irish lake | 75 | 6.09% | 462 MiB |
| Japanese ocean | 76 | 6.10% | 418 MiB |
| Latin American badlands | 75 | 4.15% | 418 MiB |

The mountain sample began while the scene was still blending from a night mood to day and includes terrain recoloring during that transition, so it is not a steady-state mountain-only CPU figure. The same full run measured the restored meadow at 6.38% of one core and about 418 MiB over 20 seconds at 15 fps; Stop left zero continuing frames. The new landscapes remain cached, but Electron's roughly 418–474 MiB observed working set is still a material memory cost. The detailed results and captured PNGs are in `evidence/landscapes-v4-release/`. A separate final quick packaged run checks the render timing and captures in `evidence/landscapes-v4-verified/`. No Linux or macOS runtime check was performed.

## v0.5.0 desktop check, 29 October 2026

The updated development app passed 40/40 in-app checks, pointer/keyboard/fullscreen checks, and ten day/night regional captures with no renderer errors on Windows x64. Water phase advanced on Irish lake and froze when its movement switch was off; hiding the distant view also removes its frame demand. A short 2.5-second sample at the default 15 fps recorded 37 frames and 9.89% of one logical core for Irish lake, and 38 frames and 8.13% for Japanese ocean. Working set at the end of those samples was about 493 MiB and 491 MiB respectively, summed across Electron processes. An all-motion-off held manual scene rendered zero continuing frames. These short desktop samples are indicative only; they are not long-duration resource measurements or packaged-binary validation. Evidence is local in the ignored `.tmp/smoke-v0.5-final/` directory. Linux, macOS, and integrated-GPU behavior remain untested.

The fresh offline Windows x64 package also passed 40/40 in-app checks with ten regional captures and zero recorded renderer errors. Its short lake/ocean samples used 11.91%/9.57% of one logical core and ended at about 471/469 MiB summed working set; the all-motion-off manual scene rendered zero continuing frames. Evidence is local in `.tmp/packaged-v0.5-smoke/`. These short samples are indicative, not long-duration resource measurements. Linux, macOS, and integrated-GPU behavior remain untested.
