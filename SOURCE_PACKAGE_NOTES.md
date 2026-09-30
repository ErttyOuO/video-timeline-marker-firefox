# Source Package Notes

Version: 1.2.3

This source archive contains the human-readable source used to create the AMO upload package.

## Build requirements

None.

There is no compilation, bundling, minification, transpilation, or dependency installation step. The extension ships plain HTML, CSS, JSON, PNG, and JavaScript files.

## Reproducing the AMO package manually

Create a ZIP/XPI whose root contains:

- `manifest.json`
- `_locales/`
- `icons/icon-16.png`
- `icons/icon-32.png`
- `icons/icon-48.png`
- `icons/icon-96.png`
- `icons/icon-128.png`
- `src/`
- `LICENSE`

Do not wrap these files in an additional parent directory inside the XPI.

Development-only documentation and large source artwork are intentionally omitted from the AMO runtime package.

## v1.2.3 sync source

Google Drive synchronization is implemented in readable source under `src/sync/`. No Google SDK or remote JavaScript library is bundled or loaded.

The production OAuth Desktop Client ID is a public application identifier embedded in `src/sync/google-auth.js`. The Desktop-client secret (non-confidential per Google) is embedded; no user credential is embedded in the package.
