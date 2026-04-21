const express = require('express');
const router = express.Router();
const { dbQuery, dbGet, dbInsert, dbUpdate, dbDelete } = require('../db');
const { requireAdmin } = require('../middleware/admin');

// List kelompok
router.get('/', async (req, res) => {
  try {
    const rows = await dbQuery(
      'SELECT k.*, ke.nama as kegiatan_nama, u.nama as ustadz_nama, (SELECT COUNT(*) FROM santri_kelompok sk WHERE sk.kelompok_id = k.id) as jumlah_santri FROM kelompok k LEFT JOIN kegiatan ke ON k.kegiatan_id = ke.id LEFT JOIN users u ON k.ustadz_id = u.id WHERE k.sekolah_id = ? ORDER BY k.nama',
      [req.sekolah_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data kelompok' });
  }
});

// Get kelompok detail with santri
router.get('/:id', async (req, res) => {
  try {
    const kelompok = await dbGet(
      'SELECT k.*, ke.nama as kegiatan_nama, u.nama as ustadz_nama FROM kelompok k LEFT JOIN kegiatan ke ON k.kegiatan_id = ke.id LEFT JOIN users u ON k.ustadz_id = u.id WHERE k.id = ? AND k.sekolah_id = ?',
      [req.params.id, req.sekolah_id]
    );
    if (!kelompok) return res.status(404).json({ error: 'Kelompok tidak ditemukan' });
    
    const santri = await dbQuery(
      'SELECT s.* FROM santri s JOIN santri_kelompok sk ON s.id = sk.santri_id WHERE sk.kelompok_id = ? AND sk.sekolah_id = ? ORDER BY s.nama',
      [req.params.id, req.sekolah_id]
    );
    
    res.json({ ...kelompok, santri });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create kelompok
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { nama, kegiatan_id, ustadz_id, keterangan } = req.body;
    if (!nama) return res.status(400).json({ error: 'Nama kelompok harus diisi' });
    const id = await dbInsert('kelompok', {
      sekolah_id: req.sekolah_id, nama,
      kegiatan_id: kegiatan_id || null, ustadz_id: ustadz_id || null, keterangan: keterangan || ''
    });
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menambah kelompok' });
  }
});

// Update kelompok
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { nama, kegiatan_id, ustadz_id, keterangan } = req.body;
    const data = {};
    if (nama !== undefined) data.nama = nama;
    if (kegiatan_id !== undefined) data.kegiatan_id = kegiatan_id || null;
    if (ustadz_id !== undefined) data.ustadz_id = ustadz_id || null;
    if (keterangan !== undefined) data.keterangan = keterangan;
    await dbUpdate('kelompok', data, 'id = ? AND sekolah_id = ?', [req.params.id, req.sekolah_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengupdate kelompok' });
  }
});

// Delete kelompok
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await dbDelete('santri_kelompok', 'kelompok_id = ? AND sekolah_id = ?', [req.params.id, req.sekolah_id]);
    await dbDelete('kelompok', 'id = ? AND sekolah_id = ?', [req.params.id, req.sekolah_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghapus kelompok' });
  }
});

// Add santri to kelompok
router.post('/:id/santri', requireAdmin, async (req, res) => {
  try {
    const { santri_id } = req.body;
    if (!santri_id) return res.status(400).json({ error: 'Santri ID harus diisi' });
    
    const existing = await dbGet('SELECT id FROM santri_kelompok WHERE sekolah_id = ? AND santri_id = ? AND kelompok_id = ?',
      [req.sekolah_id, santri_id, req.params.id]);
    if (existing) return res.status(400).json({ error: 'Santri sudah ada di kelompok ini' });
    
    await dbInsert('santri_kelompok', {
      sekolah_id: req.sekolah_id, santri_id, kelompok_id: req.params.id
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menambah santri ke kelompok' });
  }
});

// Remove santri from kelompok
router.delete('/:id/santri/:santriId', requireAdmin, async (req, res) => {
  try {
    await dbDelete('santri_kelompok', 'kelompok_id = ? AND santri_id = ? AND sekolah_id = ?',
      [req.params.id, req.params.santriId, req.sekolah_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghapus santri dari kelompok' });
  }
});

// Bulk add santri to kelompok
router.post('/:id/santri/bulk', requireAdmin, async (req, res) => {
  try {
    const { santri_ids } = req.body;
    if (!Array.isArray(santri_ids)) return res.status(400).json({ error: 'santri_ids harus array' });
    
    let added = 0;
    for (const sid of santri_ids) {
      try {
        const existing = await dbGet('SELECT id FROM santri_kelompok WHERE sekolah_id = ? AND santri_id = ? AND kelompok_id = ?',
          [req.sekolah_id, sid, req.params.id]);
        if (!existing) {
          await dbInsert('santri_kelompok', { sekolah_id: req.sekolah_id, santri_id: sid, kelompok_id: req.params.id });
          added++;
        }
      } catch (e) {}
    }
    res.json({ success: true, added });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menambah santri' });
  }
});

module.exports = router;
