// Run with sharp available (e.g. NODE_PATH=/tmp/kagopita-assets/node_modules).
const sharp = require('sharp');
const fs = require('node:fs');
const path = require('node:path');
const output = path.join(__dirname, '../public');
const cart = '<path d="M58 68h24l18 106h102l25-76H88" fill="none" stroke="white" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/><circle cx="113" cy="203" r="12" fill="white"/><circle cx="192" cy="203" r="12" fill="white"/>';
// Keep the favicon and home-screen icon aligned with the existing dark cart logo.
const icon = fs.readFileSync(path.join(output, 'logo-dark.svg'), 'utf8');
async function main() {
 fs.writeFileSync(path.join(output,'favicon.svg'),icon);
 await sharp(Buffer.from(icon)).resize(180,180).png().toFile(path.join(output,'apple-touch-icon.png'));
 const png = await sharp(Buffer.from(icon)).resize(32,32).png().toBuffer();
 const header=Buffer.alloc(22); header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);header[6]=32;header[7]=32;header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(png.length,14);header.writeUInt32LE(22,18);
 fs.writeFileSync(path.join(output,'favicon.ico'),Buffer.concat([header,png]));
 if (process.argv.includes('--icons-only')) return;
 const social=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#f0f7ef"/><rect x="32" y="32" width="1136" height="566" rx="40" fill="#fff"/><rect x="32" y="32" width="1136" height="16" rx="8" fill="#4d8f3d"/><g transform="translate(88 148) scale(.9)"><rect width="256" height="256" rx="58" fill="#4d8f3d"/>${cart}</g><g font-family="IPA Gothic" fill="#26332a"><text x="362" y="253" font-size="86" font-weight="bold">カゴピタ</text><text x="365" y="327" font-size="34">みんなで使えるお買い物リスト</text><text x="90" y="466" font-size="32" fill="#54715b">家族や友だちと共有して、買い忘れをなくそう。</text></g></svg>`;
 await sharp(Buffer.from(social)).png().toFile(path.join(output,'share-preview.png'));
}
main().catch(error=>{ console.error(error);process.exitCode=1; });
