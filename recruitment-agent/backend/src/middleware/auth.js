const { verifyToken } = require('../utils/jwt');

function requireAuth(...allowedRoles) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
      const payload = verifyToken(token);
      if (allowedRoles.length && !allowedRoles.includes(payload.role)) {
        return res.status(403).json({ error: 'Not authorized for this action' });
      }
      req.user = payload; // { id, role, name }
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
  };
}

module.exports = { requireAuth };
