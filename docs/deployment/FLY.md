# Deploying Poker Tracker to Fly.io

Fly.io is a platform for running applications globally with excellent support for persistent volumes and SQLite databases. Great for deploying close to your users.

## Prerequisites

- A [Fly.io account](https://fly.io/app/sign-up) (free allowance available)
- [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/) installed
- Your application code ready

## Step 1: Install Fly CLI

### macOS
```bash
brew install flyctl
```

### Linux
```bash
curl -L https://fly.io/install.sh | sh
```

### Windows
```powershell
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

## Step 2: Authenticate

```bash
flyctl auth login
```

This will open a browser window for authentication.

## Step 3: Create Fly.io Configuration

In your project directory:

```bash
cd pttracker
flyctl launch
```

Fly will ask several questions:

```
? Choose an app name (leave blank to generate one): poker-tracker
? Choose a region for deployment: [Select closest region]
? Would you like to set up a Postgresql database now? No
? Would you like to set up an Upstash Redis database now? No
? Would you like to deploy now? No
```

This creates a `fly.toml` configuration file.

## Step 4: Configure fly.toml

Edit the generated `fly.toml` file:

```toml
app = "poker-tracker"
primary_region = "ord"  # Chicago - change to your preferred region

[build]
  [build.args]
    NODE_VERSION = "20"

[env]
  PORT = "8080"
  NODE_ENV = "production"
  DB_PATH = "/data/poker.db"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 256

[mounts]
  source = "poker_data"
  destination = "/data"
```

## Step 5: Create a Volume

Fly.io uses volumes for persistent storage:

```bash
flyctl volumes create poker_data --region ord --size 1
```

Replace `ord` with your chosen region.

## Step 6: Create Dockerfile

Create a `Dockerfile` in your project root:

```dockerfile
FROM node:20-alpine

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create data directory
RUN mkdir -p /data

# Expose port
EXPOSE 8080

# Start application
CMD ["node", "dist/server.js"]
```

## Step 7: Create .dockerignore

Create a `.dockerignore` file:

```
node_modules
dist
*.db
*.sqlite
*.sqlite3
.env
.env.local
.git
.gitignore
README.md
docs/
```

## Step 8: Set Secrets

Set environment variables as secrets:

```bash
# Generate and set session secret
flyctl secrets set SESSION_SECRET=$(openssl rand -base64 32)

# Verify secrets
flyctl secrets list
```

## Step 9: Deploy

```bash
flyctl deploy
```

Fly will:
1. Build your Docker image
2. Push it to Fly's registry
3. Deploy your application
4. Attach the volume for persistent storage

## Step 10: Access Your Application

```bash
# Open in browser
flyctl open

# Get app URL
flyctl info
```

Your app will be available at: `https://poker-tracker.fly.dev`

## Managing Your Application

### View Status

```bash
flyctl status
```

### View Logs

```bash
# Real-time logs
flyctl logs

# Follow logs
flyctl logs -f
```

### SSH into Your App

```bash
flyctl ssh console
```

Once inside:
```bash
# Check database
ls -la /data/

# View database
sqlite3 /data/poker.db ".tables"
```

### Restart Application

```bash
flyctl apps restart poker-tracker
```

### Scale Application

```bash
# Increase memory
flyctl scale memory 512

# Add more instances
flyctl scale count 2
```

Note: SQLite doesn't support multiple writers, so keep count at 1.

## Updating Your Application

To deploy updates:

```bash
# Make your changes
git add .
git commit -m "Update feature"

# Deploy
flyctl deploy
```

## Custom Domain

### Add a Domain

```bash
flyctl certs add your-domain.com
```

### Configure DNS

Add the following DNS records at your domain registrar:

For apex domain (yourdomain.com):
```
Type: A
Name: @
Value: [IP from flyctl ips list]
```

For www subdomain:
```
Type: CNAME
Name: www
Value: poker-tracker.fly.dev
```

### Check Certificate Status

```bash
flyctl certs check your-domain.com
```

SSL certificates are automatically provisioned.

## Database Management

### Backup Database

```bash
# SSH into the app
flyctl ssh console

# Create backup
cp /data/poker.db /data/poker-backup-$(date +%Y%m%d).db

# Exit SSH
exit

# Download backup to local machine
flyctl ssh sftp get /data/poker-backup-*.db ./backups/
```

### Restore Database

```bash
# Upload database
flyctl ssh sftp shell

# In sftp shell
put backup.db /data/poker.db
exit

# Restart app
flyctl apps restart
```

### Automated Backups

Create a backup script and schedule it:

```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/sh
DATE=$(date +%Y%m%d)
cp /data/poker.db /data/backups/poker-$DATE.db
find /data/backups/ -type f -mtime +7 -delete
EOF

# Make executable
chmod +x backup.sh
```

## Monitoring

### Metrics Dashboard

```bash
# Open monitoring dashboard
flyctl dashboard
```

### Set Up Alerts

In the Fly.io dashboard:
1. Go to your app
2. Navigate to "Monitoring"
3. Set up alerts for:
   - High memory usage
   - Application crashes
   - Response time

### Health Checks

Fly automatically monitors your application health. Configure in `fly.toml`:

```toml
[[services]]
  http_checks = [
    {
      interval = 10000
      grace_period = "5s"
      method = "get"
      path = "/"
      protocol = "http"
      timeout = 2000
      tls_skip_verify = false
    }
  ]
```

## Regions and Global Deployment

### List Available Regions

```bash
flyctl platform regions
```

### Add More Regions

```bash
# Add additional region
flyctl regions add lhr  # London

# Create volume in new region
flyctl volumes create poker_data --region lhr --size 1

# List regions
flyctl regions list
```

**Important**: For SQLite, you should only run in ONE region to avoid database conflicts.

## Troubleshooting

### Build Failures

```bash
# Build locally to test
docker build -t poker-tracker .

# Run locally
docker run -p 8080:8080 poker-tracker
```

### Volume Issues

```bash
# List volumes
flyctl volumes list

# Check volume status
flyctl volumes show <volume-id>

# Extend volume size
flyctl volumes extend <volume-id> --size 2
```

### App Not Starting

```bash
# Check logs
flyctl logs

# Common issues:
# - Volume not attached
# - DB_PATH incorrect
# - Port mismatch (Fly uses 8080 internally)
```

### Database Corruption

```bash
# SSH into app
flyctl ssh console

# Check database integrity
sqlite3 /data/poker.db "PRAGMA integrity_check"

# If corrupted, restore from backup
cp /data/poker-backup-YYYYMMDD.db /data/poker.db
```

### Update Server.ts Port

Ensure your server listens on Fly's internal port. Update if needed:

```typescript
const PORT = process.env.PORT || 8080;
```

This is already configured to use `process.env.PORT`.

## Configuration Best Practices

### Production Optimization

Update `fly.toml` for production:

```toml
[env]
  NODE_ENV = "production"

[[services]]
  protocol = "tcp"
  internal_port = 8080

  [[services.ports]]
    port = 80
    handlers = ["http"]
    force_https = true

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

  [services.concurrency]
    type = "connections"
    hard_limit = 25
    soft_limit = 20
```

### Auto Stop/Start

Fly can automatically stop your app when idle (free tier):

```toml
[http_service]
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0
```

First request after stopping takes ~2 seconds to start.

## Cost

Fly.io pricing:
- **Free Tier**:
  - Up to 3 shared-cpu-1x VMs with 256MB RAM
  - 3GB persistent volume storage
  - 160GB outbound data transfer

- **Paid Usage**:
  - ~$0.0000008/sec for CPU (~$2.50/month always-on)
  - ~$0.15/GB/month for volumes
  - ~$0.02/GB for bandwidth

Your poker tracker should fit within the free tier for personal use.

## Additional Features

### Secrets Management

```bash
# Set secret
flyctl secrets set KEY=value

# Import from file
flyctl secrets import < .env.production

# Remove secret
flyctl secrets unset KEY
```

### Deploy from CI/CD

GitHub Actions example:

```yaml
name: Deploy to Fly
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}
```

## Additional Resources

- [Fly.io Documentation](https://fly.io/docs/)
- [Fly.io SQLite Guide](https://fly.io/docs/getting-started/sqlite3/)
- [Volumes Documentation](https://fly.io/docs/reference/volumes/)
- [Fly.io Community Forum](https://community.fly.io/)
