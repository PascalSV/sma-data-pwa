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
                label: 'Power (W)',
                data: [],
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4,
                fill: true,
                pointRadius: 4,
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

        // Update timestamp
        document.getElementById('timestamp').textContent = new Date().toLocaleString();

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
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
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
