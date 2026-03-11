# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

ar://playdead is a two-part project:
1. **Frontend** (`dist/`): Vanilla HTML/CSS/JS permanent media player for Arweave (no build step).
2. **Deployment CLI** (root `deploy.js` + `lib/`): Node.js CLI that deploys the frontend to Arweave.

### Running the frontend

Serve `dist/` with any static file server:
```
npx serve dist -l 3000
```
Then open `http://localhost:3000/`. The frontend fetches album data from Arweave gateways at runtime, so network access is needed for full media playback.

### Running the deployment CLI

- **Test mode** (no wallet/env vars needed): `node deploy.js --test-mode --content "Hello"`
- **View logs**: `node deploy.js --logs`
- **View stats**: `node deploy.js --stats`
- **Full deploy** requires `.env` with `ANT_PROCESS_ID`, `ROOT_ARNS_NAME`, and Arweave wallet credentials (see `lib/utils.js` `loadConfig()`).
- Directory test-mode deploys (`--test-mode --file dist/`) still require `ANT_PROCESS_ID`; only single-file test-mode works without credentials.

### Gotchas

- `package.json` specifies `ora@^5.4.2` but that version was never published (highest 5.x is 5.4.1). Workaround: run `npm install ora@5.4.1 --no-save` which installs all dependencies correctly, then skip the failing bare `npm install`.
- No linter, test framework, or build step is configured. The project uses vanilla JS with no transpilation.
- No lockfile exists (`package-lock.json`, `yarn.lock`, etc.), so dependency versions may drift.
- The `#dev` URL fragment on `player.html` enables testing features (simulation toggle for laser show).
