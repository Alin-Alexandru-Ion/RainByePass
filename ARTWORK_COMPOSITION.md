# RainByePass foliage composition

Reviewed and integrated 17 October 2026. This is an illustrative composition, pending the owner's final art direction.

Kenney's [Foliage Sprites](https://kenney.nl/assets/foliage-sprites) and [Foliage Pack](https://kenney.nl/assets/foliage-pack) both state CC0. The actual downloaded archives include CC0 license files, copied to `assets/licenses/Kenney-CC0.txt` and `assets/licenses/Kenney-Foliage-Pack-CC0.txt`. The Foliage Pack archive SHA-256 is `33bd564f2cebb6a68bee9a798650d669571a389a437b0bd601d257ca2b5e7aed`. Exact download URLs, selected members, original/derivative SHA-256 values, and dimensions for every shipped file are in `assets/asset-manifest.json`.

The raw selected PNGs were inspected on transparency. No watermark or branding is visible in those files. The supplier's promotional Preview and Sample images contain a Kenney logo; neither image is imported or shipped. The scene imports only these ingredients:

| Source | Selected raw pieces | Runtime role |
|---|---|---|
| Foliage Sprites A02 | `sprite_0001`, `0003`, `0005` | Three grass-blade clumps on meadow and field hills |
| Foliage Sprites A02 | `sprite_0041`, `0044` | Two small sprigs composed with the five existing leaf masks on the near branch |
| Foliage Pack A11 | `foliagePack_004`, `006`, `007`, `009`, `011` | Five tree forms reused at varied sizes, positions and directions in two meadow forest depths |

The Foliage Sprites originals are transparent 1024×1024 RGBA masks. `scripts/import_assets.py` trims and downsizes the added masks to at most 256×256 with soft alpha; the Foliage Pack trees are already small transparent RGBA PNGs (68–122 px wide and 208–287 px high) and are copied unchanged. The renderer applies daylight colors, scale and flips when composing them. Ground shapes and the large branch skeleton stay editable in `src/renderer/scene.ts`. This is a cached landscape pass: individual grass and distant trees are not redrawn for every animation frame. Turning off **Distant view** hides the hills, forest and grass together; turning off **Nearby tree** hides the near branch and its leaves/sprigs. The other independent scene controls are unchanged.

The style remains simple and intentionally illustrative. The trees are 2D source shapes rather than a photographic forest. Clouds remain original fair-weather geometry because the previously inspected A01 cloud pack was too smoky and diffuse for this scene. Original app code and procedural scenery are MIT licensed by Alin-Alexandru Ion; imported ingredients retain their CC0 provenance. This local app is unsigned and unpublished.

## Resource check on the new foliage scene

The packaged Windows x64 build was run on an i5-12600K desktop with two 2560×1440 displays. The sustained smoke test sampled each setting for 20 seconds, including the fully composed scene at 2560×1440. CPU percentages below are fractions of one logical core, summed across Electron processes; memory is their summed working set. Raw measurements and scene captures are in `evidence/foliage-v3-sustained/smoke-results.json` and its neighboring PNG files.

| Mode | Observed frames/s | One-core CPU | Working set after sample |
|---|---:|---:|---:|
| Settings before Mood Boost | 0 | 0.10% | 321 MiB |
| 15 fps, rays off | 14.99 | 5.42% | 414 MiB |
| 15 fps, rays on | 15.00 | 5.94% | 415 MiB |
| 30 fps, rays off | 30.00 | 9.76% | 414 MiB |
| 60 fps, rays off | 60.02 | 18.45% | 414 MiB |
| Held manual scene, all movement off | 0 | 0.15% | 388 MiB |
| Settings after Stop | 0 | 0.11% | 406 MiB |

The smoke test passed 36/36 checks with no renderer errors, and confirmed that a genuinely unfocused viewer kept animating. Stop released the scene's render and texture buffers. The operating system retained some Electron working set after Stop, so these numbers do not imply an empty process or low total RAM use. This remains an Electron application; the default 15 fps setting prioritizes low CPU use, but the roughly 414 MiB viewer working set is a real limitation for a strict memory budget. Only Windows x64 was run here; no Linux, macOS, or integrated-GPU runtime measurement was made. The package excludes raw selected and duplicate runtime art; the project retains the editable source and license records.
