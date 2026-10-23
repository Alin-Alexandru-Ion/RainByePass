# License decision: MIT

Alin-Alexandru Ion confirmed MIT for RainByePass's original work and supplied the copyright-holder name. The root [LICENSE](LICENSE) contains the standard MIT terms with `Copyright (c) 2026 Alin-Alexandru Ion`; `package.json` declares `MIT`. This covers original application source, documentation, and procedural scenery authored for this project, including `src/renderer/scene.ts` and `src/renderer/regional-landscapes.ts`. The MIT notice must remain in copies or substantial portions.

MIT permits use, modification, sharing, and commercial distribution without requiring downstream changes to be published. It does not replace the terms or provenance of imported resources. The package remains `private: true` to prevent accidental npm registry publication; this setting does not limit the MIT permissions or public GitHub source access.

## Scope and third-party material

| Material | Terms and treatment |
| --- | --- |
| RainByePass original code, documentation, and procedural scenery | MIT; copyright Alin-Alexandru Ion, 2026. |
| Kenney foliage and tree sprites, raw selected assets and derivatives | CC0-1.0; keep source and transformation records in `assets/asset-manifest.json` and `THIRD_PARTY_ASSETS.md`. |
| Poly Haven wood texture and derivative | CC0-1.0; keep its source and transformation records in the same files. |
| SunCalc 2.1.1 | BSD-2-Clause; preserve its upstream copyright, conditions, and disclaimer in source and distributed package notices. |
| Electron/Chromium and other dependencies | Their respective upstream terms; keep notices with distributed packages and finish the dependency notice audit before release. |
| Optional MET Norway forecast data | CC BY 4.0, separate from the app; provide MET Norway credit, license link, and required change indication for displayed or redistributed data. API use also requires a genuine contact/project URL. |

The [artwork manifest](assets/asset-manifest.json) identifies every imported runtime file, including original and derivative hashes and acquisition details. [THIRD_PARTY_ASSETS.md](THIRD_PARTY_ASSETS.md) lists artwork credits; [DEPENDENCY_NOTICES.md](DEPENDENCY_NOTICES.md) lists dependency licenses and notice files. The root MIT license does not assert exclusive ownership of the CC0 ingredients. Keep these records with source distributions and the applicable notices with binary distributions.

## Remaining binary-release decisions

License selection is complete. A source repository can be public while the app's binary release remains pending. Before distributing a binary, finish the dependency/asset notice audit, decide on final visual direction and signing, and verify each supported platform. A genuine MET contact/project URL is needed only to enable that optional service. Name/trademark review remains a separate owner decision.
