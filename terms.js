const fs = require('node:fs');
const path = require('node:path');
// Read on each request so a versioned update is visible without restarting.
function readTerms() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'terms.json'), 'utf8'));
}
function requireTermsAcceptance(req, res, next) {
  const terms = readTerms();
  if (req.body?.termsAccepted !== true || req.body?.termsVersion !== terms.version) {
    return res.status(400).json({ code: 'TERMS_ACCEPTANCE_REQUIRED', error: '最新の利用規約を最後まで確認し、同意してください。' });
  }
  req.acceptedTermsVersion = terms.version;
  next();
}
module.exports = { readTerms, requireTermsAcceptance };
