const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token tidak ditemukan' });
  }
  
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'pesantren-saas-jwt-secret-2024');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token tidak valid atau expired' });
  }
}

// Ensure user belongs to the current tenant
function authenticateTenant(req, res, next) {
  authenticate(req, res, () => {
    if (req.user.role === 'superadmin') return next();
    if (req.sekolah_id && req.user.sekolah_id !== req.sekolah_id) {
      return res.status(403).json({ error: 'Akses ditolak untuk pesantren ini' });
    }
    next();
  });
}

module.exports = { authenticate, authenticateTenant };
