# Repository Guidelines

## Project Structure & Module Organization

`extension/` contains the Chrome Manifest V3 extension: the service worker manages grouping and alarms, shared modules validate model output, and HTML/CSS/JavaScript implement the popup and settings. `native/` contains the Python Native Messaging bridge and installer for local Codex. `tests/` contains Node.js tests. See `README.md` for installation and manual browser checks.

## Build, Test, and Development Commands

- `npm test`: run the Node.js built-in test runner against grouping validation and provider request handling.
- `npm run check`: check JavaScript syntax and compile Python sources without contacting model providers.
- Load `extension/` through **chrome://extensions → Developer mode → Load unpacked**. Reload the extension after source changes.
- `python3 native/install.py EXTENSION_ID`: register the native host for your unpacked extension. Install and log in to Codex first.

No bundler or dependency installation is required. Use Node.js 20+ and Python 3.10+ for development.

## Coding Style & Naming Conventions

Use JavaScript ES modules, two-space indentation, semicolons, and descriptive camelCase names. Use four spaces and snake_case in Python. Keep provider integration separate from browser mutation logic. Treat model responses as untrusted input; validate tab identifiers and group colors before calling Chrome APIs. Keep interface copy concise and in Chinese.

## Testing Guidelines

Use `node:test` and `node:assert/strict`; name files `tests/*.test.js`. Cover malformed model responses, duplicate or unknown tab IDs, provider failures, and configuration validation. No numeric coverage threshold is established. Use mocked network and Chrome interfaces in automated tests; avoid paid model requests. Manually check manual grouping, scheduled grouping, protected tabs, permission prompts, and native-host failures before release.

## Commit & Pull Request Guidelines

This project started without Git history, so no historical commit convention exists. Use short imperative subjects, such as `Add Anthropic provider support`. Keep commits focused. Pull requests should explain behavior changes, list verification performed, link relevant issues, and include screenshots for UI changes. Document permission changes and native-host installation changes explicitly.

## Security & Configuration

Never commit API keys or local credentials. Store settings in local extension storage, never synchronized storage. Send only tab metadata needed for grouping. Never execute model output as commands. Keep native-host access restricted to the installed extension ID.
