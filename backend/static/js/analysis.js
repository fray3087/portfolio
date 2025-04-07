// Analisi Portafoglio - JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Ottieni il portfolio ID dalla URL
    const portfolioId = window.location.pathname.split('/')[2];
    
    // Configurazione di Chart.js
    Chart.defaults.font.family = "'Segoe UI', 'Helvetica Neue', 'Arial', sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.color = '#64748b';
    
    // Variabili globali
    let performanceChart = null;
    let drawdownChart = null;
    let allocationChart = null;
    let riskReturnChart = null;
    let returnsDistributionChart = null;
    let correlationChart = null;
    let currentPeriod = '1m';
    let cachedData = {}; 
    
    // Inizializza i grafici
    initCharts();
    
    // Gestori degli eventi
    setupEventListeners();
    
    /**
     * Inizializzazione dei grafici
     */
    function initCharts() {
        // Grafico delle performance
        setupPerformanceChart();
        
        // Carica i dati iniziali
        loadChartData(currentPeriod);
    }
    
    /**
     * Imposta i listener degli eventi
     */
    function setupEventListeners() {
        // Selettori di periodo
        const periodButtons = document.querySelectorAll('.period-btn');
        periodButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                // Rimuovi la classe attiva da tutti i bottoni
                periodButtons.forEach(b => b.classList.remove('active'));
                
                // Aggiungi la classe attiva a questo bottone
                this.classList.add('active');
                
                // Carica i dati per il periodo selezionato
                currentPeriod = this.dataset.period;
                loadChartData(currentPeriod);
            });
        });
    }
    
    /**
     * Carica i dati per i grafici e le metriche
     */
    function loadChartData(period) {
        // Mostra gli indicatori di caricamento
        showLoadingSpinners();
        
        // Usa un'unica API consolidata
        fetch(`/api/portfolios/${portfolioId}/analysis-data?period=${period}`)
            .then(response => response.json())
            .then(data => {
                // Nascondi gli indicatori di caricamento
                hideLoadingSpinners();
                
                // Aggiorna tutti i grafici con i dati ricevuti
                updatePerformanceChart(data.performance);
                updateMetrics(data.performance);
                updateDrawdownChart(data.drawdown);
                updateDrawdownMetrics(data.drawdown);
                updateAllocationChart(data.allocation);
                updateRiskReturnChart(data.riskReturn);
                updateReturnsDistributionChart(data.returnsDistribution);
                updateCorrelationChart(data.correlation);
            })
            .catch(error => {
                console.error('Errore nel caricamento dei dati:', error);
                hideLoadingSpinners();
                showErrorMessage();
            });
    }
    
    /**
     * Mostra indicatori di caricamento
     */
    function showLoadingSpinners() {
        // Aggiungi spinner a tutti i contenitori dei grafici
        document.querySelectorAll('.chart-container').forEach(container => {
            const spinner = document.createElement('div');
            spinner.className = 'loading-spinner';
            spinner.innerHTML = '<i class="fas fa-spinner fa-spin"></i><p>Caricamento dati...</p>';
            container.appendChild(spinner);
        });
        
        // Disabilita i pulsanti di periodo durante il caricamento
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.disabled = true;
        });
    }
    
    /**
     * Nasconde indicatori di caricamento
     */
    function hideLoadingSpinners() {
        // Rimuovi tutti gli spinner
        document.querySelectorAll('.loading-spinner').forEach(spinner => {
            spinner.remove();
        });
        
        // Riabilita i pulsanti
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.disabled = false;
        });
    }
    
    /**
     * Mostra un messaggio di errore
     */
    function showErrorMessage() {
        // Mostra un messaggio di errore
        document.querySelectorAll('.chart-container').forEach(container => {
            if (!container.querySelector('.error-message')) {
                const errorMsg = document.createElement('div');
                errorMsg.className = 'error-message';
                errorMsg.innerHTML = '<p>Errore nel caricamento dei dati. Riprova più tardi.</p>';
                container.appendChild(errorMsg);
            }
        });
    }
    
    /**
     * Inizializza il grafico delle performance
     */
    function setupPerformanceChart() {
        const ctx = document.getElementById('performanceChart').getContext('2d');
        
        performanceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Valore Portafoglio',
                    data: [],
                    borderColor: '#3a86ff',
                    backgroundColor: 'rgba(58, 134, 255, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.2,
                    pointRadius: 1,
                    pointHoverRadius: 5
                }, {
                    label: 'Benchmark',
                    data: [],
                    borderColor: '#8b5cf6',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: false,
                    tension: 0.2,
                    pointRadius: 0,
                    pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                let label = context.dataset.label || '';
                                if (label) {
                                    label += ': ';
                                }
                                if (context.parsed.y !== null) {
                                    label += new Intl.NumberFormat('it-IT', {
                                        style: 'currency',
                                        currency: 'EUR'
                                    }).format(context.parsed.y);
                                }
                                return label;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    },
                    y: {
                        grid: {
                            borderDash: [2, 4],
                            color: '#e2e8f0'
                        },
                        ticks: {
                            callback: function(value) {
                                return new Intl.NumberFormat('it-IT', {
                                    style: 'currency',
                                    currency: 'EUR',
                                    maximumFractionDigits: 0
                                }).format(value);
                            }
                        }
                    }
                }
            }
        });
    }
    
    /**
     * Aggiorna il grafico delle performance con nuovi dati
     */
    function updatePerformanceChart(data) {
        if (!performanceChart) {
            console.error('performanceChart non inizializzato');
            return;
        }
        
        performanceChart.data.labels = data.dates;
        performanceChart.data.datasets[0].data = data.portfolioValues;
        
        if (data.benchmarkValues && data.benchmarkValues.length > 0) {
            performanceChart.data.datasets[1].data = data.benchmarkValues;
        } else {
            performanceChart.data.datasets[1].data = [];
        }
        
        performanceChart.update();
    }
    
    /**
     * Aggiorna le metriche di performance generali
     */
    function updateMetrics(data) {
        if (!data.metrics) return;
        
        // Aggiorna le metriche di performance
        updateMetricValue('totalReturn', data.metrics.totalReturn, '%');
        updateMetricValue('annualizedReturn', data.metrics.annualizedReturn, '%');
        updateMetricValue('alpha', data.metrics.alpha, '');
        updateMetricValue('beta', data.metrics.beta, '');
        updateMetricValue('sharpeRatio', data.metrics.sharpeRatio, '');
        updateMetricValue('volatility', data.metrics.volatility, '%');
    }
    
    /**
     * Aggiorna la visualizzazione di una metrica
     */
    function updateMetricValue(id, value, suffix = '') {
        const element = document.getElementById(id);
        if (!element) return;
        
        let displayValue = value !== null ? value.toFixed(2) : 'N/A';
        if (displayValue !== 'N/A' && suffix) {
            displayValue += suffix;
        }
        
        element.textContent = displayValue;
        
        // Aggiungi classi positive/negative per i valori numerici
        if (value !== null) {
            element.className = 'metric-value ' + (value >= 0 ? 'positive' : 'negative');
        } else {
            element.className = 'metric-value';
        }
    }
    
    /**
     * Aggiorna le metriche di drawdown
     */
    function updateDrawdownMetrics(data) {
        if (!data.metrics) return;
        
        updateMetricValue('maxDrawdown', data.metrics.maxDrawdown, '%');
        updateMetricValue('avgDrawdownDuration', data.metrics.avgDrawdownDuration, ' giorni');
        updateMetricValue('avgRecoveryTime', data.metrics.avgRecoveryTime, ' giorni');
        updateMetricValue('currentDrawdown', data.metrics.currentDrawdown, '%');
    }
    
    /**
     * Inizializza o aggiorna il grafico di drawdown
     */
    function updateDrawdownChart(data) {
        const ctx = document.getElementById('drawdownChart').getContext('2d');
        
        // Se il grafico esiste già, distruggilo per ricrearlo
        if (drawdownChart) {
            drawdownChart.destroy();
        }
        
        drawdownChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.dates,
                datasets: [{
                    label: 'Drawdown',
                    data: data.drawdownValues,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    pointRadius: 0,
                    pointHoverRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Drawdown: ${context.parsed.y.toFixed(2)}%`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45
                        }
                    },
                    y: {
                        grid: {
                            borderDash: [2, 4],
                            color: '#e2e8f0'
                        },
                        max: 0,
                        ticks: {
                            callback: function(value) {
                                return `${value}%`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    /**
     * Inizializza o aggiorna il grafico di allocazione degli asset
     */
    function updateAllocationChart(data) {
        const ctx = document.getElementById('allocationChart').getContext('2d');
        
        // Se il grafico esiste già, distruggilo per ricrearlo
        if (allocationChart) {
            allocationChart.destroy();
        }
        
        // Genera colori per ogni asset
        const colors = generateColors(data.assets.length);
        
        allocationChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.assets,
                datasets: [{
                    data: data.allocations,
                    backgroundColor: colors,
                    borderWidth: 1,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            boxWidth: 15,
                            padding: 15
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                return `${label}: ${value.toFixed(2)}%`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    /**
     * Inizializza o aggiorna il grafico rischio/rendimento
     */
    function updateRiskReturnChart(data) {
        const ctx = document.getElementById('riskReturnChart').getContext('2d');
        
        // Se il grafico esiste già, distruggilo per ricrearlo
        if (riskReturnChart) {
            riskReturnChart.destroy();
        }
        
        // Genera colori per ogni asset
        const colors = generateColors(data.assets.length);
        
        riskReturnChart = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Asset',
                    data: data.assets.map((asset, index) => ({
                        x: data.risks[index],
                        y: data.returns[index],
                        assetName: asset
                    })),
                    backgroundColor: colors,
                    borderColor: '#ffffff',
                    borderWidth: 1,
                    pointRadius: 8,
                    pointHoverRadius: 10
                }, {
                    label: 'Portafoglio',
                    data: [{
                        x: data.portfolioRisk,
                        y: data.portfolioReturn,
                        assetName: 'Portafoglio'
                    }],
                    backgroundColor: '#3a86ff',
                    borderColor: '#ffffff',
                    borderWidth: 1,
                    pointRadius: 10,
                    pointHoverRadius: 12,
                    pointStyle: 'star'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const assetName = context.raw.assetName;
                                const risk = context.raw.x.toFixed(2);
                                const ret = context.raw.y.toFixed(2);
                                return [
                                    `${assetName}`,
                                    `Rischio: ${risk}%`,
                                    `Rendimento: ${ret}%`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Rischio (Volatilità %)'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Rendimento Annualizzato (%)'
                        }
                    }
                }
            }
        });
    }
    
    /**
     * Inizializza o aggiorna il grafico della distribuzione dei rendimenti
     */
    function updateReturnsDistributionChart(data) {
        const ctx = document.getElementById('returnsDistributionChart').getContext('2d');
        
        // Se il grafico esiste già, distruggilo per ricrearlo
        if (returnsDistributionChart) {
            returnsDistributionChart.destroy();
        }
        
        returnsDistributionChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.bins,
                datasets: [{
                    label: 'Frequenza',
                    data: data.frequencies,
                    backgroundColor: 'rgba(58, 134, 255, 0.7)',
                    borderColor: '#3a86ff',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Frequenza: ${context.raw}`;
                            },
                            title: function(context) {
                                const range = context[0].label;
                                return `Rendimento: ${range}%`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Rendimento Giornaliero (%)'
                        },
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Frequenza'
                        },
                        grid: {
                            borderDash: [2, 4],
                            color: '#e2e8f0'
                        }
                    }
                }
            }
        });
    }
    
    /**
     * Inizializza o aggiorna il grafico di correlazione
     */
    function updateCorrelationChart(data) {
        const ctx = document.getElementById('correlationChart').getContext('2d');
        
        // Aggiungi questo controllo
        if (!ctx) {
            console.error('Elemento correlationChart non trovato nel DOM');
            return;
        }


        // Se il grafico esiste già, distruggilo per ricrearlo
        if (correlationChart) {
            correlationChart.destroy();
        }
        
        // Gestione speciale per pochi asset (1 o 2)
        if (data.labels.length <= 2) {
            if (data.labels.length === 0) {
                // Nessun asset con dati sufficienti
                document.getElementById('correlationChart').parentNode.innerHTML = 
                    '<p class="text-center text-muted">Dati insufficienti per la correlazione.</p>';
                return;
            } else if (data.labels.length === 1) {
                // Un solo asset - mostra messaggio esplicativo
                document.getElementById('correlationChart').parentNode.innerHTML = 
                    '<p class="text-center text-muted">È necessario avere almeno due asset per calcolare la correlazione.</p>';
                return;
            } else {
                // Due asset - mostra una visualizzazione semplificata
                const correlation = data.correlationValues[1].v; // Il valore di correlazione tra i due asset
                
                correlationChart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: [`Correlazione tra ${data.labels[0]} e ${data.labels[1]}`],
                        datasets: [{
                            label: 'Coefficiente di Correlazione',
                            data: [correlation],
                            backgroundColor: correlation > 0 ? 
                                `rgba(58, 134, 255, ${Math.abs(correlation)})` : 
                                `rgba(239, 68, 68, ${Math.abs(correlation)})`,
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        indexAxis: 'y',
                        scales: {
                            x: {
                                min: -1,
                                max: 1,
                                grid: {
                                    display: true
                                },
                                ticks: {
                                    callback: function(value) {
                                        return value.toFixed(1);
                                    }
                                }
                            }
                        },
                        plugins: {
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        const value = context.raw;
                                        let correlation = "Nessuna correlazione";
                                        
                                        if (value > 0.7) correlation = "Forte correlazione positiva";
                                        else if (value > 0.3) correlation = "Correlazione positiva moderata";
                                        else if (value > 0) correlation = "Debole correlazione positiva";
                                        else if (value > -0.3) correlation = "Debole correlazione negativa";
                                        else if (value > -0.7) correlation = "Correlazione negativa moderata";
                                        else correlation = "Forte correlazione negativa";
                                        
                                        return [`Valore: ${value.toFixed(2)}`, correlation];
                                    }
                                }
                            }
                        }
                    }
                });
                return;
            }
        }
        
        // Per 3+ asset, usa la visualizzazione della matrice originale
        correlationChart = new Chart(ctx, {
            type: 'matrix',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Correlazione',
                    data: data.correlationValues,
                    width: ({chart}) => (chart.chartArea || {}).width / data.labels.length - 1,
                    height: ({chart}) => (chart.chartArea || {}).height / data.labels.length - 1,
                    backgroundColor: function(context) {
                        const value = context.dataset.data[context.dataIndex].v;
                        if (value === 1) {
                            return 'rgba(16, 185, 129, 1)'; // Verde per la diagonale (autocorrelazione = 1)
                        } else if (value < 0) {
                            return `rgba(239, 68, 68, ${Math.abs(value)})`;
                        } else {
                            return `rgba(58, 134, 255, ${value})`;
                        }
                    }
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                        callbacks: {
                            title: function(context) {
                                return '';
                            },
                            label: function(context) {
                                const v = context.dataset.data[context.dataIndex];
                                return [
                                    `${v.x} ↔ ${v.y}`,
                                    `Correlazione: ${v.v.toFixed(2)}`
                                ];
                            }
                        }
                    },
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        type: 'category',
                        labels: data.labels,
                        offset: true,
                        ticks: {
                            display: true
                        },
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        type: 'category',
                        labels: data.labels,
                        offset: true,
                        ticks: {
                            display: true
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }
    
    /**
     * Utility per generare colori per i grafici
     */
    function generateColors(count) {
        const baseColors = [
            '#3a86ff', // Blu
            '#ff6b6b', // Rosso chiaro
            '#10b981', // Verde
            '#8b5cf6', // Viola
            '#f59e0b', // Arancione
            '#64748b', // Grigio-blu
            '#ec4899', // Rosa
            '#06b6d4', // Turchese
        ];
        
        if (count <= baseColors.length) {
            return baseColors.slice(0, count);
        }
        
        // Se servono più colori di quelli disponibili, genera colori casuali
        const colors = [...baseColors];
        for (let i = baseColors.length; i < count; i++) {
            // Genera colori casuali ma evita colori troppo chiari o scuri
            const h = Math.floor(Math.random() * 360);
            const s = Math.floor(50 + Math.random() * 30);
            const l = Math.floor(45 + Math.random() * 20);
            colors.push(`hsl(${h}, ${s}%, ${l}%)`);
        }
        
        return colors;
    }
    
    /**
     * Precaricare i dati per i periodi più comuni
     */
    function precacheData() {
        const periodsToCache = ['1m', '3m', 'ytd'];
        
        // Carica in background i dati per i periodi più usati
        periodsToCache.forEach(period => {
            if (period !== currentPeriod) { // Non caricare quello già caricato
                fetch(`/api/portfolios/${portfolioId}/analysis-data?period=${period}`)
                    .then(response => response.json())
                    .then(data => {
                        cachedData[period] = data;
                        console.log(`Dati precached per il periodo ${period}`);
                    })
                    .catch(error => {
                        console.error(`Errore nel precache per ${period}:`, error);
                    });
            }
        });
    }
    
    // Avvia il precaching dopo il caricamento iniziale
    setTimeout(precacheData, 3000);
});