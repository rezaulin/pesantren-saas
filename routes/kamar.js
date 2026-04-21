const express = require('express');
const router = express.Router();
const { dbQuery, dbGet, dbInsert, dbUpdate, dbDelete } = require('../db');
const { requireAdmin } = require('../middleware/admin');

router.get('/', async (req, res) => {
  try {
    const rows = await dbQuery('SELECT k.*, (SELECT COUNT(*) FROM santri s WHERE s.kamar_id = k.id AND s.status = "aktif") as jumlah_santri FROM kamar k WHERE k.sekolah_id = ? ORDER BY k.nama', [req.sekolah_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data kamar' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { nama, kapasitas, keterangan } = req.body;
    if (!nama) return res.status(400).json({ error: 'Nama kamar harus diisi' });
    const id = await dbInsert('kamar', { sekolah_id: req.sekolah_id, nama, kapasitas: kapasitas || 20, keterangan: keterangan || '' });
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menambah kamar' });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { nama, kapasitas, keterangan } = req.body;
    const data = {};
    if (nama !== undefined) data.nama = nama;
    if (kapasitas !== undefined) data.kapasitas = kapasitas;
    if (keterangan !== undefined) data.keterangan = keterangan;
    await dbUpdate('kamar', data, 'id = ? AND sekolah_id = ?', [req.params.id, req.sekolah_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengupdate kamar' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await dbDelete('kamar', 'id = ? AND sekolah_id = ?', [req.params.id, req.sekolah_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghapus kamar' });
  }
});

module.exports = router;
