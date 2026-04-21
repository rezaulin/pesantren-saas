const express = require('express');
const router = express.Router();
const { dbQuery, dbGet, dbInsert, dbUpdate, dbDelete } = require('../db');
const { requireAdmin } = require('../middleware/admin');

router.get('/', async (req, res) => {
  try {
    const rows = await dbQuery('SELECT * FROM kegiatan WHERE sekolah_id = ? ORDER BY nama', [req.sekolah_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data kegiatan' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { nama, jenis, jam_mulai, jam_selesai, keterangan } = req.body;
    if (!nama) return res.status(400).json({ error: 'Nama kegiatan harus diisi' });
    const id = await dbInsert('kegiatan', {
      sekolah_id: req.sekolah_id, nama, jenis: jenis || 'harian',
      jam_mulai: jam_mulai || null, jam_selesai: jam_selesai || null, keterangan: keterangan || ''
    });
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menambah kegiatan' });
  }
});

router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { nama, jenis, jam_mulai, jam_selesai, keterangan } = req.body;
    const data = {};
    if (nama !== undefined) data.nama = nama;
    if (jenis !== undefined) data.jenis = jenis;
    if (jam_mulai !== undefined) data.jam_mulai = jam_mulai || null;
    if (jam_selesai !== undefined) data.jam_selesai = jam_selesai || null;
    if (keterangan !== undefined) data.keterangan = keterangan;
    await dbUpdate('kegiatan', data, 'id = ? AND sekolah_id = ?', [req.params.id, req.sekolah_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengupdate kegiatan' });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await dbDelete('kegiatan', 'id = ? AND sekolah_id = ?', [req.params.id, req.sekolah_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghapus kegiatan' });
  }
});

module.exports = router;
