#!/bin/bash
# Cheltuieli - Proxmox LXC Setup Script
# Run as root inside your LXC container
# Usage: bash setup.sh

set -e
INSTALL_DIR="/opt/cheltuieli"
SERVICE_USER="cheltuieli"
APP_PORT=3001

echo ""
echo "╔════════════════════════════════════════╗"
echo "║     Cheltuieli - Finance Tracker       ║"
echo "║         LXC Setup Script               ║"
echo "╚════════════════════════════════════════╝"
echo ""

# 1. System deps
echo "→ Installing system dependencies..."
apt-get update -qq
apt-get install -y -qq curl git build-essential python3

# 2. Node.js 20.x
if ! command -v node &> /dev/null; then
  echo "→ Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
else
  echo "→ Node.js $(node -v) already installed"
fi

# 3. Create service user
if ! id "$SERVICE_USER" &>/dev/null; then
  echo "→ Creating user: $SERVICE_USER"
  useradd -r -s /bin/false -d $INSTALL_DIR $SERVICE_USER
fi

# 4. Copy app files
echo "→ Installing app to $INSTALL_DIR..."
mkdir -p $INSTALL_DIR/data
cp -r . $INSTALL_DIR/
chown -R $SERVICE_USER:$SERVICE_USER $INSTALL_DIR

# 5. Install backend dependencies
echo "→ Installing backend dependencies..."
cd $INSTALL_DIR/backend
sudo -u $SERVICE_USER npm install --production

# 6. Build frontend
echo "→ Building frontend..."
cd $INSTALL_DIR/frontend
sudo -u $SERVICE_USER npm install
sudo -u $SERVICE_USER npm run build

# Clean up node_modules from frontend (not needed in prod)
rm -rf $INSTALL_DIR/frontend/node_modules

# 7. Install systemd service
echo "→ Installing systemd service..."
cp $INSTALL_DIR/cheltuieli.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable cheltuieli
systemctl start cheltuieli

# 8. Configure firewall (optional)
if command -v ufw &> /dev/null; then
  ufw allow $APP_PORT/tcp 2>/dev/null || true
fi

# Done
IP=$(hostname -I | awk '{print $1}')
echo ""
echo "✅ Cheltuieli installed successfully!"
echo ""
echo "   Access: http://$IP:$APP_PORT"
echo "   Status: systemctl status cheltuieli"
echo "   Logs:   journalctl -u cheltuieli -f"
echo "   DB:     $INSTALL_DIR/data/cheltuieli.db"
echo ""
echo "   💡 Tip: Set up an Nginx reverse proxy for HTTPS"
echo ""
