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

        // Aggiungi il setup del benchmark comparison
        setupBenchmarkComparison();
    }

    /**
     * Aggiunge funzionalità di comparazione con benchmark
     */
    function setupBenchmarkComparison() {
        // Crea un selettore di benchmark nell'HTML
        const headerSection = document.querySelector('.period-selector');
        const benchmarkSelector = document.createElement('div');
        benchmarkSelector.className = 'benchmark-selector';
        benchmarkSelector.innerHTML = `
            <span class="benchmark-label">Confronta con:</span>
            <select id="benchmarkSelect" class="benchmark-select">
                <option value="SPY">S&P 500 (SPY)</option>
                <option value="IWDA.L">MSCI World (IWDA)</option>
                <option value="EUNL.DE">STOXX Europe 600</option>
                <option value="BTP10Y">BTP 10Y</option>
                <option value="GOLD">Oro</option>
                <option value="none" selected>Nessun benchmark</option>
            </select>
        `;
        headerSection.appendChild(benchmarkSelector);

        // Aggiungi stili CSS inline
        const style = document.createElement('style');
        style.textContent = `
            .benchmark-selector {
                display: flex;
                align-items: center;
                margin-left: 20px;
            }
            .benchmark-label {
                margin-right: 10px;
                font-size: 14px;
                color: #64748b;
            }
            .benchmark-select {
                padding: 6px 10px;
                border-radius: 4px;
                border: 1px solid #e2e8f0;
                background-color: white;
                font-size: 14px;
                color: #334155;
            }
            .benchmark-select:focus {
                outline: none;
                border-color: #3a86ff;
                box-shadow: 0 0 0 2px rgba(58, 134, 255, 0.2);
            }
            .benchmark-legend {
                display: flex;
                align-items: center;
                margin-top: 10px;
                justify-content: center;
            }
            .benchmark-legend-item {
                display: flex;
                align-items: center;
                margin-right: 20px;
            }
            .benchmark-legend-color {
                width: 12px;
                height: 12px;
                border-radius: 50%;
                margin-right: 5px;
            }
        `;
        document.head.appendChild(style);

        // Aggiungi una legenda sotto il grafico principale
        const performanceChartContainer = document.getElementById('performanceChart').parentElement;
        const benchmarkLegend = document.createElement('div');
        benchmarkLegend.className = 'benchmark-legend';
        benchmarkLegend.innerHTML = `
            <div class="benchmark-legend-item">
                <div class="benchmark-legend-color" style="background-color: #3a86ff;"></div>
                <span>Portafoglio</span>
            </div>
            <div class="benchmark-legend-item benchmark-item" style="display: none;">
                <div class="benchmark-legend-color" style="background-color: #8b5cf6;"></div>
                <span class="benchmark-name">Benchmark</span>
            </div>
        `;
        performanceChartContainer.appendChild(benchmarkLegend);

        // Gestisci il cambio di benchmark
        document.getElementById('benchmarkSelect').addEventListener('change', function() {
            const benchmark = this.value;
            if (benchmark === 'none') {
                // Nascondi il benchmark dal grafico
                if (performanceChart) {
                    performanceChart.data.datasets[1].data = [];
                    performanceChart.update();
                    document.querySelector('.benchmark-item').style.display = 'none';
                    
                    // Nascondi anche le informazioni comparative
                    const benchmarkInfo = document.querySelector('.benchmark-info');
                    if (benchmarkInfo) {
                        benchmarkInfo.remove();
                    }
                }
            } else {
                // Mostra il benchmark selezionato
                document.querySelector('.benchmark-item').style.display = 'flex';
                document.querySelector('.benchmark-name').textContent = this.options[this.selectedIndex].text;
                loadBenchmarkData(benchmark);
            }
        });
    }

    // Funzione per caricare i dati del benchmark
    function loadBenchmarkData(benchmarkSymbol) {
        // Mostra un indicatore di caricamento
        const performanceChartContainer = document.getElementById('performanceChart').parentElement;
        const loadingSpinner = document.createElement('div');
        loadingSpinner.className = 'loading-spinner benchmark-spinner';
        loadingSpinner.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        performanceChartContainer.appendChild(loadingSpinner);
    
        // Ottieni il portfolio ID e il periodo corrente
        const portfolioId = window.location.pathname.split('/')[2];
        const currentPeriod = document.querySelector('.period-btn.active').dataset.period;
    
        // Chiama l'API per ottenere i dati del benchmark
        fetch(`/api/benchmark/${benchmarkSymbol}?period=${currentPeriod}&portfolio_id=${portfolioId}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Errore API: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                // Rimuovi lo spinner
                document.querySelector('.benchmark-spinner').remove();
    
                // Aggiorna il grafico con i dati del benchmark
                if (performanceChart) {
                    // Qui facciamo l'allineamento delle date
                    const chartDates = performanceChart.data.labels;
                    const benchmarkDates = data.dates;
                    const benchmarkValues = data.values;
                    
                    // Creiamo un mapping data -> valore
                    const benchmarkMap = {};
                    for (let i = 0; i < benchmarkDates.length; i++) {
                        benchmarkMap[benchmarkDates[i]] = benchmarkValues[i];
                    }
                    
                    // Allineiamo i valori del benchmark con le date del grafico
                    const alignedValues = [];
                    for (let date of chartDates) {
                        // Cerca la data esatta o la più vicina
                        if (benchmarkMap[date] !== undefined) {
                            alignedValues.push(benchmarkMap[date]);
                        } else {
                            // Trova la data più vicina
                            let closestDate = null;
                            let minDiff = Infinity;
                            
                            for (let bmDate of benchmarkDates) {
                                const diff = Math.abs(new Date(date) - new Date(bmDate));
                                if (diff < minDiff) {
                                    minDiff = diff;
                                    closestDate = bmDate;
                                }
                            }
                            
                            // Usa il valore della data più vicina o l'ultimo valore se non c'è corrispondenza
                            if (closestDate && benchmarkMap[closestDate] !== undefined) {
                                alignedValues.push(benchmarkMap[closestDate]);
                            } else if (alignedValues.length > 0) {
                                alignedValues.push(alignedValues[alignedValues.length - 1]);
                            } else {
                                alignedValues.push(null);
                            }
                        }
                    }
                    
                    // Aggiorna il grafico con i valori allineati
                    performanceChart.data.datasets[1].data = alignedValues;
                    performanceChart.data.datasets[1].label = data.name;
                    performanceChart.update();
                }
            })
            .catch(error => {
                console.error('Errore nel caricamento dei dati del benchmark:', error);
                if (document.querySelector('.benchmark-spinner')) {
                    document.querySelector('.benchmark-spinner').remove();
                }
                
                // Mostra un messaggio di errore
                const errorMsg = document.createElement('div');
                errorMsg.className = 'benchmark-error';
                errorMsg.textContent = 'Errore nel caricamento del benchmark';
                errorMsg.style.color = '#ef4444';
                errorMsg.style.fontSize = '14px';
                errorMsg.style.marginTop = '5px';
                errorMsg.style.textAlign = 'center';
                performanceChartContainer.appendChild(errorMsg);
                
                // Rimuovi l'errore dopo 3 secondi
                setTimeout(() => {
                    if (document.querySelector('.benchmark-error')) {
                        document.querySelector('.benchmark-error').remove();
                    }
                }, 3000);
            });
    }
    
    // Funzione helper per formattare i numeri
    function formatNumber(value) {
        return new Intl.NumberFormat('it-IT', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
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
                
                // Se c'è un benchmark selezionato, ricarica anche quello
                const benchmarkSelect = document.getElementById('benchmarkSelect');
                if (benchmarkSelect && benchmarkSelect.value !== 'none') {
                    loadBenchmarkData(benchmarkSelect.value);
                }
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
        const canvas = document.getElementById('drawdownChart');
        if (!canvas) {
            console.error('Elemento drawdownChart non trovato nel DOM');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
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
        const canvas = document.getElementById('allocationChart');
        if (!canvas) {
            console.error('Elemento allocationChart non trovato nel DOM');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
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
        const canvas = document.getElementById('riskReturnChart');
        if (!canvas) {
            console.error('Elemento riskReturnChart non trovato nel DOM');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
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
        const canvas = document.getElementById('returnsDistributionChart');
        if (!canvas) {
            console.error('Elemento returnsDistributionChart non trovato nel DOM');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
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
        const canvas = document.getElementById('correlationChart');
        
        // Aggiungi questo controllo
        if (!canvas) {
            console.error('Elemento correlationChart non trovato nel DOM');
            return;
        }

        const ctx = canvas.getContext('2d');

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
                                `rgba(58,134, 255, ${Math.abs(correlation)})` : 
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