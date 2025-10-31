# Poker Tracker

A mobile-friendly web application for tracking poker sessions, buy-ins, cash-outs, and profits. Built with Node.js, TypeScript, SQLite, and Bootstrap.

## Features

- **Session Management**: Track cash games and tournaments
- **Real-time Statistics**: Profit/loss, win rate, hourly rate
- **Mobile-First Design**: Responsive interface for all devices
- **Active Session Tracking**: Monitor ongoing games with easy cash-out
- **Data Persistence**: SQLite database storage
- **PWA Ready**: Can be installed on mobile devices

## Quick Start

1. **Install Dependencies**
   ```powershell
   npm install
   ```

2. **Build TypeScript**
   ```powershell
   npm run build
   ```

3. **Start Development Server**
   ```powershell
   npm run dev
   ```

4. **Access the App**
   - Open http://localhost:3000 in your browser
   - The app will automatically create the SQLite database on first run

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

### Ubuntu/Apache Setup

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
   # Copy files to server
   scp -r poker-tracker/ user@yourserver:/var/www/
   
   # On server
   cd /var/www/poker-tracker
   npm run setup
   pm2 start dist/server.js --name "poker-tracker"
   pm2 startup
   pm2 save
   ```

4. **Configure Apache Reverse Proxy**
   ```apache
   <VirtualHost *:80>
       ServerName poker.yourdomain.com
       ProxyPass / http://localhost:3000/
       ProxyPassReverse / http://localhost:3000/
       ProxyPreserveHost On
   </VirtualHost>
   ```

## Environment Variables

Create a `.env` file in the root directory:

```env
PORT=3000
NODE_ENV=production
DB_PATH=./poker.db
```

## License

MIT License - feel free to use for personal or commercial projects.
