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

These are provisional stylized compositions. Water has decorative static ripples, not an animated simulation; no new continuous rendering or audio was added. Original procedural scenery is MIT licensed by Alin-Alexandru Ion; reused Kenney ingredients retain their CC0 provenance. Final visual art direction and publication remain open decisions.

## Windows resource and visual check

The full packaged Windows x64 smoke run captured all five views in both day and night, passed 36/36 core checks, and reported no renderer errors. Its five regional samples ran at the default 15 fps for 5 seconds each on an i5-12600K with two 2560×1440 displays. CPU is summed across Electron processes as a percentage of one logical core; memory is summed working set at the end of each sample.

| View | Frames in 5 seconds | One-core CPU | Working set |
|---|---:|---:|---:|
| American mountains | 75 | 10.85% | 474 MiB |
| Arabian desert | 75 | 5.08% | 467 MiB |
| Irish lake | 75 | 6.09% | 462 MiB |
| Japanese ocean | 76 | 6.10% | 418 MiB |
| Latin American badlands | 75 | 4.15% | 418 MiB |

The mountain sample began while the scene was still blending from a night mood to day and includes terrain recoloring during that transition, so it is not a steady-state mountain-only CPU figure. The same full run measured the restored meadow at 6.38% of one core and about 418 MiB over 20 seconds at 15 fps; Stop left zero continuing frames. The new landscapes remain cached, but Electron's roughly 418–474 MiB observed working set is still a material memory cost. The detailed results and captured PNGs are in `evidence/landscapes-v4-release/`. A separate final quick packaged run checks the render timing and captures in `evidence/landscapes-v4-verified/`. No Linux or macOS runtime check was performed.
