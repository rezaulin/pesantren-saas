const express = require('express');
const router = express.Router();
const { dbQuery, dbGet } = require('../db');
const { checkFeature } = require('../middleware/tenant');

// Rekap absensi
router.get('/', async (req, res) => {
  try {
    const { tanggal_mulai, tanggal_akhir, kelompok_id, kegiatan_id, tipe } = req.query;
    const sid = req.sekolah_id;
    
    let result = {};
    
    if (tipe === 'malam' || !tipe) {
      // Rekap absen malam
      let sql = `SELECT s.id, s.nama, s.nis,
        COUNT(CASE WHEN am.status = 'hadir' THEN 1 END) as hadir,
        COUNT(CASE WHEN am.status = 'izin' THEN 1 END) as izin,
        COUNT(CASE WHEN am.status = 'sakit' THEN 1 END) as sakit,
        COUNT(CASE WHEN am.status = 'alpha' THEN 1 END) as alpha
        FROM santri s
        LEFT JOIN absen_malam am ON s.id = am.santri_id AND am.sekolah_id = ?
        WHERE s.sekolah_id = ? AND s.status = "aktif"`;
      const vals = [sid, sid];
      if (tanggal_mulai) { sql += ' AND (am.tanggal >= ? OR am.tanggal IS NULL)'; vals.push(tanggal_mulai); }
      if (tanggal_akhir) { sql += ' AND (am.tanggal <= ? OR am.tanggal IS NULL)'; vals.push(tanggal_akhir); }
      sql += ' GROUP BY s.id ORDER BY s.nama';
      result.absen_malam = await dbQuery(sql, vals);
    }
    
    if (tipe === 'sekolah' || !tipe) {
      // Rekap absen sekolah
      let sql = `SELECT s.id, s.nama, s.nis, ks.nama as kelas_nama,
        COUNT(CASE WHEN ask.status = 'hadir' THEN 1 END) as hadir,
        COUNT(CASE WHEN ask.status = 'izin' THEN 1 END) as izin,
        COUNT(CASE WHEN ask.status = 'sakit' THEN 1 END) as sakit,
        COUNT(CASE WHEN ask.status = 'alpha' THEN 1 END) as alpha
        FROM santri s
        LEFT JOIN absen_sekolah ask ON s.id = ask.santri_id AND ask.sekolah_id = ?
        LEFT JOIN kelas_sekolah ks ON s.kelas_id = ks.id
        WHERE s.sekolah_id = ? AND s.status = "aktif"`;
      const vals = [sid, sid];
      if (tanggal_mulai) { sql += ' AND (ask.tanggal >= ? OR ask.tanggal IS NULL)'; vals.push(tanggal_mulai); }
      if (tanggal_akhir) { sql += ' AND (ask.tanggal <= ? OR ask.tanggal IS NULL)'; vals.push(tanggal_akhir); }
      sql += ' GROUP BY s.id ORDER BY s.nama';
      result.absen_sekolah = await dbQuery(sql, vals);
    }
    
    if (tipe === 'kegiatan' || !tipe) {
      // Rekap absensi kegiatan
      let sql = `SELECT s.id, s.nama, s.nis, k.nama as kegiatan_nama, kl.nama as kelompok_nama,
        COUNT(CASE WHEN ab.status = 'hadir' THEN 1 END) as hadir,
        COUNT(CASE WHEN ab.status = 'izin' THEN 1 END) as izin,
        COUNT(CASE WHEN ab.status = 'sakit' THEN 1 END) as sakit,
        COUNT(CASE WHEN ab.status = 'alpha' THEN 1 END) as alpha
        FROM santri s
        LEFT JOIN absensi ab ON s.id = ab.santri_id AND ab.sekolah_id = ?
        LEFT JOIN absensi_sesi ase ON ab.sesi_id = ase.id
        LEFT JOIN kegiatan k ON ase.kegiatan_id = k.id
        LEFT JOIN kelompok kl ON ase.kelompok_id = kl.id
        LEFT JOIN santri_kelompok sk ON s.id = sk.santri_id AND sk.kelompok_id = kl.id
        WHERE s.sekolah_id = ? AND s.status = "aktif"`;
      const vals = [sid, sid];
      if (tanggal_mulai) { sql += ' AND (ase.tanggal >= ? OR ase.tanggal IS NULL)'; vals.push(tanggal_mulai); }
      if (tanggal_akhir) { sql += ' AND (ase.tanggal <= ? OR ase.tanggal IS NULL)'; vals.push(tanggal_akhir); }
      if (kelompok_id) { sql += ' AND (ase.kelompok_id = ? OR ase.kelompok_id IS NULL)'; vals.push(kelompok_id); }
      if (kegiatan_id) { sql += ' AND (ase.kegiatan_id = ? OR ase.kegiatan_id IS NULL)'; vals.push(kegiatan_id); }
      sql += ' GROUP BY s.id, k.id, kl.id ORDER BY s.nama, k.nama';
      result.absensi_kegiatan = await dbQuery(sql, vals);
    }
    
    res.json(result);
  } catch (err) {
    console.error('Rekap error:', err);
    res.status(500).json({ error: 'Gagal mengambil data rekap' });
  }
});

