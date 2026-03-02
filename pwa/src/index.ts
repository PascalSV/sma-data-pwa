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

// i18n translations for server-rendered pages
const i18n = {
    de: {
        'app.title': 'PV-Anlage Monitor',
        'auth.title': 'Solar Meter',
        'auth.subtitle': 'Geben Sie Ihren Zugangstoken ein',
        'auth.label': 'Zugangstoken',
        'auth.placeholder': 'Geben Sie Ihren Zugangstoken ein',
        'auth.submit': 'Anmelden',
        'auth.error': 'Ungültiger Zugangstoken',
        'auth.error_prefix': 'Fehler: ',
        'page.loading': 'Wird geladen...',
        'page.dashboard_loading': 'Dashboard wird aus /index.html geladen...',
        'page.dashboard_note': 'Für das vollständige Dashboard müssen Sie sicherstellen, dass /public/index.html korrekt bereitgestellt wird.',
        'api.error.unauthorized': 'Nicht autorisiert',
        'api.error.invalid_token': 'Ungültiger oder fehlender Zugangstoken',
        'api.error.current_data': 'Fehler beim Abrufen der aktuellen Daten',
        'api.error.current_max': 'Fehler beim Abrufen der aktuellen und maximalen Daten',
        'api.error.today': 'Fehler beim Abrufen der heutigen Daten',
        'api.error.yearly': 'Fehler beim Abrufen der Jahresdaten'
    },
    en: {
        'app.title': 'Solar Meter Monitor',
        'auth.title': 'Solar Meter',
        'auth.subtitle': 'Enter your access token',
        'auth.label': 'Access Token',
        'auth.placeholder': 'Enter your access token',
        'auth.submit': 'Sign In',
        'auth.error': 'Invalid access token',
        'auth.error_prefix': 'Error: ',
        'page.loading': 'Loading...',
        'page.dashboard_loading': 'Loading dashboard from /index.html...',
        'page.dashboard_note': 'For the full dashboard, ensure /public/index.html is properly served.',
        'api.error.unauthorized': 'Unauthorized',
        'api.error.invalid_token': 'Invalid or missing PWA access token',
        'api.error.current_data': 'Failed to fetch current data',
        'api.error.current_max': 'Failed to fetch current and max data',
        'api.error.today': 'Failed to fetch today\'s data',
        'api.error.yearly': 'Failed to fetch yearly data'
    }
};

// Helper function to get language from request or default to English
function getLanguage(c: any): string {
    const acceptLanguage = c.req.header('Accept-Language') || '';
    if (acceptLanguage.includes('de')) return 'de';
    return 'en';
}

// Helper function to translate strings server-side
function t(lang: string, key: string): string {
    const langDict = lang === 'de' ? i18n.de : i18n.en;
    return (langDict as Record<string, string>)[key] || (i18n.en as Record<string, string>)[key] || key;
}

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
        const lang = getLanguage(c);
        // Return 401 for API requests, redirect to auth page for HTML requests
        const accept = c.req.header('Accept') || '';
        if (accept.includes('application/json')) {
            return c.json(
                { 
                    error: t(lang, 'api.error.unauthorized'), 
                    message: t(lang, 'api.error.invalid_token')
                },
                { status: 401 }
            );
        }
        // For HTML requests, serve the auth page
        return c.html(getAuthPageHTML(lang), 401);
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
    const lang = getLanguage(c);
    return c.html(getAuthPageHTML(lang));
});

// Static assets are served by Wrangler via [assets] in wrangler.toml; no Hono serveStatic needed.

// Fallback routes for index.html and other common files
app.get('/', (c) => {
    const lang = getLanguage(c);
    return c.html(getMainPageHTML(lang));
});

app.get('/index.html', (c) => {
    const lang = getLanguage(c);
    return c.html(getMainPageHTML(lang));
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
        const lang = getLanguage(c);
        return c.json({ error: t(lang, 'api.error.current_data') }, 500 as any);
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
        const lang = getLanguage(c);
        return c.json({ error: t(lang, 'api.error.current_max') }, 500 as any);
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
        const lang = getLanguage(c);
        return c.json({ error: t(lang, 'api.error.today') }, 500 as any);
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
        const lang = getLanguage(c);
        return c.json({ error: t(lang, 'api.error.yearly') }, 500 as any);
    }
});

