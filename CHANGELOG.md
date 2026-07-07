# Changelog

All notable changes to `bindly-cli` are documented here. This project follows
[Semantic Versioning](https://semver.org) and
[Keep a Changelog](https://keepachangelog.com).

## [0.2.0] - 2026-07-06

### Added

- Full session lifecycle from the terminal:
  - `session answer <sessionId> --message <text>`: answer intake questions conversationally; prints the assistant's reply, progress, and the next asks.
  - `session extract <sessionId> <pdf>`: extract intake answers from a PDF (20MB max).
  - `session fill <sessionId>`: fill the session's ACORD forms; reports fields written, warnings, and suspected sparse fills.
  - `session download <sessionId> [formKey] [-o <dir>]`: download one filled form PDF or every filled form.
  - `session risk <sessionId>`: underwriting risk flags (severity, title, detail; full detail with `--json`).
  - `session upload <sessionId> <pdf>`: attach a supporting document (loss runs, prior policy).
  - `session archive <sessionId>`: archive a session.
- `whoami`: show the signed-in workspace, plan, and auth method.
- `session get` now renders intake progress, pending count, next question keys, and filled forms.
- Friendly message (no stack trace) when a free workspace hits its monthly session cap on `session new`.

### Fixed

- `login --api-key` help text: workspace keys are `bsk_...` only.
- Non-JSON error bodies (proxy HTML pages) no longer crash uploads.

## [0.1.0] - 2026-07-06

### Added

- Initial release.
- Sign-in: OAuth 2.1 device-code (default, works over SSH), browser loopback (`--browser`), or a workspace API key (`--api-key bsk_...`).
- `login`, `logout`.
- Intake sessions: `session new`, `session list`, `session get`, `session submit` (submit to Hedge).
- Global `--json` output.
- Distributed three ways: npm (`bindly-cli`), Homebrew (`taventech/tap/bindly`), and a self-contained binary via the curl installer.
