const { dbGet, dbQuery } = require('../db');

// Resolve tenant from subdomain
function resolveTenant(req, res, next) {
  const host = req.hostname || req.headers.host || '';
  const parts = host.split('.');
  
  // Extract subdomain: subdomain.domain.com -> subdomain
  // For localhost testing: use X-Tenant-Slug header or ?slug= query param
  let slug = null;
  
  if (parts.length >= 3) {
    slug = parts[0];
  } else if (req.headers['x-tenant-slug']) {
    slug = req.headers['x-tenant-slug'];
  } else if (req.query.slug) {
    slug = req.query.slug;
  }
  
  // Skip tenant resolution for super admin, landing pages, and static files
  if (req.path.startsWith('/api/super') || req.path === '/' || req.path === '/app.html' || req.path === '/login.html' ||
      req.path.startsWith('/api/cek-slug') || req.path.startsWith('/api/register-public')) {
    return next();
  }
  
  if (!slug) {
    // For API routes that need tenant, return error
    if (req.path.startsWith('/api/')) {
      return res.status(400).json({ error: 'Tenant tidak ditemukan. Gunakan subdomain yang valid.' });
    }
    return next();
  }
  
  req.tenantSlug = slug;
  next();
}

// Load tenant data (must be called after resolveTenant for tenant routes)
async function loadTenant(req, res, next) {
  if (req.sekolah) return next();
  
  const slug = req.tenantSlug || req.headers['x-tenant-slug'] || req.query.slug;
  if (!slug) {
    return res.status(400).json({ error: 'Tenant tidak ditemukan' });
  }
  
  try {
    const sekolah = await dbGet(
      'SELECT s.*, p.nama as paket_nama, p.harga_bulan, p.max_santri, p.max_users, p.fitur FROM sekolah s LEFT JOIN paket p ON s.paket_id = p.id WHERE s.slug = ?',
      [slug]
    );
    
    if (!sekolah) {
      return res.status(404).json({ error: 'Pesantren tidak ditemukan' });
    }
    
    // Parse fitur JSON
    if (typeof sekolah.fitur === 'string') {
      sekolah.fitur = JSON.parse(sekolah.fitur);
    }
    
    req.sekolah = sekolah;
    req.sekolah_id = sekolah.id;
    next();
  } catch (err) {
    console.error('loadTenant error:', err);
    res.status(500).json({ error: 'Gagal memuat data pesantren' });
  }
}

// Check if subscription is expired
function checkExpired(req, res, next) {
  const sekolah = req.sekolah;
  if (!sekolah) return res.status(400).json({ error: 'Tenant belum dimuat' });
  
  if (sekolah.status === 'suspend') {
    return res.status(403).json({ error: 'Akun pesantren ini telah disuspend. Hubungi administrator.' });
  }
  
  if (sekolah.expired_at && new Date(sekolah.expired_at) < new Date()) {
    // Auto-suspend expired accounts
    const { dbUpdate } = require('../db');
    dbUpdate('sekolah', { status: 'suspend' }, 'id = ?', [sekolah.id]);
    return res.status(403).json({ error: 'Masa berlangganan telah habis. Silakan perpanjang untuk melanjutkan.' });
  }
  
  next();
}

// Check feature access
function checkFeature(fiturName) {
  return (req, res, next) => {
    const sekolah = req.sekolah;
    if (!sekolah) return res.status(400).json({ error: 'Tenant belum dimuat' });
    
    const fitur = sekolah.fitur || {};
    if (!fitur[fiturName]) {
      return res.status(403).json({ error: `Fitur "${fiturName}" tidak tersedia di paket ${sekolah.paket_nama}. Silakan upgrade paket Anda.` });
    }
    next();
  };
}

// Check quota
function checkQuota(tipe) {
  return async (req, res, next) => {
    const sekolah = req.sekolah;
    if (!sekolah) return res.status(400).json({ error: 'Tenant belum dimuat' });
    
    try {
      let count, max;
      if (tipe === 'santri') {
        const row = await dbGet('SELECT COUNT(*) as cnt FROM santri WHERE sekolah_id = ? AND status = "aktif"', [sekolah.id]);
        count = row.cnt;
        max = sekolah.max_santri;
      } else if (tipe === 'users') {
        const row = await dbGet('SELECT COUNT(*) as cnt FROM users WHERE sekolah_id = ? AND status = "aktif"', [sekolah.id]);
        count = row.cnt;
        max = sekolah.max_users;
      }
      
      if (count >= max) {
        return res.status(403).json({ error: `Kuota ${tipe} telah tercapai (${count}/${max}). Silakan upgrade paket Anda.` });
      }
      next();
    } catch (err) {
      console.error('checkQuota error:', err);
      next();
    }
  };
}

module.exports = { resolveTenant, loadTenant, checkExpired, checkFeature, checkQuota };
