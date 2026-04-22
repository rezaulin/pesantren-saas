#!/bin/bash
# ============================================================
# Pesantren SaaS - One Click Installer
# Tested on: Ubuntu 20.04 / 22.04 / 24.04
# Usage: bash install.sh
# ============================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Helper
info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Banner
echo -e "${CYAN}"
cat << 'EOF'
  _____                          _   _       _        _____  _____ 
 |  __ \                        | | | |     | |      / ____|/ ____|
 | |__) |__  ___ _ __   ___  ___| |_| |_   _| |__   | (___ | |     
 |  ___/ _ \/ _ \ '_ \ / _ \/ __| __| | | | | '_ \   \___ \| |     
 | |  |  __/  __/ | | |  __/ (__| |_| | |_| | |_) |  ____) | |____ 
 |_|   \___|\___|_| |_|\___|\___|\__|_|\__,_|_.__/  |_____/ \_____|
                                                                   
EOF
echo -e "${NC}"
echo "  Multi-tenant Pesantren Absensi SaaS Platform"
echo "  One Click Installer"
echo ""

# Check root
if [[ $EUID -ne 0 ]]; then
   error "Jalankan sebagai root: sudo bash install.sh"
fi

# ============================================================
# INPUT KONFIGURASI
# ============================================================
echo -e "${CYAN}═══════════════════════════════════════════${NC}"
echo -e "${CYAN}  Konfigurasi${NC}"
echo -e "${CYAN}═══════════════════════════════════════════${NC}"
echo ""

read -p "Domain utama (contoh: pesantrenku.tech): " DOMAIN
if [[ -z "$DOMAIN" ]]; then
    error "Domain tidak boleh kosong!"
fi

read -p "DB password untuk user pesantren [pesantren123]: " DB_PASS
DB_PASS=${DB_PASS:-pesantren123}

read -p "Port aplikasi [3000]: " APP_PORT
APP_PORT=${APP_PORT:-3000}

read -p "Super Admin username [superadmin]: " SUPER_USER
SUPER_USER=${SUPER_USER:-superadmin}

read -p "Super Admin password [admin123]: " SUPER_PASS
SUPER_PASS=${SUPER_PASS:-admin123}

# Generate JWT secret
JWT_SECRET=$(openssl rand -hex 32)

echo ""
info "Domain: $DOMAIN"
info "Port: $APP_PORT"
info "Super Admin: $SUPER_USER / $SUPER_PASS"
echo ""

# ============================================================
# STEP 1: INSTALL DEPENDENCIES
# ============================================================
info "Step 1/8: Menginstall dependencies sistem..."

apt update -qq
apt install -y -qq curl git nginx > /dev/null 2>&1

# Install Node.js 18
if ! command -v node &> /dev/null; then
    info "Installing Node.js 18..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - > /dev/null 2>&1
    apt install -y -qq nodejs > /dev/null 2>&1
fi

NODE_VER=$(node -v)
success "Node.js $NODE_VER terinstall"

# Install PM2
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2 > /dev/null 2>&1
fi
success "PM2 terinstall"

# ============================================================
# STEP 2: INSTALL MYSQL
# ============================================================
info "Step 2/8: Menginstall MySQL..."

if ! command -v mysql &> /dev/null; then
    DEBIAN_FRONTEND=noninteractive apt install -y -qq mysql-server > /dev/null 2>&1
    systemctl enable mysql
    systemctl start mysql
fi

success "MySQL terinstall"

# ============================================================
# STEP 3: SETUP DATABASE
# ============================================================
info "Step 3/8: Setup database..."

mysql -u root <<EOSQL
CREATE DATABASE IF NOT EXISTS pesantren_saas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'pesantren'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON pesantren_saas.* TO 'pesantren'@'localhost';
FLUSH PRIVILEGES;
EOSQL

success "Database pesantren_saas dibuat"

# ============================================================
# STEP 4: CLONE & SETUP PROJECT
# ============================================================
info "Step 4/8: Setup project..."

INSTALL_DIR="/root/pesantren-saas"

if [[ -d "$INSTALL_DIR" ]]; then
    warn "Direktori $INSTALL_DIR sudah ada, pull update..."
    cd "$INSTALL_DIR"
    git pull origin master 2>/dev/null || true
else
    git clone https://github.com/rezaulin/pesantren-saas.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi

npm install --production > /dev/null 2>&1

success "Project siap di $INSTALL_DIR"

# ============================================================
# STEP 5: IMPORT SCHEMA
# ============================================================
info "Step 5/8: Import database schema..."

