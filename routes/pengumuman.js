const express = require('express');
const router = express.Router();
const { dbQuery, dbGet, dbInsert, dbUpdate, dbDelete } = require('../db');
const { checkFeature } = require('../middleware/tenant');
const { requireAdmin } = require('../middleware/admin');

// Get pengumuman
router.get('/', checkFeature('pengumuman'), async (req, res) => {
  try {
    const rows = await dbQuery('SELECT * FROM pengumuman WHERE sekolah_id = ? AND aktif = "ya" ORDER BY tanggal DESC', [req.sekolah_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data pengumuman' });
  }
});

// Create pengumuman
router.post('/', checkFeature('pengumuman'), requireAdmin, async (req, res) => {
  try {
    const { judul, isi, target, tanggal } = req.body;
    if (!judul || !isi || !tanggal) return res.status(400).json({ error: 'Field wajib harus diisi' });
    const id = await dbInsert('pengumuman', {
      sekolah_id: req.sekolah_id, judul, isi, target: target || 'semua', aktif: 'ya', tanggal
    });
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menambah pengumuman' });
  }
});

// Update pengumuman
router.put('/:id', checkFeature('pengumuman'), requireAdmin, async (req, res) => {
  try {
    const { judul, isi, target, aktif } = req.body;
    const data = {};
    if (judul !== undefined) data.judul = judul;
    if (isi !== undefined) data.isi = isi;
    if (target !== undefined) data.target = target;
    if (aktif !== undefined) data.aktif = aktif;
    await dbUpdate('pengumuman', data, 'id = ? AND sekolah_id = ?', [req.params.id, req.sekolah_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengupdate pengumuman' });
  }
});

// Delete pengumuman
router.delete('/:id', checkFeature('pengumuman'), requireAdmin, async (req, res) => {
  try {
    await dbDelete('pengumuman', 'id = ? AND sekolah_id = ?', [req.params.id, req.sekolah_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghapus pengumuman' });
  }
});

module.exports = router;
