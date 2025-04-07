document.addEventListener('DOMContentLoaded', function() {
    // Elementi DOM
    const scenarioButtons = document.querySelectorAll('.scenario-btn');
    const customInputs = document.getElementById('customScenarioInputs');
    const runButton = document.getElementById('runStressTest');
    const resultsContainer = document.getElementById('stressTestResults');
    
    // Scenario selezionato (default)
    let selectedScenario = 'crisis_2008';
    
    // Event listeners per i bottoni degli scenari
    scenarioButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            // Rimuovi la classe attiva da tutti i bottoni
            scenarioButtons.forEach(b => b.classList.remove('active'));
            
            // Aggiungi la classe attiva a questo bottone
            this.classList.add('active');
            
            // Aggiorna lo scenario selezionato
            selectedScenario = this.dataset.scenario;
            
            // Mostra/nascondi gli input custom
            if (selectedScenario === 'custom') {
                customInputs.style.display = 'block';
            } else {
                customInputs.style.display = 'none';
            }
        });
    });
    
    // Event listener per il bottone "Esegui Simulazione"
    runButton.addEventListener('click', runStressTest);
    
    // Funzione per eseguire lo stress test
    function runStressTest() {
        // Mostra un messaggio di caricamento
        resultsContainer.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Elaborazione in corso...</div>';
        resultsContainer.style.display = 'block';
        
        // Prepara i dati da inviare
        let data = {
            scenario: selectedScenario
        };
        
        // Se lo scenario è personalizzato, aggiungi gli impatti
        if (selectedScenario === 'custom') {
            data.impacts = {
                'Equity': parseFloat(document.getElementById('equity-impact').value) / 100,
                'Bond': parseFloat(document.getElementById('bond-impact').value) / 100,
                'Commodity': parseFloat(document.getElementById('commodity-impact').value) / 100,
                'RealEstate': parseFloat(document.getElementById('realestate-impact').value) / 100,
                'Cash': parseFloat(document.getElementById('cash-impact').value) / 100,
                'Crypto': parseFloat(document.getElementById('crypto-impact').value) / 100,
                'Default': -0.15 // Default per asset non categorizzati
            };
        }
        
        // Ottieni l'ID del portafoglio dalla URL
        const portfolioId = window.location.pathname.split('/')[2];
        
        // Chiama l'API
        fetch(`/api/portfolios/${portfolioId}/stress-test`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(results => {
            displayResults(results);
        })
        .catch(error => {
            console.error('Errore nell\'esecuzione dello stress test:', error);
            resultsContainer.innerHTML = '<div class="error-message">Errore nell\'esecuzione dello stress test. Riprova più tardi.</div>';
        });
    }
    
    // Funzione per visualizzare i risultati
    function displayResults(results) {
        // Formatta i numeri
        const formatCurrency = (value) => new Intl.NumberFormat('it-IT', {
            style: 'currency',
            currency: 'EUR',
            maximumFractionDigits: 0
        }).format(value);
        
        const formatPercent = (value) => `${value.toFixed(2)}%`;
        
        // Crea l'HTML per i risultati
        let html = `
            <div class="results-header">
                <h3>${results.scenario}</h3>
                <p>${results.description}</p>
            </div>
            
            <div class="results-summary">
                <div class="summary-item">
                    <div class="summary-label">Valore Attuale:</div>
                    <div class="summary-value">${formatCurrency(results.current_value)}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Valore Stressato:</div>
                    <div class="summary-value">${formatCurrency(results.stressed_value)}</div>
                </div>
                <div class="summary-item ${results.percentage_impact < 0 ? 'negative' : 'positive'}">
                    <div class="summary-label">Impatto:</div>
                    <div class="summary-value">${formatCurrency(results.absolute_impact)} (${formatPercent(results.percentage_impact)})</div>
                </div>
            </div>
            
            <h4>Impatto per Asset</h4>
            <div class="asset-impact-table">
                <table>
                    <thead>
                        <tr>
                            <th>Asset</th>
                            <th>Tipo</th>
                            <th>Variazione</th>
                            <th>Valore Originale</th>
                            <th>Valore Stressato</th>
                            <th>Impatto</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Aggiungi ogni asset alla tabella
        for (const [assetName, impact] of Object.entries(results.impact_by_asset)) {
            html += `
                <tr>
                    <td>${assetName}</td>
                    <td>${impact.type}</td>
                    <td class="${impact.impact_pct < 0 ? 'negative' : 'positive'}">${formatPercent(impact.impact_pct)}</td>
                    <td>${formatCurrency(impact.original_value)}</td>
                    <td>${formatCurrency(impact.stressed_value)}</td>
                    <td class="${impact.absolute_impact < 0 ? 'negative' : 'positive'}">${formatCurrency(impact.absolute_impact)}</td>
                </tr>
            `;
        }
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        // Aggiungi stili CSS inline
        const style = document.createElement('style');
        style.textContent = `
            .results-header {
                margin-bottom: 20px;
            }
            .results-summary {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 20px;
                margin-bottom: 30px;
                background-color: #f8fafc;
                padding: 15px;
                border-radius: 8px;
            }
            .summary-item {
                display: flex;
                flex-direction: column;
            }
            .summary-label {
                font-size: 14px;
                color: #64748b;
                margin-bottom: 5px;
            }
            .summary-value {
                font-size: 20px;
                font-weight: bold;
                color: #334155;
            }
            .asset-impact-table {
                width: 100%;
                overflow-x: auto;
            }
            .asset-impact-table table {
                width: 100%;
                border-collapse: collapse;
            }
            .asset-impact-table th {
                background-color: #f1f5f9;
                padding: 10px;
                text-align: left;
                font-weight: 600;
                color: #334155;
            }
            .asset-impact-table td {
                padding: 10px;
                border-bottom: 1px solid #e2e8f0;
            }
            .negative {
                color: #ef4444;
            }
            .positive {
                color: #10b981;
            }
            .loading {
                text-align: center;
                padding: 20px;
                font-size: 16px;
                color: #64748b;
            }
            .error-message {
                text-align: center;
                padding: 20px;
                color: #ef4444;
            }
        `;
        document.head.appendChild(style);
        
        // Aggiorna il contenitore dei risultati
        resultsContainer.innerHTML = html;
    }
});