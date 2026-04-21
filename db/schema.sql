-- Pesantren SaaS Multi-Tenant Schema
CREATE DATABASE IF NOT EXISTS pesantren_saas;
USE pesantren_saas;

-- Tabel paket/plan
CREATE TABLE paket (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(50) NOT NULL,
  harga_bulan INT NOT NULL,
  max_santri INT NOT NULL,
  max_users INT NOT NULL,
  fitur JSON NOT NULL
);

-- Seed paket
INSERT INTO paket (nama, harga_bulan, max_santri, max_users, fitur) VALUES
('Basic', 150000, 200, 20, '{"absensi":true,"pelanggaran":true,"catatan":true,"pengumuman":true,"raport_pdf":false,"export_excel":false,"custom_logo":false,"rekap_ustadz":false}'),
('Pro', 200000, 500, 50, '{"absensi":true,"pelanggaran":true,"catatan":true,"pengumuman":true,"raport_pdf":true,"export_excel":true,"custom_logo":true,"rekap_ustadz":true}'),
('Premium', 250000, 999999, 999999, '{"absensi":true,"pelanggaran":true,"catatan":true,"pengumuman":true,"raport_pdf":true,"export_excel":true,"custom_logo":true,"rekap_ustadz":true,"custom_domain":true}');

-- Tabel sekolah (tenant)
CREATE TABLE sekolah (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nama VARCHAR(200) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  alamat TEXT,
  kepala_nama VARCHAR(200) DEFAULT '',
  nama_kota VARCHAR(100) DEFAULT '',
  logo LONGTEXT,
  background LONGTEXT,
  dashboard_bg LONGTEXT,
  app_name VARCHAR(200) DEFAULT 'Pesantren Absensi',
  paket_id INT DEFAULT 1,
  status ENUM('aktif','suspend','trial') DEFAULT 'trial',
  expired_at DATETIME,
  created_at DATETIME DEFAULT NOW(),
  INDEX idx_slug (slug),
  INDEX idx_status (status)
);

-- Tabel users
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sekolah_id INT NOT NULL,
  username VARCHAR(100) NOT NULL,
  password VARCHAR(255) NOT NULL,
  nama VARCHAR(200) NOT NULL,
  role ENUM('admin','ustadz','wali') DEFAULT 'ustadz',
  status ENUM('aktif','nonaktif') DEFAULT 'aktif',
  created_at DATETIME DEFAULT NOW(),
  INDEX idx_sekolah (sekolah_id),
  INDEX idx_username (sekolah_id, username),
  UNIQUE KEY uk_user (sekolah_id, username)
);

-- Tabel santri
CREATE TABLE santri (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sekolah_id INT NOT NULL,
  nama VARCHAR(200) NOT NULL,
  nis VARCHAR(50) DEFAULT '',
  kamar_id INT DEFAULT NULL,
  kelas_id INT DEFAULT NULL,
  nama_ayah VARCHAR(200) DEFAULT '',
  nama_ibu VARCHAR(200) DEFAULT '',
  no_hp_wali VARCHAR(20) DEFAULT '',
  foto LONGTEXT,
  status ENUM('aktif','nonaktif','lulus','keluar') DEFAULT 'aktif',
  created_at DATETIME DEFAULT NOW(),
  INDEX idx_sekolah (sekolah_id),
  INDEX idx_nis (sekolah_id, nis),
  INDEX idx_kamar (kamar_id),
  INDEX idx_kelas (kelas_id)
);

-- Tabel kamar
CREATE TABLE kamar (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sekolah_id INT NOT NULL,
  nama VARCHAR(100) NOT NULL,
  kapasitas INT DEFAULT 20,
  keterangan TEXT,
  created_at DATETIME DEFAULT NOW(),
  INDEX idx_sekolah (sekolah_id)
);

-- Tabel kelas_sekolah
CREATE TABLE kelas_sekolah (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sekolah_id INT NOT NULL,
  nama VARCHAR(100) NOT NULL,
  tingkat VARCHAR(20) DEFAULT '',
  keterangan TEXT,
  created_at DATETIME DEFAULT NOW(),
  INDEX idx_sekolah (sekolah_id)
);

-- Tabel kegiatan
CREATE TABLE kegiatan (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sekolah_id INT NOT NULL,
  nama VARCHAR(200) NOT NULL,
  jenis ENUM('harian','mingguan','bulanan','lainnya') DEFAULT 'harian',
  jam_mulai TIME DEFAULT NULL,
  jam_selesai TIME DEFAULT NULL,
  keterangan TEXT,
  created_at DATETIME DEFAULT NOW(),
  INDEX idx_sekolah (sekolah_id)
);

-- Tabel kelompok
CREATE TABLE kelompok (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sekolah_id INT NOT NULL,
  nama VARCHAR(200) NOT NULL,
  kegiatan_id INT DEFAULT NULL,
  ustadz_id INT DEFAULT NULL,
  keterangan TEXT,
  created_at DATETIME DEFAULT NOW(),
  INDEX idx_sekolah (sekolah_id),
  INDEX idx_kegiatan (kegiatan_id),
  INDEX idx_ustadz (ustadz_id)
);

-- Tabel pivot santri_kelompok
CREATE TABLE santri_kelompok (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sekolah_id INT NOT NULL,
  santri_id INT NOT NULL,
  kelompok_id INT NOT NULL,
  created_at DATETIME DEFAULT NOW(),
  INDEX idx_sekolah (sekolah_id),
  INDEX idx_santri (santri_id),
  INDEX idx_kelompok (kelompok_id),
  UNIQUE KEY uk_santri_kelompok (sekolah_id, santri_id, kelompok_id)
);

