// Build-time only: use the same optional sharp tooling as generate-brand-assets.cjs.
const sharp = require('sharp');
const fs = require('node:fs');
const path = require('node:path');
const publicPath = path.join(__dirname, '../public');
fs.mkdirSync(path.join(publicPath, 'icons'), { recursive: true });
Promise.all([192, 512].map(size => sharp(path.join(publicPath, 'favicon.svg'))
  .resize(size, size).png().toFile(path.join(publicPath, `icons/pwa-${size}.png`))))
  .catch(error => { console.error(error); process.exitCode = 1; });
