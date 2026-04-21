const express = require('express');
const router = express.Router();
const { dbGet, dbUpdate } = require('../db');
const { requireAdmin } = require('../middleware/admin');

// Get settings (from sekolah table)
router.get('/', async (req, res) => {
  try {
    const sekolah = await dbGet('SELECT s.*, p.nama as paket_nama, p.fitur FROM sekolah s LEFT JOIN paket p ON s.paket_id = p.id WHERE s.id = ?', [req.sekolah_id]);
    if (!sekolah) return res.status(404).json({ error: 'Sekolah tidak ditemukan' });
    
    if (typeof sekolah.fitur === 'string') {
      sekolah.fitur = JSON.parse(sekolah.fitur);
    }
    
    res.json(sekolah);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil settings' });
  }
});

// Update settings
router.put('/', requireAdmin, async (req, res) => {
  try {
    const { app_name, kepala_nama, nama_kota, alamat, logo, background, dashboard_bg } = req.body;
    const data = {};
    if (app_name !== undefined) data.app_name = app_name;
    if (kepala_nama !== undefined) data.kepala_nama = kepala_nama;
    if (nama_kota !== undefined) data.nama_kota = nama_kota;
    if (alamat !== undefined) data.alamat = alamat;
    if (logo !== undefined) data.logo = logo;
    if (background !== undefined) data.background = background;
    if (dashboard_bg !== undefined) data.dashboard_bg = dashboard_bg;
    
    await dbUpdate('sekolah', data, 'id = ?', [req.sekolah_id]);
    res.json({ success: true, message: 'Settings berhasil diupdate' });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengupdate settings' });
  }
});

module.exports = router;
