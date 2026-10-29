# RainByePass

An offline-first ambient desktop window with seasonal daylight, fair-weather clouds, gentle foliage, and a cozy frame. The source is MIT licensed; the illustrated artwork remains provisional. There is no signed or published binary release.

## Run on Windows

From this directory, with Node.js 24 or newer:

```powershell
npm ci
node node_modules/electron/install.js
npm start
```

The explicit Electron install step supports the pinned Electron package's current download mechanism. It downloads the development runtime; the running app does not download scripts/art/fonts. A packaged copy needs neither Node nor internet.

The app always opens as a regular, movable settings window. Choose a viewer monitor and either **Windowed fullscreen (borderless)** or **Regular fullscreen**, then press **Mood Boost**. A secondary monitor is selected when available. Click/tap the scene once to show or hide the settings panel and **all viewer buttons together**; double click/tap switches fullscreen modes. Single taps wait 400 ms to distinguish a double tap. **Stop** or **Escape** returns to the saved settings-window position and size. **Exit** closes the app. **F11** switches viewer modes, and **S** toggles viewer controls. The OS fullscreen mode is Electron's native fullscreen, not a DXGI exclusive display mode. No desktop wallpaper integration or productivity tools are included.

## Features

- Offline SunCalc 2.1.1 daylight with IANA timezones, approximate location presets, 312 bundled zone references, coordinate overrides, seasonal timing, and polar handling. Location setup explains the reference; no IP geolocation.
- Four held manual moods: Morning, Day, Evening, Night. The sun follows an artistic east/right-to-west/left arch, growing largest at its central crest and entering/leaving completely below the viewport. Sunrise, solar noon and sunset are seasonally timed. The independently hideable moon follows the same arch across sunset to next sunrise; its timing is artistic rather than an astronomical lunar projection. Sky colors, darkness and stars blend through twilight.
- Nine independent switches: sky, stars, sun, moon, clouds, nearby tree, outlook, frame, and rays. Time/lighting remain independent of sky visibility; sun and foliage govern ray availability.
- Four persistent independent motion switches: cloud movement, forecast-based cloud speed, leaf sway, forecast-based sway. Frozen clocks do not accumulate motion. Manual cloud and sway speeds span 1.5–6, with the former maximum of 3 at the midpoint. Forecast speed limits apply only to forecast motion, so they cannot silently cap a manual slider. Sway amplitude remains separate.
- Seeded cloud variants with shuffled selection and recent-history exclusion. Clouds are behind landscapes. Branches and leaf pivots sway independently, anchored at the edge.
- City, field, meadow and mountain outlooks, plus American mountains, Arabian desert, Irish lake, Japanese ocean, and Latin American arid badlands. The landscape choice is independent of the daylight location and each scene-layer switch. Frames, crossbars, horizon, brightness, glow and rays remain configurable.
- Irish lake and Japanese ocean have gentle moving wave strokes. Arabian desert and Latin American badlands have sparse drifting dust curls. Water and desert wind each have independent movement switches and 1.5–6 speed sliders, with 3 at the midpoint. Hiding the distant view or choosing another scene stops their motion without changing saved preferences.
- Opt-in MET wind adapter with bounded HTTPS requests, one shared atomic disk cache, weekly scheduling, conditional requests, Expires/Retry-After, persistent backoff, cancellation and covered-timeline/manual fallback. It requires a real contact URL supplied by the owner; no fabricated identifier. No real provider request was made during implementation.
- Settings are validated, atomically written under Electron's userData directory, migrated from known v0 location fields, v1 viewer preferences and v3/v4 motion defaults, and safely recovered when corrupt. Old zero cloud/sway/wave speeds become the corresponding disabled switch. Saved fullscreen preferences never launch the viewer automatically. No startup entry, service, account, analytics or display configuration changes.

## Resource use

The default render budget is **15 fps and at most 921,600 backing pixels**, regardless of display size, with optional rays and star twinkle off. The **Use efficient defaults** button restores those resource choices without altering cloud/sway preferences. Separate 30/60 fps and larger pixel budgets are available. Low detail deliberately looks softer on large screens. All motion and visibility preferences remain independent.

