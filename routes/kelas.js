const express = require('express');
const router = express.Router();
const { dbQuery, dbGet, dbInsert, dbUpdate, dbDelete } = require('../db');
const { requireAdmin } = require('../middleware/admin');

router.get('/', async (req, res) => {
  try {
    const rows = await dbQuery('SELECT k.*, (SELECT COUNT(*) FROM santri s WHERE s.kelas_id = k.id AND s.status = "aktif") as jumlah_santri FROM kelas_sekolah k WHERE k.sekolah_id = ? ORDER BY k.nama', [req.sekolah_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data kelas' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { nama, tingkat, keterangan } = req.body;
    if (!nama) return res.status(400).json({ error: 'Nama kelas harus diisi' });
    const id = await dbInsert('kelas_sekolah', { sekolah_id: req.sekolah_id, nama, tingkat: tingkat || '', keterangan: keterangan || '' });
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menambah kelas' });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { nama, tingkat, keterangan } = req.body;
    const data = {};
    if (nama !== undefined) data.nama = nama;
    if (tingkat !== undefined) data.tingkat = tingkat;
    if (keterangan !== undefined) data.keterangan = keterangan;
    await dbUpdate('kelas_sekolah', data, 'id = ? AND sekolah_id = ?', [req.params.id, req.sekolah_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengupdate kelas' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await dbDelete('kelas_sekolah', 'id = ? AND sekolah_id = ?', [req.params.id, req.sekolah_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghapus kelas' });
  }
});

module.exports = router;
