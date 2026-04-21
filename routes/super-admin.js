const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { dbQuery, dbGet, dbInsert, dbUpdate } = require('../db');
const { requireSuperAdmin } = require('../middleware/admin');

// List all sekolah
router.get('/sekolah', requireSuperAdmin, async (req, res) => {
  try {
    const rows = await dbQuery(
      'SELECT s.*, p.nama as paket_nama, p.harga_bulan, p.fitur, (SELECT COUNT(*) FROM santri st WHERE st.sekolah_id = s.id) as jumlah_santri, (SELECT COUNT(*) FROM users u WHERE u.sekolah_id = s.id) as jumlah_users FROM sekolah s LEFT JOIN paket p ON s.paket_id = p.id ORDER BY s.created_at DESC'
    );
    rows.forEach(r => {
      if (typeof r.fitur === 'string') r.fitur = JSON.parse(r.fitur);
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data sekolah' });
  }
});

// Get single sekolah detail
router.get('/sekolah/:id', requireSuperAdmin, async (req, res) => {
  try {
    const sekolah = await dbGet(
      'SELECT s.*, p.nama as paket_nama, p.harga_bulan, p.max_santri, p.max_users, p.fitur FROM sekolah s LEFT JOIN paket p ON s.paket_id = p.id WHERE s.id = ?',
      [req.params.id]
    );
    if (!sekolah) return res.status(404).json({ error: 'Sekolah tidak ditemukan' });
    if (typeof sekolah.fitur === 'string') sekolah.fitur = JSON.parse(sekolah.fitur);
    res.json(sekolah);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new tenant
router.post('/sekolah', requireSuperAdmin, async (req, res) => {
  try {
    const { nama, slug, admin_nama, admin_username, admin_password, paket_id, alamat, nama_kota } = req.body;
    
    if (!nama || !slug || !admin_nama || !admin_username || !admin_password) {
      return res.status(400).json({ error: 'Semua field wajib harus diisi' });
    }
    
    const existing = await dbGet('SELECT id FROM sekolah WHERE slug = ?', [slug]);
    if (existing) return res.status(400).json({ error: 'Slug sudah digunakan' });
    
    const expiredAt = new Date();
    expiredAt.setMonth(expiredAt.getMonth() + 1);
    
    const sekolahId = await dbInsert('sekolah', {
      nama, slug, alamat: alamat || '', nama_kota: nama_kota || '',
      app_name: 'Pesantren Absensi',
      paket_id: paket_id || 1,
      status: 'trial',
      expired_at: expiredAt.toISOString().slice(0, 19).replace('T', ' ')
    });
    
    const hashedPass = await bcrypt.hash(admin_password, 10);
    await dbInsert('users', {
      sekolah_id: sekolahId,
      username: admin_username,
      password: hashedPass,
      nama: admin_nama,
      role: 'admin'
    });
    
    res.json({ success: true, id: sekolahId, message: 'Pesantren berhasil dibuat' });
  } catch (err) {
    console.error('Create sekolah error:', err);
    res.status(500).json({ error: 'Gagal membuat pesantren' });
  }
});

// Update sekolah (paket, status, extend)
router.put('/sekolah/:id', requireSuperAdmin, async (req, res) => {
  try {
    const { paket_id, status, expired_at, nama, alamat, nama_kota } = req.body;
    const data = {};
    if (paket_id !== undefined) data.paket_id = paket_id;
    if (status !== undefined) data.status = status;
    if (expired_at !== undefined) data.expired_at = expired_at;
    if (nama !== undefined) data.nama = nama;
    if (alamat !== undefined) data.alamat = alamat;
    if (nama_kota !== undefined) data.nama_kota = nama_kota;
    
    await dbUpdate('sekolah', data, 'id = ?', [req.params.id]);
    res.json({ success: true, message: 'Pesantren berhasil diupdate' });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengupdate pesantren' });
  }
});

// Activate sekolah (after payment)
router.post('/sekolah/:id/activate', requireSuperAdmin, async (req, res) => {
  try {
    const { months } = req.body;
    const m = months || 1;
    
    const sekolah = await dbGet('SELECT * FROM sekolah WHERE id = ?', [req.params.id]);
    if (!sekolah) return res.status(404).json({ error: 'Sekolah tidak ditemukan' });
    
    let newExpiry = new Date();
    if (sekolah.expired_at && new Date(sekolah.expired_at) > new Date()) {
      newExpiry = new Date(sekolah.expired_at);
    }
    newExpiry.setMonth(newExpiry.getMonth() + m);
    
    await dbUpdate('sekolah', {
      status: 'aktif',
      expired_at: newExpiry.toISOString().slice(0, 19).replace('T', ' ')
    }, 'id = ?', [req.params.id]);
    
    res.json({ success: true, message: `Pesantren diaktifkan selama ${m} bulan`, expired_at: newExpiry });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengaktifkan pesantren' });
  }
});

// Extend trial
router.post('/sekolah/:id/extend-trial', requireSuperAdmin, async (req, res) => {
  try {
    const { days } = req.body;
    const d = days || 7;
    
    const sekolah = await dbGet('SELECT * FROM sekolah WHERE id = ?', [req.params.id]);
    if (!sekolah) return res.status(404).json({ error: 'Sekolah tidak ditemukan' });
    
    let newExpiry = new Date();
    if (sekolah.expired_at && new Date(sekolah.expired_at) > new Date()) {
      newExpiry = new Date(sekolah.expired_at);
    }
    newExpiry.setDate(newExpiry.getDate() + d);
    
    await dbUpdate('sekolah', {
      status: 'trial',
      expired_at: newExpiry.toISOString().slice(0, 19).replace('T', ' ')
    }, 'id = ?', [req.params.id]);
    
    res.json({ success: true, message: `Trial diperpanjang ${d} hari` });
  } catch (err) {
    res.status(500).json({ error: 'Gagal memperpanjang trial' });
  }
});

// Get stats
router.get('/stats', requireSuperAdmin, async (req, res) => {
  try {
    const totalSekolah = await dbGet('SELECT COUNT(*) as total FROM sekolah');
    const totalAktif = await dbGet('SELECT COUNT(*) as total FROM sekolah WHERE status = "aktif"');
    const totalTrial = await dbGet('SELECT COUNT(*) as total FROM sekolah WHERE status = "trial"');
    const totalSuspend = await dbGet('SELECT COUNT(*) as total FROM sekolah WHERE status = "suspend"');
    const totalSantri = await dbGet('SELECT COUNT(*) as total FROM santri WHERE status = "aktif"');
    const totalUsers = await dbGet('SELECT COUNT(*) as total FROM users');
    
    // Calculate estimated monthly revenue
    const revenue = await dbQuery(
      'SELECT p.harga_bulan FROM sekolah s JOIN paket p ON s.paket_id = p.id WHERE s.status = "aktif"'
    );
    const monthlyRevenue = revenue.reduce((sum, r) => sum + r.harga_bulan, 0);
    
    res.json({
      total_sekolah: totalSekolah.total,
      sekolah_aktif: totalAktif.total,
      sekolah_trial: totalTrial.total,
      sekolah_suspend: totalSuspend.total,
      total_santri: totalSantri.total,
      total_users: totalUsers.total,
      monthly_revenue: monthlyRevenue
    });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil statistik' });
  }
});

// Get paket list
router.get('/paket', requireSuperAdmin, async (req, res) => {
  try {
    const rows = await dbQuery('SELECT * FROM paket ORDER BY harga_bulan');
    rows.forEach(r => {
      if (typeof r.fitur === 'string') r.fitur = JSON.parse(r.fitur);
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
