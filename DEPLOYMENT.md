# Deployment Guide

## API Configuration

The app needs to be configured to point to your PHP backend server. The configuration works differently depending on where the app is deployed.

### Local Development

During local development (`npm run dev`), the app uses Vite plugins to mock the API endpoints. No configuration is needed for local development - everything is handled by the dev server.

### Production Deployment

For production deployments, you **must** configure the API URL to point to your actual PHP backend server.

#### Option 1: Fly.io Deployment

If deploying to Fly.io:

1. Set the environment variable in `fly.toml`:
```toml
[env]
  VITE_API_URL = "https://trainercoachconnect.com/api.php"
```

2. Deploy:
```bash
fly deploy
```

The app will use the `VITE_API_URL` environment variable instead of trying to call `/api.php` (which doesn't exist on Fly).

#### Option 2: Manual Environment Setup

Create a `.env.production.local` file with:
```
VITE_API_URL=https://your-api-server.com/api.php
```

Then build and deploy:
```bash
npm run build
# Deploy the dist/ folder to your hosting
```

#### Option 3: Runtime Configuration (Browser)

Users can manually set the API URL in the browser console:
```javascript
localStorage.setItem('api_url', 'https://your-api-server.com/api.php')
location.reload()
```

### API URL Resolution Priority

The app determines which API endpoint to use in this order:

1. **Environment Variable** (`VITE_API_URL`) - Best for production
2. **LocalStorage** (`api_url`) - User-configurable in browser
3. **Platform Detection**:
   - Native Apps (Capacitor): `https://trainercoachconnect.com/api.php`
   - Web Apps: `/api.php` (relative path - only works for local dev)

### Troubleshooting "Failed to fetch" Errors

If you see "Failed to fetch" errors when the app loads:

1. **Check API Server Status**: Make sure your PHP backend is running and accessible
2. **Check API URL Configuration**: Open browser DevTools → Application → Storage → LocalStorage and verify the `api_url` is correct
3. **Check CORS**: If your API server is on a different domain, make sure it allows CORS requests
4. **Check Network**: Verify your deployment can reach the API server from its location

### Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `VITE_API_URL` | Overrides the API endpoint URL | `https://api.example.com/api.php` |
| `NODE_ENV` | Set automatically by deployment platform | `production`, `development` |

### Checking Current API Configuration

The app logs the current API URL when it loads. Check the browser console for messages like:
```
[API Config] Using endpoint: https://trainercoachconnect.com/api.php
```

If this shows `http://localhost:8080/api.php` or similar in production, your environment variables aren't configured correctly.
