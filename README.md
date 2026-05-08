# Tag Collector

Current version: `0.1`

Tag Collector is a local-first Chrome extension for saving tab sessions, finding them quickly, and reopening them when you need to resume work.

## What It Does

- Save the current window as a session
- Search saved sessions by session name, notes, tab title, and URL
- Rename, lock, favorite, annotate, and delete sessions
- Restore an entire session in a new window
- Reopen items from recent restore history
- Clean duplicate tabs and remove empty sessions
- Import and export JSON backups
- Import and export OneTab text format
- Switch between single-column and two-column layouts
- Use multiple built-in visual themes

## Local-Only Behavior

This project currently keeps only local capabilities:

- No account system
- No cloud sync
- No cross-device sync
- No background network dependency
- Works offline after installation

All data is stored in browser extension storage on the current machine.

## Permissions

The extension currently requests:

- `tabs`
- `storage`
- `unlimitedStorage`
- `notifications`
- `contextMenus`

It does not declare any `host_permissions`.

## Install for Development

```bash
pnpm install
pnpm build
```

Then open `chrome://extensions`, enable Developer mode, and load the `dist` directory as an unpacked extension.

## Basic Usage

### Save a session

- Open the extension popup
- Click the save action to capture the current window
- Optionally include pinned tabs based on settings

### Find a saved session

- Use the search box to search by session name, note, tab title, or URL
- Browse recent restore history from the main view
- Switch layout mode if you prefer a different session list density

### Restore a session

- Open a saved session card
- Restore the full session into a new browser window
- Locked sessions stay saved after restore

### Import and export

- Export all saved data as JSON
- Import JSON backups created by this extension
- Import or export the OneTab text format for migration workflows

## Keyboard Shortcuts

The manifest defines these commands:

- `Command+Shift+S` / `Ctrl+Shift+S`: open the tab manager
- `Alt+Shift+S`: save all tabs
- `Alt+S`: save the current tab

Shortcut behavior may be customized by Chrome from the extensions shortcuts page.

## Development Commands

```bash
pnpm type-check
pnpm lint
pnpm build
pnpm validate
```

## Privacy

- No sign-in flow
- No cloud service integration
- No remote sync path
- Data stays in local extension storage unless you export it yourself

## License

MIT