The renderer is created only after Mood Boost, uses timer-scheduled frames and cached layers, and creates cloud/texture resources as needed. Stop cancels drawing and releases scene/texture buffers. Water waves and dust swirls use direct strokes over cached terrain, with no added full-screen buffer. A held manual view with every movement disabled renders no continuing frames; an automatic static view updates at 1 Hz. Minimized viewers pause rendering; an unfocused second-monitor viewer keeps animating. Automatic forecast downloads stop in settings. Electron/Chromium still has a material memory baseline; historical Windows CPU, memory and frame measurements are in [REGIONAL_LANDSCAPES.md](REGIONAL_LANDSCAPES.md) and [VIEWER_RESOURCE_REPORT.md](VIEWER_RESOURCE_REPORT.md); those measurements predate the water and branch update.

## Build and check

```powershell
npm run typecheck
npm test
npm run build
npm run smoke
npm run notices
npm run package
```

`npm run package` builds a fresh, versioned **Windows x64** folder under `releases/` from the locally installed Electron runtime, without downloading another archive or overwriting an older build. Use the folder printed by the command. The earlier unversioned `RainByePass-win32-x64` folder was left incomplete by a failed Electron Packager overwrite and is marked `INCOMPLETE_BUILD.txt`; do not run it. `npm run package:electron-packager` retains the previous cross-platform packaging route, but it may download Electron and has not been verified for Linux or macOS here. The local Windows package is unsigned; no signing/publishing command is configured.

`dist/` includes all runtime assets and a strict CSP. The renderer has no Node access or remote networking; the sandboxed preload exposes specific validated operations only. Production uses local files, with no development server/CDN.

The renderer uses layered **Canvas2D** with cached/tinted masks and a reduced-resolution occlusion pass. PixiJS was a recommended implementation choice in the handover, not an agreed requirement. Canvas2D keeps the original geometry and masks inspectable with fewer dependencies; it does not establish a WebGL/Pixi benchmark or context-loss test. [VIEWER_RESOURCE_REPORT.md](VIEWER_RESOURCE_REPORT.md) covers v0.2.0; [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md) preserves the initial implementation/artwork history.

## Artwork and licensing

Source and derivative records are in [assets/asset-manifest.json](assets/asset-manifest.json); actual credits are generated in [THIRD_PARTY_ASSETS.md](THIRD_PARTY_ASSETS.md). Reviewed Kenney foliage masks (A02), Kenney tree shapes (A11), and a Poly Haven wood texture (A06) are used. Grass clumps are scattered over cached hills, several small tree shapes form a varied meadow forest, and leaf/sprig masks are composed onto the near branch. [ARTWORK_COMPOSITION.md](ARTWORK_COMPOSITION.md) records the selected shapes, license checks and visual limits. The A01 cloud pack was inspected and rejected for this scene. Sky/cloud/terrain/branch skeleton/light/frame geometry remains original. The illustrative style and final art direction need visual approval.

The five new landscapes use original Canvas2D geometry; Irish lake and American mountains also reuse the previously inspected Kenney foliage where appropriate. No new external artwork was imported. [REGIONAL_LANDSCAPES.md](REGIONAL_LANDSCAPES.md) records their visual intent, controls and current limitations.

Contributor builds use checked-in local runtime assets and do not depend on supplier download URLs. `scripts/acquire.mjs`, `inspect_assets.py` and `import_assets.py` document the optional authoring/acquisition workflow. They are not runtime/build prerequisites. The isolated raw archive inspection folder is deliberately excluded from packages.

The original application code, documentation, and procedural scenery are [MIT licensed](LICENSE), copyright 2026 Alin-Alexandru Ion. [LICENSE_DECISION.md](LICENSE_DECISION.md) records the scope. Kenney and Poly Haven ingredients remain CC0; SunCalc and other dependencies retain their own notices in [DEPENDENCY_NOTICES.md](DEPENDENCY_NOTICES.md), and optional MET Norway forecast data is CC BY 4.0. Source availability does not imply a signed or supported binary release.

The original planning handover is retained locally outside this repository. The current behavior, build instructions, artwork records, and validation limits are documented here.
