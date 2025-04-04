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
            console.log('Pulsante elimina portafoglio cliccato');
            const portfolioId = this.dataset.portfolioId;
            console.log('Portfolio ID:' , portfolioId);

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
                        // Rimuovi la card del portafoglio dalla pagina o ricarica la pagina
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
                        // Rimuovi la card dello strumento dalla pagina o ricarica la pagina
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
    
    // Funzione per aggiornare il sommario del portafoglio
    // Funzione per aggiornare il sommario del portafoglio
function updatePortfolioSummary() {
    const portfolioId = window.location.pathname.split('/')[2];
    const totalValue = document.getElementById('totalValue');
    const dailyChange = document.getElementById('dailyChange');
    const dailyChangePercent = document.getElementById('dailyChangePercent');
    const totalPerformance = document.getElementById('totalPerformance');
    const totalPerformancePercent = document.getElementById('totalPerformancePercent');
    
    if (!totalValue) return;
    
    // Primo step: calcolare il valore attuale del portafoglio
    let currentTotalValue = 0;
    let yesterdayTotalValue = 0;
    let initialInvestment = 0;
    
    // Poi aggiorniamo i prezzi degli strumenti chiamando l'API
    fetch(`/portfolios/${portfolioId}/update_prices`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Ora calcoliamo i valori con i dati aggiornati
            const assetCards = document.querySelectorAll('.asset-card');
            assetCards.forEach(card => {
                const symbol = card.querySelector('.delete-asset-btn').dataset.symbol;
                const currentPriceElement = card.querySelector('.current-price');
                
                // Trova i dati aggiornati per questo strumento
                const assetData = data.data.find(item => item.symbol === symbol);
                if (assetData) {
                    // Aggiorna il prezzo visualizzato
                    const priceText = currentPriceElement.textContent;
                    const currency = priceText.split(' ')[1];
                    currentPriceElement.textContent = `Prezzo attuale: ${currency} ${assetData.current_price.toFixed(2)}`;
                    
                    // Calcola il valore delle posizioni
                    const rows = card.querySelectorAll('table tbody tr');
                    let netQuantity = 0;
                    let investmentCost = 0;
                    
                    rows.forEach(row => {
                        const cells = row.querySelectorAll('td');
                        const type = cells[1].textContent.includes('Acquisto') ? 'buy' : 'sell';
                        const quantity = parseFloat(cells[2].textContent);
                        const price = parseFloat(cells[3].textContent.replace('€', '').trim());
                        const total = price * quantity;
                        
                        if (type === 'buy') {
                            netQuantity += quantity;
                            investmentCost += total;
                        } else {
                            netQuantity -= quantity;
                            investmentCost -= total;
                        }
                    });
                    
                    // Calcola il valore attuale e di ieri
                    const currentAssetValue = netQuantity * assetData.current_price;
                    const yesterdayAssetValue = netQuantity * (assetData.current_price / (1 + assetData.daily_change / 100));
                    
                    currentTotalValue += currentAssetValue;
                    yesterdayTotalValue += yesterdayAssetValue;
                    initialInvestment += investmentCost;
                }
            });
            
            // Aggiorna i valori del sommario del portafoglio
            totalValue.textContent = currentTotalValue.toFixed(2);
            
            // Variazione giornaliera
            const dailyChangeValue = currentTotalValue - yesterdayTotalValue;
            dailyChange.textContent = dailyChangeValue.toFixed(2);
            
            const dailyChangePercentValue = yesterdayTotalValue > 0 ? 
                (dailyChangeValue / yesterdayTotalValue) * 100 : 0;
            dailyChangePercent.textContent = dailyChangePercentValue.toFixed(2) + '%';
            dailyChangePercent.className = 'change ' + (dailyChangePercentValue >= 0 ? 'positive' : 'negative');
            
            // Performance totale
            const totalPerformanceValue = currentTotalValue - initialInvestment;
            totalPerformance.textContent = totalPerformanceValue.toFixed(2);
            
            const totalPerformancePercentValue = initialInvestment > 0 ? 
                (totalPerformanceValue / initialInvestment) * 100 : 0;
            totalPerformancePercent.textContent = totalPerformancePercentValue.toFixed(2) + '%';
            totalPerformancePercent.className = 'change ' + (totalPerformancePercentValue >= 0 ? 'positive' : 'negative');
            
            // Aggiorna i rendimenti su diversi periodi
            updatePerformancePeriods(portfolioId);
        }
    })
    .catch(error => {
        console.error('Errore nell\'aggiornamento dei valori del portafoglio:', error);
    });
}
        // Calcolo rendimenti su diversi periodi
    function calculatePerformanceForPeriod(portfolioId, period) {
        return fetch(`/portfolios/${portfolioId}/performance?period=${period}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            return data;
        });
    }

});
// Funzione per calcolare i rendimenti per un periodo specifico
function calculatePerformanceForPeriod(portfolioId, period) {
    return fetch(`/portfolios/${portfolioId}/performance?period=${period}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        return data;
    });
}

// Funzione per aggiornare i rendimenti su diversi periodi
function updatePerformancePeriods(portfolioId) {
    const periods = ['1m', '3m', '6m', 'ytd', '1y'];
    const cardIds = [
        'month-performance', 
        'three-month-performance', 
        'six-month-performance', 
        'ytd-performance', 
        'one-year-performance'
    ];
    
    // Aggiorna ogni periodo
    periods.forEach((period, index) => {
        calculatePerformanceForPeriod(portfolioId, period)
        .then(data => {
            const card = document.getElementById(cardIds[index]);
            if (card) {
                const valueElement = card.querySelector('.value');
                if (valueElement) {
                    const percentReturn = data.percent_return.toFixed(2);
                    valueElement.textContent = `${percentReturn}%`;
                    valueElement.className = 'value ' + (percentReturn >= 0 ? 'positive' : 'negative');
                }
            }
        })
        .catch(error => {
            console.error(`Errore nel calcolo del rendimento per il periodo ${period}:`, error);
        });
    });
}