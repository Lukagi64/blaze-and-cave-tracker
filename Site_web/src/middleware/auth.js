const crypto = require('crypto');

const API_SECRET = process.env.API_SECRET_TOKEN;

function requireAuth(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Parse "Bearer <token>" - handle extra spaces and case
    const parts = auth.trim().split(/\s+/);
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const token = parts[1];

    // Constant-time comparison to prevent timing attacks
    const secretBuffer = Buffer.from(API_SECRET || '');
    const tokenBuffer = Buffer.from(token);
    if (secretBuffer.length !== tokenBuffer.length || !crypto.timingSafeEqual(secretBuffer, tokenBuffer)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    next();
}

module.exports = requireAuth;