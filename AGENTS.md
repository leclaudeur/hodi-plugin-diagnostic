# AGENTS.md

Instructions for AI coding agents working on this Hodi plugin. Read `README.md` first, then the
[`@hodi-app/plugin-sdk` README](https://www.npmjs.com/package/@hodi-app/plugin-sdk) (in `node_modules/@hodi-app/plugin-sdk/` once
installed).

- TypeScript strict, ES modules. Prettier decides formatting (no semicolons, single quotes, 120 columns): run
  `npm run format`.
- The plugin runs inside Hodi: never call an AI provider without a click, never import Hodi's own modules (use the
  context the server part gets and `hodi:sdk` in the web part), outgoing requests only through `ctx.fetchText`.
- Every text goes in `locales/fr.json` (the reference; French says « tu ») and every key also in `locales/en.json`.
  Code, comments, identifiers and commits are in English.
- Use Hodi's components from `hodi:sdk` and its CSS variables; prefix class names with the plugin's id.
- Migrations are appended, never edited or reordered once released. Tables are named `plugin_<id>_…`.
- Before a pull request: `npm run typecheck`, `npm test`, `npm run format:check` and `npm run build` must pass.
- Releases are signed by CI with the `SIGNING_KEY` secret (README, "Releasing a signed version"): never sign locally.
- Never put a private key in the repository.
