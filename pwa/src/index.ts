import { Hono } from 'hono';

interface CloudflareEnv {
    SMA_READER_ACCESS?: string;
}

// Type declaration for the static manifest (optional in dev)
declare global {
    const __STATIC_CONTENT_MANIFEST: Record<string, string> | undefined;
}

const app = new Hono<{ Bindings: CloudflareEnv }>();

// Central API base URL for upstream SMA reader
const API_BASE = 'https://sma-data-server.everyday-apps.org';

// Helper function to verify PWA access token
function verifyPwaToken(c: any): boolean {
    const authHeader = c.req.header('Authorization');
    const secret = c.env.SMA_READER_ACCESS;

    if (!secret) {
        // If no secret is configured, allow access (for development)
        return true;
    }

    const providedToken = authHeader?.replace('Bearer ', '');
    return providedToken === secret;
}

// Authentication middleware for PWA access
app.use('/', async (c, next) => {
    // Allow these paths without authentication
    const publicPaths = ['/auth.html', '/auth-check'];

    if (publicPaths.some(path => c.req.path === path)) {
        return next();
    }

    if (!verifyPwaToken(c)) {
        // Return 401 for API requests, redirect to auth page for HTML requests
        const accept = c.req.header('Accept') || '';
        if (accept.includes('application/json')) {
            return c.json(
                { error: 'Unauthorized', message: 'Invalid or missing PWA access token' },
                { status: 401 }
            );
        }
        // For HTML requests, serve the auth page
        return c.html(getAuthPageHTML(), 401);
    }

    return next();
});

// Auth check endpoint (returns 200 if authenticated)
app.get('/auth-check', (c) => {
    if (verifyPwaToken(c)) {
        return c.json({ authenticated: true });
    }
    return c.json({ authenticated: false }, { status: 401 });
});

// Auth page endpoint
app.get('/auth.html', (c) => {
    return c.html(getAuthPageHTML());
});

// Static assets are served by Wrangler via [assets] in wrangler.toml; no Hono serveStatic needed.

// Fallback routes for index.html and other common files
app.get('/', (c) => {
    return c.html(getMainPageHTML());
});

app.get('/index.html', (c) => {
    return c.html(getMainPageHTML());
});

// Helper to forward authorization header to API
function getAuthHeaders(c: any): HeadersInit {
    const headers: HeadersInit = {};
    const authHeader = c.req.header('Authorization');
    if (authHeader) {
        headers['Authorization'] = authHeader;
    }
    return headers;
}

// API proxy endpoints for the solar data
app.get('/api/current', async (c) => {
    try {
        const response = await fetch(`${API_BASE}/current`, {
            headers: getAuthHeaders(c)
        });
        const data = await response.json();
        return c.json(data, response.status as any);
    } catch (error) {
        return c.json({ error: 'Failed to fetch current data' }, 500 as any);
    }
});

app.get('/api/current-and-max', async (c) => {
    try {
        const response = await fetch(`${API_BASE}/current-and-max`, {
            headers: getAuthHeaders(c)
        });
        const data = await response.json();
        return c.json(data, response.status as any);
    } catch (error) {
        return c.json({ error: 'Failed to fetch current and max data' }, 500 as any);
    }
});

app.get('/api/today', async (c) => {
    try {
        const response = await fetch(`${API_BASE}/today`, {
            headers: getAuthHeaders(c)
        });
        const data = await response.json();
        return c.json(data, response.status as any);
    } catch (error) {
        return c.json({ error: 'Failed to fetch today\'s data' }, 500 as any);
    }
});

app.get('/api/yearly-yield', async (c) => {
    try {
        const response = await fetch(`${API_BASE}/yearly-yield`, {
            headers: getAuthHeaders(c)
        });
        const data = await response.json();
        return c.json(data, response.status as any);
    } catch (error) {
        return c.json({ error: 'Failed to fetch yearly\'s data' }, 500 as any);
    }
});

