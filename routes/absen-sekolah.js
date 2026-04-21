const express = require('express');
const router = express.Router();
const { dbQuery, dbGet, dbInsert, dbUpdate, dbDelete } = require('../db');
const { requireAdmin } = require('../middleware/admin');

// Get absen sekolah by date
router.get('/', async (req, res) => {
  try {
    const { tanggal, kelas_id } = req.query;
    if (!tanggal) return res.status(400).json({ error: 'Tanggal harus diisi' });
    
    let sql = 'SELECT s.*, k.nama as kelas_nama FROM santri s LEFT JOIN kelas_sekolah k ON s.kelas_id = k.id WHERE s.sekolah_id = ? AND s.status = "aktif"';
    const vals = [req.sekolah_id];
    if (kelas_id) { sql += ' AND s.kelas_id = ?'; vals.push(kelas_id); }
    sql += ' ORDER BY s.nama';
    
    const santri = await dbQuery(sql, vals);
    const absen = await dbQuery('SELECT * FROM absen_sekolah WHERE sekolah_id = ? AND tanggal = ?', [req.sekolah_id, tanggal]);
    
    const absenMap = {};
    absen.forEach(a => { absenMap[a.santri_id] = a; });
    
    const result = santri.map(s => ({
      ...s,
      absen: absenMap[s.id] || null
    }));
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data absen sekolah' });
  }
});

// Bulk save absen sekolah
router.post('/bulk', requireAdmin, async (req, res) => {
  try {
    const { tanggal, data } = req.body;
    if (!tanggal || !Array.isArray(data)) return res.status(400).json({ error: 'Data tidak valid' });
    
    for (const item of data) {
      const existing = await dbGet('SELECT id FROM absen_sekolah WHERE sekolah_id = ? AND santri_id = ? AND tanggal = ?',
        [req.sekolah_id, item.santri_id, tanggal]);
      
      if (existing) {
        await dbUpdate('absen_sekolah', { status: item.status, keterangan: item.keterangan || '' }, 'id = ?', [existing.id]);
      } else {
        await dbInsert('absen_sekolah', {
          sekolah_id: req.sekolah_id, santri_id: item.santri_id, kelas_id: item.kelas_id || null, tanggal,
          status: item.status, keterangan: item.keterangan || ''
        });
      }
    }
    
    res.json({ success: true, message: 'Absen sekolah berhasil disimpan' });
  } catch (err) {
    console.error('Bulk absen sekolah error:', err);
    res.status(500).json({ error: 'Gagal menyimpan absen sekolah' });
  }
});

module.exports = router;
