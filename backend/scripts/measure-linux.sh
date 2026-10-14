#!/bin/sh
set -eu
# Run from the repository root in an existing x86_64 Linux environment.
# All downloaded application artifacts stay in maintenance/linux-runtime.
ROOT=$(pwd)
DEST="${VIDPILOT_LINUX_DEST:-$ROOT/maintenance/linux-runtime}"
mkdir -p "$DEST"
cd "$DEST"
curl --fail --silent --show-error --connect-timeout 15 --max-time 180 https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt -o node-shasums.txt
ARCHIVE=$(awk '/linux-x64.tar.xz$/ {print $2;exit}' node-shasums.txt)
test -n "$ARCHIVE"
if [ -f "$ROOT/maintenance/linux-runtime/$ARCHIVE" ] && [ "$DEST" != "$ROOT/maintenance/linux-runtime" ]; then cp "$ROOT/maintenance/linux-runtime/$ARCHIVE" .; else curl --fail --silent --show-error --connect-timeout 15 --max-time 300 "https://nodejs.org/dist/latest-v22.x/$ARCHIVE" -o "$ARCHIVE"; fi
awk -v file="$ARCHIVE" '$2==file {print}' node-shasums.txt | sha256sum -c -
tar -xf "$ARCHIVE"
export PATH="$DEST/${ARCHIVE%.tar.xz}/bin:$PATH"
mkdir -p app
cp "$ROOT/backend/package.json" "$ROOT/backend/package-lock.json" app/
cd app
npm ci --omit=dev --no-audit --no-fund > "$DEST/npm-install.log" 2>&1
node --input-type=module -e 'import {ensureBrowser} from "@remotion/renderer"; console.log(await ensureBrowser({chromeMode:"headless-shell",browserExecutable:null}));' > "$DEST/browser-install.log" 2>&1
node -e 'const fs=require("fs"),path=require("path");function size(p){const s=fs.lstatSync(p);if(s.isSymbolicLink())return 0;return s.isDirectory()?fs.readdirSync(p).reduce((n,f)=>n+size(path.join(p,f)),0):s.size;}const result={productionDependencies:size("node_modules"),nodeVersion:process.version,platform:process.platform};fs.writeFileSync("../dependencies.json",JSON.stringify(result,null,2));console.log(result);'
