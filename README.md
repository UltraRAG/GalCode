# GalCode

GalCode is a web-first galgame interface for AI companions, roleplay characters, and optional local coding agents.

The main product is now the browser app: configure OpenAI-compatible chat APIs, give each heroine her own identity and system prompt, then talk through a visual-novel style dialogue flow. The desktop/Electron build remains as a Local Bridge for features that a browser cannot do directly, such as calling Codex, Claude Code, Cursor Agent, choosing local folders, and loading arbitrary local image packs.

## Current Capabilities

- Web-first React/Vite app.
- Visual novel dialogue playback: one or two lines per page, click/Next/Space to advance.
- Persistent VN controls: Back, Next, Auto, Full, History, Raw, Skip.
- API Companion agents with configurable API URL, API key, model, temperature, identity, and system prompt.
- OpenAI-compatible Chat Completions support.
- Harem Mode: send one message to every API Companion; later characters can see earlier character replies.
- Dynamic stage speaker: portrait, name, and accent follow the current responding character.
- Local browser state via `localStorage`.
- Desktop Local Bridge for local CLI work agents: Codex, Claude Code, Cursor Agent.
- Markdown session export.
- Built-in sample assets for Web and Desktop testing.

## Quick Start

Install dependencies:

```bash
npm install
```

Run the Web app:

```bash
npm run dev
```

Open the URL printed by Vite, usually:

```text
http://127.0.0.1:5173
```

Production build:

```bash
npm run build
npm run preview
```

## Configure An API Companion

In GalCode:

1. Open `Menu`.
2. Open `Settings`.
3. Click `Add Companion`.
4. Set `Agent Type` to `API Companion`.
5. Fill:
   - `API URL`, for example `https://api.example.com/v1`
   - `API Key`
   - `Model`
   - `Temperature`
   - `Personality / System Prompt`

The API URL can be either a base URL ending in `/v1` or a full `/chat/completions` endpoint. GalCode normalizes both.

In local Web development, GalCode posts to the same-origin `/api/galcode/chat` proxy provided by Vite, then the proxy calls the configured upstream API. This avoids browser CORS failures for local use. A hosted deployment should provide an equivalent server-side proxy.

## Harem Mode

Use `Menu -> Harem Mode` to toggle group mode.

When enabled:

- The input targets all API Companions.
- Characters respond one by one in agent list order.
- Each later character receives the user message plus earlier character replies from the same turn.
- The stage portrait and accent switch to the currently speaking character.

CLI work agents are not called in Harem Mode.

## Desktop Local Bridge

The browser cannot directly execute local CLI tools or inspect arbitrary local folders. For local coding agents, use:

```bash
npm run start:desktop
```

For desktop development with Vite hot reload:

```bash
npm run dev:desktop
```

Desktop bridge features include:

- Codex CLI
- Claude Code CLI
- Cursor Agent CLI
- `/login` terminal launch
- local workspace picker
- local image picker
- local theme folder import
- `galcode-asset://` file loading

## CLI Work Agents

Default local work agents:

| Agent | Login command | Default command |
| --- | --- | --- |
| Codex | `codex login` | `codex exec --json --color never --skip-git-repo-check "{prompt}"` |
| Claude Code | `claude auth login` | `claude -p --output-format text "{prompt}"` |
| Cursor Agent | `cursor-agent login` | `cursor-agent --print --output-format text --trust "{prompt}"` |

CLI agents require Desktop Local Bridge. In pure Web mode they are visible as configurable characters but cannot run local commands.

## Useful Commands

```bash
npm run dev
npm run dev:desktop
npm run start:desktop
npm run build
npm run test:smoke
npm run test:runtime
npm run test:agents
npm run doctor
```

`test:agents` calls local CLI tools and expects them to be installed and logged in.

## Project Structure

```text
src/
  App.tsx            Main visual-novel UI and app state
  core.ts            Defaults, helpers, transcript export
  styles.css         Galgame styling
  types.ts           Shared types

electron/
  main.cjs           Desktop Local Bridge, CLI launch, API proxy path
  preload.cjs        Renderer bridge
  agent-runtime.cjs  CLI command parsing and asset scanning

sample-assets/       Web/Desktop sample backgrounds and sprites
scripts/             Tests and local tooling
docs/                Planning and asset notes
themes/              Theme metadata
```

## Notes

- API keys are stored in local state for the MVP. Treat this as a local prototype, not a hardened multi-user deployment.
- Web mode can use bundled assets and user-selected local image files through the browser file picker. Arbitrary local folder scanning still belongs to Desktop Local Bridge.
- The sample assets are for local MVP testing; see `sample-assets/CREDITS.md`.
