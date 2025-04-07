// Funzionalità per i modali e le interazioni utente
document.addEventListener('DOMContentLoaded', function() {
    // Variabili per i modali
    const addAssetModal = document.getElementById('addAssetModal');
    const addTransactionModal = document.getElementById('addTransactionModal');
    const addAssetBtn = document.getElementById('addAssetBtn');
    const addTransactionBtns = document.querySelectorAll('.add-transaction-btn');
    const closeBtns = document.querySelectorAll('.close');
    
    // Apri il modale per aggiungere uno strumento
    if (addAssetBtn) {
        addAssetBtn.addEventListener('click', function() {
            addAssetModal.classList.add('active');
        });
    }
    
    // Apri il modale per aggiungere una transazione
    addTransactionBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const symbol = this.dataset.symbol;
            const transactionForm = document.getElementById('transactionForm');
            
            // Imposta l'azione del form per includere il simbolo dello strumento
            transactionForm.action = `/portfolios/${window.location.pathname.split('/')[2]}/assets/${symbol}/add_transaction`;
            
            // Imposta la data di oggi come valore predefinito
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('transactionDate').value = today;
            
            addTransactionModal.classList.add('active');
        });
    });
    
    // Chiudi i modali quando si clicca sul pulsante di chiusura
    closeBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            addAssetModal.classList.remove('active');
            addTransactionModal.classList.remove('active');
        });
    });
    
    // Chiudi i modali quando si clicca all'esterno del modale
    window.addEventListener('click', function(event) {
        if (event.target === addAssetModal) {
            addAssetModal.classList.remove('active');
        }
        if (event.target === addTransactionModal) {
            addTransactionModal.classList.remove('active');
        }
    });

    // Per il pulsante di eliminazione del portafoglio
    const deletePortfolioBtns = document.querySelectorAll('.delete-portfolio-btn');
    if (deletePortfolioBtns.length > 0) {
        deletePortfolioBtns.forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const portfolioId = this.dataset.portfolioId;
                
                if (confirm('Sei sicuro di voler eliminare questo portafoglio? Questa azione non può essere annullata.')) {
                    fetch(`/portfolios/${portfolioId}/delete`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            window.location.reload();
                        } else {
                            alert(data.error || 'Errore durante l\'eliminazione del portafoglio');
                        }
                    })
                    .catch(error => {
                        console.error('Errore:', error);
                        alert('Errore durante l\'eliminazione');
                    });
                }
            });
        });
    }

    // Per il pulsante di eliminazione dello strumento
    const deleteAssetBtns = document.querySelectorAll('.delete-asset-btn');
    if (deleteAssetBtns.length > 0) {
        deleteAssetBtns.forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const symbol = this.dataset.symbol;
                const portfolioId = window.location.pathname.split('/')[2];
                
                if (confirm('Sei sicuro di voler eliminare questo strumento dal portafoglio? Questa azione non può essere annullata.')) {
                    fetch(`/portfolios/${portfolioId}/assets/${symbol}/delete`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            window.location.reload();
                        } else {
                            alert(data.error || 'Errore durante l\'eliminazione dello strumento');
                        }
                    })
                    .catch(error => {
                        console.error('Errore:', error);
                        alert('Errore durante l\'eliminazione');
                    });
                }
            });
        });
    }
        
    // Per il pulsante di eliminazione della transazione
    const deleteTransactionBtns = document.querySelectorAll('.delete-transaction-btn');
    if (deleteTransactionBtns.length > 0) {
        deleteTransactionBtns.forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const symbol = this.dataset.symbol;
                const date = this.dataset.date;
                const type = this.dataset.type;
                const quantity = this.dataset.quantity;
                const price = this.dataset.price;
                const portfolioId = window.location.pathname.split('/')[2];
                
                if (confirm('Sei sicuro di voler eliminare questa transazione? Questa azione non può essere annullata.')) {
                    fetch(`/portfolios/${portfolioId}/assets/${symbol}/transactions/delete`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            date: date,
                            type: type,
                            quantity: quantity,
                            price: price
                        })
                    })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            window.location.reload();
                        } else {
                            alert(data.error || 'Errore durante l\'eliminazione della transazione');
                        }
                    })
                    .catch(error => {
                        console.error('Errore:', error);
                        alert('Errore durante l\'eliminazione');
                    });
                }
            });
        });
    }

    // Ricerca di strumenti finanziari
    const assetSearch = document.getElementById('assetSearch');
    const searchResults = document.getElementById('searchResults');
    
    if (assetSearch) {
        assetSearch.addEventListener('input', debounce(function() {
            const query = this.value.trim();
            
            if (query.length < 2) {
                searchResults.innerHTML = '';
                return;
            }
            
            // Richiesta API per cercare gli strumenti
            fetch(`/search_assets?q=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(data => {
                searchResults.innerHTML = '';
                if (data.results && data.results.length > 0) {
                    data.results.forEach(result => {
                        const item = document.createElement('div');
                        item.className = 'search-result-item';
                        item.innerHTML = `
                            <h4>${result.name}</h4>
                            <p>${result.symbol} <span class="asset-type">${result.type || ''}</span></p>
                            <p class="price">${result.currency || 'USD'} ${(result.price || 0).toFixed(2)}</p>
                        `;
                        
                        // Aggiungi lo strumento al portafoglio quando viene cliccato
                        item.addEventListener('click', function() {
                            addAssetToPortfolio(
                                result.symbol, 
                                result.name, 
                                result.price, 
                                result.currency, 
                                result.type
                            );
                        });
                        
                        searchResults.appendChild(item);
                    });
                } else {
                    searchResults.innerHTML = '<div class="search-result-item">Nessun risultato trovato</div>';
                }
            })
            .catch(error => {
                console.error('Errore nella ricerca:', error);
                searchResults.innerHTML = '<div class="search-result-item">Errore nella ricerca</div>';
            });
        }, 300));
    }
    
    // Toggle per il tipo di transazione
    const toggleOptions = document.querySelectorAll('.toggle-option');
    const transactionTypeSelect = document.getElementById('transactionType');
    
    toggleOptions.forEach(option => {
        option.addEventListener('click', function() {
            // Rimuovi la classe attiva da tutte le opzioni
            toggleOptions.forEach(opt => opt.classList.remove('active'));
            
            // Aggiungi la classe attiva all'opzione cliccata
            this.classList.add('active');
            
            // Aggiorna il valore della select
            const type = this.dataset.type;
            transactionTypeSelect.value = type;
        });
    });
    
    // Calcolo dei valori del portafoglio
    updatePortfolioSummary();
    
    // Funzione helper per ritardare l'esecuzione di una funzione
    function debounce(func, wait) {
        let timeout;
        return function() {
            const context = this, args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                func.apply(context, args);
            }, wait);
        };
    }
    
    // Aggiungi lo strumento al portafoglio
    function addAssetToPortfolio(symbol, name, price, currency, type) {
        const portfolioId = window.location.pathname.split('/')[2];
        
        fetch(`/portfolios/${portfolioId}/add_asset`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                symbol: symbol,
                name: name,
                price: price,
                currency: currency,
                type: type
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Ricarica la pagina per mostrare il nuovo strumento
                window.location.reload();
            } else {
                alert(data.error || 'Errore nell\'aggiunta dello strumento');
            }
        })
        .catch(error => {
            console.error('Errore:', error);
            alert('Errore nella richiesta');
        });
    }
});

// Funzione helper per aggiornare un singolo elemento di performance
function updatePerformanceItem(parentElement, selector, value, allowNull = false) {
    const element = parentElement.querySelector(selector);
    if (!element) return;
    
    if (value === null && allowNull) {
        element.textContent = 'N/A';
        element.className = 'value ' + selector.substring(1);
        return;
    }
    
    element.textContent = `${parseFloat(value).toFixed(2)}%`;
    element.className = `value ${selector.substring(1)} ${parseFloat(value) >= 0 ? 'positive' : 'negative'}`;
}

// Funzione per aggiornare i dati di performance di un asset
function updateAssetPerformance(element, data) {
    if (!element) return;
    
    // Aggiorna la quantità
    const netQuantity = element.querySelector('.net-quantity');
    if (netQuantity) netQuantity.textContent = parseFloat(data.net_quantity).toFixed(2);
    
    // Aggiorna il costo medio
    const avgCost = element.querySelector('.avg-cost');
    if (avgCost) avgCost.textContent = `€ ${parseFloat(data.avg_cost).toFixed(2)}`;
    
    // Aggiorna il valore attuale
    const currentValue = element.querySelector('.current-value');
    if (currentValue) currentValue.textContent = `€ ${parseFloat(data.current_value).toFixed(2)}`;
    
    // Aggiorna il profitto/perdita
    const plValue = element.querySelector('.pl-value');
    if (plValue) {
        plValue.textContent = `€ ${parseFloat(data.pl_value).toFixed(2)} (${parseFloat(data.pl_percent).toFixed(2)}%)`;
        plValue.className = `value pl-value ${data.pl_value >= 0 ? 'positive' : 'negative'}`;
    }
    
    // Aggiorna le variazioni
    updatePerformanceItem(element, '.daily-change', data.daily_change);
    updatePerformanceItem(element, '.weekly-change', data.weekly_change);
    updatePerformanceItem(element, '.monthly-change', data.monthly_change);
    updatePerformanceItem(element, '.ytd-change', data.ytd_change);
    updatePerformanceItem(element, '.three-year-change', data.three_year_change, true);
    updatePerformanceItem(element, '.five-year-change', data.five_year_change, true);
    updatePerformanceItem(element, '.ten-year-change', data.ten_year_change, true);
    updatePerformanceItem(element, '.since-inception-change', data.since_inception_change);
}

// Funzione per aggiornare il sommario del portafoglio e tutti i dati di performance
function updatePortfolioSummary() {
    console.log("Esecuzione updatePortfolioSummary iniziata");
    const portfolioId = window.location.pathname.split('/')[2];
    
    // Elementi del sommario del portafoglio
    const totalValue = document.getElementById('totalValue');
    const dailyChange = document.getElementById('dailyChange');
    const dailyChangePercent = document.getElementById('dailyChangePercent');
    const totalPerformance = document.getElementById('totalPerformance');
    const totalPerformancePercent = document.getElementById('totalPerformancePercent');
    
    if (!totalValue) {
        console.log("Elemento totalValue non trovato, uscita dalla funzione");
        return;
    }
    
    // Variabili per il calcolo del totale
    let currentTotalValue = 0;
    let yesterdayTotalValue = 0;
    let initialInvestment = 0;
    
    // Richiesta API per aggiornare i prezzi
    console.log(`Richiesta API per portfolio ${portfolioId}`);
    fetch(`/portfolios/${portfolioId}/update_prices`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        console.log("Risposta API ricevuta:", data);
        
        if (!data.success) {
            console.error("API ha restituito un errore:", data.error || "Errore sconosciuto");
            return;
        }
        
        if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
            console.warn("Nessun dato ricevuto dall'API");
            return;
        }
        
        console.log("Dati degli asset:", data.data);
        
        // Aggiorna i dati per ogni asset
        const assetCards = document.querySelectorAll('.asset-card');
        assetCards.forEach(card => {
            const deleteBtn = card.querySelector('.delete-asset-btn');
            if (!deleteBtn) return;
            
            const symbol = deleteBtn.dataset.symbol;
            const asset = data.data.find(a => a.symbol === symbol);
            
            if (!asset) {
                console.warn(`Dati non trovati per ${symbol}`);
                return;
            }
            
            // Aggiorna il prezzo corrente
            const priceElement = card.querySelector('.price-value');
            if (priceElement) priceElement.textContent = parseFloat(asset.current_price).toFixed(2);
            
            // Aggiorna le informazioni di performance
            const safeSymbol = symbol.replace(/\./g, '_');
            const performanceElement = card.querySelector(`#performance-${safeSymbol}`);
            
            if (performanceElement) {
                console.log(`Elemento performance trovato per ${symbol}`);
                updateAssetPerformance(performanceElement, asset);
            } else {
                console.warn(`Elemento performance NON trovato per ${symbol} (cercato #performance-${safeSymbol})`);
            }
            
            // Calcola il valore totale per il sommario
            currentTotalValue += parseFloat(asset.current_value);
            yesterdayTotalValue += parseFloat(asset.current_value) / (1 + parseFloat(asset.daily_change) / 100);
            initialInvestment += parseFloat(asset.avg_cost) * parseFloat(asset.net_quantity);
        });
        
        // Aggiorna il sommario del portafoglio
        totalValue.textContent = currentTotalValue.toFixed(2);
        
        // Calcola la variazione giornaliera
        const dailyChangeValue = currentTotalValue - yesterdayTotalValue;
        if (dailyChange) dailyChange.textContent = dailyChangeValue.toFixed(2);
        
        if (dailyChangePercent) {
            const dailyChangePercentValue = yesterdayTotalValue > 0 ? 
                (dailyChangeValue / yesterdayTotalValue) * 100 : 0;
            dailyChangePercent.textContent = dailyChangePercentValue.toFixed(2) + '%';
            dailyChangePercent.className = 'change ' + (dailyChangePercentValue >= 0 ? 'positive' : 'negative');
        }
        
        // Calcola la performance totale
        const totalPerfValue = currentTotalValue - initialInvestment;
        if (totalPerformance) totalPerformance.textContent = totalPerfValue.toFixed(2);
        
        if (totalPerformancePercent) {
            const totalPerfPercentValue = initialInvestment > 0 ? 
                (totalPerfValue / initialInvestment) * 100 : 0;
            totalPerformancePercent.textContent = totalPerfPercentValue.toFixed(2) + '%';
            totalPerformancePercent.className = 'change ' + (totalPerfPercentValue >= 0 ? 'positive' : 'negative');
        }
        
        // Aggiorna la performance per diversi periodi
        updatePerformancePeriods(portfolioId);
    })
    .catch(error => {
        console.error('Errore nell\'aggiornamento dei valori del portafoglio:', error);
    });
}