// Authentication page HTML
function getAuthPageHTML(): string {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Solar Meter - Authentication</title>
    <style>
        @font-face {
            font-family: 'D-DIN';
            src: url('/fonts/D-DIN.woff2') format('woff2'),
                 url('/fonts/D-DIN.woff') format('woff'),
                 url('/fonts/D-DIN.otf') format('opentype'),
                 url('/fonts/D-DIN.ttf') format('truetype');
            font-weight: 400;
            font-style: normal;
            font-display: swap;
        }

        @font-face {
            font-family: 'D-DIN';
            src: url('/fonts/D-DIN-Bold.woff2') format('woff2'),
                 url('/fonts/D-DIN-Bold.woff') format('woff'),
                 url('/fonts/D-DIN-Bold.otf') format('opentype'),
                 url('/fonts/D-DIN-Bold.ttf') format('truetype');
            font-weight: 700;
            font-style: normal;
            font-display: swap;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        :root {
            --bg: #0f162b;
            --card: rgba(255, 255, 255, 0.06);
            --stroke: rgba(255, 255, 255, 0.12);
            --text: #f8fbff;
            --muted: #9fb0d0;
            --primary: #7cf3c6;
            --primary-strong: #57e3b2;
            --danger: #ff7b7b;
            --glass: blur(12px);
            --shadow: 0 24px 64px rgba(0,0,0,0.45);
        }

        body {
            font-family: 'D-DIN', 'Inter', 'SF Pro Display', 'Segoe UI', system-ui, -apple-system, sans-serif;
            background: radial-gradient(120% 120% at 20% 20%, #192444 0%, #0c1120 45%, #080c18 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            color: var(--text);
        }

        .auth-container {
            background: var(--card);
            border: 1px solid var(--stroke);
            border-radius: 16px;
            box-shadow: var(--shadow);
            padding: 32px;
            max-width: 420px;
            width: 100%;
            backdrop-filter: var(--glass);
        }

        .auth-header { text-align: center; margin-bottom: 26px; }
        .auth-icon { font-size: 2.8em; margin-bottom: 10px; }
        h1 { color: var(--text); font-size: 1.6em; letter-spacing: -0.02em; }
        .auth-subtitle { color: var(--muted); font-size: 0.95em; margin-top: 4px; }

        .form-group { margin-bottom: 18px; }
        label { display: block; color: var(--muted); font-weight: 600; margin-bottom: 8px; font-size: 0.95em; }

        input {
            width: 100%;
            padding: 12px;
            border: 1px solid var(--stroke);
            border-radius: 12px;
            font-size: 1em;
            background: rgba(255, 255, 255, 0.04);
            color: var(--text);
            transition: border-color 0.2s, background 0.2s;
        }
        input:focus {
            outline: none;
            border-color: var(--primary);
            background: rgba(255, 255, 255, 0.08);
        }

        button {
            width: 100%;
            padding: 12px;
            background: linear-gradient(135deg, var(--primary) 0%, var(--primary-strong) 100%);
            color: #0c1120;
            border: none;
            border-radius: 12px;
            font-size: 1em;
            font-weight: 800;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
            box-shadow: 0 12px 24px rgba(124, 243, 198, 0.35);
        }
        button:hover { transform: translateY(-1px); box-shadow: 0 16px 32px rgba(124, 243, 198, 0.4); }
        button:active { transform: translateY(0); }

        .error {
            color: var(--danger);
            font-size: 0.9em;
            margin-top: 10px;
            display: none;
        }
        .error.show { display: block; }

        .loading { display: none; }
        .loading.show {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid rgba(255,255,255,0.3);
            border-top: 2px solid #0c1120;
            border-radius: 50%;
            animation: spin 0.6s linear infinite;
            vertical-align: middle;
            margin-right: 8px;
        }

        @keyframes spin { to { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <div class="auth-container">
        <div class="auth-header">
            <div class="auth-icon">☀️</div>
            <h1>Solar Meter</h1>
            <p class="auth-subtitle">Enter your access token</p>
        </div>

        <form id="authForm">
            <div class="form-group">
                <label for="token">Access Token</label>
                <input 
                    type="password" 
                    id="token" 
                    placeholder="Enter your access token"
                    required
                    autocomplete="off"
                />
            </div>
            <button type="submit">
                <span class="loading" id="loading"></span>
                Sign In
            </button>
            <div class="error" id="error"></div>
        </form>
    </div>

    <script>
        const form = document.getElementById('authForm');
        const tokenInput = document.getElementById('token');
        const errorDiv = document.getElementById('error');
        const loadingSpan = document.getElementById('loading');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            errorDiv.classList.remove('show');
            loadingSpan.classList.add('show');

            const token = tokenInput.value.trim();

            try {
                const response = await fetch(window.location.pathname, {
                    headers: {
                        'Authorization': 'Bearer ' + token
                    }
                });

                if (response.ok) {
                    // Store token in sessionStorage
                    sessionStorage.setItem('pwaToken', token);
                    localStorage.setItem('pwaToken', token);
                    // Reload to access the PWA
                    window.location.href = '/';
                } else {
                    errorDiv.textContent = 'Invalid access token';
                    errorDiv.classList.add('show');
                }
            } catch (error) {
                errorDiv.textContent = 'Error: ' + error.message;
                errorDiv.classList.add('show');
            } finally {
                loadingSpan.classList.remove('show');
            }
        });

        // Check if already authenticated
        (async () => {
            const token = sessionStorage.getItem('pwaToken') || localStorage.getItem('pwaToken');
            if (token) {
                const response = await fetch('/auth-check', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (response.ok) {
                    window.location.href = '/';
                }
            }
        })();
    </script>
</body>
</html>`;
    return html;
}

// Main dashboard page HTML (embedded version for development)
function getMainPageHTML(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#1a1a1a">
    <meta name="description" content="Solar meter PWA - Real-time solar power monitoring">
    <title>Solar Meter Monitor</title>
    <link rel="manifest" href="/manifest.json">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="apple-touch-icon" href="/icon-192.png">
    <style>
        @font-face {
            font-family: 'D-DIN';
            src: url('/fonts/D-DIN.woff2') format('woff2'),
                 url('/fonts/D-DIN.woff') format('woff'),
                 url('/fonts/D-DIN.otf') format('opentype'),
                 url('/fonts/D-DIN.ttf') format('truetype');
            font-weight: 400;
            font-style: normal;
            font-display: swap;
        }

        @font-face {
            font-family: 'D-DIN';
            src: url('/fonts/D-DIN-Bold.woff2') format('woff2'),
                 url('/fonts/D-DIN-Bold.woff') format('woff'),
                 url('/fonts/D-DIN-Bold.otf') format('opentype'),
                 url('/fonts/D-DIN-Bold.ttf') format('truetype');
            font-weight: 700;
            font-style: normal;
            font-display: swap;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        :root {
            --bg: #0f162b;
            --card: rgba(255, 255, 255, 0.06);
            --stroke: rgba(255, 255, 255, 0.12);
            --text: #f8fbff;
            --muted: #95a3c0;
            --primary: #7cf3c6;
            --primary-strong: #57e3b2;
            --shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
        }
        body {
            font-family: 'D-DIN', 'Inter', 'SF Pro Display', 'Segoe UI', system-ui, -apple-system, sans-serif;
            background: radial-gradient(120% 120% at 20% 20%, #192444 0%, #0c1120 45%, #080c18 100%);
            min-height: 100vh;
            padding: 20px;
            color: var(--text);
            line-height: 1.6;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        header {
            background: var(--card);
            padding: 18px 20px;
            border-radius: 16px;
            box-shadow: var(--shadow);
            margin-bottom: 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border: 1px solid var(--stroke);
            backdrop-filter: blur(10px);
        }
        h1 {
            font-size: 1.9em;
            color: var(--text);
            letter-spacing: -0.02em;
            margin-bottom: 6px;
        }
        .timestamp { color: var(--muted); font-size: 0.95em; }
        .loading {
            text-align: center;
            padding: 32px;
            color: var(--primary);
            background: var(--card);
            border: 1px solid var(--stroke);
            border-radius: 14px;
            box-shadow: var(--shadow);
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div>
                <h1>🔆📟📈 Solar Meter Monitor</h1>
                <p class="timestamp">Loading...</p>
            </div>
        </header>
        <div class="loading">
            <p>Loading dashboard from /index.html...</p>
            <p style="margin-top: 20px; font-size: 0.9em; color: #999;">
                For the full dashboard, ensure /pwa/public/index.html is properly served.
            </p>
        </div>
    </div>
</body>
</html>`;
}

export default app;
