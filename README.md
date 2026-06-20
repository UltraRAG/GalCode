# GalCode

GalCode is a web-first galgame interface for configurable OpenAI-compatible API characters. It turns chat models into visual-novel heroines, adds a global director agent for story continuity, and presents replies through click-to-advance dialogue.

## Current Product Shape

- Pure Web app: run it in the browser with Vite.
- Reusable model configs: API URL, API key, model, and temperature live in one model pool.
- User-configurable API heroines: each heroine selects a model config and keeps her own identity and system prompt.
- Director agent: generates the opening story, can regenerate it, and silently updates plot state after conversations.
- Galgame dialogue flow: one or two lines per page, with Back, Next, Auto, Full, History, Raw, and Skip controls.
- Harem Mode: send one line to all heroines; later heroines can see earlier heroine replies in that turn.
- VN stage rules: user lines and narration show only the background; heroine lines show the speaking heroine; multi-heroine turns show all participating heroines with the current speaker highlighted.
- Local visual assets: bundled sample background/portraits plus browser file picker for custom images.

## Run

```bash
npm install
npm run dev
```

Open the printed Vite URL, usually:

```text
http://127.0.0.1:5173/
```

For the current local test server used during development, port `5199` may also be running:

```text
http://127.0.0.1:5199/
```

## Basic Flow

1. Open `Settings`.
2. Configure one or more model configs with API URL, API key, model, and temperature.
3. Pick a model config for the Director Agent.
4. Configure one or more heroines with a model config, personality, and identity.
5. On the first screen, generate or regenerate the opening story.
6. Enter the story and click through dialogue like a visual novel.
7. Toggle Harem Mode when you want every heroine to answer in sequence.

The API endpoint should be OpenAI-compatible. You can enter either a base `/v1` URL or a full `/v1/chat/completions` URL; the local Vite proxy normalizes it and avoids browser CORS failures.

## Director Agent

The director is a hidden story manager. It does two things:

- Opening generation: creates the initial scene, atmosphere, relationship setup, and conflict seed.
- Silent updates: after user and heroine dialogue, it summarizes the new story state so later responses stay continuous.

The director does not speak directly in the chat after the opening. It updates story memory in the background.

## Heroines

Each heroine is an API character with:

- display name and character name
- identity/personality text
- selected model config
- portrait, accent color, and system prompt

Default heroines are sample API characters only. They do not include any API credentials.

## Commands

```bash
npm run dev          # Start web app
npm run build        # Typecheck and build
npm run preview      # Preview production build
npm run test:smoke   # Core state/prompt/dialogue tests
```

## Project Layout

```text
src/
  App.tsx        Web galgame UI and API orchestration
  core.ts        Default heroines, director prompts, state migration, dialogue helpers
  styles.css     Visual novel layout and panels
  types.ts       Shared state and transcript types

vite.config.ts   Local chat-completions proxy
sample-assets/   Bundled placeholder backgrounds and character sprites
scripts/         Smoke/runtime helper tests
```

## Notes

- API keys are stored only in local app state during development. Do not commit real keys.
- The current sample art is placeholder material and can be replaced through Settings.
- The old local coding-agent path has been removed from the product UI; GalCode is now focused on API-driven conversation galgame play.
