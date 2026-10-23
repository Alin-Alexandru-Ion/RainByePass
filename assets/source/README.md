# Original and acquired artwork provenance

`acquisition.json` preserves actual raw file URLs, retrieval timestamps, CC0 evidence, archive hashes and download outcomes for A01/A02/A06. `raw-inspection.json` records actual sizes, alpha extrema and hashes from the isolated inspection folder. That folder contains the original full downloads locally but is ignored for packaging/version control; no source build depends on it.

`selected/` preserves the ten imported Kenney flat masks, five Kenney tree shapes, and the original Poly Haven diffuse map. The runtime derivatives and exact transformation/hash records are in `../asset-manifest.json`. Contributors can build offline directly from checked-in runtime assets. The selected originals also allow repeatable derivatives without reacquiring entire packs.

A01: WickedInsignia alpha cloud pack was acquired, visually reviewed on blue/orange/night backgrounds, then rejected for this initial fair-weather composition because its dark/diffuse shapes look smoky. It is not shipped or credited as runtime artwork. No watermark removal was performed.

Original clouds, gradients, sun/moon disks, stars, branches, terrain and scalable frame geometry are authored in `src/renderer/scene.ts` and `src/renderer/regional-landscapes.ts`, not downloaded imagery. The original work is MIT licensed; final visual style remains provisional. A02/A06/A11 are approved as initial ingredients, not a claim that final integrated artwork has been approved by the owner.

Location reference: bundled IANA `reference/zone1970.tab` is public-domain representative-zone data, not exact personal geolocation. Hamburg's approximate 53.55 N, 10.00 E preset follows the stated city coordinates in *Plants in urban environments*, section 4.2.1, Max Planck repository: https://pure.mpg.de/rest/items/item_2243358_1/component/file_2243357/content . Other city-labelled zone presets come from IANA; Tromsø is a clearly labelled approximate polar test example. Runtime uses IANA rules supplied by Chromium/Intl.
