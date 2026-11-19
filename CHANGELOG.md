# Changelog

All notable changes to Diagnostic are documented in this file: what changes for the people who use it.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). Each pull request adds its line under « Unreleased »; a
release pull request raises `version` and moves the lines under it, then the tag `v<version>` publishes it.

## [Unreleased]

## [1.0.0-beta.2] - 2026-11-19

Every profile reports, and the reports move to the server's space with their limits. Needs Hodi 1.0.0-beta.13 or
later.

### Changed

- **Every profile reports.** _Report_ is under every article for every profile, teens and children included, and
  each sees only its own reports. The reports and the pack move from Settings to the server's space, in Server ›
  Diagnostic › Reports, for whoever runs the server.
- **Several issues and screenshots.** _Report a problem_ picks several issues in one field, like a source's topics,
  and takes up to 5 screenshots of 5 MB each, listed in the drop area.
- Built with `@hodi-app/plugin-sdk` 1.0.0-beta.5.

### Added

- **Limits.** Server › Diagnostic › Reports shows how much room the pack takes, and sets the room it may take
  (500 MB by default, the oldest screenshots then reports erased past it), how long a report stays (90 days) and how
  many reports a profile makes a day (10).
- A deleted profile's reports, and a removed household's, go with it.

## [1.0.0-beta.1] - 2026-11-15

The first beta, released with Hodi 1.0.0-beta.1: the same as 0.2.2 for a household.

### Changed

- Built with `@hodi-app/plugin-sdk` 1.0.0-beta.2.

## [0.2.2] - 2026-11-11

### Added

- Its name and description in each language, for Hodi's interface in English (needs Hodi with translated plugin
  names).

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

[unreleased]: https://github.com/leclaudeur/hodi-plugin-diagnostic/compare/v1.0.0-beta.2...HEAD
[1.0.0-beta.2]: https://github.com/leclaudeur/hodi-plugin-diagnostic/releases/tag/v1.0.0-beta.2
[1.0.0-beta.1]: https://github.com/leclaudeur/hodi-plugin-diagnostic/releases/tag/v1.0.0-beta.1
[0.2.2]: https://github.com/leclaudeur/hodi-plugin-diagnostic/releases/tag/v0.2.2
[0.2.1]: https://github.com/leclaudeur/hodi-plugin-diagnostic/releases/tag/v0.2.1
[0.2.0]: https://github.com/leclaudeur/hodi-plugin-diagnostic/releases/tag/v0.2.0
[0.1.0]: https://github.com/leclaudeur/hodi-plugin-diagnostic/releases/tag/v0.1.0
