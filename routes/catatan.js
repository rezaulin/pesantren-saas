const express = require('express');
const router = express.Router();
const { dbQuery, dbGet, dbInsert, dbUpdate, dbDelete } = require('../db');
const { checkFeature } = require('../middleware/tenant');

// Get catatan
router.get('/', checkFeature('catatan'), async (req, res) => {
  try {
    const { santri_id, kategori } = req.query;
    let sql = 'SELECT c.*, s.nama as santri_nama, s.nis, u.nama as ustadz_nama FROM catatan_guru c JOIN santri s ON c.santri_id = s.id LEFT JOIN users u ON c.ustadz_id = u.id WHERE c.sekolah_id = ?';
    const vals = [req.sekolah_id];
    if (santri_id) { sql += ' AND c.santri_id = ?'; vals.push(santri_id); }
    if (kategori) { sql += ' AND c.kategori = ?'; vals.push(kategori); }
    sql += ' ORDER BY c.tanggal DESC';
    const rows = await dbQuery(sql, vals);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data catatan' });
  }
});

// Create catatan
router.post('/', checkFeature('catatan'), async (req, res) => {
  try {
    const { santri_id, judul, isi, kategori, tanggal } = req.body;
    if (!santri_id || !judul || !tanggal) return res.status(400).json({ error: 'Field wajib harus diisi' });
    const id = await dbInsert('catatan_guru', {
      sekolah_id: req.sekolah_id, santri_id, judul, isi: isi || '',
      kategori: kategori || 'lainnya', ustadz_id: req.user.id, tanggal
    });
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menambah catatan' });
  }
});

// Update catatan
router.put('/:id', checkFeature('catatan'), async (req, res) => {
  try {
    const { judul, isi, kategori } = req.body;
    const data = {};
    if (judul !== undefined) data.judul = judul;
    if (isi !== undefined) data.isi = isi;
    if (kategori !== undefined) data.kategori = kategori;
    await dbUpdate('catatan_guru', data, 'id = ? AND sekolah_id = ?', [req.params.id, req.sekolah_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengupdate catatan' });
  }
});

// Delete catatan
router.delete('/:id', checkFeature('catatan'), async (req, res) => {
  try {
    await dbDelete('catatan_guru', 'id = ? AND sekolah_id = ?', [req.params.id, req.sekolah_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghapus catatan' });
  }
});

module.exports = router;
