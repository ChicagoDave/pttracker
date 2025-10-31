# Poker Tracker

A mobile-friendly web application for tracking poker sessions, buy-ins, cash-outs, and profits. Built with Node.js, TypeScript, SQLite, and Bootstrap.

I spent some time on this and if there are issues/feature requests I'll be listening. Donations are not required, but they will go to my next buy-in. Thanks!

[![Donate with PayPal](https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/donate/?hosted_button_id=FNSMPSCM92Y74)

---

## 🚀 One-Click Deploy

Deploy your own instance in minutes - no technical knowledge required!

[![Deploy to Heroku](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/ChicagoDave/pttracker)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/ChicagoDave/pttracker)

**Quick Setup:**
1. Click a deploy button above
2. Create a free account (if you don't have one)
3. The app will be deployed automatically with all settings configured
4. Access your app URL and create your first account
5. Start tracking your poker sessions from any device!

**Note:** Heroku's free tier spins down after 30 minutes of inactivity. Render's free tier spins down after 15 minutes. First request after spin-down takes ~30 seconds.

## Features

- **Session Management**: Track cash games and tournaments
- **Real-time Statistics**: Profit/loss, win rate, hourly rate
- **Mobile-First Design**: Responsive interface for all devices
- **Active Session Tracking**: Monitor ongoing games with easy cash-out
- **User Authentication**: Secure login system with bcrypt password hashing
- **CSV Import**: Import existing poker session data from CSV files
- **Data Persistence**: SQLite database storage
- **PWA Ready**: Can be installed on mobile devices

## Prerequisites

- **Node.js** 18.x or higher
- **npm** 9.x or higher
- **Git** (for deployment)

## Quick Start

**For the easiest setup**, use the [One-Click Deploy](#-one-click-deploy) buttons above!

**For local development or manual setup:**

### 1. Clone the Repository

```bash
git clone https://github.com/ChicagoDave/pttracker.git
cd pttracker
```

### 2. Set Up Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and set a secure session secret:

```env
PORT=3000
NODE_ENV=development
SESSION_SECRET=your-super-secret-random-string-here
DB_PATH=./poker.db
```

**IMPORTANT**: Change `SESSION_SECRET` to a long, random string. You can generate one using:

```bash
# On Linux/Mac
openssl rand -base64 32

# On Windows (PowerShell)
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Build the Application

```bash
npm run build
```

### 5. Start the Server

**Development mode** (with auto-reload):
```bash
npm run dev
```

**Production mode**:
```bash
npm start
```

### 6. Access the Application

1. Open http://localhost:3000 in your browser
2. On first run, you'll need to create an account
3. The app will automatically create the SQLite database

## First-Time User Setup

When you first access the application:

1. Navigate to http://localhost:3000
2. You'll be redirected to the login page
3. Click "Register" or navigate to the registration page
4. Create your account with a username and password
5. Log in and start tracking your poker sessions

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run setup` - Install dependencies and build

## Project Structure

```
poker-tracker/
├── src/                    # TypeScript backend
│   ├── server.ts          # Express server
│   ├── models/            # TypeScript interfaces
│   ├── database/          # SQLite operations
│   └── routes/            # API routes
├── public/                # Frontend files
│   ├── index.html         # Main UI
│   ├── css/styles.css     # Custom styling
│   ├── js/                # Frontend JavaScript
│   └── manifest.json      # PWA configuration
├── dist/                  # Compiled TypeScript (auto-generated)
└── poker.db              # SQLite database (auto-generated)
```

## API Endpoints

- `GET /api/sessions` - Get all sessions
- `POST /api/sessions` - Create new session
- `PUT /api/sessions/:id` - Update session
- `DELETE /api/sessions/:id` - Delete session
- `POST /api/sessions/:id/cashout` - Cash out active session
- `GET /api/sessions/stats` - Get statistics

## Deployment

### ⚡ Easiest: One-Click Deploy

Use the deploy buttons at the top of this README for instant deployment! No configuration needed.

### 🔧 Alternative Hosting Platforms

For more control or different platforms, see the `docs/deployment/` directory for detailed guides:

- **[Heroku](docs/deployment/HEROKU.md)** ([Sign up](https://signup.heroku.com/)) - ⭐ One-click deploy available
- **[Render](docs/deployment/RENDER.md)** ([Sign up](https://render.com/)) - ⭐ One-click deploy available
- **[Railway](docs/deployment/RAILWAY.md)** ([Sign up](https://railway.app/)) - Deploy directly from GitHub, free tier
- **[Fly.io](docs/deployment/FLY.md)** ([Sign up](https://fly.io/app/sign-up)) - Global app deployment with free allowance
- **[DigitalOcean](docs/deployment/DIGITALOCEAN.md)** ([Sign up](https://www.digitalocean.com/)) - VPS deployment with full control

### Quick Deployment Tips

**Before deploying:**

1. Set `NODE_ENV=production` in your environment variables
2. Generate a secure `SESSION_SECRET` (use `openssl rand -base64 32`)
3. The SQLite database will be created automatically on first run
4. If using HTTPS, update the session cookie settings in [src/server.ts:27](src/server.ts#L27)

**For VPS/Self-Hosted:**

```bash
# Install PM2 for process management
npm install -g pm2

# Start the app
pm2 start dist/server.js --name poker-tracker

# Save PM2 configuration
pm2 save
pm2 startup
```

### Ubuntu/Apache Setup

For detailed VPS setup instructions, see [docs/deployment/DIGITALOCEAN.md](docs/deployment/DIGITALOCEAN.md)

1. **Install Node.js**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. **Install PM2**
   ```bash
   sudo npm install -g pm2
   ```

3. **Deploy Application**
   ```bash
   # Clone repository
   git clone https://github.com/ChicagoDave/pttracker.git
   cd pttracker

   # Set up environment
   cp .env.example .env
   nano .env  # Edit with your settings

   # Build and start
   npm run setup
   pm2 start dist/server.js --name "poker-tracker"
   pm2 startup
   pm2 save
   ```

4. **Configure Apache Reverse Proxy**
   ```apache
   <VirtualHost *:443>
       ServerName poker.yourdomain.com

       SSLEngine on
       SSLCertificateFile /etc/letsencrypt/live/poker.yourdomain.com/fullchain.pem
       SSLCertificateKeyFile /etc/letsencrypt/live/poker.yourdomain.com/privkey.pem

       ProxyPass / http://localhost:3000/
       ProxyPassReverse / http://localhost:3000/
       ProxyPreserveHost On
   </VirtualHost>
   ```

## Environment Variables

The application uses the following environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | Port the server listens on |
| `NODE_ENV` | No | `development` | Environment mode (`development` or `production`) |
| `SESSION_SECRET` | **Yes** | None | Secret key for session encryption (must be set!) |
| `DB_PATH` | No | `./poker.db` | Path to SQLite database file |

Create a `.env` file based on `.env.example` and customize the values.

## Security Considerations

- Always set a strong `SESSION_SECRET` in production
- Use HTTPS in production (set `cookie.secure: true` in [src/server.ts:27](src/server.ts#L27))
- The default password hashing uses bcrypt with 10 rounds
- Sessions expire after 24 hours
- Keep your dependencies updated: `npm audit` and `npm update`

## Troubleshooting

### Database Issues

If you encounter database errors:
```bash
# Stop the application
pm2 stop poker-tracker  # or Ctrl+C if running directly

# Remove the database (WARNING: This deletes all data!)
rm poker.db

# Restart the application (will create a fresh database)
npm start
```

### Port Already in Use

If port 3000 is already in use:
```bash
# Change the PORT in your .env file
echo "PORT=3001" >> .env

# Or set it temporarily
PORT=3001 npm start
```

### Build Errors

If you encounter TypeScript build errors:
```bash
# Clean and rebuild
rm -rf dist node_modules
npm install
npm run build
```

## Development

### Running Tests

```bash
npm test
```

### Database Migrations

The application automatically initializes the database on first run. To reset:

```bash
# View the database schema
sqlite3 poker.db ".schema"

# Run migrations manually
npm run build
node dist/database/db.js
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - feel free to use for personal or commercial projects.

## Support

For issues and questions:
- Open an issue on [GitHub](https://github.com/ChicagoDave/pttracker/issues)
- Check the deployment guides in `docs/deployment/`
