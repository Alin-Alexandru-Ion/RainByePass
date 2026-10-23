# Reproducible local evidence

`npm run smoke` runs the real Electron app, with a separate temporary profile under this directory. It exercises settings, renderer isolation, independent controls, offline renderer policy, resizes, manual moods, fullscreen, minimizing, and short frame-pacing measurements. It captures PNGs and `smoke-results.json`. The smoke renderer exposes its private fixture hooks only when launched with `--smoke-test`.

Packaged smoke execution uses `RAIN_EVIDENCE_DIR` to keep its profile/evidence outside the asar archive. No MET request is made in this harness. All network influence tests use an injected fake transport. A blocked CSP probe is expected and excluded from runtime errors.

Development captures and profiles are excluded from packages/version control. See `VIEWER_RESOURCE_REPORT.md` for current results and limits; `IMPLEMENTATION_REPORT.md` retains earlier v0.1.0 measurements. Automated resizing is not equivalent to testing real mixed-density monitor moves, and a short profiling run is not a long-duration hardware soak.

The v0.2.0 harness measures startup settings, four animated configurations, a static held scene and settings after Stop for 20 seconds each. `--quick-smoke` reduces these samples to 2.5 seconds for regression checking. Real mouse input exercises single/double gestures; keyboard input exercises the small overlay, F11 and Escape. Sun/moon event captures use fixture timestamps. `--exit-test` checks settings Exit and `--viewer-exit-test` checks viewer Exit, both through the actual saved-close path. Each uses an isolated profile. Production builds expose no renderer test hooks.
