# GalCode v0.2 Acceptance Checklist

This checklist defines the pure API galgame MVP.

## Product Scope

- GalCode launches as a usable Web visual-novel app with `npm run dev`.
- The first screen lets the user generate, regenerate, and enter a story.
- Users can configure reusable model configs with API URL, API key, model, and temperature.
- Users can configure a Director Agent with a selected model config and director prompt.
- Users can configure heroine characters with a selected model config, identity, portrait, accent, and system prompt.
- Chat calls use OpenAI-compatible Chat Completions.
- Local Web API calls go through `/api/galcode/chat` to avoid browser CORS failures.
- Browser state persists through localStorage.
- Web users can choose local background and portrait image files through the browser file picker.
- The dialogue UI plays model output one or two lines at a time.
- VN controls are persistent: Back, Next, Auto, Full, History, Raw, Skip.
- Harem Mode sends one user message to all heroines in order.
- Later Harem Mode heroines can see earlier heroine replies.
- User lines and narration show only the background.
- Single heroine lines show only the current speaking heroine.
- Multi-heroine turns show all participating heroines with the current speaker highlighted.
- The director silently updates story state after each completed user turn.
- The current session can be exported to Markdown.

## Runtime Checks

Run these commands from the repo root:

```bash
npm install
npm run test:smoke
npm run test:runtime
npm run typecheck
npm run build
npm audit --audit-level=critical
node -c electron/main.cjs && node -c electron/preload.cjs && node -c electron/agent-runtime.cjs
```

Expected result:

- `test:smoke` prints `smoke ok`.
- `test:runtime` prints `runtime ok`.
- `typecheck` passes.
- `build` passes and includes sample Web assets.
- `npm audit --audit-level=critical` reports no critical vulnerabilities.

## Manual Web Smoke Flow

1. Launch Web with `npm run dev`.
2. Open `Settings`.
3. Fill one model config with API URL, API key, and model.
4. Select that model config for the Director Agent.
5. Select a model config and persona for at least one heroine.
6. Return to the story gate and generate a story.
7. Click `进入剧情`.
8. Confirm the opening story appears as VN pages with no heroine portrait.
9. Send a short message.
10. Confirm the user line shows only the background and the response shows the speaking heroine.
11. Click `Full`, `Back`, `Next`, `History`, `Raw`, and `Skip`.
12. Enable `后宫模式`.
13. Configure at least two heroines, send one message, and confirm they answer sequentially with participating portraits on stage.

## Known v0.2 Limits

- Hosted static-only deployments need an API proxy equivalent to the local Vite `/api/galcode/chat` route.
- API keys are stored in local state for the MVP.
- Live2D, voice, BGM, cloud accounts, and server-side API vaulting are future work.
