from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify
import requests
import json
from datetime import datetime
import os
import yfinance as yf
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

if __name__ == '__main__':
    app.run(debug=True, port=5001)  # Usa la porta 5001 invece della 5000