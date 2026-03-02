// i18n - Internationalization support
const i18n = {
    currentLanguage: 'en',
    translations: {
        de: {
            'app.title': 'Sonnen-Meter Monitor',
            'card.currentLoad': 'Aktuelle Last',
            'card.energyProduction': 'Energieerzeugung',
            'card.todayProduction': 'Heutige Energieerzeugung',
            'card.yearlyProduction': 'Jährliche Energieerzeugung',
            'label.total': 'Gesamt',
            'label.today': 'Heute',
            'install.banner': 'Installiere diese App auf deinem Gerät für Offline-Zugriff und schnelle Ausführung',
            'install.button': 'App installieren',
            'pull.refresh': 'Zum Aktualisieren hochziehen',
            'pull.release': 'Zum Aktualisieren loslassen',
            'pull.refreshing': 'Wird aktualisiert...',
            'timestamp.refreshed': 'Aktualisiert am:',
            'chart.power': 'Leistung (W)',
            'chart.energy': 'Energie (kWh)',
            'chart.mean': 'Durchschnitt',
            'gauge.min': '0W',
            'gauge.max': '4.500W'
        },
        en: {
            'app.title': 'Solar Meter Monitor',
            'card.currentLoad': 'Current Load',
            'card.energyProduction': 'Energy Production',
            'card.todayProduction': 'Today\'s Energy Production',
            'card.yearlyProduction': 'Yearly Energy Production',
            'label.total': 'Total',
            'label.today': 'Today',
            'install.banner': 'Install this app on your device for offline access and quick launch',
            'install.button': 'Install App',
            'pull.refresh': 'Pull to refresh',
            'pull.release': 'Release to refresh',
            'pull.refreshing': 'Refreshing...',
            'timestamp.refreshed': 'Refreshed on:',
            'chart.power': 'Power (W)',
            'chart.energy': 'Energy (kWh)',
            'chart.mean': 'Mean',
            'gauge.min': '0W',
            'gauge.max': '4.500W'
        }
    },

    getLanguage() {
        // Check localStorage for saved preference
        const saved = localStorage.getItem('preferredLanguage');
        if (saved && this.translations[saved]) return saved;

        // Get browser language
        const browserLang = navigator.language.split('-')[0].toLowerCase();
        if (this.translations[browserLang]) return browserLang;

        // Default to English
        return 'en';
    },

    t(key) {
        return this.translations[this.currentLanguage]?.[key] || this.translations['en'][key] || key;
    },

    init() {
        this.currentLanguage = this.getLanguage();
        this.applyTranslations();
    },

    applyTranslations() {
        // Update all elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            element.textContent = this.t(key);
        });

        // Update title
        document.querySelector('title').textContent = this.t('app.title');
        document.documentElement.lang = this.currentLanguage;
    },

    setLanguage(lang) {
        if (this.translations[lang]) {
            this.currentLanguage = lang;
            localStorage.setItem('preferredLanguage', lang);
            this.applyTranslations();
        }
    }
};

// Get PWA access token
function getPwaToken() {
    return sessionStorage.getItem('pwaToken') || localStorage.getItem('pwaToken');
}

// Get API secret from global variable or localStorage
function getApiSecret() {
    // Try to get from window object (injected by server)
    if (typeof window.API_SECRET !== 'undefined') {
        return window.API_SECRET;
    }
    // Fallback to localStorage
    return localStorage.getItem('apiSecret');
}

// Helper to make authenticated API calls
async function fetchWithAuth(url) {
    const pwaToken = getPwaToken();
    const apiSecret = getApiSecret();
    const headers = {};

    if (pwaToken) {
        headers['Authorization'] = `Bearer ${pwaToken}`;
    }

    if (apiSecret) {
        headers['X-API-Key'] = `Bearer ${apiSecret}`;
    }

    return fetch(url, { headers });
}

// Check PWA authentication on page load
async function checkPwaAuth() {
    const token = getPwaToken();
    if (!token) {
        // Redirect to auth page
        window.location.href = '/auth.html';
        return;
    }

    // Verify token is still valid
    try {
        const response = await fetch('/auth-check', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
            // Token invalid, redirect to auth
            sessionStorage.removeItem('pwaToken');
            window.location.href = '/auth.html';
        }
    } catch (error) {
        console.error('Auth check failed:', error);
    }
}

// Logout handler
function logout() {
    sessionStorage.removeItem('pwaToken');
    localStorage.removeItem('pwaToken');
    window.location.href = '/auth.html';
}

// Service Worker Registration
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(() => console.log('Service Worker registered'))
        .catch(err => console.log('Service Worker registration failed:', err));
}

// PWA Install Banner
let deferredPrompt;
const installBanner = document.getElementById('installBanner');
const installButton = document.getElementById('installButton');
const closeBanner = document.getElementById('closeBanner');
const logoutButton = document.getElementById('logoutButton');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBanner.classList.add('show');
});

installButton?.addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        deferredPrompt = null;
        installBanner.classList.remove('show');
    }
});

closeBanner?.addEventListener('click', () => {
    installBanner.classList.remove('show');
});

