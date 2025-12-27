# Solar Meter API & PWA Project

A Cloudflare Workers-based project providing both a REST API and a Progressive Web App (PWA) for real-time solar meter monitoring.

## Project Structure

```
.
├── api/                    # REST API for solar data
│   ├── src/
│   │   └── index.ts       # API endpoints
│   ├── wrangler.toml      # API configuration
│   └── tsconfig.json      # TypeScript config
├── pwa/                    # Progressive Web App
│   ├── src/
│   │   └── index.ts       # PWA worker
│   ├── public/
│   │   ├── index.html     # Main HTML
│   │   ├── app.js         # Frontend logic
│   │   ├── sw.js          # Service Worker
│   │   └── manifest.json  # PWA manifest
│   ├── wrangler.toml      # PWA configuration
│   └── tsconfig.json      # TypeScript config
├── package.json           # Root dependencies
└── wrangler.toml         # (Deprecated - use api/wrangler.toml and pwa/wrangler.toml)
```

## Features

### API
- **Current Power**: Get the latest power output
- **Current & Max**: Fetch today's first, max, and latest readings
- **Max Yield**: Get the maximum power output record
- **Today's Data**: Retrieve all readings for the current day

### PWA
- **Real-time Gauges**: Visual representations of current power and daily yield
- **Power Chart**: Time-series chart of today's power production
- **Offline Support**: Service Worker caching for offline access
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Installable**: Can be installed as a standalone app on supported devices

## Development

### Prerequisites
- Node.js 18+
- Wrangler CLI (installed as dev dependency)

### Setup
```bash
npm install
```

### Development Server

Run the API:
```bash
npm run dev:api
```

In another terminal, run the PWA:
```bash
npm run dev:pwa
```

### Type Checking
```bash
npm run type-check
```

### Building
```bash
npm run build:api
npm run build:pwa
```

## Deployment

### Deploy Both
```bash
npm run deploy
```

### Deploy Individual Services
```bash
npm run deploy:api    # Deploy API only
npm run deploy:pwa    # Deploy PWA only
```

## Technologies Used

- **Hono**: Fast web framework
- **Cloudflare Workers**: Serverless compute
- **Chart.js**: Data visualization
- **Service Workers**: Offline caching
- **TypeScript**: Type safety
- **Cloudflare Secrets**: API authentication

## API Authentication

The API is protected with Cloudflare secret-based authentication:

- **Protected endpoints**: All data endpoints require `Authorization: Bearer {secret}` header
- **Secret management**: Uses Cloudflare's secret store via `SMA_DATA_SERVER_ACCESS`

See [API_AUTH_SETUP.md](API_AUTH_SETUP.md) for detailed setup instructions.

## API Endpoints

The PWA communicates with the API through these endpoints:

- `GET /api/current` - Current power and yield
- `GET /api/current-and-max` - Today's data summary
- `GET /api/today` - All readings for today

## Customization

### Gauge Limits
Edit `pwa/public/app.js` to adjust gauge max values:
```javascript
const maxPower = 6000;      // Max power in Watts
const maxYield = 30000;     // Max yield in Wh
```

### Refresh Intervals
Modify data fetch intervals in `pwa/public/app.js`:
```javascript
setInterval(fetchData, 30 * 1000);        // 30 seconds
setInterval(fetchData, 5 * 60 * 1000);    // 5 minutes
```

### Styling
Customize colors and layout in `pwa/public/index.html` `<style>` section.

## License

MIT
