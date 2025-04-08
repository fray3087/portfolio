document.addEventListener('DOMContentLoaded', function() {
    // Debug globale
    console.log("Document ready. Checking all important elements:");
    
    // Variabili per i modali
    const addAssetModal = document.getElementById('addAssetModal');
    const addTransactionModal = document.getElementById('addTransactionModal');
    const csvUploadModal = document.getElementById('csvUploadModal');
    
    const addAssetBtn = document.getElementById('addAssetBtn');
    const csvUploadBtn = document.getElementById('csvUploadBtn');
    const addTransactionBtns = document.querySelectorAll('.add-transaction-btn');
    const closeBtns = document.querySelectorAll('.close');

    // Verifica elementi critici
    const elementsToCheck = [
        'addAssetModal', 
        'addTransactionModal', 
        'csvUploadModal', 
        'addAssetBtn', 
        'csvUploadBtn', 
        'csvFile'
    ];

    elementsToCheck.forEach(elementId => {
        const element = document.getElementById(elementId);
        console.log(`${elementId}:`, element ? "FOUND ✅" : "NOT FOUND ❌");
    });

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

    // Gestione modale aggiunta strumento
    if (addAssetBtn) {
        addAssetBtn.addEventListener('click', function() {
            addAssetModal.classList.add('active');
        });
    }

    // Gestione modale aggiunta transazione
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

    // Gestione chiusura modali
    closeBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            addAssetModal.classList.remove('active');
            addTransactionModal.classList.remove('active');
            csvUploadModal.classList.remove('active');
        });
    });

    // Chiudi modali cliccando all'esterno
    window.addEventListener('click', function(event) {
        if (event.target === addAssetModal) {
            addAssetModal.classList.remove('active');
        }
        if (event.target === addTransactionModal) {
            addTransactionModal.classList.remove('active');
        }
        if (event.target === csvUploadModal) {
            csvUploadModal.classList.remove('active');
        }
    });

    // Gestione upload CSV
    const csvUploadForm = document.getElementById('csvUploadForm');
    if (csvUploadBtn) {
        csvUploadBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log("CSV Upload button clicked");
            csvUploadModal.classList.add('active');
        });
    }

    // Submit form CSV
    if (csvUploadForm) {
        csvUploadForm.addEventListener('submit', function(e) {
            e.preventDefault();
            console.log("CSV Form submit triggered");

            const csvFile = document.getElementById('csvFile');
            if (!csvFile || !csvFile.files.length) {
                console.error("No file selected");
                alert("Seleziona un file CSV");
                return;
            }

            const formData = new FormData(this);
            const addTransactionButton = document.querySelector('.add-transaction-btn');
            
            if (!addTransactionButton) {
                console.error("No transaction button found");
                alert("Nessuno strumento trovato per l'importazione");
                return;
            }

            const symbol = addTransactionButton.dataset.symbol;
            const portfolioId = window.location.pathname.split('/')[2];

            console.log("Selected Symbol:", symbol);
            console.log("Portfolio ID:", portfolioId);

            fetch(`/portfolios/${portfolioId}/assets/${symbol}/import_csv`, {
                method: 'POST',
                body: formData
            })
            .then(response => {
                console.log("Response status:", response.status);
                return response.json();
            })
            .then(data => {
                console.log("Server response:", data);
                if (data.success) {
                    alert('Transazioni importate con successo!');
                    window.location.reload();
                } else {
                    alert('Errore nell\'importazione: ' + (data.error || 'Errore sconosciuto'));
                }
            })
            .catch(error => {
                console.error("Fetch error:", error);
                alert('Errore durante l\'importazione');
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
            toggleOptions.forEach(opt => opt.classList.remove('active'));
            
            this.classList.add('active');
            
            const type = this.dataset.type;
            transactionTypeSelect.value = type;
        });
    });
    
    // Eliminazione portafoglio
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

    // Eliminazione strumento
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

    // Eliminazione transazione
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

    // Aggiungi strumento al portafoglio
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

    // Calcolo dei valori del portafoglio
    updatePortfolioSummary();
});

