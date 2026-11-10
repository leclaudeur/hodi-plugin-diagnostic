<div align="center">

# 🩺 Diagnostic

**A [Hodi](https://github.com/leclaudeur/hodi) plugin to report what the reader gets wrong on an article.**<br>
It gathers everything needed to fix it into one pack, ready to send.

[![CI](https://github.com/leclaudeur/hodi-plugin-diagnostic/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/leclaudeur/hodi-plugin-diagnostic/actions/workflows/ci.yml)
[![Latest release](https://img.shields.io/github/v/release/leclaudeur/hodi-plugin-diagnostic?sort=semver)](https://github.com/leclaudeur/hodi-plugin-diagnostic/releases)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

[**Install**](#install) · [**The pack**](#the-pack) · [**Develop**](#develop) · [**Release**](#release-a-signed-version)

</div>

## What it does

Sometimes Hodi's reader cuts a text, keeps a share bar or loses the images. Diagnostic helps you show exactly what
went wrong:

- 🚩 **Report**: a button at the end of each article. Tick what is wrong, add a note and a screenshot if you like.
- 👀 **Spotted by Hodi**: blocked sites, cut texts and page leftovers, noted on its own.
- 📦 **The pack**: _Settings › Diagnostic_ lists every report and downloads them all as one zip file.

It is for the household's **admin only**: other profiles never see it. It makes **no AI call**.

## Install

You need a Hodi with plugin API 2, where you are the server's admin.

1. Download the `.hodi-plugin` file of the
   [latest release](https://github.com/leclaudeur/hodi-plugin-diagnostic/releases/latest).
2. In Hodi, open _Server › Plugins_ and click **Add a plugin**. Choose the file.
3. Hodi restarts with it. **Diagnostic** shows in _Settings_, in the _Household_ group, after _AI & credits_.

Releases are signed, so Hodi installs them as _Verified_.

> [!WARNING]
> Coming from 0.1.0? Its screenshots aren't carried over. Download the pack first if you need them.

## The pack

**Download** in _Settings › Diagnostic_ gives you one zip file, with a folder per article:

```text
report.json      the article and every report on it: issues, note, who, when
page.html        the page as its site served it at the first report
extracted.html   the text Hodi's reader took from it
capture-<n>.png  the screenshots
```

Send it to whoever fixes Hodi's reader or its sources. Once the fixes are in, click **Empty**.

> [!NOTE]
> On a server with several households, each admin sees only their own reports. What Hodi spots on its own is about
> the reader, so only the server's admin sees it.

## Develop

Requires **Node.js 24** or later.

```bash
npm ci
npm test       # node:test, on the server part
```

To try it in a test Hodi, use developer mode as the
[plugin template](https://github.com/leclaudeur/hodi-plugin-template#quick-start) explains.

```text
plugin.json          id, audience admin, permissions.articles, menu entry, the "Spot on its own" option
server/index.ts      the routes, and onArticle for what Hodi spots
server/store.ts      its tables: reports, kept articles, screenshots
server/signals.ts    what Hodi spots on its own
server/pack.ts       the files of the zip
web/                 the reader's button, the dialogs and the Settings page
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

1. Raise `version` in `plugin.json` and `package.json`, in a pull request.
2. Once it is merged, tag that exact version: `git tag v0.2.0 && git push origin v0.2.0`.
3. CI builds the package with the repository's `SIGNING_KEY` secret and publishes the release.

> [!IMPORTANT]
> The key only exists in a temporary file during the build. It never leaves GitHub's secrets.

## License

[MIT](LICENSE).
