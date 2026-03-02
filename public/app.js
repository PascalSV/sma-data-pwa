// i18n - Internationalization support
const i18n = {
    currentLanguage: 'en',
    translations: {
        de: {
            'app.title': 'PV-Anlage Monitor',
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
            'gauge.min': '0 W',
            'gauge.max': '4.500 W'
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
            'gauge.min': '0 W',
            'gauge.max': '4.500 W'
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

// Service Worker Registration
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(() => console.log('Service Worker registered'))
        .catch(err => console.log('Service Worker registration failed:', err));
}

// PWA Install Banner
let deferredPrompt;

function setupInstallBanner() {
    const installBanner = document.getElementById('installBanner');
    const installButton = document.getElementById('installButton');
    const closeBanner = document.getElementById('closeBanner');

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        installBanner?.classList.add('show');
    });

    installButton?.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);
            deferredPrompt = null;
            installBanner?.classList.remove('show');
        }
    });

    closeBanner?.addEventListener('click', () => {
        installBanner?.classList.remove('show');
    });
}

function setupTimestampRefresh() {
    const timestamp = document.getElementById('timestamp');
    if (!timestamp) return;

    timestamp.addEventListener('click', async () => {
        await fetchData();
    });
}

function setupPullToRefresh() {
    const indicator = document.getElementById('pullIndicator');
    if (!indicator) return;

    const threshold = 70;
    let startY = 0;
    let pulling = false;

    window.addEventListener('touchstart', (e) => {
        if (window.scrollY === 0 && e.touches.length === 1) {
            startY = e.touches[0].clientY;
            pulling = true;
        }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (!pulling || e.touches.length !== 1) return;
        const delta = e.touches[0].clientY - startY;
        if (delta > 0 && window.scrollY === 0) {
            const clamped = Math.min(delta, threshold * 1.5);
            indicator.style.transform = `translateY(${Math.max(clamped / 3 - 12, 0)}px)`;
            indicator.textContent = delta > threshold ? i18n.t('pull.release') : i18n.t('pull.refresh');
            indicator.classList.add('visible');
        }
    }, { passive: true });

    window.addEventListener('touchend', async () => {
        if (!pulling) return;
        const shouldRefresh = indicator.textContent === i18n.t('pull.release');
        indicator.textContent = shouldRefresh ? i18n.t('pull.refreshing') : i18n.t('pull.refresh');
        indicator.style.transform = 'translateY(0)';
        indicator.classList.add('visible');

        if (shouldRefresh) {
            await fetchData();
        }

        setTimeout(() => {
            indicator.classList.remove('visible');
            indicator.style.transform = 'translateY(-12px)';
            indicator.textContent = i18n.t('pull.refresh');
        }, shouldRefresh ? 500 : 200);

        pulling = false;
    }, { passive: true });
}

// Chart instances
let powerGaugeChart = null;
let yieldGaugeChart = null;
let powerTimeSeriesChart = null;
let yearlyYieldChart = null;

const yearlyBarValueLabelsPlugin = {
    id: 'yearlyBarValueLabels',
    afterDatasetsDraw(chart, args, pluginOptions) {
        if (chart.config.type !== 'bar') return;
        if (!pluginOptions || pluginOptions.enabled === false) return;

        const bars = chart.getDatasetMeta(0)?.data || [];
        const values = chart.data.datasets?.[0]?.data || [];
        if (!bars.length || !values.length) return;

        const context = chart.ctx;
        const insideColor = pluginOptions.insideColor || '#0c1120';
        const outsideColor = pluginOptions.outsideColor || '#f8fbff';
        const minInsideHeight = pluginOptions.minInsideHeight || 44;
        const insideBottomPadding = pluginOptions.insideBottomPadding || 10;
        const fontSize = window.innerWidth <= 768 ? 13 : 18;

        context.save();
        context.textAlign = 'left';
        context.textBaseline = 'middle';
        context.font = `700 ${fontSize}px D-DIN, Inter, sans-serif`;

        bars.forEach((bar, index) => {
            const rawValue = Number(values[index] || 0);
            const label = `${rawValue.toLocaleString('de-DE')} kWh`;

            const barTop = Math.min(bar.y, bar.base);
            const barBottom = Math.max(bar.y, bar.base);
            const barHeight = barBottom - barTop;
            const isInside = barHeight >= minInsideHeight;

            const x = bar.x;
            const y = isInside ? (barBottom - insideBottomPadding) : (barTop - insideBottomPadding);

            context.fillStyle = isInside ? insideColor : outsideColor;
            context.translate(x, y);
            context.rotate(-Math.PI / 2);
            context.fillText(label, 0, 0);
            context.rotate(Math.PI / 2);
            context.translate(-x, -y);
        });

        context.restore();
    }
};

Chart.register(yearlyBarValueLabelsPlugin);

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
            labels: ['Normal', 'Warning', 'Critical', 'Remaining'],
            datasets: [{
                data: [60, 20, 20, 0],
                backgroundColor: ['#7cf3c6', '#ffa500', '#ff4444', '#e0e0e0'],
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        }
    });
}

