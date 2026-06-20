# Reference Strategy

GalCode should absorb proven visual-novel and AI companion patterns without becoming a clone of any single project.

## Ren'Py

Source: https://www.renpy.org/

Useful takeaways:

- Treat dialogue, narration, character display, transitions, menus, audio, save/history, and choices as first-class systems.
- Keep authoring simple. Ren'Py succeeds because large narrative experiences can be expressed with a compact script language.
- GalCode equivalent: introduce a small scene/event grammar later, for example `say`, `narrate`, `show`, `hide`, `choice`, `sound`, `director_update`.

## super-agent-party

Source: https://github.com/heshengtao/super-agent-party

Useful takeaways:

- Desktop companion framing with custom models, character personas, backgrounds, emotion packs, and multi-window modes.
- Extension system for character packs and model providers.
- Multi-character party conversations.

GalCode equivalent:

- Theme packs and browser image imports.
- Configurable API heroines.
- Harem Mode where characters answer in order and can react to earlier replies.

## Galcode Island

Source: https://github.com/sjyinzju/Galcode_island

Useful takeaways:

- Keep the galgame layer emotionally focused instead of exposing raw model mechanics.
- Preserve session history and make replay/review natural.
- Character identity should be a durable object: portrait, name, accent, model config, system prompt, and relationship state.

GalCode next implementation targets:

- Add save slots and story snapshots.
- Add choices that the director can interpret as plot branches.
- Add emotion/pose selection for each heroine.
- Add BGM, voice, and transition events.
- Move API keys to a safer server-side vault before hosted deployment.

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
