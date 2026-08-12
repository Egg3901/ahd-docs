<p align="center">
  <img src="https://docs.lakesidegames.net/ahd-logo.png" alt="A House Divided" width="120">
</p>
<h1 align="center">A House Divided — Documentation</h1>

<p align="center">
  The design and engineering documentation behind <a href="https://github.com/Egg3901/AHDGame">A House Divided</a>,
  published at <a href="https://docs.lakesidegames.net">docs.lakesidegames.net</a>.
</p>

---

## What's here

| Directory      | Contents                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| `design/`      | Game design docs: how every system works — elections, legislation, parties, the economy, the world   |
| `engineering/` | Architecture, conventions, and contribution guides for the [game codebase](https://github.com/Egg3901/AHDGame) |
| `api/`         | The public REST API and client integration                                                           |
| `site-build/`  | The static site generator for docs.lakesidegames.net                                                 |

The published site also includes the **player wiki**, which lives in the game repo (`src/lib/seeds/wiki/`) so the in-game wiki and the site share one source. The site build pulls it in automatically.

## Accuracy conventions

- Docs suffixed **`-as-shipped`** are grounded in the current code and supersede older design docs where they disagree. Prefer them.
- Older design docs describe intent at the time of writing; when a doc and the code disagree, the code wins — and a PR fixing the doc is welcome.
- Formulas and constants in docs should cite the source file they come from. If you find a constant that doesn't match the code, that's a bug in the doc: open a PR or an issue.

## Contributing

Documentation PRs are some of the most valuable contributions to the project:

1. **Fix inaccuracies** — verify against the code in [AHDGame](https://github.com/Egg3901/AHDGame) and cite file paths in backticks.
2. **Cover gaps** — systems without a current doc, or docs that stop before the interesting part.
3. **Player wiki changes** go to the game repo (`src/lib/seeds/wiki/content/`), not here.

Style: plain direct prose, no em dashes, `## sections`, real file paths, real constant values. Look at any `-as-shipped` doc for the pattern.

### Building the site locally

```bash
cd site-build
npm install
GAME_REPO=/path/to/AHDGame DOCS_OUT=./out node build.mjs
```

Renders every doc plus the wiki to static HTML with the grouped sidebar, cross-reference graph, and sitemap.

## License

[PolyForm Noncommercial 1.0.0](https://github.com/Egg3901/AHDGame/blob/main/LICENSE.md), same as the game. "A House Divided" and its logo are trademarks of Lakeside Games.
