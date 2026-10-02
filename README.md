# dsh-theme-ink

Ink wash (水墨) theme plugin for the DeepSeek Harness Web UI: opaque
rice-paper panels with a vermilion seal and dry-brush strokes floating above
the content, plus blooming ink drops and falling bamboo leaves. Fonts follow
the DSH defaults.

The theme is enabled while the plugin is installed (no toggle) — disable or
remove the plugin to restore the default theme.

![hero](docs/screenshots/ink.png)

## Install

Install into a web profile (requires the `webServer` service; do not install
into a headless profile):

```sh
dsh plugin --profile web add github:jiangwangyang/dsh-theme-ink
```

Refresh the Web UI. The theme activates immediately; disable or remove the
plugin from plugin management to revert.

## How it works

- **Host half** (`src/index.js`): serves `/ink/ink.css` and `/ink/ink.js`
  through the `webServer` service (read from disk per request — edits apply on
  refresh), and injects a boot marker, stylesheet and deferred renderer script
  into `index.html` via `tapIndex` so the first paint never flashes the
  default theme.
- **Client half** (`src/client/index.js`): stacks the ink palette on the
  current theme via `ctx.theme.overrideTokens` (orthogonal to the
  light/dark/system preference; no theme id is registered and no preference is
  touched), asserts a light color-scheme chrome after every `theme/change`,
  and mounts the structural layer and the `window.DshInk` renderer. Everything
  is reverted on unload.
- **Structure layer** (`assets/ink.css`): gated by `html[data-dsh-ink]` —
  shiki ink-highlight tokens and a top fx layer (`z-index: 9998`,
  `pointer-events: none`) holding the vermilion seal, dry-brush strokes and
  the particle canvas above all content. Panels are opaque paper colors via
  the token overlay; there is no backdrop layer.
- **Renderer** (`assets/ink.js`): creates the fx layer with seal and canvas;
  a lightweight 2D-canvas particle loop (30fps cap) — blooming ink drops at
  the canvas edges and swaying bamboo leaves, ported from the openagents ink
  theme. Degrades to a static frame under `prefers-reduced-motion`.

## License

MIT
