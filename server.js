require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { pool, dbGet, dbInsert } = require('./db');
const { resolveTenant, loadTenant, checkExpired } = require('./middleware/tenant');
const { authenticate, authenticateTenant } = require('./middleware/auth');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Tenant resolution
app.use(resolveTenant);

// Public routes (no auth needed)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Check slug availability
app.get('/api/cek-slug/:slug', async (req, res) => {
  try {
    const existing = await dbGet('SELECT id FROM sekolah WHERE slug = ?', [req.params.slug]);
    res.json({ available: !existing });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Public registration (creates tenant + admin)
app.post('/api/register-public', async (req, res) => {
  try {
    const { nama, slug, admin_nama, admin_username, admin_password, paket_id } = req.body;
    
    if (!nama || !slug || !admin_nama || !admin_username || !admin_password) {
      return res.status(400).json({ error: 'Semua field harus diisi' });
    }
    
    // Validate slug
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return res.status(400).json({ error: 'Slug hanya boleh huruf kecil, angka, dan strip' });
    }
    
    // Check slug availability
    const existing = await dbGet('SELECT id FROM sekolah WHERE slug = ?', [slug]);
    if (existing) {
      return res.status(400).json({ error: 'Slug sudah digunakan' });
    }
    
    // Calculate trial expiry (1 month)
    const expiredAt = new Date();
    expiredAt.setMonth(expiredAt.getMonth() + 1);
    
    // Create sekolah
    const sekolahId = await dbInsert('sekolah', {
      nama,
      slug,
      app_name: 'Pesantren Absensi',
      paket_id: paket_id || 1,
      status: 'trial',
      expired_at: expiredAt.toISOString().slice(0, 19).replace('T', ' ')
    });
    
    // Create admin user
    const hashedPass = await bcrypt.hash(admin_password, 10);
    await dbInsert('users', {
      sekolah_id: sekolahId,
      username: admin_username,
      password: hashedPass,
      nama: admin_nama,
      role: 'admin',
      status: 'aktif'
    });
    
    res.json({ success: true, message: 'Pesantren berhasil didaftarkan', sekolah_id: sekolahId });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Gagal mendaftar' });
  }
});

// Get tenant info (public)
app.get('/api/tenant-info', loadTenant, async (req, res) => {
  const s = req.sekolah;
  res.json({
    id: s.id,
    nama: s.nama,
    slug: s.slug,
    app_name: s.app_name,
    logo: s.logo,
    background: s.background,
    dashboard_bg: s.dashboard_bg,
    kepala_nama: s.kepala_nama,
    nama_kota: s.nama_kota,
    paket_nama: s.paket_nama,
    status: s.status,
    fitur: s.fitur
  });
});

// Login
app.post('/api/login', loadTenant, async (req, res) => {
  try {
    const { username, password } = req.body;
    const sekolah_id = req.sekolah_id;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username dan password harus diisi' });
    }
    
    const user = await dbGet(
      'SELECT * FROM users WHERE sekolah_id = ? AND username = ? AND status = "aktif"',
      [sekolah_id, username]
    );
    
    if (!user) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Username atau password salah' });
    }
    
    const token = jwt.sign(
      { id: user.id, sekolah_id: user.sekolah_id, username: user.username, nama: user.nama, role: user.role },
      process.env.JWT_SECRET || 'pesantren-saas-jwt-secret-2024',
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      user: { id: user.id, username: user.username, nama: user.nama, role: user.role, sekolah_id: user.sekolah_id }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Wali login (by santri nama or nis)
app.post('/api/login-wali', loadTenant, async (req, res) => {
  try {
    const { identitas } = req.body;
    const sekolah_id = req.sekolah_id;
    
    if (!identitas) {
      return res.status(400).json({ error: 'Masukkan NIS atau nama santri' });
    }
    
    const santri = await dbGet(
      'SELECT * FROM santri WHERE sekolah_id = ? AND (nis = ? OR nama = ?) AND status = "aktif"',
      [sekolah_id, identitas, identitas]
    );
    
    if (!santri) {
      return res.status(401).json({ error: 'Santri tidak ditemukan' });
    }
    
    const token = jwt.sign(
      { id: santri.id, sekolah_id, role: 'wali', nama: santri.nama, santri_id: santri.id },
      process.env.JWT_SECRET || 'pesantren-saas-jwt-secret-2024',
      { expiresIn: '7d' }
    );
    
    res.json({
      token,
      user: { id: santri.id, nama: santri.nama, role: 'wali', santri_id: santri.id, sekolah_id }
    });
  } catch (err) {
    console.error('Login wali error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Super admin login (no tenant needed)
app.post('/api/super/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const superUser = process.env.SUPER_ADMIN_USER || 'superadmin';
    const superPass = process.env.SUPER_ADMIN_PASS || 'superadmin123';
    
    if (username === superUser && password === superPass) {
      const token = jwt.sign(
        { id: 0, role: 'superadmin', username: 'superadmin', nama: 'Super Admin' },
        process.env.JWT_SECRET || 'pesantren-saas-jwt-secret-2024',
        { expiresIn: '1d' }
      );
      res.json({ token, user: { role: 'superadmin', nama: 'Super Admin' } });
    } else {
      res.status(401).json({ error: 'Kredensial salah' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Mount protected routes (tenant + auth)
app.use('/api/santri', authenticateTenant, checkExpired, require('./routes/santri'));
app.use('/api/kamar', authenticateTenant, checkExpired, require('./routes/kamar'));
app.use('/api/kelas', authenticateTenant, checkExpired, require('./routes/kelas'));
app.use('/api/kegiatan', authenticateTenant, checkExpired, require('./routes/kegiatan'));
app.use('/api/kelompok', authenticateTenant, checkExpired, require('./routes/kelompok'));
app.use('/api/jadwal', authenticateTenant, checkExpired, require('./routes/jadwal'));
app.use('/api/absensi', authenticateTenant, checkExpired, require('./routes/absensi'));
app.use('/api/absen-malam', authenticateTenant, checkExpired, require('./routes/absen-malam'));
app.use('/api/absen-sekolah', authenticateTenant, checkExpired, require('./routes/absen-sekolah'));
app.use('/api/pelanggaran', authenticateTenant, checkExpired, require('./routes/pelanggaran'));
app.use('/api/catatan', authenticateTenant, checkExpired, require('./routes/catatan'));
app.use('/api/pengumuman', authenticateTenant, checkExpired, require('./routes/pengumuman'));
app.use('/api/rekap', authenticateTenant, checkExpired, require('./routes/rekap'));
app.use('/api/settings', authenticateTenant, checkExpired, require('./routes/settings'));
app.use('/api/users', authenticateTenant, checkExpired, require('./routes/users'));

// Super admin routes (no tenant)
app.use('/api/super', authenticate, require('./routes/super-admin'));

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Pesantren SaaS server running on port ${PORT}`);
  console.log(`Domain: ${process.env.DOMAIN || 'localhost'}`);
});

module.exports = app;
