#!/usr/bin/env node
// Thin launcher: the real entry is the bundled ESM in dist/. Keeping the shebang
// in a tiny shim avoids banner edge-cases and keeps dist/index.js importable too.
import "../dist/index.js";
