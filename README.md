# Hodi plugin template

A starting point for a [Hodi](https://github.com/leclaudeur/hodi) plugin. It is a complete small plugin: two settings
that Hodi draws, a server route with its own table, and a card under its options in Réglages › Plugins, in French and
English.

## Start

1. **Use this template** (the green button on GitHub), then clone your new repository.
2. In `plugin.json`, choose your plugin's `id` (lowercase letters, digits and dashes), `name` and `description`. Rename
   the table in `server/index.ts` (`plugin_<id>_…`, dashes as underscores) and the class in `web/plugin.css` to match.
3. Install and build:

```bash
npm install
npm run build        # dist/<id>-<version>.hodi-plugin
```

4. In Hodi, as the admin: Réglages › Plugins › Ajouter un plugin, and choose that file. Hodi restarts with it.

## The folder

```text
plugin.json        what it is: id, name, version, api, who it is for, its settings
server/index.ts    its server part: its own migrations and routes, served at /api/plugins/<id>/
web/index.tsx      its web part: drawn with Hodi's components from 'hodi:sdk'
web/plugin.css     its styles, prefixed with its id, coloured with Hodi's CSS variables
locales/           its texts, one file per language (fr is the fallback)
assets/            optional: pictures and other files its web part asks for
```

The full guide, with every field and what a plugin may use, is the
[`@hodi-app/plugin-sdk` README](https://www.npmjs.com/package/@hodi-app/plugin-sdk).

## Rules

A plugin runs inside Hodi, with Hodi's rights, so it keeps Hodi's rules:

- No AI call without a click on a purple button.
- Every text in `locales/`; French says « tu ».
- Outgoing requests through `ctx.fetchText`; data in the plugin's own tables (`ctx.db`) and folder (`ctx.dataDir`).
- A migration that is released is never edited or reordered: add a new one.

## Unsigned, and that is fine

A package built here is unsigned: Hodi installs it as "Code non vérifié", after a second question. "Vérifié" is kept
for Hodi's official plugins, signed by its maintainer.

## Checks

```bash
npm run typecheck
npm run format:check
npm run build
```

GitHub Actions runs them on every push and pull request, and attaches the `.hodi-plugin` file to the run. A tag such as
`v0.1.0` also publishes it as a GitHub release.

## License

This template is under the [MIT license](LICENSE). Your plugin is yours: replace `LICENSE` and the `license` field
in `package.json` with the license you choose.
