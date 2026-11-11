# Changelog

All notable changes to Diagnostic are documented in this file: what changes for the people who use it.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). Each pull request adds its line under « Unreleased »; a
release pull request raises `version` and moves the lines under it, then the tag `v<version>` publishes it.

## [Unreleased]

### Added

- Its description in English, for Hodi's interface in English (needs Hodi with translated plugin names).

### Changed

- The « Signalés » list shows grey placeholder rows while it loads, instead of staying empty.

## [0.2.1] - 2026-11-10

Maintenance only: nothing changes for a household.

### Changed

- The code follows Hodi's size limits and lint rules, and its development tools have no known vulnerability.
- Releases are signed only from the maintainer's tags.

## [0.2.0] - 2026-11-08

### Changed

- Diagnostic runs on plugin API 2: inside Hodi's sandbox, with its own database.
- Reports belong to a household: each household's admin sees only its own. Pages Hodi spotted on its own are seen by
  the server admin only.
- Screenshots are kept in the plugin's database. Those of 0.1.0 are not carried over: download the pack before you
  update if you need them.

## [0.1.0] - 2026-11-06

### Added

- **Report**: a button at the end of each article, to tick what the reader got wrong, add a note and a screenshot.
- **Spotted by Hodi**: blocked sites, cut texts and page leftovers, noted on their own.
- **The pack**: Settings › Diagnostic lists every report and downloads them all as one zip file.

[unreleased]: https://github.com/leclaudeur/hodi-plugin-diagnostic/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/leclaudeur/hodi-plugin-diagnostic/releases/tag/v0.2.1
[0.2.0]: https://github.com/leclaudeur/hodi-plugin-diagnostic/releases/tag/v0.2.0
[0.1.0]: https://github.com/leclaudeur/hodi-plugin-diagnostic/releases/tag/v0.1.0