// Export Excel
router.get('/export/excel', checkFeature('export_excel'), async (req, res) => {
  try {
    const ExcelJS = require('exceljs');
    const { tanggal_mulai, tanggal_akhir, tipe } = req.query;
    const sid = req.sekolah_id;
    
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Rekap Absensi');
    
    // Header
    sheet.columns = [
      { header: 'No', key: 'no', width: 5 },
      { header: 'NIS', key: 'nis', width: 15 },
      { header: 'Nama Santri', key: 'nama', width: 30 },
      { header: 'Hadir', key: 'hadir', width: 10 },
      { header: 'Izin', key: 'izin', width: 10 },
      { header: 'Sakit', key: 'sakit', width: 10 },
      { header: 'Alpha', key: 'alpha', width: 10 },
      { header: 'Total', key: 'total', width: 10 }
    ];
    
    // Get data
    let sql = `SELECT s.nama, s.nis,
      COUNT(CASE WHEN am.status = 'hadir' THEN 1 END) as hadir,
      COUNT(CASE WHEN am.status = 'izin' THEN 1 END) as izin,
      COUNT(CASE WHEN am.status = 'sakit' THEN 1 END) as sakit,
      COUNT(CASE WHEN am.status = 'alpha' THEN 1 END) as alpha
      FROM santri s LEFT JOIN absen_malam am ON s.id = am.santri_id AND am.sekolah_id = ?
      WHERE s.sekolah_id = ? AND s.status = "aktif"`;
    const vals = [sid, sid];
    if (tanggal_mulai) { sql += ' AND (am.tanggal >= ? OR am.tanggal IS NULL)'; vals.push(tanggal_mulai); }
    if (tanggal_akhir) { sql += ' AND (am.tanggal <= ? OR am.tanggal IS NULL)'; vals.push(tanggal_akhir); }
    sql += ' GROUP BY s.id ORDER BY s.nama';
    
    const data = await dbQuery(sql, vals);
    data.forEach((row, i) => {
      sheet.addRow({
        no: i + 1,
        nis: row.nis,
        nama: row.nama,
        hadir: row.hadir,
        izin: row.izin,
        sakit: row.sakit,
        alpha: row.alpha,
        total: row.hadir + row.izin + row.sakit + row.alpha
      });
    });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=rekap-absensi.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export Excel error:', err);
    res.status(500).json({ error: 'Gagal export Excel' });
  }
});

