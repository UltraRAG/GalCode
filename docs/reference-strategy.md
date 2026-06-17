# Reference Strategy

GalCode should absorb proven visual-novel and desktop-agent patterns without becoming a clone of any single project.

## Ren'Py

Source: https://www.renpy.org/

Useful takeaways:

- Treat dialogue, narration, character display, transitions, menus, audio, and save/history as first-class systems.
- Keep authoring simple. Ren'Py succeeds because large narrative experiences can be expressed with a compact script language and extended with Python when needed.
- GalCode equivalent: introduce a small scene/event grammar later, for example `say`, `narrate`, `show`, `hide`, `choice`, `sound`, `agent_event`.

Do not copy Ren'Py internals into the Electron MVP. Use it as product grammar inspiration.

## super-agent-party

Source: https://github.com/heshengtao/super-agent-party

Useful takeaways:

- Desktop companion framing with custom models, character personas, backgrounds, emotion packs, and multi-window modes.
- Extension system for adding new surfaces.
- Agent task center and computer-control direction.

GalCode equivalent:

- Theme packs and local asset imports.
- Future extension points for agent adapters and character packs.
- Optional side/dock window for a lightweight heroine companion.

## Galcode Island

Source: https://github.com/sjyinzju/Galcode_island

Useful takeaways:

- Project tabs are the right primary work unit.
- Normalize agent output into structured blocks: user input, body, thinking, command, command output, todo, file, diff, tool call, status, stderr, error.
- Codex is better treated as a shared app-server JSON-RPC backend when going beyond one-shot execution.
- Claude can use stream-json style process integration.
- Session persistence needs native session/thread IDs, not only visible transcript text.

GalCode next implementation target:

- Replace plain transcript entries with stream blocks.
- Add project tabs and history restore.
- Build specialized backend adapters for Codex app-server, Claude stream JSON, Cursor headless, and future OpenCode.
- Keep the galgame layer on top of the block model instead of tying it to raw stdout.

## Local Asset Policy

The app supports local image import for backgrounds and character portraits. GalCode should treat these as user-owned local files and should not commit them to the repo by default.

Recommended future structure:

```text
user-assets/
  themes/
    my-theme/
      theme.json
      backgrounds/
      characters/
      sounds/
```

This lets private local asset packs work without the project distributing third-party copyrighted files.
