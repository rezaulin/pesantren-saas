const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { dbQuery, dbGet, dbInsert, dbUpdate, dbDelete } = require('../db');
const { checkQuota } = require('../middleware/tenant');
const { requireAdmin } = require('../middleware/admin');

// List users
router.get('/', requireAdmin, async (req, res) => {
  try {
    const rows = await dbQuery('SELECT id, sekolah_id, username, nama, role, status, created_at FROM users WHERE sekolah_id = ? ORDER BY nama', [req.sekolah_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengambil data user' });
  }
});

// Create user
router.post('/', requireAdmin, checkQuota('users'), async (req, res) => {
  try {
    const { username, password, nama, role } = req.body;
    if (!username || !password || !nama) return res.status(400).json({ error: 'Semua field harus diisi' });
    
    const existing = await dbGet('SELECT id FROM users WHERE sekolah_id = ? AND username = ?', [req.sekolah_id, username]);
    if (existing) return res.status(400).json({ error: 'Username sudah digunakan' });
    
    const hashedPass = await bcrypt.hash(password, 10);
    const id = await dbInsert('users', {
      sekolah_id: req.sekolah_id, username, password: hashedPass, nama, role: role || 'ustadz'
    });
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menambah user' });
  }
});

// Update user
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { nama, role, status, password } = req.body;
    const data = {};
    if (nama !== undefined) data.nama = nama;
    if (role !== undefined) data.role = role;
    if (status !== undefined) data.status = status;
    if (password) data.password = await bcrypt.hash(password, 10);
    
    await dbUpdate('users', data, 'id = ? AND sekolah_id = ?', [req.params.id, req.sekolah_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal mengupdate user' });
  }
});

// Delete user
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await dbDelete('users', 'id = ? AND sekolah_id = ?', [req.params.id, req.sekolah_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Gagal menghapus user' });
  }
});

module.exports = router;
