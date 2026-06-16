# Vault Server — VPS Deployment

## One-time server setup (Ubuntu/Debian)

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

# Install git (usually already present)
sudo apt update && sudo apt install -y git build-essential

# Create a directory for your vault notes
mkdir -p ~/vault-notes
cd ~/vault-notes && git init -b main
# (or clone an existing repo: git clone <your-repo-url> ~/vault-notes)
```

## Build the server

```bash
# On your Mac (cross-compile) OR directly on the VPS:
cd server
cargo build --release
# Binary is at: server/target/release/vault-server
```

## Build the web frontend

```bash
# On your Mac:
pnpm install
pnpm build:web
# Output is in: dist-web/
```

## Deploy to VPS

```bash
# Copy the binary and frontend to the VPS
scp server/target/release/vault-server user@YOUR_VPS_IP:~/
scp -r dist-web user@YOUR_VPS_IP:~/

# SSH into the VPS
ssh user@YOUR_VPS_IP
```

## Run the server

```bash
# Set environment variables and start
VAULT_PATH=~/vault-notes \
VAULT_TOKEN=your-secret-token-here \
PORT=8080 \
STATIC_DIR=~/dist-web \
./vault-server
```

Access the app at: **http://YOUR_VPS_IP:8080**

Enter your `VAULT_TOKEN` when prompted in the browser.

## Run as a systemd service (keep it running after reboot)

```bash
sudo tee /etc/systemd/system/vault.service > /dev/null <<EOF
[Unit]
Description=Vault web server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$HOME
Environment=VAULT_PATH=$HOME/vault-notes
Environment=VAULT_TOKEN=your-secret-token-here
Environment=PORT=8080
Environment=STATIC_DIR=$HOME/dist-web
ExecStart=$HOME/vault-server
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable vault
sudo systemctl start vault
sudo systemctl status vault
```

## Add to iPhone home screen

1. Open **http://YOUR_VPS_IP:8080** in Safari on your iPhone
2. Tap the **Share** button → **Add to Home Screen**
3. Enter your token when prompted — it's saved in the browser for future sessions

## Optional: HTTPS with a self-signed certificate

For full PWA features, HTTPS is required. Without a domain name, use a self-signed cert:

```bash
# Generate a self-signed cert (valid for 10 years)
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem \
  -days 3650 -nodes -subj "/CN=YOUR_VPS_IP"
```

Then install nginx as a TLS terminator:

```bash
sudo apt install -y nginx
sudo tee /etc/nginx/sites-available/vault <<EOF
server {
    listen 443 ssl;
    server_name YOUR_VPS_IP;

    ssl_certificate     $HOME/cert.pem;
    ssl_certificate_key $HOME/key.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/vault /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
```

On your iPhone: **Settings → General → VPN & Device Management → Install Certificate** (trust the cert.pem file once).

Access via: **https://YOUR_VPS_IP**