// Initialize time series chart
function initializeTimeSeries() {
    const timeSeriesCtx = document.getElementById('powerChart');
    const isMobile = window.innerWidth <= 768;
    powerTimeSeriesChart = new Chart(timeSeriesCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: i18n.t('chart.power'),
                data: [],
                borderColor: '#7cf3c6',
                backgroundColor: 'rgba(124, 243, 198, 0.1)',
                tension: 0.4,
                fill: true,
                pointRadius: 0,
                pointHoverRadius: 0,
                pointBackgroundColor: '#7cf3c6',
                pointBorderColor: '#fff',
                pointBorderWidth: isMobile ? 1 : 2
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
                            const isMobile = window.innerWidth <= 768;
                            return isMobile ? value.toLocaleString() : value.toLocaleString() + ' W';
                        },
                        font: {
                            size: window.innerWidth <= 768 ? 10 : 12
                        }
                    }
                },
                x: {
                    display: true,
                    ticks: {
                        font: {
                            size: window.innerWidth <= 768 ? 10 : 12
                        }
                    }
                }
            }
        }
    });
}

// Initialize yearly yield bar chart
function initializeYearlyYieldChart() {
    const yearlyCtx = document.getElementById('yearlyYieldChart');
    yearlyYieldChart = new Chart(yearlyCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: i18n.t('chart.energy'),
                data: [],
                backgroundColor: '#7cf3c6',
                borderRadius: 10,
                hoverBackgroundColor: '#57e3b2'
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
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.parsed.y.toLocaleString()} kWh`
                    }
                },
                yearlyBarValueLabels: {
                    enabled: true,
                    insideColor: '#0c1120',
                    outsideColor: '#f8fbff',
                    minInsideHeight: 44,
                    insideBottomPadding: 10
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => {
                            const isMobile = window.innerWidth <= 768;
                            return isMobile ? value.toLocaleString() : `${value.toLocaleString()} kWh`;
                        },
                        font: {
                            size: window.innerWidth <= 768 ? 10 : 12
                        }
                    }
                },
                x: {
                    ticks: {
                        font: {
                            size: window.innerWidth <= 768 ? 10 : 12
                        }
                    }
                }
            }
        }
    });
}

// Fetch and update data
async function fetchData() {
    try {
        const powerCardSpinner = document.getElementById('powerCardSpinner');
        const yieldCardSpinner = document.getElementById('yieldCardSpinner');
        const powerChartOverlay = document.getElementById('powerChartOverlay');
        const yearlyChartOverlay = document.getElementById('yearlyChartOverlay');
        const errorContainer = document.getElementById('errorContainer');

        powerCardSpinner?.classList.add('active');
        yieldCardSpinner?.classList.add('active');
        powerChartOverlay?.classList.add('active');
        yearlyChartOverlay?.classList.add('active');
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

        // Fetch yearly yield data
        const yearlyResponse = await fetchWithAuth('/api/yearly-yield');
        if (!yearlyResponse.ok && yearlyResponse.status === 401) {
            throw new Error('Unauthorized: Invalid API credentials');
        }
        const yearlyData = await yearlyResponse.json();

        if (yearlyData.success) {
            updateYearlyYield(yearlyData.data);
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
    } finally {
        const powerCardSpinner = document.getElementById('powerCardSpinner');
        const yieldCardSpinner = document.getElementById('yieldCardSpinner');
        powerCardSpinner?.classList.remove('active');
        yieldCardSpinner?.classList.remove('active');
        // Chart overlays are managed by updateTimeSeries/updateYearlyYield functions
    }
}

// Update metric displays and gauges
function updateMetrics(data) {
    const power = Math.round(data.power || 0);
    const yield_ = Math.round(data.total_yield || 0);

    // Update values
    document.getElementById('powerValue').textContent = power.toLocaleString() + ' W';
    document.getElementById('yieldValue').textContent = Math.round(yield_ / 1000).toLocaleString() + ' kWh';

    // Update power gauge (assuming max 4500W) with three zones: 0-60% blue, 61-80% yellow, 81-100% red
    const maxPower = 4500;
    const powerPercentage = Math.min((power / maxPower) * 100, 100);
    if (powerGaugeChart) {
        let normalPercentage = 0, warningPercentage = 0, criticalPercentage = 0;

        if (powerPercentage <= 60) {
            normalPercentage = powerPercentage;
        } else if (powerPercentage <= 80) {
            normalPercentage = 60;
            warningPercentage = powerPercentage - 60;
        } else {
            normalPercentage = 60;
            warningPercentage = 20;
            criticalPercentage = powerPercentage - 80;
        }

        const remaining = 100 - powerPercentage;
        powerGaugeChart.data.datasets[0].data = [normalPercentage, warningPercentage, criticalPercentage, remaining];
        powerGaugeChart.update();
    }
}

// Update time series chart
function updateTimeSeries(data) {
    const powerChartOverlay = document.getElementById('powerChartOverlay');

    if (!Array.isArray(data) || data.length === 0) {
        // Show no-data message
        if (powerChartOverlay) {
            powerChartOverlay.innerHTML = '<div class="no-data">No data available</div>';
            powerChartOverlay.classList.add('active');
        }
        return;
    }

    // Sort by timestamp ascending
    const sortedData = [...data].sort((a, b) => a.TimeStamp - b.TimeStamp);

    // Calculate today's yield (difference between first and last TotalYield)
    if (sortedData.length > 0) {
        const firstYield = Math.round(sortedData[0].TotalYield || 0);
        const lastYield = Math.round(sortedData[sortedData.length - 1].TotalYield || 0);
        const todayYield = lastYield - firstYield;
        document.getElementById('todayYieldValue').textContent = (todayYield / 1000).toLocaleString('de-DE', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        }) + ' kWh';
    }

    const labels = sortedData.map(item => {
        const date = new Date(item.TimeStamp * 1000);
        return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
    });

    const powers = sortedData.map(item => Math.round(item.Power || 0));

    if (powerTimeSeriesChart) {
        powerTimeSeriesChart.data.labels = labels;
        powerTimeSeriesChart.data.datasets[0].data = powers;
        powerTimeSeriesChart.update();
        if (powerChartOverlay) {
            powerChartOverlay.classList.remove('active');
        }
    }
}

// Update yearly yield bar chart
function updateYearlyYield(data) {
    const yearlyChartOverlay = document.getElementById('yearlyChartOverlay');

    if (!Array.isArray(data) || data.length === 0 || !yearlyYieldChart) {
        // Show no-data message
        if (yearlyChartOverlay) {
            yearlyChartOverlay.innerHTML = '<div class="no-data">No data available</div>';
            yearlyChartOverlay.classList.add('active');
        }
        return;
    }

    // Normalize fields: accept Year/year and Yield/Total/total_yield
    const normalized = data.map(item => {
        const year = item.year ?? item.Year ?? item.year_value ?? item.yearVal;
        const yieldWh = item.yield ?? item.Yield ?? item.total ?? item.Total ?? item.total_yield ?? 0;
        return {
            year: year ?? '-',
            kwh: Math.round((yieldWh || 0) / 1000)
        };
    }).filter(entry => entry.year !== '-');

    // Sort by year ascending if numeric
    const sorted = normalized.sort((a, b) => Number(a.year) - Number(b.year));

    // Calculate year-over-year difference, clamped to >= 0
    const differences = sorted.map((entry, idx) => {
        if (idx === 0) {
            // First year: show as difference from zero (or absolute)
            return entry.kwh;
        }
        // Subsequent years: show difference from previous year, min 0
        return Math.max(0, entry.kwh - sorted[idx - 1].kwh);
    });

    const labels = sorted.map(entry => entry.year);
    const currentYear = new Date().getFullYear();

    // Calculate mean excluding partial years (first year and current year)
    const fullYearDifferences = differences.filter((_, idx) => {
        const yearValue = Number(sorted[idx].year);
        // Exclude first year and current year from mean calculation
        return idx > 0 && yearValue !== currentYear;
    });

    const meanValue = fullYearDifferences.length > 0
        ? fullYearDifferences.reduce((a, b) => a + b, 0) / fullYearDifferences.length
        : (differences.length > 0 ? differences.reduce((a, b) => a + b, 0) / differences.length : 0);

    yearlyYieldChart.data.labels = labels;
    yearlyYieldChart.data.datasets[0].data = differences;

    // Add or update mean line (always at end for top rendering)
    const meanLineDataset = {
        label: `${i18n.t('chart.mean')} (${Math.round(meanValue).toLocaleString()} kWh)`,
        data: new Array(differences.length).fill(meanValue),
        type: 'line',
        borderColor: '#ff9500',
        borderWidth: 3,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
        tension: 0,
        spanGaps: true,
        xAxisID: 'x',
        yAxisID: 'y',
        zIndex: 10
    };

    if (yearlyYieldChart.data.datasets.length > 1) {
        yearlyYieldChart.data.datasets[1] = meanLineDataset;
    } else {
        yearlyYieldChart.data.datasets.push(meanLineDataset);
    }
    yearlyYieldChart.update();

    // Hide the no-data overlay when data is present
    if (yearlyChartOverlay) {
        yearlyChartOverlay.classList.remove('active');
    }
}

// Initialize app
function initializeApp() {
    // Initialize i18n (language support)
    i18n.init();

    // Check authentication first
    checkPwaAuth();

    // Setup event listeners
    setupInstallBanner();
    setupTimestampRefresh();
    setupPullToRefresh();

    initializeGauges();
    initializeTimeSeries();
    initializeYearlyYieldChart();
    fetchData();
}

// Start when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}