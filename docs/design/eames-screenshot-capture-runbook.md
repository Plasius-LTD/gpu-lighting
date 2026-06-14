# Eames Screenshot Capture Runbook

Use this order when validating environment-lighting screenshots.

1. Build the packages first.
   - `cd /Users/philliphounslow/plasius/gpu-renderer && npm run build`
   - `cd /Users/philliphounslow/plasius/gpu-lighting && npm run build`

2. Start the static server from the monorepo root or let the capture script
   start one.

3. Prefer attaching Playwright to an already-running WebGPU-capable Chrome over
   asking Playwright to launch fresh Chromium on macOS when browser bootstrap is
   unstable.
   - Start Chrome with remote debugging enabled.
   - Export `PLASIUS_CAPTURE_CDP_URL=http://127.0.0.1:<port>`.

4. Run the Eames capture script.
   - `node scripts/eames-environments/capture.mjs`
   - For reverse-pass analysis:
     `node scripts/eames-environments/path-debug-capture.mjs`
   - Default validation settings are deterministic unless overridden:
     `maxDepth=8`, `spp=1`, `frames=1`, `denoise=1`, `motion=0`,
     `frameIndex=777`, `probe=1`.
   - Artifacts are written to `output/playwright/eames-environments/` as
     canvas-only PNGs plus JSON metadata with black-pixel and luminance stats.

5. If a capture does not complete, read the page diagnostics before retrying a
   different browser path.
   - The validation page now exposes bootstrap step, detail, and WebGPU
     availability in `window.__plasiusCaptureState` / `window.__plasiusCaptureError`.
   - A page stuck on the initial HUD without an error means the diagnostics path
     is broken and should be fixed before more capture attempts.
   - When Playwright can navigate but cannot own a Chromium process, start
     `node gpu-lighting/scripts/eames-environments/capture-bridge-server.mjs <port>`
     and open the validation page with `captureBitmap=1` plus
     `captureUploadPath=output/playwright/eames-environments/<name>.png`. If
     the validation page is served by a plain static host, also pass
     `captureUploadUrl=http://127.0.0.1:<port>/__plasius-capture`. The page
     will freeze its own canvas and POST the PNG back to the bridge server.