// Authentication page HTML
function getAuthPageHTML(lang: string = 'en'): string {
    const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light dark">
    <title>${t(lang, 'app.title')}</title>
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

        @media (prefers-color-scheme: light) {
            :root {
                --bg: #fafafa;
                --card: rgba(0, 0, 0, 0.04);
                --stroke: rgba(0, 0, 0, 0.08);
                --text: #1a1a1a;
                --muted: #666666;
                --shadow: 0 24px 64px rgba(0,0,0,0.1);
            }

            body {
                background: radial-gradient(120% 120% at 20% 20%, #e8f4f0 0%, #f5fafc 45%, #ffffff 100%);
            }
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
        .auth-icon { width: 80px; height: 80px; margin: 0 auto 16px; display: block; }
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

        @media (prefers-color-scheme: light) {
            button {
                color: #ffffff;
                box-shadow: 0 12px 24px rgba(124, 243, 198, 0.15);
            }
            button:hover {
                box-shadow: 0 16px 32px rgba(124, 243, 198, 0.25);
            }
        }

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
            <img src="/icon-transparent.svg" alt="${t(lang, 'auth.title')}" class="auth-icon">
            <h1>${t(lang, 'auth.title')}</h1>
            <p class="auth-subtitle">${t(lang, 'auth.subtitle')}</p>
        </div>

        <form id="authForm">
            <div class="form-group">
                <label for="token">${t(lang, 'auth.label')}</label>
                <input 
                    type="password" 
                    id="token" 
                    placeholder="${t(lang, 'auth.placeholder')}"
                    required
                    autocomplete="off"
                />
            </div>
            <button type="submit">
                <span class="loading" id="loading"></span>
                ${t(lang, 'auth.submit')}
            </button>
            <div class="error" id="error"></div>
        </form>
    </div>

    <script>
        const form = document.getElementById('authForm');
        const tokenInput = document.getElementById('token');
        const errorDiv = document.getElementById('error');
        const loadingSpan = document.getElementById('loading');
        const errorPrefix = '${t(lang, 'auth.error_prefix')}';
        const invalidTokenError = '${t(lang, 'auth.error')}';

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
                    errorDiv.textContent = invalidTokenError;
                    errorDiv.classList.add('show');
                }
            } catch (error) {
                errorDiv.textContent = errorPrefix + error.message;
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
function getMainPageHTML(lang: string = 'en'): string {
    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="theme-color" content="#0f162b">
    <meta name="color-scheme" content="light dark">
    <meta name="description" content="Solar meter PWA - Real-time solar power monitoring">
    <title>${t(lang, 'app.title')}</title>
    <link rel="manifest" href="/manifest.json">
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <link rel="apple-touch-icon" href="/icon-192.svg">
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

        @media (prefers-color-scheme: light) {
            :root {
                --bg: #fafafa;
                --card: rgba(0, 0, 0, 0.04);
                --stroke: rgba(0, 0, 0, 0.08);
                --text: #1a1a1a;
                --muted: #666666;
                --shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
            }
        }

        body {
            font-family: 'D-DIN', 'Inter', 'SF Pro Display', 'Segoe UI', system-ui, -apple-system, sans-serif;
            background: radial-gradient(120% 120% at 20% 20%, #192444 0%, #0c1120 45%, #080c18 100%);
            min-height: 100vh;
            padding: 20px;
            color: var(--text);
            line-height: 1.6;
        }

        @media (prefers-color-scheme: light) {
            body {
                background: radial-gradient(120% 120% at 20% 20%, #e8f4f0 0%, #f5fafc 45%, #ffffff 100%);
            }
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
            display: flex;
            align-items: center;
            gap: 12px;
        }
        h1 img {
            width: 48px;
            height: 48px;
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
        .loading p:last-child {
            margin-top: 20px;
            font-size: 0.9em;
            color: #999;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div>
                <h1><img src="/icon-transparent.svg" alt="Solar Meter">${t(lang, 'app.title')}</h1>
                <p class="timestamp">${t(lang, 'page.loading')}</p>
            </div>
        </header>
        <div class="loading">
            <p>${t(lang, 'page.dashboard_loading')}</p>
            <p>
                ${t(lang, 'page.dashboard_note')}
            </p>
        </div>
    </div>
</body>
</html>`;
}

export default app;
