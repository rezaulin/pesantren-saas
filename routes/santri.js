const express = require('express');
const router = express.Router();
const { dbQuery, dbGet, dbInsert, dbUpdate, dbDelete } = require('../db');
const { checkQuota } = require('../middleware/tenant');
const { requireAdmin } = require('../middleware/admin');

// List all santri
router.get('/', async (req, res) => {
  try {
    const sid = req.sekolah_id;
    const rows = await dbQuery(
      'SELECT s.*, k.nama as kamar_nama, ks.nama as kelas_nama FROM santri s LEFT JOIN kamar k ON s.kamar_id = k.id LEFT JOIN kelas_sekolah ks ON s.kelas_id = ks.id WHERE s.sekolah_id = ? ORDER BY s.nama',
      [sid]
    );
    res.json(rows);
  } catch (err) {
    console.error('Get santri error:', err);
    res.status(500).json({ error: 'Gagal mengambil data santri' });
  }
});

// Get single santri
router.get('/:id', async (req, res) => {
  try {
    const row = await dbGet(
      'SELECT s.*, k.nama as kamar_nama, ks.nama as kelas_nama FROM santri s LEFT JOIN kamar k ON s.kamar_id = k.id LEFT JOIN kelas_sekolah ks ON s.kelas_id = ks.id WHERE s.id = ? AND s.sekolah_id = ?',
      [req.params.id, req.sekolah_id]
    );
    if (!row) return res.status(404).json({ error: 'Santri tidak ditemukan' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create santri
router.post('/', requireAdmin, checkQuota('santri'), async (req, res) => {
  try {
    const { nama, nis, kamar_id, kelas_id, nama_ayah, nama_ibu, no_hp_wali } = req.body;
    if (!nama) return res.status(400).json({ error: 'Nama santri harus diisi' });
    
    const id = await dbInsert('santri', {
      sekolah_id: req.sekolah_id,
      nama, nis: nis || '', kamar_id: kamar_id || null, kelas_id: kelas_id || null,
      nama_ayah: nama_ayah || '', nama_ibu: nama_ibu || '', no_hp_wali: no_hp_wali || ''
    });
    res.json({ success: true, id, message: 'Santri berhasil ditambahkan' });
  } catch (err) {
    console.error('Create santri error:', err);
    res.status(500).json({ error: 'Gagal menambah santri' });
  }
});

// Update santri
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { nama, nis, kamar_id, kelas_id, nama_ayah, nama_ibu, no_hp_wali, status } = req.body;
    const data = {};
    if (nama !== undefined) data.nama = nama;
    if (nis !== undefined) data.nis = nis;
    if (kamar_id !== undefined) data.kamar_id = kamar_id || null;
    if (kelas_id !== undefined) data.kelas_id = kelas_id || null;
    if (nama_ayah !== undefined) data.nama_ayah = nama_ayah;
    if (nama_ibu !== undefined) data.nama_ibu = nama_ibu;
    if (no_hp_wali !== undefined) data.no_hp_wali = no_hp_wali;
    if (status !== undefined) data.status = status;
    
    const affected = await dbUpdate('santri', data, 'id = ? AND sekolah_id = ?', [req.params.id, req.sekolah_id]);
    if (!affected) return res.status(404).json({ error: 'Santri tidak ditemukan' });
    res.json({ success: true, message: 'Santri berhasil diupdate' });
  } catch (err) {
    console.error('Update santri error:', err);
    res.status(500).json({ error: 'Gagal mengupdate santri' });
  }
});

// Delete santri
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const affected = await dbDelete('santri', 'id = ? AND sekolah_id = ?', [req.params.id, req.sekolah_id]);
    if (!affected) return res.status(404).json({ error: 'Santri tidak ditemukan' });
    res.json({ success: true, message: 'Santri berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghapus santri' });
  }
});

// Bulk import santri from array
router.post('/import', requireAdmin, async (req, res) => {
  try {
    const { data } = req.body;
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: 'Data tidak valid' });
    }
    
    let success = 0, failed = 0;
    for (const item of data) {
      try {
        if (!item.nama) { failed++; continue; }
        await dbInsert('santri', {
          sekolah_id: req.sekolah_id,
          nama: item.nama,
          nis: item.nis || '',
          nama_ayah: item.nama_ayah || '',
          nama_ibu: item.nama_ibu || '',
          no_hp_wali: item.no_hp_wali || ''
        });
        success++;
      } catch (e) {
        failed++;
      }
    }
    res.json({ success: true, imported: success, failed, message: `${success} santri berhasil diimport` });
  } catch (err) {
    res.status(500).json({ error: 'Gagal import santri' });
  }
});

module.exports = router;
