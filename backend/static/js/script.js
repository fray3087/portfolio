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


// Funzione per aggiornare il sommario del portafoglio
function updatePortfolioSummary() {
    console.log("Esecuzione updatePortfolioSummary iniziata");
    const portfolioId = window.location.pathname.split('/')[2];
    const totalValue = document.getElementById('totalValue');
    const dailyChange = document.getElementById('dailyChange');
    const dailyChangePercent = document.getElementById('dailyChangePercent');
    const totalPerformance = document.getElementById('totalPerformance');
    const totalPerformancePercent = document.getElementById('totalPerformancePercent');
    
    if (!totalValue) {
        console.log("Elemento totalValue non trovato, uscita dalla funzione");
        return;
    }
    
    // Primo step: calcolare il valore attuale del portafoglio
    let currentTotalValue = 0;
    let yesterdayTotalValue = 0;
    let initialInvestment = 0;
    
    // Poi aggiorniamo i prezzi degli strumenti chiamando l'API
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
        if (data.success) {
            console.log("Dati degli asset:", data.data);
            
            
            // Ora calcoliamo i valori con i dati aggiornati
            const assetCards = document.querySelectorAll('.asset-card');
            assetCards.forEach(card => {
                const symbol = card.querySelector('.delete-asset-btn').dataset.symbol;
                const currentPriceElement = card.querySelector('.current-price .price-value');
                
                // Trova i dati aggiornati per questo strumento
                const assetData = data.data.find(item => item.symbol === symbol);
                if (assetData) {
                    // Aggiorna il prezzo visualizzato
                    if (currentPriceElement) {
                        currentPriceElement.textContent = assetData.current_price.toFixed(2);
                    } else {
                        // Fallback per il formato vecchio
                        const oldPriceElement = card.querySelector('.current-price');
                        if (oldPriceElement) {
                            const priceText = oldPriceElement.textContent;
                            const currency = priceText.split(' ')[1];
                            oldPriceElement.textContent = `Prezzo attuale: ${currency} ${assetData.current_price.toFixed(2)}`;
                        }
                    }
                    
                    // Aggiorna i dettagli di performance dell'asset
// Modifica la funzione che aggiorna i valori di performance
// Sanitizza il simbolo per l'uso come selettore
const safeSymbol = symbol.replace(/\./g, '_');
const performanceElement = card.querySelector(`#performance-${safeSymbol}`);
if (performanceElement) {
    console.log(`Elemento performance trovato per ${symbol}:`, performanceElement);
    
    // Quantità
    const netQuantityElement = performanceElement.querySelector('.net-quantity');
    if (netQuantityElement) {
        console.log(`Elemento net-quantity trovato per ${symbol}:`, netQuantityElement);
        netQuantityElement.textContent = assetData.net_quantity.toFixed(2);
    } else {
        console.log(`Elemento net-quantity NON trovato per ${symbol}`);
    }
    
    // Costo medio
    const avgCostElement = performanceElement.querySelector('.avg-cost');
    if (avgCostElement) {
        console.log(`Elemento avg-cost trovato per ${symbol}:`, avgCostElement);
        avgCostElement.textContent = `€ ${assetData.avg_cost.toFixed(2)}`;
    } else {
        console.log(`Elemento avg-cost NON trovato per ${symbol}`);
    }
    
    // Valore attuale
    const currentValueElement = performanceElement.querySelector('.current-value');
    if (currentValueElement) {
        console.log(`Elemento current-value trovato per ${symbol}:`, currentValueElement);
        currentValueElement.textContent = `€ ${assetData.current_value.toFixed(2)}`;
    } else {
        console.log(`Elemento current-value NON trovato per ${symbol}`);
    }
    
    // P/L
    const plValueElement = performanceElement.querySelector('.pl-value');
    if (plValueElement) {
        console.log(`Elemento pl-value trovato per ${symbol}:`, plValueElement);
        plValueElement.textContent = `€ ${assetData.pl_value.toFixed(2)} (${assetData.pl_percent.toFixed(2)}%)`;
        plValueElement.className = `value pl-value ${assetData.pl_value >= 0 ? 'positive' : 'negative'}`;
    } else {
        console.log(`Elemento pl-value NON trovato per ${symbol}`);
    }
    
    // Variazione giornaliera
    const dailyChangeElement = performanceElement.querySelector('.daily-change');
    if (dailyChangeElement) {
        console.log(`Elemento daily-change trovato per ${symbol}:`, dailyChangeElement);
        dailyChangeElement.textContent = `${assetData.daily_change.toFixed(2)}%`;
        dailyChangeElement.className = `value daily-change ${assetData.daily_change >= 0 ? 'positive' : 'negative'}`;
    } else {
        console.log(`Elemento daily-change NON trovato per ${symbol}`);
    }
    
    // Variazione settimanale
    const weeklyChangeElement = performanceElement.querySelector('.weekly-change');
    if (weeklyChangeElement) {
        console.log(`Elemento weekly-change trovato per ${symbol}:`, weeklyChangeElement);
        weeklyChangeElement.textContent = `${assetData.weekly_change.toFixed(2)}%`;
        weeklyChangeElement.className = `value weekly-change ${assetData.weekly_change >= 0 ? 'positive' : 'negative'}`;
    } else {
        console.log(`Elemento weekly-change NON trovato per ${symbol}`);
    }
    
    // Variazione mensile
    const monthlyChangeElement = performanceElement.querySelector('.monthly-change');
    if (monthlyChangeElement) {
        console.log(`Elemento monthly-change trovato per ${symbol}:`, monthlyChangeElement);
        monthlyChangeElement.textContent = `${assetData.monthly_change.toFixed(2)}%`;
        monthlyChangeElement.className = `value monthly-change ${assetData.monthly_change >= 0 ? 'positive' : 'negative'}`;
    } else {
        console.log(`Elemento monthly-change NON trovato per ${symbol}`);
    }
    
    // Variazione YTD
    const ytdChangeElement = performanceElement.querySelector('.ytd-change');
    if (ytdChangeElement) {
        console.log(`Elemento ytd-change trovato per ${symbol}:`, ytdChangeElement);
        ytdChangeElement.textContent = `${assetData.ytd_change.toFixed(2)}%`;
        ytdChangeElement.className = `value ytd-change ${assetData.ytd_change >= 0 ? 'positive' : 'negative'}`;
    } else {
        console.log(`Elemento ytd-change NON trovato per ${symbol}`);
    }
} else {
    console.log(`Elemento performance NON trovato per ${symbol} (cercato #performance-${safeSymbol})`);
}
                    
                    // Calcola il valore delle posizioni per il portafoglio totale
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
            if (typeof updatePerformancePeriods === 'function') {
                updatePerformancePeriods(portfolioId);
            }
        }
    })
    .catch(error => {
        console.error('Errore nell\'aggiornamento dei valori del portafoglio:', error);
    });
}

// Funzione helper per aggiornare un valore di performance
function updatePerformanceValue(parentElement, selector, value) {
    const element = parentElement.querySelector(selector);
    if (element) {
        element.textContent = `${value.toFixed(2)}%`;
        element.className = `value ${selector.substring(1)} ${value >= 0 ? 'positive' : 'negative'}`;
    }
}

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