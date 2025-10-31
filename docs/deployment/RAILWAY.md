# Deploying Poker Tracker to Railway

Railway is a modern deployment platform that makes it easy to deploy applications with persistent storage. It's an excellent choice for this SQLite-based application.

## Prerequisites

- A [Railway account](https://railway.app/) (free tier available)
- A GitHub account
- Your code pushed to GitHub

## Method 1: Deploy from GitHub (Recommended)

### Step 1: Connect Your Repository

1. Go to [Railway.app](https://railway.app/)
2. Click "Start a New Project"
3. Select "Deploy from GitHub repo"
4. Authorize Railway to access your GitHub account
5. Select your `pttracker` repository

### Step 2: Configure Environment Variables

1. In your Railway project dashboard, click on your service
2. Go to the "Variables" tab
3. Add the following environment variables:

   ```
   NODE_ENV=production
   SESSION_SECRET=<generate-a-secure-random-string>
   PORT=3000
   DB_PATH=/data/poker.db
   ```

   To generate a secure `SESSION_SECRET`:
   ```bash
   openssl rand -base64 32
   ```

### Step 3: Configure Persistent Storage

Railway provides persistent volumes for data storage:

1. In your service settings, go to the "Volumes" tab
2. Click "Add Volume"
3. Mount path: `/data`
4. This ensures your SQLite database persists across deployments

### Step 4: Configure Build Settings

Railway should auto-detect your Node.js application. Verify these settings:

1. Go to "Settings" tab
2. Build Command: `npm run build` (should be auto-detected)
3. Start Command: `npm start` (should be auto-detected)

### Step 5: Deploy

Railway will automatically deploy your application. You can:

1. Monitor the deployment logs in real-time
2. Once deployed, click "Generate Domain" to get a public URL
3. Your app will be available at: `https://your-app-name.up.railway.app`

## Method 2: Deploy with Railway CLI

### Step 1: Install Railway CLI

```bash
# macOS/Linux
brew install railway

# npm (all platforms)
npm i -g @railway/cli

# Windows
scoop install railway
```

### Step 2: Login

```bash
railway login
```

### Step 3: Initialize Project

In your project directory:

```bash
railway init
```

### Step 4: Link to a New Project

```bash
railway link
```

### Step 5: Set Environment Variables

```bash
railway variables set NODE_ENV=production
railway variables set SESSION_SECRET=$(openssl rand -base64 32)
railway variables set DB_PATH=/data/poker.db
```

### Step 6: Create Volume

```bash
railway volume add -m /data
```

### Step 7: Deploy

```bash
railway up
```

## Updating Your Application

Railway automatically deploys when you push to your GitHub repository's main branch.

For manual deployments with CLI:

```bash
railway up
```

## Custom Domain

1. In your Railway project, go to "Settings"
2. Scroll to "Domains"
3. Click "Add Domain"
4. Enter your custom domain
5. Configure DNS records as shown by Railway

## Monitoring and Logs

### View Logs in Dashboard
- Navigate to your project in Railway dashboard
- Click on "Logs" tab to see real-time logs

### View Logs with CLI
```bash
railway logs
```

## Environment Management

### View all variables
```bash
railway variables
```

### Set a variable
```bash
railway variables set KEY=value
```

### Delete a variable
```bash
railway variables delete KEY
```

## Database Backup

Since Railway uses persistent volumes, your data is safe. However, regular backups are recommended:

### Manual Backup

1. Access your service shell:
   ```bash
   railway shell
   ```

2. Copy the database:
   ```bash
   cp /data/poker.db /data/poker-backup-$(date +%Y%m%d).db
   ```

### Download Database Locally

Use Railway CLI to connect and download:

```bash
railway shell
# Then manually transfer the file
```

## Troubleshooting

### Build Failures

Check logs:
```bash
railway logs
```

Common issues:
- Missing dependencies in `package.json`
- TypeScript build errors
- Incorrect start command

### Application Not Starting

1. Verify environment variables are set correctly
2. Check that `PORT` is set (Railway provides this automatically)
3. Ensure the start command is `npm start` or `node dist/server.js`

### Database Issues

- Ensure volume is mounted at `/data`
- Check `DB_PATH` environment variable points to `/data/poker.db`
- Verify volume has sufficient space in Railway dashboard

### Connection Refused

- Railway assigns a dynamic port via `PORT` environment variable
- Ensure your app listens on `process.env.PORT`
- This is already configured in the application

## Cost

Railway provides:
- **Free Tier**: $5 credit per month (hobby plan)
- **Developer Plan**: $10/month for hobby projects
- **Paid Plans**: Pay for usage beyond free tier

The free tier is usually sufficient for personal poker tracking apps with moderate usage.

## Additional Features

### PostgreSQL Database (Optional)

If you want to migrate to PostgreSQL:

1. In Railway dashboard, click "New"
2. Select "Database" > "PostgreSQL"
3. Railway will provide a `DATABASE_URL`
4. Update your application to use PostgreSQL

### Multiple Environments

Railway supports multiple environments:

```bash
# Create a new environment
railway environment create staging

# Switch environments
railway environment switch production
```

## Additional Resources

- [Railway Documentation](https://docs.railway.app/)
- [Railway CLI Reference](https://docs.railway.app/develop/cli)
- [Volume Storage Guide](https://docs.railway.app/guides/volumes)
