from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify
import requests
import json
from datetime import datetime, timedelta
import os
import yfinance as yf
import pandas as pd

app = Flask(__name__)
app.secret_key = 'your_secret_key'  # Necessario per utilizzare le sessioni e i flash messages

# Simula un database di utenti
users = {
    'admin': {'password': 'password', 'portfolios': {}}
}

# Struttura di esempio per un portfolio
# users['admin']['portfolios'] = {
#     'portfolio1': {
#         'name': 'Portfolio Azionario',
#         'description': 'Il mio portfolio di azioni',
#         'created_at': '2023-01-01',
#         'assets': [
#             {
#                 'symbol': 'AAPL',
#                 'name': 'Apple Inc.',
#                 'transactions': [
#                     {'date': '2023-01-15', 'type': 'buy', 'quantity': 10, 'price': 150.00},
#                     {'date': '2023-03-20', 'type': 'sell', 'quantity': 5, 'price': 170.00}
#                 ]
#             }
#         ]
#     }
# }

@app.route('/')
def home():
    if 'username' in session:
        return redirect(url_for('portfolios'))
    return render_template('login.html')

@app.route('/', methods=['POST'])
def login():
    username = request.form['username']
    password = request.form['password']
    
    if username in users and users[username]['password'] == password:
        session['username'] = username
        return redirect(url_for('portfolios'))
    else:
        flash('Credenziali errate. Riprova.', 'error')
        return redirect(url_for('home'))

@app.route('/logout')
def logout():
    session.pop('username', None)
    return redirect(url_for('home'))

@app.route('/portfolios')
def portfolios():
    if 'username' not in session:
        return redirect(url_for('home'))
    
    username = session['username']
    user_portfolios = users[username]['portfolios']
    
    return render_template('portfolios.html', portfolios=user_portfolios)

@app.route('/portfolios/new', methods=['GET', 'POST'])
def new_portfolio():
    if 'username' not in session:
        return redirect(url_for('home'))
    
    if request.method == 'POST':
        portfolio_id = f"portfolio_{len(users[session['username']]['portfolios']) + 1}"
        portfolio_name = request.form['name']
        portfolio_description = request.form['description']
        
        # Crea un nuovo portfolio
        users[session['username']]['portfolios'][portfolio_id] = {
            'name': portfolio_name,
            'description': portfolio_description,
            'created_at': datetime.now().strftime('%Y-%m-%d'),
            'assets': []
        }
        
        flash('Portfolio creato con successo!', 'success')
        return redirect(url_for('portfolio_detail', portfolio_id=portfolio_id))
    
    return render_template('new_portfolio.html')

@app.route('/portfolios/<portfolio_id>')
def portfolio_detail(portfolio_id):
    if 'username' not in session:
        return redirect(url_for('home'))
    
    username = session['username']
    if portfolio_id not in users[username]['portfolios']:
        flash('Portfolio non trovato', 'error')
        return redirect(url_for('portfolios'))
    
    portfolio = users[username]['portfolios'][portfolio_id]
    return render_template('portfolio_detail.html', portfolio=portfolio, portfolio_id=portfolio_id)