logoutButton?.addEventListener('click', logout);// Chart instances
let powerGaugeChart = null;
let yieldGaugeChart = null;
let powerTimeSeriesChart = null;

// Initialize gauges
function initializeGauges() {
    const gaugeOptions = {
        type: 'doughnut',
        options: {
            responsive: true,
            maintainAspectRatio: true,
            circumference: 180,
            rotation: 270,
            cutout: '75%',
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: false
                }
            }
        }
    };

    // Power Gauge
    const powerGaugeCtx = document.getElementById('powerGauge');
    powerGaugeChart = new Chart(powerGaugeCtx, {
        ...gaugeOptions,
        data: {
            labels: ['Used', 'Remaining'],
            datasets: [{
                data: [0, 100],
                backgroundColor: ['#667eea', '#e0e0e0'],
                borderWidth: 0
            }]
        }
    });

    // Yield Gauge
    const yieldGaugeCtx = document.getElementById('yieldGauge');
    yieldGaugeChart = new Chart(yieldGaugeCtx, {
        ...gaugeOptions,
        data: {
            labels: ['Used', 'Remaining'],
            datasets: [{
                data: [0, 100],
                backgroundColor: ['#764ba2', '#e0e0e0'],
                borderWidth: 0
            }]
        }
    });
}

// Initialize time series chart
function initializeTimeSeries() {
    const timeSeriesCtx = document.getElementById('powerChart');
    powerTimeSeriesChart = new Chart(timeSeriesCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: i18n.t('chart.power'),
                data: [],
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4,
                fill: true,
                pointRadius: 0,
                pointHoverRadius: 0,
                pointBackgroundColor: '#667eea',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        font: {
                            size: 12
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function (value) {
                            return value + ' W';
                        }
                    }
                },
                x: {
                    display: true
                }
            }
        }
    });
}

// Fetch and update data
async function fetchData() {
    try {
        const errorContainer = document.getElementById('errorContainer');
        errorContainer.innerHTML = '';

        // Fetch current data
        const currentResponse = await fetchWithAuth('/api/current');
        if (!currentResponse.ok && currentResponse.status === 401) {
            throw new Error('Unauthorized: Invalid API credentials');
        }
        const currentData = await currentResponse.json();

        if (currentData.success) {
            updateMetrics(currentData.data);
        }

        // Fetch today's data
        const todayResponse = await fetchWithAuth('/api/today');
        if (!todayResponse.ok && todayResponse.status === 401) {
            throw new Error('Unauthorized: Invalid API credentials');
        }
        const todayData = await todayResponse.json();

        if (todayData.success) {
            updateTimeSeries(todayData.data);
        }

        // Update timestamp with padded date/time
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const dateTimeStr = `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
        document.getElementById('timestamp').textContent = i18n.t('timestamp.refreshed') + ' ' + dateTimeStr;

    } catch (error) {
        console.error('Error fetching data:', error);
        const errorContainer = document.getElementById('errorContainer');
        errorContainer.innerHTML = `<div class="error">Failed to fetch data: ${error.message}</div>`;
    }
}

// Update metric displays and gauges
function updateMetrics(data) {
    const power = Math.round(data.power || 0);
    const yield_ = Math.round(data.total_yield || 0);

    // Update values
    document.getElementById('powerValue').textContent = power.toLocaleString() + ' W';
    document.getElementById('yieldValue').textContent = (yield_ / 1000).toFixed(2) + ' kWh';

    // Update power gauge (assuming max 6000W)
    const maxPower = 6000;
    const powerPercentage = Math.min((power / maxPower) * 100, 100);
    if (powerGaugeChart) {
        powerGaugeChart.data.datasets[0].data = [powerPercentage, 100 - powerPercentage];
        powerGaugeChart.update();
    }

    // Update yield gauge (assuming max 30 kWh per day)
    const maxYield = 30000;
    const yieldPercentage = Math.min((yield_ / maxYield) * 100, 100);
    if (yieldGaugeChart) {
        yieldGaugeChart.data.datasets[0].data = [yieldPercentage, 100 - yieldPercentage];
        yieldGaugeChart.update();
    }
}

// Update time series chart
function updateTimeSeries(data) {
    if (!Array.isArray(data) || data.length === 0) return;

    // Sort by timestamp ascending
    const sortedData = [...data].sort((a, b) => a.TimeStamp - b.TimeStamp);

    const labels = sortedData.map(item => {
        const date = new Date(item.TimeStamp * 1000);
        return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
    });

    const powers = sortedData.map(item => Math.round(item.Power || 0));

    if (powerTimeSeriesChart) {
        powerTimeSeriesChart.data.labels = labels;
        powerTimeSeriesChart.data.datasets[0].data = powers;
        powerTimeSeriesChart.update();
    }
}

// Initialize app
function initializeApp() {
    // Initialize i18n (language support)
    i18n.init();

    // Check authentication first
    checkPwaAuth();

    initializeGauges();
    initializeTimeSeries();
    fetchData();

    // Refresh data every 5 minutes
    setInterval(fetchData, 5 * 60 * 1000);

    // Refresh every 30 seconds for near real-time updates
    setInterval(fetchData, 30 * 1000);
}

// Start when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}
