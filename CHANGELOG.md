# Changelog

Project-level changes for `nokta-hoop`.

Format follows Keep a Changelog. Versions are named as `nokta-hoop X.Y.Z`;
entries below are rebuilt from the current git commit history.

## [Unreleased]

## [nokta-hoop 0.2.0] - 2026-05-06

### Added
- Added project support documents: `AGENT.md`, `DESIGN.md`, and this
  `CHANGELOG.md`.
- Added root `.gitignore` rules for local `example/` reference code, Node/Expo
  outputs, logs, and environment files.
- Added npm workspace structure for `apps/mobile`, `packages/hoop-call`, and
  `services/token-server`.
- Added `packages/hoop-call` transcript utilities for Stream JSONL parsing,
  transcript formatting, and transcription asset selection.
- Added a `nokta-hoop` Stream token server with `/token`, `/users`,
  `/calls/:callType/:callId/transcriptions`, and
  `/calls/:callType/:callId/transcript` endpoints.
- Added the Expo mobile video-call app with room join, Stream call controls,
  automatic transcription start/stop, transcript polling, and transcript
  reading screen.
- Added transcript export support with backend downloads for Markdown, text,
  and JSON plus mobile transcript-screen download buttons.
- Added `DEVELOPER_SETUP.md` with new-developer instructions for Stream
  credentials, environment files, Cloudflare Tunnel, Expo Metro, and Android
  dev-client testing.

### Changed
- Kept `packages/hoop-core` and `packages/hoop-wiki` as empty planned folders
  only; active workspace scripts now run the video-call package, token server,
  and mobile app.
- Limited Android debug builds to `arm64-v8a` and `x86_64` to avoid the
  `armeabi-v7a` native codegen crash seen while compiling `react-native-svg`.
- Changed the token server to bind to `0.0.0.0` by default so physical Android
  devices can reach it through the development machine LAN IP.
- Fixed root `mobile:start` argument forwarding so Expo flags such as
  `--clear --host lan` reach the mobile workspace script.
- Delayed transcript navigation until transcription stop/leave handling
  finishes, removed duplicate call leave cleanup, and treated empty Stream
  transcript assets as still processing instead of showing a ready `0 line`
  transcript.
- Changed call ending to move into the transcript screen immediately and show
  an explicit transcript loading state while Stream prepares the transcript.

## [nokta-hoop 0.1.0] - 2026-05-06

### Added
- Added the initial `README.md` with the short `nokta-hoop` product summary.
- Added `PLAN.md` with the draft repository creation plan, target folder
  structure, source synthesis, execution plan, and verification plan.
- Added `IDEA.md` with the architectural specification for HITL/HOTL/HOOTL
  governance, video-call sessions, transcripts, wiki writeback, data models,
  API draft, CLI reference, test strategy, and first implementation target.
