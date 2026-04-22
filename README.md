# Pesantren Absensi SaaS

Sistem manajemen pesantren berbasis web dengan arsitektur multi-tenant. Setiap pesantren dapat subdomain sendiri (contoh: `darul-hikmah.pesantrenku.tech`).

## Fitur

### Paket Langganan
| Paket | Harga/Bulan | Max Santri | Max Users | Fitur Tambahan |
|-------|-------------|------------|-----------|----------------|
| Basic | Rp 150.000 | 200 | 20 | Absensi, Pelanggaran, Catatan, Pengumuman |
| Pro | Rp 200.000 | 500 | 50 | + Raport PDF, Export Excel, Custom Logo, Rekap Ustadz |
| Premium | Rp 250.000 | Unlimited | Unlimited | + Custom Domain |

### Fitur Sistem
- **Multi-tenant**: Setiap pesantren punya subdomain sendiri
- **Manajemen Santri**: CRUD, import, filter by kamar/kelas/status
- **Kamar & Kelas**: Manajemen asrama dan kelas
- **Kegiatan & Kelompok**: Atur kegiatan, buat kelompok, assign santri
- **Jadwal**: Jadwal umum (harian) & jadwal sekolah per kelas
- **Absensi**: Buka sesi, isi absensi per santri, tutup sesi
- **Absen Malam & Sekolah**: Bulk input per tanggal
- **Pelanggaran**: Catat pelanggaran dengan poin
- **Catatan Guru**: Notes per santri (akademik/behavior)
- **Pengumuman**: Broadcast ke semua/ustadz/wali/admin
- **Rekap & Export**: Ringkasan absensi, export Excel & PDF
- **Super Admin Panel**: Kelola semua pesantren, aktifkan/extend, statistik

### Role Pengguna
- **Admin**: Akses penuh semua fitur
- **Ustadz**: Absensi, kelompok, pelanggaran, catatan, pengumuman
- **Wali**: Lihat absensi anak, pengumuman
- **Super Admin**: Panel terpisah untuk kelola semua tenant

---

## Instalasi Cepat (One Click)

Dari fresh VPS Ubuntu, cukup 1 command:

```bash
curl -sSL https://raw.githubusercontent.com/rezaulin/pesantren-saas/master/install.sh | bash
```

Atau manual:
```bash
wget https://raw.githubusercontent.com/rezaulin/pesantren-saas/master/install.sh
bash install.sh
```

Installer akan otomatis:
- Install Node.js 18, MySQL, Nginx, PM2
- Setup database & import schema
- Konfigurasi .env & Nginx
- Start aplikasi dengan PM2 (auto-restart on boot)

Kamu cukup input:
- Domain (contoh: `pesantrenku.tech`)
- DB password
- Port (default 3000)
- Super Admin username & password

Setelah install selesai, ikuti instruksi di terminal untuk setting DNS & SSL.

---

## Instalasi Manual (Step by Step)

### Prerequisites
- VPS Ubuntu 20.04+ (minimal 1 vCPU, 1 GB RAM)
- Domain utama (contoh: `pesantrenku.tech`)
- Node.js 18+
- MySQL 8.0+
- Nginx
- DNS wildcard di Cloudflare atau registrar domain

### 1. Setup VPS

```bash
# Update sistem
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install MySQL
sudo apt install -y mysql-server
sudo mysql_secure_installation

# Install Nginx
sudo apt install -y nginx

# Install PM2 (process manager)
sudo npm install -g pm2
```

### 2. Setup Database

```bash
sudo mysql -u root -p
```

