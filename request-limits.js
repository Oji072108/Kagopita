const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// Shared across paths: changing items or email endpoints cannot evade a cooldown.
function createRequestLimits(getUser) {
  const actor = req => {
    const user = getUser(req);
    return user ? `user:${user.id}` : `ip:${ipKeyGenerator(req.ip)}`;
  };
  const limit = (name, windowMs, max, keyGenerator = actor) => rateLimit({
    windowMs, limit: max, keyGenerator, identifier: name,
    standardHeaders: 'draft-8', legacyHeaders: false,
    handler(req, res) {
      const retryAfter = Math.max(1, Math.ceil((req.rateLimit.resetTime.getTime() - Date.now()) / 1000));
      res.set('Retry-After', String(retryAfter));
      res.set('Cache-Control', 'no-store');
      res.status(429).json({
        code: 'RATE_LIMITED', retryAfter,
        error: '操作が多すぎます。少し待ってからもう一度お試しください。'
      });
    }
  });
  const writes = limit('actions', 10_000, 60);
  const toggles = limit('checks', 5_000, 12);
  const emailActor = limit('email-cooldown', 30_000, 1);
  const emailVolume = limit('email-volume', 15 * 60_000, 10);
  const emailRecipient = limit('email-recipient', 60_000, 3, req => {
    // Hash addresses rather than retaining them as keys in the limiter store.
    const email = String(req.body?.email || '').trim().toLowerCase();
    return email ? require('node:crypto').createHash('sha256').update(email).digest('hex') : actor(req);
  });
  return { writes, toggles, emailActor, emailVolume, emailRecipient };
}

module.exports = { createRequestLimits };
