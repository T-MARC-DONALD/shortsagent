#!/bin/bash
# Oracle Cloud Free Tier VM setup script
# Run this on a fresh Oracle Cloud Ubuntu VM (Always Free tier)
# SSH into your VM, then run:
#   curl -sL https://raw.githubusercontent.com/YOUR_USERNAME/shortsagent/main/setup-oracle.sh | bash

set -e

echo "=== ShortsAgent Oracle Cloud Setup ==="

# 1. Install Node.js 20
echo "[1/7] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Install ffmpeg + fonts
echo "[2/7] Installing ffmpeg and fonts..."
sudo apt-get update
sudo apt-get install -y ffmpeg fonts-dejavu-core git

# 3. Install bun
echo "[3/7] Installing bun..."
curl -fsSL https://bun.sh/install | bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# 4. Install PM2 for process management
echo "[4/7] Installing PM2..."
sudo npm install -g pm2

# 5. Clone the repo (replace with your repo URL)
echo "[5/7] Cloning repository..."
cd /opt
sudo git clone https://github.com/YOUR_USERNAME/shortsagent.git || sudo mkdir -p shortsagent
cd shortsagent
sudo chown -R $USER:$USER /opt/shortsagent

# 6. Install dependencies and build
echo "[6/7] Installing dependencies and building..."
bun install
bun run db:push
bun run build

# 7. Start with PM2
echo "[7/7] Starting with PM2..."
pm2 delete shortsagent 2>/dev/null || true
pm2 start "node .next/standalone/server.js" --name shortsagent
pm2 startup
pm2 save

echo ""
echo "=== Setup complete! ==="
echo "Your app is running on port 3000"
echo ""
echo "Next steps:"
echo "1. Open port 3000 in Oracle Cloud Security List:"
echo "   - Go to: https://cloud.oracle.com/networking/vcns"
echo "   - Click your VCN → Security Lists → Default Security List"
echo "   - Add Ingress Rule: Source 0.0.0.0/0, IP Protocol TCP, Dest Port 3000"
echo ""
echo "2. Access your app at: http://YOUR_VM_PUBLIC_IP:3000"
echo ""
echo "3. (Optional) Set up HTTPS with a free domain from freenom.com + Caddy"
