const express = require('express');
const router = express.Router();
const { dbQuery, dbGet, dbInsert, dbUpdate, dbDelete } = require('../db');
const { requireAdmin } = require('../middleware/admin');

// Get absen malam by date
router.get('/', async (req, res) => {
  try {
    const { tanggal } = req.query;
    if (!tanggal) return res.status(400).json({ error: 'Tanggal harus diisi' });
    
    const santri = await dbQuery('SELECT * FROM santri WHERE sekolah_id = ? AND status = "aktif" ORDER BY nama', [req.sekolah_id]);
    const absen = await dbQuery('SELECT * FROM absen_malam WHERE sekolah_id = ? AND tanggal = ?', [req.sekolah_id, tanggal]);
    
    const absenMap = {};
    absen.forEach(a => { absenMap[a.santri_id] = a; });
    
    const result = santri.map(s => ({
      ...s,
      absen: absenMap[s.id] || null
    }));
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data absen malam' });
  }
});

// Bulk save absen malam
router.post('/bulk', requireAdmin, async (req, res) => {
  try {
    const { tanggal, data } = req.body;
    if (!tanggal || !Array.isArray(data)) return res.status(400).json({ error: 'Data tidak valid' });
    
    for (const item of data) {
      const existing = await dbGet('SELECT id FROM absen_malam WHERE sekolah_id = ? AND santri_id = ? AND tanggal = ?',
        [req.sekolah_id, item.santri_id, tanggal]);
      
      if (existing) {
        await dbUpdate('absen_malam', { status: item.status, keterangan: item.keterangan || '' }, 'id = ?', [existing.id]);
      } else {
        await dbInsert('absen_malam', {
          sekolah_id: req.sekolah_id, santri_id: item.santri_id, tanggal,
          status: item.status, keterangan: item.keterangan || ''
        });
      }
    }
    
    res.json({ success: true, message: 'Absen malam berhasil disimpan' });
  } catch (err) {
    console.error('Bulk absen malam error:', err);
    res.status(500).json({ error: 'Gagal menyimpan absen malam' });
  }
});

module.exports = router;
