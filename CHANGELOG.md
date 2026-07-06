# Changelog

All notable changes to `bindly-cli` are documented here. This project follows
[Semantic Versioning](https://semver.org) and
[Keep a Changelog](https://keepachangelog.com).

## [0.1.0] - 2026-07-06

### Added

- Initial release.
- Sign-in: OAuth 2.1 device-code (default, works over SSH), browser loopback (`--browser`), or a workspace API key (`--api-key bsk_...`).
- `login`, `logout`.
- Intake sessions: `session new`, `session list`, `session get`, `session submit` (submit to Hedge).
- Global `--json` output.
- Distributed three ways: npm (`bindly-cli`), Homebrew (`taventech/tap/bindly`), and a self-contained binary via the curl installer.
