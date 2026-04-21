const express = require('express');
const router = express.Router();
const { dbQuery, dbGet, dbInsert, dbUpdate, dbDelete } = require('../db');
const { requireAdmin } = require('../middleware/admin');

// Jadwal Umum
router.get('/umum', async (req, res) => {
  try {
    const rows = await dbQuery(
      'SELECT j.*, k.nama as kegiatan_nama FROM jadwal_umum j LEFT JOIN kegiatan k ON j.kegiatan_id = k.id WHERE j.sekolah_id = ? ORDER BY FIELD(j.hari,"senin","selasa","rabu","kamis","jumat","sabtu","minggu"), j.jam_mulai',
      [req.sekolah_id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil jadwal' });
  }
});

router.post('/umum', requireAdmin, async (req, res) => {
  try {
    const { kegiatan_id, hari, jam_mulai, jam_selesai, keterangan } = req.body;
    if (!kegiatan_id || !hari || !jam_mulai || !jam_selesai) {
      return res.status(400).json({ error: 'Semua field harus diisi' });
    }
    const id = await dbInsert('jadwal_umum', {
      sekolah_id: req.sekolah_id, kegiatan_id, hari, jam_mulai, jam_selesai, keterangan: keterangan || ''
    });
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menambah jadwal' });
  }
});

router.put('/umum/:id', requireAdmin, async (req, res) => {
  try {
    const { kegiatan_id, hari, jam_mulai, jam_selesai, keterangan } = req.body;
    const data = {};
    if (kegiatan_id !== undefined) data.kegiatan_id = kegiatan_id;
    if (hari !== undefined) data.hari = hari;
    if (jam_mulai !== undefined) data.jam_mulai = jam_mulai;
    if (jam_selesai !== undefined) data.jam_selesai = jam_selesai;
    if (keterangan !== undefined) data.keterangan = keterangan;
    await dbUpdate('jadwal_umum', data, 'id = ? AND sekolah_id = ?', [req.params.id, req.sekolah_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengupdate jadwal' });
  }
});

router.delete('/umum/:id', requireAdmin, async (req, res) => {
  try {
    await dbDelete('jadwal_umum', 'id = ? AND sekolah_id = ?', [req.params.id, req.sekolah_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghapus jadwal' });
  }
});

// Jadwal Sekolah
router.get('/sekolah', async (req, res) => {
  try {
    const kelas_id = req.query.kelas_id;
    let sql = 'SELECT j.*, k.nama as kelas_nama, u.nama as ustadz_nama FROM jadwal_sekolah j LEFT JOIN kelas_sekolah k ON j.kelas_id = k.id LEFT JOIN users u ON j.ustadz_id = u.id WHERE j.sekolah_id = ?';
    const vals = [req.sekolah_id];
    if (kelas_id) { sql += ' AND j.kelas_id = ?'; vals.push(kelas_id); }
    sql += ' ORDER BY FIELD(j.hari,"senin","selasa","rabu","kamis","jumat","sabtu","minggu"), j.jam_mulai';
    const rows = await dbQuery(sql, vals);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil jadwal sekolah' });
  }
});

router.post('/sekolah', requireAdmin, async (req, res) => {
  try {
    const { kelas_id, hari, mata_pelajaran, jam_mulai, jam_selesai, ustadz_id } = req.body;
    if (!kelas_id || !hari || !mata_pelajaran || !jam_mulai || !jam_selesai) {
      return res.status(400).json({ error: 'Semua field harus diisi' });
    }
    const id = await dbInsert('jadwal_sekolah', {
      sekolah_id: req.sekolah_id, kelas_id, hari, mata_pelajaran, jam_mulai, jam_selesai, ustadz_id: ustadz_id || null
    });
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menambah jadwal' });
  }
});

router.put('/sekolah/:id', requireAdmin, async (req, res) => {
  try {
    const { kelas_id, hari, mata_pelajaran, jam_mulai, jam_selesai, ustadz_id } = req.body;
    const data = {};
    if (kelas_id !== undefined) data.kelas_id = kelas_id;
    if (hari !== undefined) data.hari = hari;
    if (mata_pelajaran !== undefined) data.mata_pelajaran = mata_pelajaran;
    if (jam_mulai !== undefined) data.jam_mulai = jam_mulai;
    if (jam_selesai !== undefined) data.jam_selesai = jam_selesai;
    if (ustadz_id !== undefined) data.ustadz_id = ustadz_id || null;
    await dbUpdate('jadwal_sekolah', data, 'id = ? AND sekolah_id = ?', [req.params.id, req.sekolah_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengupdate jadwal' });
  }
});

router.delete('/sekolah/:id', requireAdmin, async (req, res) => {
  try {
    await dbDelete('jadwal_sekolah', 'id = ? AND sekolah_id = ?', [req.params.id, req.sekolah_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghapus jadwal' });
  }
});

module.exports = router;