// Funzioni esterne

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

function updateAssetPerformance(element, data) {
    if (!element) return;
    
    const netQuantity = element.querySelector('.net-quantity');
    if (netQuantity) netQuantity.textContent = parseFloat(data.net_quantity).toFixed(2);
    
    const avgCost = element.querySelector('.avg-cost');
    if (avgCost) avgCost.textContent = `€ ${parseFloat(data.avg_cost).toFixed(2)}`;
    
    const currentValue = element.querySelector('.current-value');
    if (currentValue) currentValue.textContent = `€ ${parseFloat(data.current_value).toFixed(2)}`;
    
    const plValue = element.querySelector('.pl-value');
    if (plValue) {
        plValue.textContent = `€ ${parseFloat(data.pl_value).toFixed(2)} (${parseFloat(data.pl_percent).toFixed(2)}%)`;
        plValue.className = `value pl-value ${data.pl_value >= 0 ? 'positive' : 'negative'}`;
    }
    
    updatePerformanceItem(element, '.daily-change', data.daily_change);
    updatePerformanceItem(element, '.weekly-change', data.weekly_change);
    updatePerformanceItem(element, '.monthly-change', data.monthly_change);
    updatePerformanceItem(element, '.ytd-change', data.ytd_change);
    updatePerformanceItem(element, '.three-year-change', data.three_year_change, true);
    updatePerformanceItem(element, '.five-year-change', data.five_year_change, true);
    updatePerformanceItem(element, '.ten-year-change', data.ten_year_change, true);
    updatePerformanceItem(element, '.since-inception-change', data.since_inception_change);
}

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
    
    let currentTotalValue = 0;
    let yesterdayTotalValue = 0;
    let initialInvestment = 0;
    
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
            
            const priceElement = card.querySelector('.price-value');
            if (priceElement) priceElement.textContent = parseFloat(asset.current_price).toFixed(2);
            
            const safeSymbol = symbol.replace(/\./g, '_');
            const performanceElement = card.querySelector(`#performance-${safeSymbol}`);
            
            if (performanceElement) {
                console.log(`Elemento performance trovato per ${symbol}`);
                updateAssetPerformance(performanceElement, asset);
            } else {
                console.warn(`Elemento performance NON trovato per ${symbol} (cercato #performance-${safeSymbol})`);
            }
            
            currentTotalValue += parseFloat(asset.current_value);
            yesterdayTotalValue += parseFloat(asset.current_value) / (1 + parseFloat(asset.daily_change) / 100);
            initialInvestment += parseFloat(asset.avg_cost) * parseFloat(asset.net_quantity);
        });
        
        totalValue.textContent = currentTotalValue.toFixed(2);
        
        const dailyChangeValue = currentTotalValue - yesterdayTotalValue;
        if (dailyChange) dailyChange.textContent = dailyChangeValue.toFixed(2);
        
        if (dailyChangePercent) {
            const dailyChangePercentValue = yesterdayTotalValue > 0 ? 
                (dailyChangeValue / yesterdayTotalValue) * 100 : 0;
            dailyChangePercent.textContent = dailyChangePercentValue.toFixed(2) + '%';
            dailyChangePercent.className = 'change ' + (dailyChangePercentValue >= 0 ? 'positive' : 'negative');
        }
        
        const totalPerfValue = currentTotalValue - initialInvestment;
        if (totalPerformance) totalPerformance.textContent = totalPerfValue.toFixed(2);
        
        if (totalPerformancePercent) {
            const totalPerfPercentValue = initialInvestment > 0 ? 
                (totalPerfValue / initialInvestment) * 100 : 0;
            totalPerformancePercent.textContent = totalPerfPercentValue.toFixed(2) + '%';
            totalPerformancePercent.className = 'change ' + (totalPerfPercentValue >= 0 ? 'positive' : 'negative');
        }
        
        updatePerformancePeriods(portfolioId);
    })
    .catch(error => {
        console.error('Errore nell\'aggiornamento dei valori del portafoglio:', error);
    });
}

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
}