// Export PDF (Raport)
router.get('/export/pdf/:santriId', checkFeature('raport_pdf'), async (req, res) => {
  try {
    const PDFDocument = require('pdfkit');
    const sid = req.sekolah_id;
    const santriId = req.params.santriId;
    
    const santri = await dbGet('SELECT s.*, k.nama as kamar_nama, ks.nama as kelas_nama FROM santri s LEFT JOIN kamar k ON s.kamar_id = k.id LEFT JOIN kelas_sekolah ks ON s.kelas_id = ks.id WHERE s.id = ? AND s.sekolah_id = ?', [santriId, sid]);
    if (!santri) return res.status(404).json({ error: 'Santri tidak ditemukan' });
    
    const sekolah = req.sekolah;
    
    const absenMalam = await dbGet(`SELECT 
      COUNT(CASE WHEN status = 'hadir' THEN 1 END) as hadir,
      COUNT(CASE WHEN status = 'izin' THEN 1 END) as izin,
      COUNT(CASE WHEN status = 'sakit' THEN 1 END) as sakit,
      COUNT(CASE WHEN status = 'alpha' THEN 1 END) as alpha
      FROM absen_malam WHERE sekolah_id = ? AND santri_id = ?`, [sid, santriId]);
    
    const pelanggaran = await dbQuery('SELECT * FROM pelanggaran WHERE sekolah_id = ? AND santri_id = ? ORDER BY tanggal DESC LIMIT 10', [sid, santriId]);
    const catatan = await dbQuery('SELECT c.*, u.nama as ustadz_nama FROM catatan_guru c LEFT JOIN users u ON c.ustadz_id = u.id WHERE c.sekolah_id = ? AND c.santri_id = ? ORDER BY tanggal DESC', [sid, santriId]);
    
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=raport-${santri.nis || santri.nama}.pdf`);
    doc.pipe(res);
    
    // Title
    doc.fontSize(16).font('Helvetica-Bold').text(sekolah.nama, { align: 'center' });
    doc.fontSize(10).font('Helvetica').text(sekolah.alamat || '', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(14).font('Helvetica-Bold').text('RAPORT SANTRI', { align: 'center' });
    doc.moveDown(1);
    
    // Student info
    doc.fontSize(10).font('Helvetica');
    doc.text(`Nama: ${santri.nama}`);
    doc.text(`NIS: ${santri.nis || '-'}`);
    doc.text(`Kamar: ${santri.kamar_nama || '-'}`);
    doc.text(`Kelas: ${santri.kelas_nama || '-'}`);
    doc.moveDown(1);
    
    // Rekap absensi
    doc.fontSize(12).font('Helvetica-Bold').text('REKAP ABSENSI MALAM');
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Hadir: ${absenMalam?.hadir || 0} hari`);
    doc.text(`Izin: ${absenMalam?.izin || 0} hari`);
    doc.text(`Sakit: ${absenMalam?.sakit || 0} hari`);
    doc.text(`Alpha: ${absenMalam?.alpha || 0} hari`);
    doc.moveDown(1);
    
    // Pelanggaran
    if (pelanggaran.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('DAFTAR PELANGGARAN');
      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica');
      pelanggaran.forEach((p, i) => {
        doc.text(`${i+1}. ${p.tanggal} - ${p.jenis} (${p.poin} poin) - ${p.keterangan || ''}`);
      });
      doc.moveDown(1);
    }
    
    // Catatan
    if (catatan.length > 0) {
      doc.fontSize(12).font('Helvetica-Bold').text('CATATAN GURU');
      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica');
      catatan.forEach((c, i) => {
        doc.text(`${i+1}. [${c.kategori}] ${c.judul}`, { continued: true });
        doc.text(` - ${c.ustadz_nama || 'Guru'}`, { align: 'right' });
        doc.text(`   ${c.isi || ''}`, { indent: 10 });
      });
    }
    
    doc.end();
  } catch (err) {
    console.error('Export PDF error:', err);
    res.status(500).json({ error: 'Gagal export PDF' });
  }
});

module.exports = router;