```sql
CREATE DATABASE pesantren_saas;
CREATE USER 'pesantren'@'localhost' IDENTIFIED BY 'pesantren123';
GRANT ALL PRIVILEGES ON pesantren_saas.* TO 'pesantren'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Import schema:
```bash
mysql -u pesantren -p pesantren_saas < /root/pesantren-saas/db/schema.sql
```

### 3. Clone & Setup Project

```bash
cd /root
git clone <repo-url> pesantren-saas
cd pesantren-saas
npm install
```

### 4. Konfigurasi Environment

```bash
cp .env.example .env
nano .env
```

Isi `.env`:
```env
DB_HOST=localhost
DB_USER=pesantren
DB_PASS=PASSWORD_ANDA
DB_NAME=pesantren_saas
PORT=3000
JWT_SECRET=ganti-dengan-random-string-panjang
DOMAIN=pesantrenku.tech
SUPER_ADMIN_USER=superadmin
SUPER_ADMIN_PASS=ganti-password-ini
```

Generate JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. Konfigurasi Domain & DNS

Sistem ini menggunakan **subdomain otomatis** untuk setiap pesantren. Contoh:
- Domain utama: `pesantrenku.tech` → landing page
- Subdomain: `darul-hikmah.pesantrenku.tech` → dashboard pesantren Darul Hikmah
- Subdomain: `al-falah.pesantrenku.tech` → dashboard pesantren Al-Falah

Agar subdomain baru langsung aktif tanpa perlu setting DNS satu-satu, kita pakai **DNS Wildcard**.

#### 5a. Point Domain ke VPS

Pastikan domain kamu sudah mengarah ke nameserver Cloudflare:
1. Login ke Cloudflare → **Add a Site** → masukkan domain (contoh: `pesantrenku.tech`)
2. Cloudflare akan kasih 2 nameserver, contoh:
   - `bethany.ns.cloudflare.com`
   - `glen.ns.cloudflare.com`
3. Buka dashboard registrar domain (Niagahoster, Namecheap, dll) → ganti nameserver ke yang dikasih Cloudflare
4. Tunggu propagasi (bisa 5 menit - 24 jam)

#### 5b. Tambah DNS Records di Cloudflare

Login ke Cloudflare → pilih domain → **DNS** → **Records**

Tambahkan **2 record** berikut:

**Record 1 — Domain utama:**
| Field | Value |
|-------|-------|
| Type | `A` |
| Name | `@` |
| IPv4 address | `IP_VPS_KAMU` (contoh: `167.71.247.137`) |
| Proxy status | **Proxied** (icon oranye ON) |
| TTL | Auto |

**Record 2 — Wildcard (semua subdomain):**
| Field | Value |
|-------|-------|
| Type | `A` |
| Name | `*` |
| IPv4 address | `IP_VPS_KAMU` |
| Proxy status | **Proxied** (icon oranye ON) |
| TTL | Auto |

Hasilnya akan seperti ini:
```
Type    Name    Content          Proxy     TTL
A       @       167.71.247.137   Proxied   Auto
A       *       167.71.247.137   Proxied   Auto
```

#### 5c. Verifikasi DNS

Tunggu beberapa menit, lalu test:
```bash
# Test domain utama
nslookup pesantrenku.tech

