const express = require('express');
const router = express.Router();
const { dbQuery, dbGet, dbInsert, dbUpdate, dbDelete } = require('../db');
const { checkFeature } = require('../middleware/tenant');
const { requireAdmin } = require('../middleware/admin');

// Get pelanggaran
router.get('/', checkFeature('pelanggaran'), async (req, res) => {
  try {
    const { santri_id } = req.query;
    let sql = 'SELECT p.*, s.nama as santri_nama, s.nis, u.nama as pelapor_nama FROM pelanggaran p JOIN santri s ON p.santri_id = s.id LEFT JOIN users u ON p.dilaporkan_oleh = u.id WHERE p.sekolah_id = ?';
    const vals = [req.sekolah_id];
    if (santri_id) { sql += ' AND p.santri_id = ?'; vals.push(santri_id); }
    sql += ' ORDER BY p.tanggal DESC';
    const rows = await dbQuery(sql, vals);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data pelanggaran' });
  }
});

// Create pelanggaran
router.post('/', checkFeature('pelanggaran'), requireAdmin, async (req, res) => {
  try {
    const { santri_id, jenis, poin, keterangan, tanggal } = req.body;
    if (!santri_id || !jenis || !tanggal) return res.status(400).json({ error: 'Field wajib harus diisi' });
    const id = await dbInsert('pelanggaran', {
      sekolah_id: req.sekolah_id, santri_id, jenis, poin: poin || 0,
      keterangan: keterangan || '', tanggal, dilaporkan_oleh: req.user.id
    });
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menambah pelanggaran' });
  }
});

// Update pelanggaran
router.put('/:id', checkFeature('pelanggaran'), requireAdmin, async (req, res) => {
  try {
    const { jenis, poin, keterangan, tanggal } = req.body;
    const data = {};
    if (jenis !== undefined) data.jenis = jenis;
    if (poin !== undefined) data.poin = poin;
    if (keterangan !== undefined) data.keterangan = keterangan;
    if (tanggal !== undefined) data.tanggal = tanggal;
    await dbUpdate('pelanggaran', data, 'id = ? AND sekolah_id = ?', [req.params.id, req.sekolah_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengupdate pelanggaran' });
  }
});

// Delete pelanggaran
router.delete('/:id', checkFeature('pelanggaran'), requireAdmin, async (req, res) => {
  try {
    await dbDelete('pelanggaran', 'id = ? AND sekolah_id = ?', [req.params.id, req.sekolah_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghapus pelanggaran' });
  }
});

module.exports = router;
