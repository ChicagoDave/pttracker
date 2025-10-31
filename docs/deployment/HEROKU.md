# Deploying Poker Tracker to Heroku

Heroku is a cloud platform that makes it easy to deploy web applications. This guide will walk you through deploying Poker Tracker to Heroku.

## Prerequisites

- A [Heroku account](https://signup.heroku.com/) (free tier available)
- [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli) installed
- Git installed

## Step 1: Prepare Your Application

1. **Login to Heroku CLI**
   ```bash
   heroku login
   ```

2. **Create a new Heroku app**
   ```bash
   heroku create your-poker-tracker
   # Or let Heroku generate a random name
   heroku create
   ```

## Step 2: Configure Environment Variables

Set the required environment variables:

```bash
# Generate a secure session secret
SESSION_SECRET=$(openssl rand -base64 32)

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set SESSION_SECRET="$SESSION_SECRET"
```

## Step 3: Add a Procfile

Create a `Procfile` in your project root:

```bash
echo "web: node dist/server.js" > Procfile
```

## Step 4: Configure Package.json

Ensure your `package.json` has a `heroku-postbuild` script:

```json
{
  "scripts": {
    "heroku-postbuild": "npm run build"
  }
}
```

This is already configured in the project, so you don't need to modify it.

## Step 5: Deploy

1. **Commit any changes**
   ```bash
   git add .
   git commit -m "Prepare for Heroku deployment"
   ```

2. **Push to Heroku**
   ```bash
   git push heroku main
   # Or if your branch is named 'master'
   git push heroku master
   ```

3. **Open your app**
   ```bash
   heroku open
   ```

## Step 6: Monitor and Manage

### View logs
```bash
heroku logs --tail
```

### Restart the app
```bash
heroku restart
```

### Check app status
```bash
heroku ps
```

### Access the Heroku dashboard
Visit https://dashboard.heroku.com/apps/your-app-name

## Database Considerations

Heroku uses an ephemeral filesystem, which means files (including your SQLite database) will be lost when the dyno restarts. For production use on Heroku, consider:

1. **Using Heroku Postgres** (recommended for persistence)
2. **Using a volume add-on** for file persistence
3. **Deploying to a different platform** that supports persistent storage (see Railway or Render guides)

### Migrating to PostgreSQL (Optional)

If you need persistent data on Heroku, you'll need to migrate to PostgreSQL:

1. Add the Heroku Postgres add-on:
   ```bash
   heroku addons:create heroku-postgresql:mini
   ```

2. Update your application code to use PostgreSQL instead of SQLite

## Troubleshooting

### Application Error on Launch

Check the logs:
```bash
heroku logs --tail
```

Common issues:
- Missing `SESSION_SECRET` environment variable
- Build errors during deployment
- Port configuration (Heroku sets the PORT automatically)

### Database Reset

Since the filesystem is ephemeral, your database will reset on dyno restart. This is normal behavior for SQLite on Heroku.

### Build Failures

If the build fails:
```bash
# Check build logs
heroku logs --tail

# Try a clean build locally first
rm -rf node_modules dist
npm install
npm run build
```

## Updating Your App

To deploy updates:

```bash
git add .
git commit -m "Update message"
git push heroku main
```

## Custom Domain

To add a custom domain:

```bash
heroku domains:add www.yourdomain.com
```

Then configure your DNS provider with the DNS target provided by Heroku.

## SSL/HTTPS

Heroku provides free SSL for all apps. Your app will automatically be available at:
- `https://your-app-name.herokuapp.com`

For custom domains, SSL is included in the Hobby tier and above.

## Cost

- **Free Tier**: 550-1000 free dyno hours per month (requires credit card)
- **Hobby Tier**: $7/month for 24/7 uptime
- **Postgres**: Mini tier starts at $5/month

## Additional Resources

- [Heroku Node.js Documentation](https://devcenter.heroku.com/articles/getting-started-with-nodejs)
- [Heroku CLI Reference](https://devcenter.heroku.com/articles/heroku-cli-commands)
- [Managing Environment Variables](https://devcenter.heroku.com/articles/config-vars)
