# Diagnostic

A [Hodi](https://github.com/leclaudeur/hodi) plugin for the household's admin: it reports what the reader gets wrong
on an article, and gathers everything needed to fix it into one pack to send.

- **Signaler**, at the end of an article beside "Lire l'original". The dialog asks what is wrong (texte coupé,
  éléments en trop, images manquantes, mise en page cassée, mauvais contenu, or "Autre" in your own words), and takes a
  note and a screenshot (PNG or JPG, 5 MB at most). The same article can be reported again for something else; the
  button then says "Signalé · 2", and the dialog lists the reports already made, each of which can be taken back.
- **Repéré seul**: as Hodi reads an article for the first time, the plugin notes on its own a site that did not answer,
  a text too short to be whole, and the site's leftovers in the text ("Lire aussi", a breadcrumb, a share bar). The
  "Repérer seul" option turns this off. It keeps at most 300 such articles.
- **Réglages › Diagnostic** (in the Foyer group, after IA et crédits): the pack to download, the list of what was
  reported or spotted, and "Vider" once the pack is sent and the fixes are in.

Only the admin sees any of it: the plugin's audience is `admin`, so Hodi neither loads it nor answers its routes for
other profiles. It makes no AI call.

## The pack

`hodi-diagnostic-<date>.zip` holds one folder per article:

```text
report.json      the article, every report on it (issues, "Autre", note, by the admin or by Hodi) and when
page.html        its page as its site served it when it was first reported
extracted.html   the text Hodi's reader took from it
capture-<n>.png  the screenshots
```

Drop it in a conversation with whoever fixes Hodi's reader (`server/news/extract.ts`) or its sources (`sources.yml`).

## Requirements

Hodi with the plugin API 1 and `@hodi-app/plugin-sdk` 0.2.0 or later: the reader action, plugin pages in Réglages and
`ctx.articles` came with it.

## The folder

```text
plugin.json          id diagnostic, audience admin, its menu entry, the "Repérer seul" option
server/index.ts      the routes and onArticle
server/store.ts      its two tables: the reports, and the articles kept for the pack
server/signals.ts    what Hodi spots alone
server/captures.ts   the screenshots, in the plugin's own folder (captures/<report id>.<png|jpg>)
server/pack.ts       the zip
web/                 the reader's button, the dialog, the screenshot field and the page
locales/             French (the reference, « tu ») and English
test/                node:test, on the server part
```

## Checks

```bash
npm ci
npm run typecheck
npm test
npm run format:check
npm run build        # dist/diagnostic-<version>.hodi-plugin, unsigned
```

GitHub Actions runs them on every push and pull request, and attaches the unsigned package to the run.

## Releasing a signed version

Diagnostic is one of Hodi's official plugins: its releases are signed, so Hodi installs them as "Vérifié".

1. Raise `version` in `plugin.json` and `package.json` in a pull request.
2. Once it is merged, push a tag with that version: `git tag v0.2.0 && git push origin v0.2.0`.
3. The workflow builds the package signed with the `SIGNING_KEY` secret of the repository, and publishes it as a
   GitHub release. The key is written to a temporary file for the build only, then deleted; it never leaves GitHub's
   secrets.

To install it: download the `.hodi-plugin` file from the release, then Réglages › Plugins › Ajouter un plugin.

## License

[MIT](LICENSE).