mysql -u root pesantren_saas < "$INSTALL_DIR/db/schema.sql"

# MySQL performance tuning
info "Optimasi MySQL untuk production..."
mysql -u root <<'TUNING'
SET GLOBAL innodb_buffer_pool_size = 256 * 1024 * 1024;
SET GLOBAL max_connections = 200;
SET GLOBAL query_cache_type = 1;
SET GLOBAL query_cache_size = 64 * 1024 * 1024;
TUNING

# Make persistent via config
cat > /etc/mysql/conf.d/pesantren-tuning.cnf << EOF
[mysqld]
innodb_buffer_pool_size = 256M
max_connections = 200
query_cache_type = 1
query_cache_size = 64M
innodb_log_file_size = 64M
innodb_flush_log_at_trx_commit = 2
EOF

systemctl restart mysql

success "Schema imported & MySQL dioptimasi"

# ============================================================
# STEP 6: KONFIGURASI .ENV
# ============================================================
info "Step 6/8: Konfigurasi environment..."

cat > "$INSTALL_DIR/.env" << EOF
DB_HOST=localhost
DB_USER=pesantren
DB_PASS=${DB_PASS}
DB_NAME=pesantren_saas
PORT=${APP_PORT}
JWT_SECRET=${JWT_SECRET}
DOMAIN=${DOMAIN}
SUPER_ADMIN_USER=${SUPER_USER}
SUPER_ADMIN_PASS=${SUPER_PASS}
EOF

success ".env dikonfigurasi"

# ============================================================
# STEP 7: KONFIGURASI NGINX
# ============================================================
info "Step 7/8: Konfigurasi Nginx..."

# Remove default site
rm -f /etc/nginx/sites-enabled/default

cat > /etc/nginx/sites-available/pesantren-saas << EOF
server {
    listen 80;
    server_name ${DOMAIN} *.${DOMAIN};

    # Increase max body size for file uploads
    client_max_body_size 50m;

    location / {
        proxy_pass http://127.0.0.1:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable site
ln -sf /etc/nginx/sites-available/pesantren-saas /etc/nginx/sites-enabled/

# Test config
nginx -t || error "Nginx config error!"

systemctl restart nginx
systemctl enable nginx

success "Nginx dikonfigurasi"

# ============================================================
# STEP 8: START APLIKASI
# ============================================================
info "Step 8/8: Start aplikasi..."

cd "$INSTALL_DIR"

# Stop if already running
pm2 delete pesantren-saas 2>/dev/null || true

# Start with PM2 (cluster mode untuk multi-core)
# PM2 cluster otomatis fork sesuai jumlah CPU
pm2 start server.js --name pesantren-saas -i max
pm2 save

# Setup PM2 startup on boot
pm2 startup systemd -u root --hp /root > /dev/null 2>&1 || true
pm2 save

success "Aplikasi running di port ${APP_PORT}"

# ============================================================
# SELESAI
# ============================================================
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  INSTALASI SELESAI!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${CYAN}Landing Page:${NC}  http://${DOMAIN}"
echo -e "  ${CYAN}Login:${NC}        http://${DOMAIN}/login.html"
echo -e "  ${CYAN}Dashboard:${NC}    http://${DOMAIN}/app.html"
echo ""
echo -e "  ${CYAN}Super Admin:${NC}"
echo -e "    Username: ${SUPER_USER}"
echo -e "    Password: ${SUPER_PASS}"
echo ""
echo -e "  ${YELLOW}LANGKAH SELANJUTNYA:${NC}"
echo -e "  1. Setting DNS wildcard di Cloudflare:"
echo -e "     - Type: A, Name: @, Value: $(curl -s ifconfig.me), Proxy: ON"
echo -e "     - Type: A, Name: *, Value: $(curl -s ifconfig.me), Proxy: ON"
echo ""
echo -e "  2. Setup SSL (pilih salah satu):"
echo -e "     - ${GREEN}Gampang:${NC} Nyalakan Cloudflare Proxy (SSL otomatis)"
echo -e "     - ${GREEN}Secure:${NC} certbot certonly --manual --preferred-challenges dns \\"
echo -e "              -d \"${DOMAIN}\" -d \"*.${DOMAIN}\""
echo ""
echo -e "  3. Tambah pesantren baru:"
echo -e "     Login Super Admin → Kelola Sekolah → Tambah"
echo ""
echo -e "  ${CYAN}PM2 Commands:${NC}"
echo -e "    pm2 status          → cek status"
echo -e "    pm2 logs pesantren-saas  → lihat log"
echo -e "    pm2 restart pesantren-saas  → restart"
echo ""