@app.route('/search_assets', methods=['GET'])
def search_assets():
    if 'username' not in session:
        return jsonify({'error': 'Non autorizzato'}), 401
    
    query = request.args.get('q', '')
    if not query:
        return jsonify({'results': []})
    
    try:
        # Lista di simboli comuni italiani ed europei
        italian_european_symbols = [
            "ENI.MI", "ENEL.MI", "ISP.MI", "UCG.MI", "TIT.MI",  # Italiani
            "STLA.MI", "RACE.MI", "PRY.MI", "MB.MI", "FCA.MI",
            "MC.PA", "AIR.PA", "BNP.PA", "SAP.DE", "SIE.DE",    # Francesi e tedeschi
            "AMS.MC", "SAN.MC", "TEF.MC", "NESN.SW", "ROG.SW"   # Spagnoli e svizzeri
        ]

        # ETF europei comuni
        european_etfs = [
            "IWDA.L", "VWCE.DE", "EUNL.DE", "VUSA.L", "CSPX.L",  # ETF azionari
            "IUSA.MI", "LCUK.MI", "XEMC.DE", "DBXD.MI", "IQQH.DE",
            "IEAC.L", "AGGH.L", "IBGS.MI", "IEAG.DE", "IEBB.MI"   # ETF obbligazionari
        ]
        
        results = []
        
        # Prova a ottenere direttamente lo strumento se la query è un simbolo
        try:
            ticker = yf.Ticker(query.upper())
            info = ticker.info
            if info and 'shortName' in info:
                results.append({
                    'symbol': query.upper(),
                    'name': info.get('shortName', info.get('longName', query.upper())),
                    'price': info.get('regularMarketPrice', 0),
                    'currency': info.get('currency', 'USD'),
                    'type': info.get('quoteType', 'N/A')
                })
        except:
            pass
        
        # Se non abbiamo risultati, proviamo con alcuni simboli comuni che contengono la query
        if not results:
            # Lista di simboli comuni inclusi ETF USA
            common_symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA", 
                             "SPY", "QQQ", "VTI", "VOO", "IEUR", "VGK", "EEM", "VWO",
                             "BND", "AGG", "VNQ", "GLD", "SLV", "BTC-USD", "ETH-USD"]
            
            # Filtra i simboli che contengono la query
            filtered_symbols = [s for s in common_symbols if query.lower() in s.lower()]
            
            # Aggiungi simboli italiani ed europei se la query lo suggerisce
            if "italia" in query.lower() or "mi" in query.lower() or "borsa" in query.lower():
                filtered_symbols.extend([s for s in italian_european_symbols if s not in filtered_symbols])
            
            # Aggiungi ETF europei se la query lo suggerisce
            if "etf" in query.lower() or "europa" in query.lower() or "european" in query.lower():
                filtered_symbols.extend([s for s in european_etfs if s not in filtered_symbols])
            
            # Se la query è vuota o molto generica, mostra un mix di titoli USA ed europei
            if len(filtered_symbols) < 3:
                filtered_symbols.extend(italian_european_symbols[:5])
                filtered_symbols.extend(european_etfs[:5])
            
            # Ottieni informazioni sui simboli filtrati
            for symbol in filtered_symbols[:15]:  # Limita a 15 risultati
                try:
                    ticker = yf.Ticker(symbol)
                    info = ticker.info
                    if info and 'shortName' in info:
                        results.append({
                            'symbol': symbol,
                            'name': info.get('shortName', info.get('longName', symbol)),
                            'price': info.get('regularMarketPrice', 0),
                            'currency': info.get('currency', 'USD'),
                            'type': info.get('quoteType', 'N/A')
                        })
                except Exception as e:
                    print(f"Errore per {symbol}: {e}")
                    continue
        
        return jsonify({'results': results})
    
    except Exception as e:
        print(f"Errore nella ricerca: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/portfolios/<portfolio_id>/add_asset', methods=['POST'])
def add_asset(portfolio_id):
    if 'username' not in session:
        return jsonify({'error': 'Non autorizzato'}), 401
    
    data = request.json
    symbol = data.get('symbol')
    name = data.get('name')
    price = data.get('price', 0)
    currency = data.get('currency', 'USD')
    asset_type = data.get('type', 'Unknown')
    
    if not symbol or not name:
        return jsonify({'error': 'Dati mancanti'}), 400
    
    username = session['username']
    if portfolio_id not in users[username]['portfolios']:
        return jsonify({'error': 'Portfolio non trovato'}), 404
    
    # Controlla se lo strumento è già nel portfolio
    portfolio = users[username]['portfolios'][portfolio_id]
    for asset in portfolio['assets']:
        if asset['symbol'] == symbol:
            return jsonify({'error': 'Strumento già nel portfolio'}), 400
    
    # Aggiungi il nuovo strumento con più informazioni
    portfolio['assets'].append({
        'symbol': symbol,
        'name': name,
        'current_price': price,
        'currency': currency,
        'type': asset_type,
        'transactions': []
    })
    
    return jsonify({'success': True})

@app.route('/portfolios/<portfolio_id>/assets/<symbol>/add_transaction', methods=['POST'])
def add_transaction(portfolio_id, symbol):
    if 'username' not in session:
        return jsonify({'error': 'Non autorizzato'}), 401
    
    data = request.form
    transaction_type = data.get('type')
    quantity = float(data.get('quantity'))
    price = float(data.get('price'))
    date = data.get('date')
    
    username = session['username']
    if portfolio_id not in users[username]['portfolios']:
        flash('Portfolio non trovato', 'error')
        return redirect(url_for('portfolios'))
    
    portfolio = users[username]['portfolios'][portfolio_id]
    
    # Trova lo strumento nel portfolio
    asset = None
    for a in portfolio['assets']:
        if a['symbol'] == symbol:
            asset = a
            break
    
    if not asset:
        flash('Strumento non trovato nel portfolio', 'error')
        return redirect(url_for('portfolio_detail', portfolio_id=portfolio_id))
    
    # Aggiungi la transazione
    asset['transactions'].append({
        'date': date,
        'type': transaction_type,
        'quantity': quantity,
        'price': price
    })
    
    flash('Transazione aggiunta con successo', 'success')
    return redirect(url_for('portfolio_detail', portfolio_id=portfolio_id))

@app.route('/portfolios/<portfolio_id>/delete', methods=['POST'])
def delete_portfolio(portfolio_id):
    if 'username' not in session:
        return jsonify({'error': 'Non autorizzato'}), 401
    
    username = session['username']
    if portfolio_id not in users[username]['portfolios']:
        return jsonify({'error': 'Portfolio non trovato'}), 404
    
    # Elimina il portafoglio
    del users[username]['portfolios'][portfolio_id]
    
    return jsonify({'success': True})

@app.route('/portfolios/<portfolio_id>/assets/<symbol>/delete', methods=['POST'])
def delete_asset(portfolio_id, symbol):
    if 'username' not in session:
        return jsonify({'error': 'Non autorizzato'}), 401
    
    username = session['username']
    if portfolio_id not in users[username]['portfolios']:
        return jsonify({'error': 'Portfolio non trovato'}), 404
    
    portfolio = users[username]['portfolios'][portfolio_id]
    
    # Trova l'indice dello strumento nel portfolio
    asset_index = None
    for i, asset in enumerate(portfolio['assets']):
        if asset['symbol'] == symbol:
            asset_index = i
            break
    
    if asset_index is None:
        return jsonify({'error': 'Strumento non trovato nel portfolio'}), 404
    
    # Elimina lo strumento
    portfolio['assets'].pop(asset_index)
    
    return jsonify({'success': True})

# Elimina una transazione
@app.route('/portfolios/<portfolio_id>/assets/<symbol>/transactions/delete', methods=['POST'])
def delete_transaction(portfolio_id, symbol):
    if 'username' not in session:
        return jsonify({'error': 'Non autorizzato'}), 401
    
    username = session['username']
    if portfolio_id not in users[username]['portfolios']:
        return jsonify({'error': 'Portfolio non trovato'}), 404
    
    portfolio = users[username]['portfolios'][portfolio_id]
    
    # Trova l'asset
    asset = None
    for a in portfolio['assets']:
        if a['symbol'] == symbol:
            asset = a
            break
    
    if not asset:
        return jsonify({'error': 'Strumento non trovato nel portfolio'}), 404
    
    # Dati della transazione da eliminare
    data = request.json
    date = data.get('date')
    transaction_type = data.get('type')
    quantity = float(data.get('quantity'))
    price = float(data.get('price'))
    
    # Trova e rimuovi la transazione
    for i, transaction in enumerate(asset['transactions']):
        if (transaction['date'] == date and 
            transaction['type'] == transaction_type and 
            abs(transaction['quantity'] - quantity) < 0.001 and 
            abs(transaction['price'] - price) < 0.001):
            asset['transactions'].pop(i)
            return jsonify({'success': True})
    
    return jsonify({'error': 'Transazione non trovata'}), 404

# Funzione helper per trovare il prezzo più vicino a una data specifica - CORRETTA
def find_closest_price(history_df, target_date):
    # Trova l'indice della data più vicina alla data target
    if history_df.empty:
        return 0
        
    # Assicura che target_date sia timezone-naive
    if isinstance(target_date, datetime):
        target_date = target_date.replace(tzinfo=None)
    
    # Converti l'indice in una lista di date senza timezone info
    dates = []
    for idx_date in history_df.index:
        # Rimuovi l'informazione timezone se presente
        if hasattr(idx_date, 'tzinfo') and idx_date.tzinfo is not None:
            dates.append(idx_date.replace(tzinfo=None))
        else:
            dates.append(idx_date)
    
    # Converti target_date in Timestamp senza timezone
    target_timestamp = pd.Timestamp(target_date).replace(tzinfo=None)
    
    # Trova la data più vicina
    closest_date_idx = None
    min_diff = None
    
    for i, date in enumerate(dates):
        diff = abs((date - target_timestamp).total_seconds())
        if min_diff is None or diff < min_diff:
            min_diff = diff
            closest_date_idx = i
    
    # Se non troviamo una data vicina, usiamo la prima disponibile
    if closest_date_idx is None:
        return history_df['Close'].iloc[0] if len(history_df) > 0 else 0
    
    return history_df['Close'].iloc[closest_date_idx]

# Recupera i prezzi storici     
@app.route('/portfolios/<portfolio_id>/update_prices', methods=['POST'])
def update_prices(portfolio_id):
    if 'username' not in session:
        return jsonify({'error': 'Non autorizzato'}), 401
    
    username = session['username']
    if portfolio_id not in users[username]['portfolios']:
        return jsonify({'error': 'Portfolio non trovato'}), 404
    
    portfolio = users[username]['portfolios'][portfolio_id]
    updated_data = []
    print(f"Ricevuta richiesta update_prices per portfolio {portfolio_id}")
    print(f"Portfolio contiene {len(portfolio['assets'])} asset")
    
    # Data corrente per calcoli YTD e altre metriche temporali
    current_date = datetime.now()
    ytd_start_date = datetime(current_date.year, 1, 1)  # 1° gennaio dell'anno corrente
    three_years_ago = current_date - timedelta(days=365*3)
    five_years_ago = current_date - timedelta(days=365*5)
    ten_years_ago = current_date - timedelta(days=365*10)
    
    # Recupera i prezzi storici per ogni strumento
    for asset in portfolio['assets']:
        symbol = asset['symbol']
        print(f"Elaborazione asset {symbol}...")
        try:
            # Ottieni dati storici per il periodo massimo disponibile
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period="max")
            print(f"Ottenuti {len(hist)} punti dati storici per {symbol}")
            
            # Aggiorna il prezzo corrente
            if not hist.empty:
                current_price = hist['Close'].iloc[-1]
                asset['current_price'] = current_price
                
                # Memorizza i prezzi storici
                if 'historical_prices' not in asset:
                    asset['historical_prices'] = {}
                
                for date, row in hist.iterrows():
                    date_str = date.strftime('%Y-%m-%d')
                    asset['historical_prices'][date_str] = row['Close']
                
                try:
                    # Trova il prezzo più vicino per diverse date di riferimento
                    ytd_price = find_closest_price(hist, ytd_start_date)
                    three_year_price = find_closest_price(hist, three_years_ago)
                    five_year_price = find_closest_price(hist, five_years_ago)
                    ten_year_price = find_closest_price(hist, ten_years_ago)
                    first_price = hist['Close'].iloc[0] if not hist.empty else current_price
                    
                    # Calcola le variazioni percentuali per diversi periodi
                    daily_change = hist['Close'].pct_change().iloc[-1] * 100 if len(hist) > 1 else 0
                    weekly_change = hist['Close'].pct_change(5).iloc[-1] * 100 if len(hist) > 5 else 0
                    monthly_change = hist['Close'].pct_change(20).iloc[-1] * 100 if len(hist) > 20 else 0
                    
                    # Calcola correttamente il YTD (Year To Date)
                    ytd_change = ((current_price / ytd_price) - 1) * 100 if ytd_price > 0 else 0
                    
                    # Nuove metriche temporali
                    three_year_change = ((current_price / three_year_price) - 1) * 100 if three_year_price > 0 else None
                    five_year_change = ((current_price / five_year_price) - 1) * 100 if five_year_price > 0 else None
                    ten_year_change = ((current_price / ten_year_price) - 1) * 100 if ten_year_price > 0 else None
                    since_inception_change = ((current_price / first_price) - 1) * 100 if first_price > 0 else 0
                except Exception as e:
                    print(f"Errore nel calcolo delle metriche di performance per {symbol}: {e}")
                    # Valori predefiniti in caso di errore
                    daily_change = 0
                    weekly_change = 0
                    monthly_change = 0
                    ytd_change = 0
                    three_year_change = None
                    five_year_change = None
                    ten_year_change = None
                    since_inception_change = 0
                
                # Calcola il costo medio e il profitto/perdita
                buy_quantity = 0
                buy_value = 0
                sell_quantity = 0
                sell_value = 0
                
                for transaction in asset['transactions']:
                    if transaction['type'] == 'buy':
                        buy_quantity += transaction['quantity']
                        buy_value += transaction['quantity'] * transaction['price']
                    else:  # sell
                        sell_quantity += transaction['quantity']
                        sell_value += transaction['quantity'] * transaction['price']
                
                net_quantity = buy_quantity - sell_quantity
                
                # Calcola il costo medio solo se abbiamo acquisti
                avg_cost = buy_value / buy_quantity if buy_quantity > 0 else 0
                
                # Calcola il valore attuale e il P/L
                current_value = net_quantity * current_price
                investment_cost = avg_cost * net_quantity
                pl_value = current_value - investment_cost
                pl_percent = (pl_value / investment_cost * 100) if investment_cost > 0 else 0
                
                updated_data.append({
                    'symbol': symbol,
                    'name': asset['name'],
                    'current_price': current_price,
                    'net_quantity': net_quantity,
                    'avg_cost': avg_cost,
                    'current_value': current_value,
                    'pl_value': pl_value,
                    'pl_percent': pl_percent,
                    'daily_change': daily_change,
                    'weekly_change': weekly_change,
                    'monthly_change': monthly_change,
                    'ytd_change': ytd_change,
                    'three_year_change': three_year_change,
                    'five_year_change': five_year_change,
                    'ten_year_change': ten_year_change,
                    'since_inception_change': since_inception_change
                })
        except Exception as e:
            print(f"Errore nell'aggiornamento dei prezzi per {symbol}: {e}")
    
    print(f"Dati aggiornati per il portfolio {portfolio_id}:")
    for data in updated_data:
        print(f"Symbol: {data['symbol']}, Prezzo: {data['current_price']}, Quantità: {data['net_quantity']}, P/L: {data['pl_value']}")
    
    return jsonify({'success': True, 'data': updated_data})

