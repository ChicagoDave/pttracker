# Deploying Poker Tracker to Render

Render is a modern cloud platform with automatic deployments from Git, free SSL, and persistent disk storage. It offers a free tier perfect for personal projects.

## Prerequisites

- A [Render account](https://render.com/) (free tier available)
- Your code pushed to GitHub or GitLab
- A GitHub/GitLab account

## Step 1: Create a New Web Service

1. Log in to [Render Dashboard](https://dashboard.render.com/)
2. Click "New +"
3. Select "Web Service"
4. Connect your GitHub or GitLab account if you haven't already
5. Select your `pttracker` repository

## Step 2: Configure the Service

Fill in the following settings:

### Basic Settings
- **Name**: `poker-tracker` (or your preferred name)
- **Environment**: `Node`
- **Region**: Choose the closest to your location
- **Branch**: `main` (or `master`)

### Build & Deploy Settings
- **Build Command**: `npm run build`
- **Start Command**: `npm start`

### Instance Settings
- **Plan**: Select "Free" for testing or "Starter" for production
  - Free: 750 hours/month, spins down after inactivity
  - Starter: $7/month, always on

## Step 3: Add Environment Variables

In the "Environment Variables" section, add:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `SESSION_SECRET` | Generate using: `openssl rand -base64 32` |
| `DB_PATH` | `/data/poker.db` |

**Important**: Keep your `SESSION_SECRET` secure and random!

## Step 4: Add Persistent Disk

SQLite requires persistent storage to maintain data across deployments:

1. Scroll down to "Disk" section
2. Click "Add Disk"
3. Configure:
   - **Name**: `poker-data`
   - **Mount Path**: `/data`
   - **Size**: 1 GB (free tier) or larger

## Step 5: Deploy

1. Click "Create Web Service"
2. Render will automatically:
   - Clone your repository
   - Install dependencies
   - Build your TypeScript code
   - Start your application

3. Monitor the deployment in the logs panel

## Step 6: Access Your Application

Once deployed, your app will be available at:
```
https://poker-tracker.onrender.com
```
(Replace with your actual service name)

## Automatic Deployments

Render automatically deploys when you push to your repository:

1. Make changes to your code
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Update feature"
   git push origin main
   ```
3. Render automatically detects the push and redeploys

## Custom Domain

### Add a Custom Domain

1. In your service dashboard, go to "Settings"
2. Scroll to "Custom Domains"
3. Click "Add Custom Domain"
4. Enter your domain (e.g., `poker.yourdomain.com`)

### Configure DNS

Add a CNAME record in your DNS provider:

```
Type:  CNAME
Name:  poker (or your subdomain)
Value: poker-tracker.onrender.com
TTL:   Auto or 3600
```

Render provides free SSL certificates automatically.

## Monitoring and Logs

### View Logs
- In the Render dashboard, click on your service
- Click the "Logs" tab
- View real-time logs or search historical logs

### Metrics
- Navigate to "Metrics" tab
- View CPU, memory usage, and response times

### Alerts
- Set up email alerts for deployment failures
- Configure in "Settings" > "Notifications"

## Database Management

### Backup Your Database

1. **Using Render Shell**:
   ```bash
   # Access your service shell
   # In Render dashboard: Shell tab
   cd /data
   cp poker.db poker-backup-$(date +%Y%m%d).db
   ```

2. **Download via sftp** (available on paid plans)

3. **Automated Backups**: Implement a scheduled job to backup to S3 or similar

### Reset Database

If you need to reset your database:

1. Access the Shell in Render dashboard
2. Run:
   ```bash
   rm /data/poker.db
   ```
3. Restart your service

## Environment-Specific Settings

### Production Optimization

Update these settings for production:

1. **In your service settings**:
   - Enable "Auto-Deploy": Yes
   - Health Check Path: `/` (optional)

2. **Update server.ts** for HTTPS:
   - Set `cookie.secure: true` for production
   - This is already handled if `NODE_ENV=production`

## Troubleshooting

### Service Not Starting

1. Check the logs in Render dashboard
2. Common issues:
   - Missing environment variables
   - Build errors
   - Incorrect start command

3. Verify commands locally:
   ```bash
   npm run build
   npm start
   ```

### Database Not Persisting

- Ensure disk is mounted at `/data`
- Check `DB_PATH` environment variable
- Verify disk is attached in "Disks" section

### Free Tier Spin Down

The free tier spins down after 15 minutes of inactivity:
- First request after spin down will take ~30 seconds
- Upgrade to Starter plan for always-on service
- Use a service like UptimeRobot for periodic pings

### Build Failures

If build fails:

1. Check logs for specific errors
2. Test build locally:
   ```bash
   rm -rf dist node_modules
   npm install
   npm run build
   ```
3. Ensure all dependencies are in `package.json` (not `devDependencies`)

### Port Issues

Render automatically sets the `PORT` environment variable. Your app should use:
```javascript
const PORT = process.env.PORT || 3000;
```
This is already configured in the application.

## Scaling

### Horizontal Scaling
- Render supports multiple instances
- Configure in "Settings" > "Scaling"
- Note: SQLite doesn't support multiple writers, so stick to 1 instance
- For multiple instances, migrate to PostgreSQL

### Vertical Scaling
- Upgrade instance type for more CPU/RAM
- Available plans:
  - Free: 512 MB RAM, 0.1 CPU
  - Starter: 512 MB RAM, 0.5 CPU
  - Standard: 2 GB RAM, 1 CPU
  - Pro: 4 GB RAM, 2 CPU

## Cost

- **Free Tier**:
  - 750 hours/month
  - 512 MB RAM
  - Spins down after 15 minutes of inactivity
  - 1 GB persistent disk

- **Starter Plan**: $7/month
  - Always on
  - 512 MB RAM
  - Persistent disk included

- **Standard Plan**: $25/month
  - More resources
  - Better performance

## Render Configuration File (Optional)

You can create a `render.yaml` for infrastructure as code:

```yaml
services:
  - type: web
    name: poker-tracker
    env: node
    buildCommand: npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: SESSION_SECRET
        generateValue: true
      - key: DB_PATH
        value: /data/poker.db
    disk:
      name: poker-data
      mountPath: /data
      sizeGB: 1
```

Commit this to your repository for easy redeployment.

## Additional Resources

- [Render Node.js Documentation](https://render.com/docs/deploy-node-express-app)
- [Persistent Disks Guide](https://render.com/docs/disks)
- [Environment Variables](https://render.com/docs/environment-variables)
- [Custom Domains](https://render.com/docs/custom-domains)
