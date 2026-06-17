# GalCode v0.1 Acceptance Checklist

This checklist defines what "first usable version" means for the current GalCode MVP.

## Product Scope

- GalCode launches as an Electron desktop app.
- The first screen is the usable visual-novel coding interface, not a landing page.
- The default roster includes Codex, Claude Code, and Cursor.
- Each agent appears as a configurable heroine with a character name, accent color, command, args, and mode.
- Users can add and delete custom local agents.
- Users can send a message through the dialogue input and receive streamed output as dialogue/system lines.
- Users can inspect unmodified process output in the raw log panel.
- Users can stop a running agent process.
- Users can select a workspace folder.
- Users can import a local theme folder and auto-bind background/portrait image assets.
- Users can switch a character to the local Echo Test Agent without external accounts.
- Each run records status and output character count.
- The current session can be exported to Markdown.

## Runtime Checks

Run these commands from the repo root:

```bash
npm install
npm run doctor
npm run test:smoke
npm run test:runtime
npm run typecheck
npm run build
npm audit --audit-level=critical
node -c electron/main.cjs && node -c electron/agent-runtime.cjs && node -c electron/preload.cjs
npm run start:desktop
```

Expected result:

- `doctor` passes required checks.
- `doctor` may warn if `claude` or `cursor-agent` are not installed or not logged in.
- `test:smoke` prints `smoke ok`.
- `test:runtime` prints `runtime ok`.
- `npm audit --audit-level=critical` reports no critical vulnerabilities.
- `npm run start:desktop` opens the production-style Electron app from `dist/`.

## Manual Smoke Flow

1. Launch the app with `npm run start:desktop`.
2. Open `Quick Start`.
3. Click `Use Echo Test Agent`.
4. Send: `hello GalCode`.
5. Confirm the dialogue area shows an Echo response.
6. Confirm a run pill appears with `completed`.
7. Open `Log` and confirm raw stdout is visible.
8. Export the session and confirm the Markdown contains transcript, runs, and raw log.
9. Open `Settings`, click `Add Agent` from the rail, then confirm a custom agent can be edited.
10. Delete that custom agent and confirm default agents remain.

## Known v0.1 Limits

- Claude Code and Cursor require their CLIs to be installed or configured manually.
- Real terminal TUI support is intentionally out of scope for v0.1; one-shot command mode is the default.
- Live2D, voice, BGM, multi-agent debate, and structured diff parsing are post-v0.1 work.
- Distributed builds should use original or user-provided local assets.