// Funzione per aggiornare le performance su diversi periodi
function updatePerformancePeriods(portfolioId) {
    const periods = ['1m', '3m', '6m', 'ytd', '1y'];
    const cardIds = [
        'month-performance', 
        'three-month-performance', 
        'six-month-performance', 
        'ytd-performance', 
        'one-year-performance'
    ];
    
    periods.forEach((period, index) => {
        fetch(`/portfolios/${portfolioId}/performance?period=${period}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            const card = document.getElementById(cardIds[index]);
            if (!card) return;
            
            const valueElement = card.querySelector('.value');
            if (!valueElement) return;
            
            const percentReturn = parseFloat(data.percent_return).toFixed(2);
            valueElement.textContent = `${percentReturn}%`;
            valueElement.className = 'value ' + (data.percent_return >= 0 ? 'positive' : 'negative');
        })
        .catch(error => {
            console.error(`Errore nel recupero dei dati di performance per ${period}:`, error);
        });
    });

    
// Da aggiungere a script.js

document.addEventListener('DOMContentLoaded', function() {
    // Ottieni riferimenti agli elementi della pagina
    const csvUploadModal = document.getElementById('csvUploadModal');
    const csvUploadBtn = document.getElementById('csvUploadBtn');
    
    // Aggiungi event listener per aprire il modale di upload CSV
    if (csvUploadBtn) {
        csvUploadBtn.addEventListener('click', function() {
            csvUploadModal.classList.add('active');
        });
    }
    
    // Aggiorna il gestore di chiusura per includere il nuovo modale
    const closeBtns = document.querySelectorAll('.close');
    closeBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            if (this.closest('.modal')) {
                this.closest('.modal').classList.remove('active');
            }
        });
    });
    
    // Chiudi i modali quando si clicca all'esterno
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.classList.remove('active');
        }
    });
    
    // Gestisci l'invio del form CSV
    const csvUploadForm = document.getElementById('csvUploadForm');
    if (csvUploadForm) {
        csvUploadForm.addEventListener('submit', function(e) {
            // Ottieni l'asset selezionato
            // In una pagina di asset specifico, useremo il simbolo dalla URL
            // In una pagina portfolio, chiederemo all'utente di selezionare un asset
            const assetSelector = document.getElementById('assetSelector');
            let symbol;
            
            if (assetSelector) {
                // Siamo nella pagina del portfolio generale
                symbol = assetSelector.value;
                if (!symbol) {
                    e.preventDefault();
                    alert('Seleziona uno strumento prima di caricare il CSV');
                    return;
                }
            } else {
                // Siamo nella pagina di un asset specifico
                // Ottieni il simbolo dall'URL o da altro elemento della pagina
                const addTransactionBtn = document.querySelector('.add-transaction-btn');
                if (addTransactionBtn) {
                    symbol = addTransactionBtn.dataset.symbol;
                }
                
                if (!symbol) {
                    e.preventDefault();
                    alert('Impossibile determinare lo strumento per l\'importazione');
                    return;
                }
            }
            
            // Imposta l'URL di destinazione
            const portfolioId = window.location.pathname.split('/')[2];
            csvUploadForm.action = `/portfolios/${portfolioId}/assets/${symbol}/import_csv`;
            
            // Continua con il submit
            // Il form ha già enctype="multipart/form-data" quindi i file verranno inviati correttamente
        });
    }
    
    // Se siamo nella pagina principale del portfolio, aggiungiamo un selettore di asset
    if (csvUploadForm && !document.querySelector('.add-transaction-btn')) {
        // Crea un selettore di asset
        const inputGroup = document.createElement('div');
        inputGroup.className = 'input-group';
        inputGroup.innerHTML = `
            <label for="assetSelector">Seleziona Strumento</label>
            <select id="assetSelector" name="asset" required>
                <option value="">-- Seleziona uno strumento --</option>
                ${Array.from(document.querySelectorAll('.asset-card h3')).map(el => {
                    const symbol = el.closest('.asset-card').querySelector('.delete-asset-btn').dataset.symbol;
                    return `<option value="${symbol}">${el.textContent}</option>`;
                }).join('')}
            </select>
        `;
        
        // Inserisci il selettore all'inizio del form
        csvUploadForm.insertBefore(inputGroup, csvUploadForm.firstChild);
    }
});


}