# Test subdomain (harus resolve ke IP VPS)
nslookup test.pesantrenku.tech
nslookup darul-hikmah.pesantrenku.tech
```

Semua harus return IP VPS kamu.

#### 5d. Aktifkan SSL di Cloudflare

Di Cloudflare → **SSL/TLS**:
1. Pilih mode **Full (Strict)** jika sudah pasang SSL di VPS
2. Atau **Flexible** jika belum (Cloudflare handle SSL, VPS pakai HTTP)

Recommended: pakai **Full (Strict)** + pasang SSL di VPS juga (lihat langkah 7).

### 6. Konfigurasi Nginx

```bash
sudo nano /etc/nginx/sites-available/pesantren-saas
```

```nginx
server {
    listen 80;
    server_name pesantrenku.tech *.pesantrenku.tech;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/pesantren-saas /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 7. Setup SSL dengan Let's Encrypt

Karena kita pakai wildcard subdomain, perlu **wildcard SSL certificate**.

#### Opsi A: Pakai Cloudflare Proxy (Paling Mudah)

Kalau Cloudflare Proxy sudah ON (icon oranye di step 5b), SSL otomatis dihandle Cloudflare. Kamu bisa skip langkah ini.

Di VPS cukup pastikan Nginx listen di port 80 (Cloudflare yang handle HTTPS).

#### Opsi B: Wildcard SSL dari Let's Encrypt (Recommended)

```bash
sudo apt install -y certbot python3-certbot-nginx

# Generate wildcard cert (butuh DNS challenge)
sudo certbot certonly --manual --preferred-challenges dns \
  -d "pesantrenku.tech" \
  -d "*.pesantrenku.tech"
```

Certbot akan minta kamu tambahkan **TXT record** di DNS:
1. Buka Cloudflare → DNS → Records
2. Tambah record baru:
   - Type: `TXT`
   - Name: `_acme-challenge`
   - Content: (dikasih certbot)
3. Tunggu beberapa detik, lalu tekan Enter di terminal certbot
4. Cert akan disimpan di `/etc/letsencrypt/live/pesantrenku.tech/`

Update Nginx config untuk pakai SSL:
```nginx
server {
    listen 443 ssl;
    server_name pesantrenku.tech *.pesantrenku.tech;

    ssl_certificate /etc/letsencrypt/live/pesantrenku.tech/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pesantrenku.tech/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name pesantrenku.tech *.pesantrenku.tech;
    return 301 https://$host$request_uri;
}
```

Auto-renew cert:
```bash
# Test renew
sudo certbot renew --dry-run

# Certbot biasanya auto-setup cron, tapi cek:
sudo systemctl status certbot.timer
```

### 8. Start Aplikasi

```bash
cd /root/pesantren-saas
pm2 start server.js --name pesantren-saas
pm2 save
pm2 startup
```

### 9. Verifikasi

```bash
# Cek status
pm2 status pesantren-saas

# Cek log
pm2 logs pesantren-saas

# Test akses
curl http://localhost:3000
```

Buka browser: `https://pesantrenku.tech`

---

## Deploy untuk Pelanggan Baru

Ketika ada pesantren baru yang ingin menggunakan jasa:

> **PENTING: Subdomain otomatis!** Karena kita pakai DNS wildcard (`*.pesantrenku.tech`), kamu **tidak perlu** menambahkan DNS record baru setiap ada pelanggan. Cukup buat tenant di Super Admin, subdomain langsung aktif. Contoh: buat tenant dengan slug `darul-hikmah`, maka `darul-hikmah.pesantrenku.tech` langsung bisa diakses tanpa konfigurasi DNS tambahan.

### Langkah 1: Tambah Tenant via Super Admin

1. Login ke `https://pesantrenku.tech/login.html`
2. Pilih tab **Super Admin**
3. Login dengan kredensial super admin
4. Klik **Tambah** di menu Kelola Sekolah
5. Isi:
   - **Nama**: Nama pesantren (contoh: "Darul Hikmah")
   - **Slug**: Subdomain (contoh: "darul-hikmah") → akses di `darul-hikmah.pesantrenku.tech`
   - **Admin Nama**: Nama pengurus
   - **Admin Username**: Username untuk login
   - **Admin Password**: Password sementara

### Langkah 2: Aktifkan Langganan

1. Di Super Admin → Kelola Sekolah
2. Klik tombol **Aktifkan** pada pesantren tersebut
3. Pilih durasi (bulan)
4. Status berubah dari "Trial" → "Aktif"

### Langkah 3: Berikan Akses ke Pelanggan

Kirim informasi berikut ke pelanggan:
```
URL: https://darul-hikmah.pesantrenku.tech/login.html
Username: [username yang dibuat]
Password: [password yang dibuat]
Paket: [Basic/Pro/Premium]
Berlaku sampai: [tanggal expired]
```

### Langkah 4: Pelanggan Login & Setup

Pelanggan bisa langsung:
1. Buka URL subdomain mereka
2. Login dengan kredensial yang diberikan
3. Atur pengaturan (logo, nama kepala pesantren, kota)
4. Tambah data santri, kamar, kelas, kegiatan
5. Mulai menggunakan sistem absensi

### Perpanjang Langganan

1. Login Super Admin
2. Cari pesantren di Kelola Sekolah
3. Klik **Aktifkan** → pilih berapa bulan
4. Atau **Extend Trial** untuk perpanjang masa percobaan

### Suspend Otomatis

Sistem otomatis suspend akun yang sudah expired. Pelanggan tidak bisa akses sampai diperpanjang.

---

## Struktur Project

```
pesantren-saas/
├── server.js              # Main server (Express)
├── db.js                  # Database connection (MySQL)
├── package.json           # Dependencies
├── .env                   # Environment config
├── .env.example           # Template environment
├── db/
│   └── schema.sql         # Database schema + seed data
├── middleware/
│   ├── tenant.js          # Resolve tenant dari subdomain
│   ├── auth.js            # JWT authentication
│   └── admin.js           # Super admin check
├── routes/
│   ├── santri.js          # CRUD santri
│   ├── kamar.js           # CRUD kamar
│   ├── kelas.js           # CRUD kelas
│   ├── kegiatan.js        # CRUD kegiatan
│   ├── kelompok.js        # CRUD kelompok + assign santri
│   ├── jadwal.js          # Jadwal umum & sekolah
│   ├── absensi.js         # Sesi absensi
│   ├── absen-malam.js     # Absen malam
│   ├── absen-sekolah.js   # Absen sekolah
│   ├── pelanggaran.js     # CRUD pelanggaran
│   ├── catatan.js         # CRUD catatan guru
│   ├── pengumuman.js      # CRUD pengumuman
│   ├── rekap.js           # Rekap & export
│   ├── settings.js        # Pengaturan tenant
│   ├── users.js           # Manajemen pengguna
│   └── super-admin.js     # Panel super admin
└── public/
    ├── index.html         # Landing page + registrasi
    ├── login.html         # Login page (3 tab)
    └── app.html           # Dashboard SPA (full app)
```

---

## API Endpoints

### Public (tanpa auth)
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/cek-slug/:slug` | Cek ketersediaan slug |
| POST | `/api/register-public` | Registrasi publik (trial 1 bulan) |
| GET | `/api/tenant-info` | Info tenant |
| POST | `/api/login` | Login admin/ustadz |
| POST | `/api/login-wali` | Login wali |
| POST | `/api/super/login` | Login super admin |

### Tenant (butuh auth + tenant)
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET/POST | `/api/santri/` | List / Tambah santri |
| GET/PUT/DELETE | `/api/santri/:id` | Detail / Update / Hapus |
| GET/POST | `/api/kamar/` | List / Tambah kamar |
| GET/POST | `/api/kelas/` | List / Tambah kelas |
| GET/POST | `/api/kegiatan/` | List / Tambah kegiatan |
| GET/POST | `/api/kelompok/` | List / Tambah kelompok |
| POST | `/api/kelompok/:id/santri` | Tambah santri ke kelompok |
| GET/POST | `/api/jadwal/umum` | Jadwal kegiatan harian |
| GET/POST | `/api/jadwal/sekolah` | Jadwal pelajaran per kelas |
| GET/POST | `/api/absensi/sesi` | Buka sesi absensi |
| PUT | `/api/absensi/sesi/:id/tutup` | Tutup sesi |
| POST | `/api/absensi/bulk` | Isi absensi massal |
| GET/POST | `/api/absen-malam/` | Absen malam |
| GET/POST | `/api/absen-sekolah/` | Absen sekolah |
| GET/POST | `/api/pelanggaran/` | Pelanggaran |
| GET/POST | `/api/catatan/` | Catatan guru |
| GET/POST | `/api/pengumuman/` | Pengumuman |
| GET | `/api/rekap/` | Rekap absensi |
| GET | `/api/rekap/export/excel` | Export Excel |
| GET | `/api/rekap/export/pdf/:id` | Export PDF per santri |
| GET/PUT | `/api/settings/` | Pengaturan |
| GET/POST | `/api/users/` | Manajemen pengguna |

### Super Admin (butuh auth super admin)
| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/super/stats` | Statistik global |
| GET/POST | `/api/super/sekolah` | List / Tambah sekolah |
| GET/PUT | `/api/super/sekolah/:id` | Detail / Update sekolah |
| POST | `/api/super/sekolah/:id/activate` | Aktifkan langganan |
| POST | `/api/super/sekolah/:id/extend-trial` | Perpanjang trial |
| GET | `/api/super/paket` | List paket |

---

## Troubleshooting

### Server tidak bisa start
```bash
pm2 logs pesantren-saas
# Cek error, biasanya masalah DB connection
```

### Database connection error
```bash
# Pastikan MySQL running
sudo systemctl status mysql

# Test koneksi
mysql -u pesantren -p -e "SHOW DATABASES;"
```

### Subdomain tidak resolusi
```bash
# Cek DNS wildcard
nslookup test.pesantrenku.tech

# Cek Nginx config
sudo nginx -t
```

### Reset Super Admin Password
Edit `.env`, ganti `SUPER_ADMIN_PASS`, lalu:
```bash
pm2 restart pesantren-saas
```

---

## Maintenance

### Backup Database
```bash
mysqldump -u pesantren -p pesantren_saas > backup_$(date +%Y%m%d).sql
```

### Update Aplikasi
```bash
cd /root/pesantren-saas
git pull
npm install
pm2 restart pesantren-saas
```

### Monitor
```bash
pm2 monit
```

---

## License

Private - Hak cipta milik pengembang.