# Rendimenti su diversi periodi
@app.route('/portfolios/<portfolio_id>/performance', methods=['GET'])
def get_performance(portfolio_id):
    if 'username' not in session:
        return jsonify({'error': 'Non autorizzato'}), 401
    
    username = session['username']
    if portfolio_id not in users[username]['portfolios']:
        return jsonify({'error': 'Portfolio non trovato'}), 404
    
    portfolio = users[username]['portfolios'][portfolio_id]
    
    period = request.args.get('period', 'all')
    today = datetime.now()
    
    # Determina la data di inizio in base al periodo
    if period == '1m':
        start_date = (today - timedelta(days=30)).strftime('%Y-%m-%d')
    elif period == '3m':
        start_date = (today - timedelta(days=90)).strftime('%Y-%m-%d')
    elif period == '6m':
        start_date = (today - timedelta(days=180)).strftime('%Y-%m-%d')
    elif period == 'ytd':
        start_date = datetime(today.year, 1, 1).strftime('%Y-%m-%d')
    elif period == '1y':
        start_date = (today - timedelta(days=365)).strftime('%Y-%m-%d')
    else:
        # Trova la prima transazione in assoluto
        start_date = today.strftime('%Y-%m-%d')
        for asset in portfolio['assets']:
            for transaction in asset['transactions']:
                if transaction['date'] < start_date:
                    start_date = transaction['date']
    
    # Calcola i valori del portafoglio all'inizio e alla fine del periodo
    start_value = 0
    end_value = 0
    cash_flows = []  # Per calcolare TWR e MWR in seguito
    
    for asset in portfolio['assets']:
        if 'historical_prices' not in asset:
            continue
        
        # Determina le transazioni rilevanti e calcola la quantità posseduta all'inizio del periodo
        net_quantity_at_start = 0
        net_quantity_current = 0
        
        for transaction in asset['transactions']:
            transaction_date = transaction['date']
            quantity = transaction['quantity']
            price = transaction['price']
            
            if transaction['type'] == 'buy':
                if transaction_date < start_date:
                    net_quantity_at_start += quantity
                net_quantity_current += quantity
                # Registra il flusso di cassa per TWR/MWR
                cash_flows.append({
                    'date': transaction_date,
                    'amount': -quantity * price  # Negativo perché è un'uscita di cassa
                })
            else:  # sell
                if transaction_date < start_date:
                    net_quantity_at_start -= quantity
                net_quantity_current -= quantity
                # Registra il flusso di cassa per TWR/MWR
                cash_flows.append({
                    'date': transaction_date,
                    'amount': quantity * price  # Positivo perché è un'entrata di cassa
                })
        
        # Trova i prezzi all'inizio e alla fine del periodo
        start_price = None
        end_price = None
        
        # Trova il prezzo più vicino alla data di inizio
        closest_start_date = None
        for date_str, price in asset['historical_prices'].items():
            if date_str >= start_date:
                if closest_start_date is None or date_str < closest_start_date:
                    closest_start_date = date_str
                    start_price = price
        
        # Utilizza il prezzo corrente come prezzo finale
        end_price = asset['current_price']
        
        if start_price and end_price:
            start_value += net_quantity_at_start * start_price
            end_value += net_quantity_current * end_price
    
    # Calcola il rendimento percentuale
    if start_value > 0:
        percent_return = ((end_value - start_value) / start_value) * 100
    else:
        percent_return = 0
    
    # In futuro qui potremmo aggiungere il calcolo di MWR e TWR
    
    return jsonify({
        'period': period,
        'start_date': start_date,
        'end_date': today.strftime('%Y-%m-%d'),
        'start_value': start_value,
        'end_value': end_value,
        'percent_return': percent_return
    })    

if __name__ == '__main__':
    app.run(debug=True, port=5001)  # Usa la porta 5001 invece della 5000