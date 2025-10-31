# Deploying Poker Tracker to DigitalOcean

DigitalOcean provides VPS (Virtual Private Server) hosting with full control over your environment. This guide covers deployment on a DigitalOcean Droplet.

## Prerequisites

- A [DigitalOcean account](https://www.digitalocean.com/)
- SSH key configured in your DigitalOcean account
- Basic Linux command line knowledge
- A domain name (optional but recommended)

## Option 1: DigitalOcean App Platform (PaaS - Easiest)

App Platform is DigitalOcean's managed platform, similar to Heroku or Render.

### Step 1: Create a New App

1. Log in to DigitalOcean
2. Click "Create" > "Apps"
3. Connect your GitHub repository
4. Select your `pttracker` repository

### Step 2: Configure the App

- **Resource Type**: Web Service
- **Build Command**: `npm run build`
- **Run Command**: `npm start`
- **HTTP Port**: 3000

### Step 3: Environment Variables

Add these environment variables:

```
NODE_ENV=production
SESSION_SECRET=<generate-secure-random-string>
DB_PATH=/data/poker.db
```

### Step 4: Add a Volume

App Platform doesn't support persistent storage in the free tier. Consider using:
- A managed database add-on
- Upgrading to a paid tier with volume support
- Using a Droplet instead (see Option 2)

### Cost: Starts at $5/month

## Option 2: DigitalOcean Droplet (VPS - Full Control)

This gives you complete control and persistent storage.

### Step 1: Create a Droplet

1. Log in to DigitalOcean
2. Click "Create" > "Droplets"
3. Choose configuration:
   - **Image**: Ubuntu 22.04 LTS
   - **Plan**: Basic ($6/month is sufficient)
   - **CPU**: Regular Intel, 1GB RAM
   - **Region**: Choose closest to you
   - **Authentication**: SSH Key (recommended) or Password
   - **Hostname**: poker-tracker

4. Click "Create Droplet"

### Step 2: Initial Server Setup

SSH into your droplet:

```bash
ssh root@your-droplet-ip
```

#### Create a Non-Root User

```bash
# Create new user
adduser nodeuser

# Add to sudo group
usermod -aG sudo nodeuser

# Copy SSH keys to new user
rsync --archive --chown=nodeuser:nodeuser ~/.ssh /home/nodeuser
```

#### Set Up Firewall

```bash
# Allow SSH, HTTP, and HTTPS
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

### Step 3: Install Node.js

```bash
# Update system
sudo apt update
sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version

# Install build tools
sudo apt-get install -y build-essential
```

### Step 4: Install and Configure PM2

PM2 is a process manager for Node.js applications:

```bash
sudo npm install -g pm2
```

### Step 5: Deploy Your Application

#### Method A: Clone from GitHub

```bash
# Switch to your user
su - nodeuser

# Create app directory
mkdir -p ~/apps
cd ~/apps

# Clone repository
git clone https://github.com/ChicagoDave/pttracker.git
cd pttracker

# Install dependencies
npm install

# Build the application
npm run build
```

#### Method B: Deploy via Git Push (Advanced)

Set up a Git hook for automatic deployment when you push to your server.

### Step 6: Configure Environment Variables

```bash
cd ~/apps/pttracker

# Create .env file
nano .env
```

Add the following:

```env
PORT=3000
NODE_ENV=production
SESSION_SECRET=<generate-a-secure-random-string>
DB_PATH=/home/nodeuser/apps/pttracker/poker.db
```

Generate a secure session secret:

```bash
openssl rand -base64 32
```

### Step 7: Start Application with PM2

```bash
# Start the application
pm2 start dist/server.js --name poker-tracker

# Save PM2 configuration
pm2 save

# Set PM2 to start on boot
pm2 startup
# Run the command that PM2 outputs
```

### Step 8: Set Up Nginx Reverse Proxy

Install and configure Nginx:

```bash
sudo apt install nginx -y
```

Create Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/poker-tracker
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/poker-tracker /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

### Step 9: Configure DNS

In your domain registrar, add an A record:

```
Type: A
Name: @ (or subdomain like 'poker')
Value: your-droplet-ip
TTL: 3600
```

Wait for DNS propagation (can take up to 48 hours, usually much faster).

### Step 10: Set Up SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtain and install certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Test automatic renewal
sudo certbot renew --dry-run
```

Certbot will automatically:
- Obtain SSL certificate
- Configure Nginx to use HTTPS
- Set up automatic renewal

### Step 11: Update Session Cookie Settings

For HTTPS, update [src/server.ts:27](../../src/server.ts#L27):

```typescript
cookie: {
  secure: true,  // Set to true for HTTPS
  httpOnly: true,
  maxAge: 24 * 60 * 60 * 1000
}
```

Rebuild and restart:

```bash
npm run build
pm2 restart poker-tracker
```

## Managing Your Application

### PM2 Commands

```bash
# View status
pm2 status

# View logs
pm2 logs poker-tracker

# Restart app
pm2 restart poker-tracker

# Stop app
pm2 stop poker-tracker

# Monitor resources
pm2 monit
```

### Updating Your Application

```bash
cd ~/apps/pttracker

# Pull latest changes
git pull origin main

# Install any new dependencies
npm install

# Rebuild
npm run build

# Restart
pm2 restart poker-tracker
```

### Backup Database

```bash
# Create backup directory
mkdir -p ~/backups

# Backup database
cp ~/apps/pttracker/poker.db ~/backups/poker-$(date +%Y%m%d).db

# Automated daily backup (crontab)
crontab -e

# Add this line:
0 2 * * * cp ~/apps/pttracker/poker.db ~/backups/poker-$(date +\%Y\%m\%d).db
```

### View Application Logs

```bash
# PM2 logs
pm2 logs poker-tracker

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

## Monitoring and Maintenance

### Set Up Monitoring

```bash
# Install monitoring tools
pm2 install pm2-logrotate

# Configure log rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### System Updates

Regular maintenance:

```bash
# Update system packages
sudo apt update
sudo apt upgrade -y

# Update Node.js packages
cd ~/apps/pttracker
npm update

# Check for vulnerabilities
npm audit
npm audit fix
```

## Security Best Practices

1. **Firewall**: Keep UFW enabled with only necessary ports
2. **SSH**: Use SSH keys, disable password authentication
3. **Updates**: Regularly update system and packages
4. **Backups**: Automate database backups
5. **Monitoring**: Set up uptime monitoring (UptimeRobot, etc.)
6. **Fail2Ban**: Consider installing fail2ban for SSH protection

```bash
# Install fail2ban
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

## Troubleshooting

### Application Won't Start

```bash
# Check PM2 logs
pm2 logs poker-tracker

# Check if port is in use
sudo lsof -i :3000

# Restart PM2
pm2 restart poker-tracker
```

### Nginx Errors

```bash
# Test configuration
sudo nginx -t

# Check error logs
sudo tail -f /var/log/nginx/error.log

# Restart Nginx
sudo systemctl restart nginx
```

### Database Permission Issues

```bash
cd ~/apps/pttracker
chmod 644 poker.db
chown nodeuser:nodeuser poker.db
```

### SSL Certificate Issues

```bash
# Renew certificate manually
sudo certbot renew

# Check certificate expiry
sudo certbot certificates
```

## Cost

DigitalOcean Droplet pricing:
- **Basic Droplet**: $6/month (1GB RAM, 25GB SSD)
- **Better Performance**: $12/month (2GB RAM, 50GB SSD)
- **Backups**: +20% of droplet cost (optional)
- **Domain**: Varies by registrar ($10-15/year typical)

## Additional Resources

- [DigitalOcean Node.js Tutorial](https://www.digitalocean.com/community/tutorials/how-to-set-up-a-node-js-application-for-production-on-ubuntu-20-04)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt Certbot](https://certbot.eff.org/)
