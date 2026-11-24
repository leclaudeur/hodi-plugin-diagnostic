<div align="center">

# 🩺 Diagnostic

**A [Hodi](https://github.com/leclaudeur/hodi) plugin to report what the reader gets wrong on an article.**<br>
It gathers everything needed to fix it into one pack, ready to send.

[![CI](https://github.com/leclaudeur/hodi-plugin-diagnostic/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/leclaudeur/hodi-plugin-diagnostic/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/leclaudeur/hodi-plugin-diagnostic?sort=semver)](https://github.com/leclaudeur/hodi-plugin-diagnostic/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![Patreon](https://img.shields.io/badge/Patreon-Le%20Claudeur-F96854?logo=patreon&logoColor=white)](https://www.patreon.com/cw/LeClaudeur)

[**Install**](#install) · [**The pack**](#the-pack) · [**Fix the reader**](#fix-the-reader) · [**Develop**](#develop) · [**Release**](#release-a-signed-version) · [**Sponsor**](#sponsor)

</div>

## What it does

Sometimes Hodi's reader cuts a text, keeps a share bar or loses the images. Diagnostic helps you show exactly what
went wrong:

- 🚩 **Report**: a button at the end of each article, for every profile. Pick what is wrong, add a note and up to
  five screenshots if you like.
- 👀 **Spotted by Hodi**: blocked sites, cut texts and page leftovers, noted on its own.
- 📦 **The pack**: _Server › Diagnostic › Reports_ lists every report of every profile and downloads them all as one
  zip file.

Each profile sees only its own reports. The pack is for the **server's admin only**, who also sets its limits. It
makes **no AI call**.

## Install

You need a Hodi with plugin API 2, where you are the server's admin.

1. Download the `.hodi-plugin` file of the
   [latest release](https://github.com/leclaudeur/hodi-plugin-diagnostic/releases/latest).
2. In Hodi, open _Server › Plugins_ and click **Add a plugin**. Choose the file.
3. Hodi restarts with it. **Diagnostic** shows in the server's space, with its _Reports_ section.

Releases are signed, so Hodi installs them as _Verified_.

> [!WARNING]
> Coming from 0.1.0? Its screenshots aren't carried over. Download the pack first if you need them.

## The pack

**Download** in _Server › Diagnostic › Reports_ gives you one zip file, with a folder per article:

```text
report.json               the article and every report on it: issues, note, when, never who
page.html                 the page as its site served it at the first report
extracted.html            the text Hodi's reader took from it
capture-<report>-<n>.png  the screenshots
```

Send it to whoever fixes Hodi's reader or its sources, or [fix it yourself](#fix-the-reader). Once the fixes
are in, click **Empty**.

## Limits

So the pack never grows without end, _Server › Diagnostic › Reports_ sets three limits:

- **Room for the pack**: 500 MB by default, from 50 MB to 5 GB. Past it, the oldest screenshots go first, then the
  oldest reports.
- **Kept for**: 90 days by default. Older reports go once a day, with their screenshots and pages.
- **Reports a day**: 10 per profile by default.

A deleted profile's reports go with it.

## Fix the reader

A pack holds all it takes to fix what the reader gets wrong, with or without code.

**Without code**: open a _Reader problem_ issue on [Hodi](https://github.com/leclaudeur/hodi/issues/new/choose) and
attach the article's folder from the pack. Look at its screenshots first: they show your screen.

**With code**, in a clone of [Hodi](https://github.com/leclaudeur/hodi):

1. Compare the article's `page.html` and `extracted.html` to see what is missing or extra.
2. Fix the cause:
   - a text cut short, or a leftover such as a share bar: `server/news/extract.ts`;
   - a site that blocks the reader or is for subscribers only: `reader: false` in `sources.yml`.
3. Add a test in `server/test/` with a short cut of `page.html`, like `extract-arc.test.ts`.
4. Open one pull request per problem, naming the issue from `report.json`.

## Develop

Requires **Node.js 24** or later.

```bash
npm ci
npm test       # node:test, on the server part
```

To try it in a test Hodi, use developer mode as the
[plugin template](https://github.com/leclaudeur/hodi-plugin-template#quick-start) explains.

```text
plugin.json             id, audience all, permissions.articles, the "Spot on its own" option
server/index.ts         the plugin: its routes, the daily clean-up, onArticle for what Hodi spots
server/routes.ts        what every profile does from the reader, on its own reports
server/server-routes.ts the server admin's section: summary, limits, pack, emptying
server/store.ts         the reports; article-store.ts and capture-store.ts the kept pages and screenshots
server/migrations.ts    its tables
server/limits.ts        the room, the days and the reports a day
server/signals.ts       what Hodi spots on its own
server/pack.ts          the files of the zip
web/                    the reader's button, the dialogs and the server's section
locales/             French (the reference) and English
```

Run the checks before each pull request. GitHub Actions runs them on every push:

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build        # → dist/diagnostic-<version>.hodi-plugin, unsigned
```

## Release a signed version

Diagnostic is one of Hodi's official plugins, so its releases are signed.

1. In a pull request, raise `version` in `plugin.json`, `package.json` and [CHANGELOG.md](CHANGELOG.md).
2. Once it is merged, tag that exact version: `git tag v0.2.0 && git push origin v0.2.0`.
3. CI builds the package with the repository's `SIGNING_KEY` secret and publishes the release.

> [!IMPORTANT]
> The key only exists in a temporary file during the build. It never leaves GitHub's secrets.

## Sponsor

Hodi is free and open source, with no ads and nothing to pay.\
If it is useful to you, you can support its work on Patreon.

[![Support Hodi on Patreon](https://img.shields.io/badge/Support%20Hodi-Patreon-F96854?style=for-the-badge&logo=patreon&logoColor=white)](https://www.patreon.com/cw/LeClaudeur)

## License

Copyright © 2026 Le Claudeur.

Diagnostic is free software under the [MIT license](LICENSE): you may **use, change and share** it freely.
