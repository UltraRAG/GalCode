# GalCode v0.1 Acceptance Checklist

This checklist defines the first usable Web-first GalCode MVP.

## Product Scope

- GalCode launches as a usable Web visual-novel app with `npm run dev`.
- The first screen is the actual VN dialogue interface, not a landing page.
- Users can create API Companion characters with API URL, API key, model, temperature, role, and system prompt.
- API Companion calls use OpenAI-compatible Chat Completions.
- Local Web API calls go through `/api/galcode/chat` to avoid browser CORS failures.
- Browser state persists through localStorage.
- Web users can choose local background and portrait image files through the browser file picker.
- The dialogue UI plays model output one or two lines at a time.
- VN controls are persistent: Back, Next, Auto, Full, History, Raw, Skip.
- Harem Mode sends one user message to all API Companions in order.
- Later Harem Mode characters can see earlier character replies.
- The visible portrait, name, and accent follow the current speaking character.
- The current session can be exported to Markdown.
- Desktop Local Bridge remains available for Codex, Claude Code, Cursor Agent, local workspace selection, local image selection, and local theme folder import.

## Runtime Checks

Run these commands from the repo root:

```bash
npm install
npm run test:smoke
npm run test:runtime
npm run typecheck
npm run build
npm audit --audit-level=critical
node -c electron/main.cjs && node -c electron/agent-runtime.cjs && node -c electron/preload.cjs
```

Expected result:

- `test:smoke` prints `smoke ok`.
- `test:runtime` prints `runtime ok`.
- `typecheck` passes.
- `build` passes and includes sample Web assets.
- `npm audit --audit-level=critical` reports no critical vulnerabilities.

Desktop bridge check:

```bash
npm run start:desktop
```

Expected result:

- Electron opens the production-style app from `dist/`.
- Local CLI agents remain desktop-only.

## Manual Web Smoke Flow

1. Launch Web with `npm run dev`.
2. Open `Menu -> Settings`.
3. Click `Add Companion`.
4. Fill API URL, API key, model, and persona.
5. Send a short message.
6. Confirm the response appears as VN pages.
7. Click `Full`, `Back`, `Next`, `History`, and `Raw`.
8. Enable `Harem Mode`.
9. Add or configure at least two API Companions.
10. Send one message and confirm characters answer sequentially.

## Known v0.1 Limits

- Hosted static-only deployments need an API proxy equivalent to the local Vite `/api/galcode/chat` route.
- API keys are stored in local state for the MVP.
- Web mode cannot scan arbitrary local folders; use Desktop Local Bridge for folder import.
- CLI agents require Desktop Local Bridge and installed local CLIs.
- Live2D, voice, BGM, cloud accounts, and server-side API proxy are future work.