-- Tabel jadwal_umum (kegiatan harian)
CREATE TABLE jadwal_umum (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sekolah_id INT NOT NULL,
  kegiatan_id INT NOT NULL,
  hari ENUM('senin','selasa','rabu','kamis','jumat','sabtu','minggu') NOT NULL,
  jam_mulai TIME NOT NULL,
  jam_selesai TIME NOT NULL,
  keterangan TEXT,
  created_at DATETIME DEFAULT NOW(),
  INDEX idx_sekolah (sekolah_id),
  INDEX idx_kegiatan (kegiatan_id)
);

-- Tabel jadwal_sekolah
CREATE TABLE jadwal_sekolah (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sekolah_id INT NOT NULL,
  kelas_id INT NOT NULL,
  hari ENUM('senin','selasa','rabu','kamis','jumat','sabtu','minggu') NOT NULL,
  mata_pelajaran VARCHAR(200) NOT NULL,
  jam_mulai TIME NOT NULL,
  jam_selesai TIME NOT NULL,
  ustadz_id INT DEFAULT NULL,
  created_at DATETIME DEFAULT NOW(),
  INDEX idx_sekolah (sekolah_id),
  INDEX idx_kelas (kelas_id)
);

-- Tabel absensi_sesi (session absensi)
CREATE TABLE absensi_sesi (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sekolah_id INT NOT NULL,
  kegiatan_id INT NOT NULL,
  kelompok_id INT DEFAULT NULL,
  tanggal DATE NOT NULL,
  waktu_buka DATETIME DEFAULT NOW(),
  waktu_tutup DATETIME DEFAULT NULL,
  dibuka_oleh INT DEFAULT NULL,
  status ENUM('buka','tutup') DEFAULT 'buka',
  created_at DATETIME DEFAULT NOW(),
  INDEX idx_sekolah (sekolah_id),
  INDEX idx_tanggal (sekolah_id, tanggal)
);

-- Tabel absensi
CREATE TABLE absensi (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sekolah_id INT NOT NULL,
  sesi_id INT NOT NULL,
  santri_id INT NOT NULL,
  status ENUM('hadir','izin','sakit','alpha') DEFAULT 'hadir',
  keterangan TEXT,
  waktu DATETIME DEFAULT NOW(),
  created_at DATETIME DEFAULT NOW(),
  INDEX idx_sekolah (sekolah_id),
  INDEX idx_sesi (sesi_id),
  INDEX idx_santri (santri_id),
  UNIQUE KEY uk_absensi (sekolah_id, sesi_id, santri_id)
);

-- Tabel absen_malam
CREATE TABLE absen_malam (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sekolah_id INT NOT NULL,
  santri_id INT NOT NULL,
  tanggal DATE NOT NULL,
  status ENUM('hadir','izin','sakit','alpha') DEFAULT 'hadir',
  keterangan TEXT,
  created_at DATETIME DEFAULT NOW(),
  INDEX idx_sekolah (sekolah_id),
  INDEX idx_tanggal (sekolah_id, tanggal),
  UNIQUE KEY uk_absen_malam (sekolah_id, santri_id, tanggal)
);

-- Tabel absen_sekolah
CREATE TABLE absen_sekolah (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sekolah_id INT NOT NULL,
  santri_id INT NOT NULL,
  kelas_id INT DEFAULT NULL,
  tanggal DATE NOT NULL,
  status ENUM('hadir','izin','sakit','alpha') DEFAULT 'hadir',
  keterangan TEXT,
  created_at DATETIME DEFAULT NOW(),
  INDEX idx_sekolah (sekolah_id),
  INDEX idx_tanggal (sekolah_id, tanggal),
  UNIQUE KEY uk_absen_sekolah (sekolah_id, santri_id, tanggal)
);

-- Tabel pelanggaran
CREATE TABLE pelanggaran (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sekolah_id INT NOT NULL,
  santri_id INT NOT NULL,
  jenis VARCHAR(200) NOT NULL,
  poin INT DEFAULT 0,
  keterangan TEXT,
  tanggal DATE NOT NULL,
  dilaporkan_oleh INT DEFAULT NULL,
  created_at DATETIME DEFAULT NOW(),
  INDEX idx_sekolah (sekolah_id),
  INDEX idx_santri (santri_id)
);

-- Tabel catatan_guru
CREATE TABLE catatan_guru (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sekolah_id INT NOT NULL,
  santri_id INT NOT NULL,
  judul VARCHAR(200) NOT NULL,
  isi TEXT,
  kategori ENUM('akademik','behavior','lainnya') DEFAULT 'lainnya',
  ustadz_id INT DEFAULT NULL,
  tanggal DATE NOT NULL,
  created_at DATETIME DEFAULT NOW(),
  INDEX idx_sekolah (sekolah_id),
  INDEX idx_santri (santri_id)
);

-- Tabel pengumuman
CREATE TABLE pengumuman (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sekolah_id INT NOT NULL,
  judul VARCHAR(200) NOT NULL,
  isi TEXT NOT NULL,
  target ENUM('semua','ustadz','wali','admin') DEFAULT 'semua',
  aktif ENUM('ya','tidak') DEFAULT 'ya',
  tanggal DATE NOT NULL,
  created_at DATETIME DEFAULT NOW(),
  INDEX idx_sekolah (sekolah_id)
);
