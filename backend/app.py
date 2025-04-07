import os
import json
import bcrypt
from datetime import datetime, timedelta
from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify
import requests
import yfinance as yf
import pandas as pd
import numpy as np
from scipy import stats
from functools import lru_cache
import hashlib
import time
import csv
import io

# Dizionario per memorizzare i risultati del cache con una scadenza
performance_cache = {}
cache_expiry = 3600  # Cache valida per 1 ora (in secondi)

def get_cache_key(portfolio_id, period, endpoint):
    """Genera una chiave univoca per il caching"""
    return f"{portfolio_id}_{period}_{endpoint}"

def cache_result(portfolio_id, period, endpoint, data):
    """Salva un risultato nella cache"""
    key = get_cache_key(portfolio_id, period, endpoint)
    performance_cache[key] = {
        'data': data,
        'timestamp': time.time()
    }

def get_cached_result(portfolio_id, period, endpoint):
    """Recupera un risultato dalla cache se valido"""
    key = get_cache_key(portfolio_id, period, endpoint)
    if key in performance_cache:
        entry = performance_cache[key]
        if time.time() - entry['timestamp'] < cache_expiry:
            return entry['data']
    return None

def clear_portfolio_cache(portfolio_id):
    """Cancella tutta la cache relativa a un determinato portfolio"""
    keys_to_delete = []
    for key in performance_cache.keys():
        if key.startswith(f"{portfolio_id}_"):
            keys_to_delete.append(key)
    
    for key in keys_to_delete:
        del performance_cache[key]
    
    print(f"Cache cancellata per il portfolio {portfolio_id}")    


def compute_all_returns(portfolio, start_date, end_date):
    """Calcola i rendimenti giornalieri per tutti gli asset una volta sola"""
    asset_returns = {}
    portfolio_values = []
    dates = []
    
    # Genera date
    current_date = start_date
    while current_date <= end_date:
        date_str = current_date.strftime('%Y-%m-%d')
        dates.append(date_str)
        
        # Calcola valore portafoglio
        daily_value = 0
        for asset in portfolio['assets']:
            # Trova il prezzo più vicino alla data corrente
            asset_price = 0
            if 'historical_prices' in asset:
                # Trova il prezzo più vicino alla data corrente
                closest_date = None
                min_date_diff = float('inf')
                
                for price_date, price in asset['historical_prices'].items():
                    if price_date <= date_str:
                        date_diff = abs((datetime.strptime(date_str, '%Y-%m-%d') - 
                                        datetime.strptime(price_date, '%Y-%m-%d')).days)
                        if date_diff < min_date_diff:
                            min_date_diff = date_diff
                            closest_date = price_date
                            asset_price = price
            
            # Calcola la quantità posseduta alla data corrente
            net_quantity = 0
            for transaction in asset['transactions']:
                if transaction['date'] <= date_str:
                    if transaction['type'] == 'buy':
                        net_quantity += transaction['quantity']
                    else:  # sell
                        net_quantity -= transaction['quantity']
            
            # Salva i prezzi e le quantità per ogni asset
            symbol = asset['symbol']
            if symbol not in asset_returns:
                asset_returns[symbol] = {
                    'prices': [],
                    'quantities': [],
                    'values': [],
                    'returns': []  # Aggiungi questa chiave
                }
            
            asset_returns[symbol]['prices'].append(asset_price)
            asset_returns[symbol]['quantities'].append(net_quantity)
            asset_returns[symbol]['values'].append(net_quantity * asset_price)
            
            # Aggiungi il valore dell'asset al valore totale del portafoglio
            daily_value += net_quantity * asset_price
        
        # Aggiungi il valore alla serie temporale
        portfolio_values.append(daily_value)
        
        current_date += timedelta(days=1)
    
    # Calcola rendimenti del portafoglio
    portfolio_returns = []
    for i in range(1, len(portfolio_values)):
        if portfolio_values[i-1] > 0:
            daily_return = (portfolio_values[i] - portfolio_values[i-1]) / portfolio_values[i-1]
        else:
            daily_return = 0
        portfolio_returns.append(daily_return)
    
    # Calcola rendimenti per ogni asset
    for symbol in asset_returns:
        # Ottieni l'asset corrispondente
        asset_obj = None
        for asset in portfolio['assets']:
            if asset['symbol'] == symbol:
                asset_obj = asset
                break
        
        # Se l'asset ha rendimenti storici precalcolati, usali
        if asset_obj and 'historical_returns' in asset_obj:
            # Recupera i rendimenti precalcolati per le date nel nostro periodo
            returns = []
            for i in range(1, len(dates)):
                date_str = dates[i]
                if date_str in asset_obj['historical_returns']:
                    # Usa il rendimento precalcolato
                    returns.append(asset_obj['historical_returns'][date_str])
                else:
                    # Altrimenti calcola il rendimento dai prezzi
                    asset_prices = asset_returns[symbol]['prices']
                    if i < len(asset_prices) and i-1 < len(asset_prices) and asset_prices[i-1] > 0:
                        daily_return = (asset_prices[i] - asset_prices[i-1]) / asset_prices[i-1]
                        returns.append(daily_return)
                    else:
                        returns.append(0)  # Fallback se non abbiamo i dati
        else:
            # Calcola i rendimenti dai prezzi come prima
            asset_prices = asset_returns[symbol]['prices']
            returns = []
            for i in range(1, len(asset_prices)):
                if asset_prices[i-1] > 0:
                    daily_return = (asset_prices[i] - asset_prices[i-1]) / asset_prices[i-1]
                else:
                    daily_return = 0
                returns.append(daily_return)
        
        # Assegna i rendimenti calcolati o recuperati
        asset_returns[symbol]['returns'] = returns
    
    return {
        'dates': dates,
        'portfolioValues': portfolio_values,
        'portfolioReturns': portfolio_returns,
        'assetReturns': asset_returns
    }


def hash_password(password):
    """Hash della password con bcrypt"""
    # Converti la password in bytes e genera l'hash
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

def check_password(provided_password, stored_hash):
    """Verifica della password con debug dettagliato"""
    try:
        # Converti la password fornita in bytes
        provided_password_bytes = provided_password.encode('utf-8')
        
        # Debug: stampa il tipo e il formato di stored_hash
        print(f"Tipo stored_hash: {type(stored_hash)}")
        print(f"Formato stored_hash: {stored_hash}")
        
        # Gestisci diversi formati di stored_hash
        if isinstance(stored_hash, str):
            try:
                stored_hash = stored_hash.encode('utf-8')
                print("Hash convertito da stringa a bytes")
            except Exception as e:
                print(f"Errore nella conversione: {e}")
                return False
        
        # Verifica la password
        result = bcrypt.checkpw(provided_password_bytes, stored_hash)
        print(f"Risultato verifica password: {result}")
        return result
    except Exception as e:
        print(f"Errore dettagliato nella verifica della password: {e}")
        return False



def load_users():
    """Carica gli utenti da un file JSON con gestione degli errori migliorata."""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(base_dir, 'users.json')
    
    try:
        # Assicurati che la directory esista
        os.makedirs(base_dir, exist_ok=True)
        
        # Se il file non esiste o non può essere caricato, crea un utente di default
        if not os.path.exists(file_path):
            default_users = {
                'admin': {
                    'password': hash_password('password'),  # Hash della password di default
                    'portfolios': {}
                }
            }
            with open(file_path, 'w', encoding='utf-8') as f:
                json_users = {
                    username: {
                        'password': password.decode('utf-8'),
                        'portfolios': user_data['portfolios']
                    } for username, user_data in default_users.items()
                }
                json.dump(json_users, f, indent=4, ensure_ascii=False)
            return default_users
        
        # Leggi il file esistente con gestione degli errori
        with open(file_path, 'r', encoding='utf-8') as f:
            try:
                loaded_users = json.load(f)
                
                # Converti gli hash di nuovo in bytes o rigenera
                users = {}
                for username, user_data in loaded_users.items():
                    try:
                        # Prova a usare l'hash esistente
                        password = user_data['password']
                        if isinstance(password, str):
                            password = password.encode('utf-8')
                        
                        # Verifica che l'hash sia valido
                        bcrypt.checkpw(b'test', password)
                        
                        users[username] = {
                            'password': password,
                            'portfolios': user_data.get('portfolios', {})
                        }
                    except Exception:
                        # Se l'hash non è valido, rigenera
                        print(f"Hash non valido per {username}. Rigenerazione.")
                        users[username] = {
                            'password': hash_password('password'),
                            'portfolios': user_data.get('portfolios', {})
                        }
                
                # Assicurati che l'utente admin esista sempre
                if 'admin' not in users:
                    users['admin'] = {
                        'password': hash_password('password'),
                        'portfolios': {}
                    }
                
                return users
            except json.JSONDecodeError:
                print("Errore nel decodificare il file JSON. Creazione di un nuovo file.")
                default_users = {
                    'admin': {
                        'password': hash_password('password'),
                        'portfolios': {}
                    }
                }
                with open(file_path, 'w', encoding='utf-8') as f:
                    json_users = {
                        username: {
                            'password': password.decode('utf-8'),
                            'portfolios': user_data['portfolios']
                        } for username, user_data in default_users.items()
                    }
                    json.dump(json_users, f, indent=4, ensure_ascii=False)
                return default_users
    
    except Exception as e:
        print(f"Errore inatteso nel caricamento degli utenti: {e}")
        return {
            'admin': {
                'password': hash_password('password'),
                'portfolios': {}
            }
        }

def save_users(users):
    """Salva gli utenti su un file JSON con gestione avanzata degli errori"""
    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        file_path = os.path.join(base_dir, 'users.json')
        backup_path = file_path + '.bak'
        
        # Crea un backup prima di sovrascrivere
        if os.path.exists(file_path):
            os.replace(file_path, backup_path)
        
        # Converti gli hash in stringhe per il salvataggio JSON
        json_users = {}
        for username, user_data in users.items():
            json_users[username] = {
                'password': user_data['password'].decode('utf-8'),
                'portfolios': user_data['portfolios']
            }
        
        # Salva il nuovo file
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(json_users, f, indent=4, ensure_ascii=False)
        
        # Rimuovi il backup se il salvataggio ha successo
        if os.path.exists(backup_path):
            os.remove(backup_path)
        
        print("Dati utente salvati con successo")
    except Exception as e:
        print(f"Errore nel salvataggio degli utenti: {e}")
        # Tentativi di ripristino
        if os.path.exists(backup_path):
            try:
                os.replace(backup_path, file_path)
                print("Ripristinato il backup precedente")
            except Exception:
                print("Impossibile ripristinare il backup")

# Carica gli utenti all'avvio dell'applicazione
users = load_users()

app = Flask(__name__)
app.secret_key = 'your_secret_key'  # Necessario per utilizzare le sessioni e i flash messages

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        confirm_password = request.form['confirm_password']
        
        # Controlli base
        if not username or not password:
            flash('Username e password sono obbligatori', 'error')
            return redirect(url_for('register'))
        
        if password != confirm_password:
            flash('Le password non coincidono', 'error')
            return redirect(url_for('register'))
        
        # Controllo se l'utente esiste già
        if username in users:
            flash('Username già esistente', 'error')
            return redirect(url_for('register'))
        
        # Username deve essere alfanumerico
        if not username.isalnum():
            flash('Username deve contenere solo lettere e numeri', 'error')
            return redirect(url_for('register'))
        
        # Password deve essere lunga almeno 6 caratteri
        if len(password) < 6:
            flash('La password deve essere lunga almeno 6 caratteri', 'error')
            return redirect(url_for('register'))
        
        # Aggiungi nuovo utente con password hashata
        users[username] = {
            'password': hash_password(password),
            'portfolios': {}
        }
        
        # Salva gli utenti
        save_users(users)
        
        flash('Registrazione avvenuta con successo', 'success')
        return redirect(url_for('login'))
    
    return render_template('register.html')

@app.route('/')
def home():
    if 'username' in session:
        return redirect(url_for('portfolios'))
    return render_template('login.html')

@app.route('/', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        # Controlla se l'utente esiste
        if username not in users:
            flash('Utente non trovato', 'error')
            return redirect(url_for('home'))
        
        # Debug: stampa le informazioni dell'utente
        print(f"Utente trovato: {username}")
        print(f"Stored password: {users[username]['password']}")
        
        # Verifica la password
        stored_password = users[username]['password']
        
        if check_password(password, stored_password):
            session['username'] = username
            return redirect(url_for('portfolios'))
        else:
            flash('Credenziali errate. Riprova.', 'error')
            return redirect(url_for('home'))
    
    return render_template('login.html')


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
        
        # Salva immediatamente
        save_users(users)
        
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
    
    # Salva immediatamente
    save_users(users)

    # Cancella la cache per questo portfolio
    clear_portfolio_cache(portfolio_id)
    
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
    
    # Gestione dei nuovi campi opzionali
    fee = 0.0
    notes = ""
    
    if data.get('fee') and data.get('fee').strip():
        fee = float(data.get('fee'))
    
    if data.get('notes'):
        notes = data.get('notes')
    
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
    
    # Aggiungi la transazione con i nuovi campi
    asset['transactions'].append({
        'date': date,
        'type': transaction_type,
        'quantity': quantity,
        'price': price,
        'fee': fee,
        'notes': notes
    })

    # Salva immediatamente
    save_users(users)

    # Cancella la cache per questo portfolio
    clear_portfolio_cache(portfolio_id)
    
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

    # Salva immediatamente
    save_users(users)
    
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

    # Salva immediatamente
    save_users(users)

    # Cancella la cache per questo portfolio
    clear_portfolio_cache(portfolio_id)
    
    return jsonify({'success': True})

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
    
    # Opzionalmente controlla anche fee se presente
    fee = data.get('fee', 0)
    if fee:
        fee = float(fee)
    
    # Trova e rimuovi la transazione
    for i, transaction in enumerate(asset['transactions']):
        # Verifica se i campi essenziali corrispondono
        if (transaction['date'] == date and 
            transaction['type'] == transaction_type and 
            abs(transaction['quantity'] - quantity) < 0.001 and 
            abs(transaction['price'] - price) < 0.001):
            
            # Se fee è specificato nel payload, verifica anche quello
            if fee > 0 and 'fee' in transaction:
                if abs(transaction['fee'] - fee) > 0.001:
                    continue  # Non corrisponde, passa alla prossima transazione
            
            # Rimuovi la transazione
            asset['transactions'].pop(i)
            
            # Salva immediatamente
            save_users(users)
            
            # Cancella la cache per questo portfolio
            clear_portfolio_cache(portfolio_id)
            
            return jsonify({'success': True})
    
    return jsonify({'error': 'Transazione non trovata'}), 404

# Funzione helper per trovare il prezzo più vicino a una data specifica
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

                # Memorizza anche i rendimenti storici
                if 'historical_returns' not in asset:
                    asset['historical_returns'] = {}
                
                # Processa i dati storici
                prev_date = None
                prev_price = None
                
                for date, row in hist.iterrows():
                    date_str = date.strftime('%Y-%m-%d')
                    price = row['Close']

                    # Salva il prezzo
                    asset['historical_prices'][date_str] = price

                    # Calcola e salva il rendimento giornaliero se abbiamo un prezzo precedente
                    if prev_price is not None and prev_price > 0:
                        daily_return = (price - prev_price) / prev_price
                        asset['historical_returns'][date_str] = daily_return
                    
                    prev_date = date_str
                    prev_price = price
                
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
    
    # Salva gli utenti dopo l'aggiornamento
    save_users(users)

    # Cancella la cache per questo portfolio
    clear_portfolio_cache(portfolio_id)
    
    print(f"Dati aggiornati per il portfolio {portfolio_id}:")
    for data in updated_data:
        print(f"Symbol: {data['symbol']}, Prezzo: {data['current_price']}, Quantità: {data['net_quantity']}, P/L: {data['pl_value']}")
    
    return jsonify({'success': True, 'data': updated_data})

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

# Route per visualizzare la pagina di analisi del portafoglio
@app.route('/portfolios/<portfolio_id>/analysis')
def portfolio_analysis(portfolio_id):
    if 'username' not in session:
        return redirect(url_for('home'))
    
    username = session['username']
    if portfolio_id not in users[username]['portfolios']:
        flash('Portfolio non trovato', 'error')
        return redirect(url_for('portfolios'))
    
    portfolio = users[username]['portfolios'][portfolio_id]
    return render_template('portfolio_analysis.html', portfolio=portfolio, portfolio_id=portfolio_id)

@app.route('/api/portfolios/<portfolio_id>/performance-data')
def get_performance_data(portfolio_id):
    if 'username' not in session:
        return jsonify({'error': 'Non autorizzato'}), 401
    
    username = session['username']
    if portfolio_id not in users[username]['portfolios']:
        return jsonify({'error': 'Portfolio non trovato'}), 404
    
    portfolio = users[username]['portfolios'][portfolio_id]
    period = request.args.get('period', '1m')
    
    # Controlla se il risultato è nella cache
    cached_data = get_cached_result(portfolio_id, period, 'performance')
    if cached_data:
        return jsonify(cached_data)
    
    # Ottieni le date di inizio e fine
    end_date = datetime.now()
    
    # Determinare la data di inizio in base al periodo
    if period == '1m':
        start_date = end_date - timedelta(days=30)
    elif period == '3m':
        start_date = end_date - timedelta(days=90)
    elif period == '6m':
        start_date = end_date - timedelta(days=180)
    elif period == 'ytd':
        start_date = datetime(end_date.year, 1, 1)
    elif period == '1y':
        start_date = end_date - timedelta(days=365)
    else:  # 'all'
        # Trova la data della prima transazione
        start_date = end_date
        for asset in portfolio['assets']:
            for transaction in asset['transactions']:
                transaction_date = datetime.strptime(transaction['date'], '%Y-%m-%d')
                if transaction_date < start_date:
                    start_date = transaction_date
    
    # Formatta le date per il confronto con stringhe
    start_date_str = start_date.strftime('%Y-%m-%d')
    end_date_str = end_date.strftime('%Y-%m-%d')
    
    # Costruisci una serie temporale di valori del portafoglio
    dates = []
    portfolio_values = []
    current_date = start_date
    
    # Generiamo una lista di date dal periodo selezionato
    date_list = []
    while current_date <= end_date:
        date_list.append(current_date.strftime('%Y-%m-%d'))
        current_date += timedelta(days=1)
    
    # Calcola i valori per ogni data
    for date_str in date_list:
        daily_value = 0
        
        for asset in portfolio['assets']:
            # Trova il prezzo più vicino alla data corrente
            asset_price = 0
            if 'historical_prices' in asset:
                # Trova il prezzo più vicino alla data corrente
                closest_date = None
                min_date_diff = float('inf')
                
                for price_date, price in asset['historical_prices'].items():
                    if price_date <= date_str:
                        date_diff = abs((datetime.strptime(date_str, '%Y-%m-%d') - 
                                        datetime.strptime(price_date, '%Y-%m-%d')).days)
                        if date_diff < min_date_diff:
                            min_date_diff = date_diff
                            closest_date = price_date
                            asset_price = price
            
            # Calcola la quantità posseduta alla data corrente
            net_quantity = 0
            for transaction in asset['transactions']:
                if transaction['date'] <= date_str:
                    if transaction['type'] == 'buy':
                        net_quantity += transaction['quantity']
                    else:  # sell
                        net_quantity -= transaction['quantity']
            
            # Aggiungi il valore dell'asset al valore totale del portafoglio
            daily_value += net_quantity * asset_price
        
        # Aggiungi la data e il valore alla serie temporale
        dates.append(date_str)
        portfolio_values.append(daily_value)
    
    # Calcola i rendimenti giornalieri percentuali
    daily_returns = []
    for i in range(1, len(portfolio_values)):
        if portfolio_values[i-1] > 0:
            daily_return = (portfolio_values[i] - portfolio_values[i-1]) / portfolio_values[i-1] * 100
        else:
            daily_return = 0
        daily_returns.append(daily_return)
    
    # Calcola le metriche di performance
    # Rendimento totale
    total_return = ((portfolio_values[-1] / portfolio_values[0]) - 1) * 100 if portfolio_values[0] > 0 else 0
    
    # Rendimento annualizzato
    days_held = (end_date - start_date).days
    if days_held > 0 and portfolio_values[0] > 0:
        annualized_return = (((portfolio_values[-1] / portfolio_values[0]) ** (365 / days_held)) - 1) * 100
    else:
        annualized_return = 0
    
    # Volatilità (deviazione standard annualizzata dei rendimenti giornalieri)
    volatility = np.std(daily_returns) * np.sqrt(252) if daily_returns else 0
    
    # Indice di Sharpe (usando rendimento risk-free dello 0.5%)
    risk_free_rate = 0.5  # 0.5% annuo
    daily_risk_free = risk_free_rate / 252
    sharpe_ratio = ((annualized_return - risk_free_rate) / volatility) if volatility > 0 else 0
    
    # Alpha e Beta (assumiamo un benchmark semplice per ora)
    # In un'implementazione reale, dovresti caricare veri dati di benchmark
    benchmark_values = [val * (1 + 0.0002) for val in range(len(portfolio_values))]
    
    result_data = {
        'dates': dates,
        'portfolioValues': portfolio_values,
        'benchmarkValues': benchmark_values,
        'metrics': {
            'totalReturn': total_return,
            'annualizedReturn': annualized_return,
            'alpha': 0.5,  # Placeholder per ora
            'beta': 1.1,   # Placeholder per ora
            'sharpeRatio': sharpe_ratio,
            'volatility': volatility
        }
    }
    
    # Salva il risultato nella cache prima di restituirlo
    cache_result(portfolio_id, period, 'performance', result_data)
    
    return jsonify(result_data)

# API per ottenere i dati di drawdown
@app.route('/api/portfolios/<portfolio_id>/drawdown-data')
def get_drawdown_data(portfolio_id):
    if 'username' not in session:
        return jsonify({'error': 'Non autorizzato'}), 401
    
    username = session['username']
    if portfolio_id not in users[username]['portfolios']:
        return jsonify({'error': 'Portfolio non trovato'}), 404
    
    # Ottieni i dati di performance
    period = request.args.get('period', '1m')
    performance_data = get_performance_data(portfolio_id).json
    
    if 'error' in performance_data:
        return jsonify(performance_data), 404
    
    # Calcola i drawdown
    dates = performance_data['dates']
    portfolio_values = performance_data['portfolioValues']
    
    # Calcola il drawdown (percentuale)
    max_value = portfolio_values[0]
    drawdown_values = []
    drawdown_periods = []
    current_drawdown = 0
    current_drawdown_start = None
    
    for i, value in enumerate(portfolio_values):
        if value > max_value:
            max_value = value
            # Se usciamo da un drawdown, registriamo il periodo
            if current_drawdown_start is not None:
                drawdown_periods.append({
                    'start': current_drawdown_start,
                    'end': i - 1,
                    'duration': i - current_drawdown_start,
                    'depth': current_drawdown
                })
                current_drawdown_start = None
                current_drawdown = 0
        
        # Calcola il drawdown corrente
        if max_value > 0:
            dd = (value - max_value) / max_value * 100  # Sarà negativo
        else:
            dd = 0
        
        # Se iniziamo un nuovo drawdown
        if dd < 0 and current_drawdown_start is None:
            current_drawdown_start = i
            current_drawdown = dd
        # Se siamo in un drawdown e questo è più profondo
        elif dd < 0 and dd < current_drawdown:
            current_drawdown = dd
        
        drawdown_values.append(dd)
    
    # Completa l'ultimo periodo di drawdown se necessario
    if current_drawdown_start is not None:
        drawdown_periods.append({
            'start': current_drawdown_start,
            'end': len(portfolio_values) - 1,
            'duration': len(portfolio_values) - current_drawdown_start,
            'depth': current_drawdown
        })
    
    # Calcola le metriche di drawdown
    max_drawdown = min(drawdown_values) if drawdown_values else 0
    
    # Durata media dei drawdown
    avg_drawdown_duration = sum([period['duration'] for period in drawdown_periods]) / len(drawdown_periods) if drawdown_periods else 0
    
    # Tempo medio di recupero (non implementato in questo esempio semplificato)
    avg_recovery_time = 0  # Placeholder
    
    # Drawdown corrente
    current_drawdown = drawdown_values[-1] if drawdown_values else 0
    
    return jsonify({
        'dates': dates,
        'drawdownValues': drawdown_values,
        'metrics': {
            'maxDrawdown': max_drawdown,
            'avgDrawdownDuration': avg_drawdown_duration,
            'avgRecoveryTime': avg_recovery_time,
            'currentDrawdown': current_drawdown
        }
    })

# API per ottenere i dati di allocazione degli asset
@app.route('/api/portfolios/<portfolio_id>/allocation-data')
def get_allocation_data(portfolio_id):
    if 'username' not in session:
        return jsonify({'error': 'Non autorizzato'}), 401
    
    username = session['username']
    if portfolio_id not in users[username]['portfolios']:
        return jsonify({'error': 'Portfolio non trovato'}), 404
    
    portfolio = users[username]['portfolios'][portfolio_id]
    
    # Calcola l'allocazione corrente
    asset_names = []
    allocations = []
    total_value = 0
    
    # Prima, calcola il valore totale
    for asset in portfolio['assets']:
        # Calcola la quantità netta posseduta
        net_quantity = 0
        for transaction in asset['transactions']:
            if transaction['type'] == 'buy':
                net_quantity += transaction['quantity']
            else:  # sell
                net_quantity -= transaction['quantity']
        
        # Aggiungi il valore dell'asset al totale
        asset_value = net_quantity * asset.get('current_price', 0)
        total_value += asset_value
    
    # Poi, calcola la percentuale di allocazione per ogni asset
    for asset in portfolio['assets']:
        # Calcola la quantità netta posseduta
        net_quantity = 0
        for transaction in asset['transactions']:
            if transaction['type'] == 'buy':
                net_quantity += transaction['quantity']
            else:  # sell
                net_quantity -= transaction['quantity']
        
        # Calcola il valore e la percentuale
        asset_value = net_quantity * asset.get('current_price', 0)
        allocation_percentage = (asset_value / total_value * 100) if total_value > 0 else 0
        
        # Aggiungi all'elenco solo se l'allocazione è significativa
        if allocation_percentage > 0.1:
            asset_names.append(asset['name'])
            allocations.append(allocation_percentage)
    
    return jsonify({
        'assets': asset_names,
        'allocations': allocations
    })

# API per ottenere i dati di rischio/rendimento
@app.route('/api/portfolios/<portfolio_id>/risk-return-data')
def get_risk_return_data(portfolio_id):
    if 'username' not in session:
        return jsonify({'error': 'Non autorizzato'}), 401
    
    username = session['username']
    if portfolio_id not in users[username]['portfolios']:
        return jsonify({'error': 'Portfolio non trovato'}), 404
    
    portfolio = users[username]['portfolios'][portfolio_id]
    period = request.args.get('period', '1m')
    
    # Ottieni i dati di performance per calcolare il rischio e il rendimento del portafoglio
    performance_data = get_performance_data(portfolio_id).json
    
    if 'error' in performance_data:
        return jsonify(performance_data), 404
    
    portfolio_return = performance_data['metrics']['annualizedReturn']
    portfolio_risk = performance_data['metrics']['volatility']
    
    # Calcola il rischio e il rendimento per ogni asset
    asset_names = []
    asset_returns = []
    asset_risks = []
    
    for asset in portfolio['assets']:
        # Per semplificare, utilizziamo le metriche dall'asset stesso
        # In una implementazione reale, dovresti calcolare queste metriche con dati storici
        asset_names.append(asset['name'])
        
        # Se esistono dati storici, calcola le metriche
        if 'historical_prices' in asset and len(asset['historical_prices']) > 1:
            # Converti i prezzi storici in un array
            prices = []
            dates = sorted(asset['historical_prices'].keys())
            for date in dates:
                prices.append(asset['historical_prices'][date])
            
            # Calcola i rendimenti giornalieri
            daily_returns = []
            for i in range(1, len(prices)):
                if prices[i-1] > 0:
                    daily_return = (prices[i] - prices[i-1]) / prices[i-1] * 100
                else:
                    daily_return = 0
                daily_returns.append(daily_return)
            
            # Calcola il rendimento annualizzato
            annualized_return = np.mean(daily_returns) * 252
            
            # Calcola la volatilità annualizzata
            volatility = np.std(daily_returns) * np.sqrt(252) if len(daily_returns) > 1 else 0
            
            asset_returns.append(annualized_return)
            asset_risks.append(volatility)
        else:
            # Se non ci sono dati storici, usa valori placeholder
            asset_returns.append(5.0)  # 5% di rendimento annualizzato
            asset_risks.append(10.0)   # 10% di volatilità annualizzata
    
    return jsonify({
        'assets': asset_names,
        'returns': asset_returns,
        'risks': asset_risks,
        'portfolioReturn': portfolio_return,
        'portfolioRisk': portfolio_risk
    })

# API per ottenere la distribuzione dei rendimenti
@app.route('/api/portfolios/<portfolio_id>/returns-distribution')
def get_returns_distribution(portfolio_id):
    if 'username' not in session:
        return jsonify({'error': 'Non autorizzato'}), 401
    
    username = session['username']
    if portfolio_id not in users[username]['portfolios']:
        return jsonify({'error': 'Portfolio non trovato'}), 404
    
    period = request.args.get('period', '1m')
    
    # Ottieni i dati di performance
    performance_data = get_performance_data(portfolio_id).json
    
    if 'error' in performance_data:
        return jsonify(performance_data), 404
    
    # Calcola i rendimenti giornalieri dal valore del portafoglio
    portfolio_values = performance_data['portfolioValues']
    daily_returns = []
    
    for i in range(1, len(portfolio_values)):
        if portfolio_values[i-1] > 0:
            daily_return = (portfolio_values[i] - portfolio_values[i-1]) / portfolio_values[i-1] * 100
        else:
            daily_return = 0
        daily_returns.append(daily_return)
    
    # Crea bins per l'istogramma
    if daily_returns:
        # Usa il metodo di Freedman-Diaconis per determinare la larghezza del bin
        q75, q25 = np.percentile(daily_returns, [75, 25])
        iqr = q75 - q25
        bin_width = 2 * iqr * (len(daily_returns) ** (-1/3)) if iqr > 0 else 0.5
        
        # Limita il numero di bin tra 5 e 20
        num_bins = min(max(int((max(daily_returns) - min(daily_returns)) / bin_width), 5), 20)
        
        # Crea bins e calcola le frequenze
        hist, bin_edges = np.histogram(daily_returns, bins=num_bins)
        
        # Crea le etichette per i bins
        bin_labels = []
        for i in range(len(bin_edges) - 1):
            bin_labels.append(f"{bin_edges[i]:.2f} a {bin_edges[i+1]:.2f}")
        
        return jsonify({
            'bins': bin_labels,
            'frequencies': hist.tolist()
        })
    else:
        return jsonify({
            'bins': [],
            'frequencies': []
        })

# API per ottenere i dati di correlazione
@app.route('/api/portfolios/<portfolio_id>/correlation-data')
def get_correlation_data(portfolio_id):
    if 'username' not in session:
        return jsonify({'error': 'Non autorizzato'}), 401
    
    username = session['username']
    if portfolio_id not in users[username]['portfolios']:
        return jsonify({'error': 'Portfolio non trovato'}), 404
    
    portfolio = users[username]['portfolios'][portfolio_id]
    
    # Raccogli tutti i prezzi storici per calcolare le correlazioni
    asset_names = []
    asset_returns = []
    
    for asset in portfolio['assets']:
        if 'historical_prices' in asset and len(asset['historical_prices']) > 1:
            asset_names.append(asset['name'])
            
            # Converti i prezzi storici in rendimenti giornalieri
            prices = []
            dates = sorted(asset['historical_prices'].keys())
            for date in dates:
                prices.append(asset['historical_prices'][date])
            
            # Calcola i rendimenti giornalieri
            returns = []
            for i in range(1, len(prices)):
                if prices[i-1] > 0:
                    daily_return = (prices[i] - prices[i-1]) / prices[i-1]
                else:
                    daily_return = 0
                returns.append(daily_return)
            
            asset_returns.append(returns)
    
    # Calcola la matrice di correlazione
    correlation_matrix = []
    if len(asset_returns) > 1:
        # Assicurati che tutti gli array abbiano la stessa lunghezza
        min_length = min(len(returns) for returns in asset_returns)
        asset_returns = [returns[:min_length] for returns in asset_returns]
        
        # Calcola le correlazioni
        df = pd.DataFrame(asset_returns).T
        correlation_matrix = df.corr().values.tolist()
    
    # Converti la matrice in un formato adatto per il grafico
    correlation_values = []
    if correlation_matrix:
        for i in range(len(asset_names)):
            for j in range(len(asset_names)):
                correlation_values.append({
                    'x': asset_names[i],
                    'y': asset_names[j],
                    'v': correlation_matrix[i][j]
                })
    
    return jsonify({
        'labels': asset_names,
        'correlationMatrix': correlation_matrix,
        'correlationValues': correlation_values
    })

@app.route('/api/portfolios/<portfolio_id>/analysis-data')
def get_analysis_data(portfolio_id):
    if 'username' not in session:
        return jsonify({'error': 'Non autorizzato'}), 401
    
    username = session['username']
    if portfolio_id not in users[username]['portfolios']:
        return jsonify({'error': 'Portfolio non trovato'}), 404
    
    portfolio = users[username]['portfolios'][portfolio_id]
    period = request.args.get('period', '1m')
    
    # Controlla se il risultato completo è nella cache
    cached_data = get_cached_result(portfolio_id, period, 'full_analysis')
    if cached_data:
        return jsonify(cached_data)
    
    # Ottieni le date di inizio e fine
    end_date = datetime.now()
    
    # Determinare la data di inizio in base al periodo
    if period == '1m':
        start_date = end_date - timedelta(days=30)
    elif period == '3m':
        start_date = end_date - timedelta(days=90)
    elif period == '6m':
        start_date = end_date - timedelta(days=180)
    elif period == 'ytd':
        start_date = datetime(end_date.year, 1, 1)
    elif period == '1y':
        start_date = end_date - timedelta(days=365)
    else:  # 'all'
        # Trova la data della prima transazione
        start_date = end_date
        for asset in portfolio['assets']:
            for transaction in asset['transactions']:
                transaction_date = datetime.strptime(transaction['date'], '%Y-%m-%d')
                if transaction_date < start_date:
                    start_date = transaction_date
    
    # Usa la funzione compute_all_returns per calcolare tutti i dati necessari
    all_data = compute_all_returns(portfolio, start_date, end_date)
    
    # Performance data
    portfolio_values = all_data['portfolioValues']
    daily_returns = [r * 100 for r in all_data['portfolioReturns']]
    
    # Calcola le metriche di performance
    total_return = ((portfolio_values[-1] / portfolio_values[0]) - 1) * 100 if portfolio_values[0] > 0 else 0
    
    # Rendimento annualizzato
    days_held = (end_date - start_date).days
    if days_held > 0 and portfolio_values[0] > 0:
        annualized_return = (((portfolio_values[-1] / portfolio_values[0]) ** (365 / days_held)) - 1) * 100
    else:
        annualized_return = 0
    
    # Volatilità (deviazione standard annualizzata dei rendimenti giornalieri)
    volatility = np.std(daily_returns) * np.sqrt(252) if daily_returns else 0
    
    # Indice di Sharpe (usando rendimento risk-free dello 0.5%)
    risk_free_rate = 0.5  # 0.5% annuo
    sharpe_ratio = ((annualized_return - risk_free_rate) / volatility) if volatility > 0 else 0
    
    # Benchmark (placeholder)
    benchmark_values = [val * (1 + 0.0002) for val in range(len(portfolio_values))]
    
    performance_data = {
        'dates': all_data['dates'],
        'portfolioValues': portfolio_values,
        'benchmarkValues': benchmark_values,
        'metrics': {
            'totalReturn': total_return,
            'annualizedReturn': annualized_return,
            'alpha': 0.5,  # Placeholder
            'beta': 1.1,   # Placeholder
            'sharpeRatio': sharpe_ratio,
            'volatility': volatility
        }
    }
    
    # Calcola drawdown
    max_value = portfolio_values[0]
    drawdown_values = []
    drawdown_periods = []
    current_drawdown = 0
    current_drawdown_start = None
    
    for i, value in enumerate(portfolio_values):
        if value > max_value:
            max_value = value
            # Se usciamo da un drawdown, registriamo il periodo
            if current_drawdown_start is not None:
                drawdown_periods.append({
                    'start': current_drawdown_start,
                    'end': i - 1,
                    'duration': i - current_drawdown_start,
                    'depth': current_drawdown
                })
                current_drawdown_start = None
                current_drawdown = 0
        
        # Calcola il drawdown corrente
        if max_value > 0:
            dd = (value - max_value) / max_value * 100  # Sarà negativo
        else:
            dd = 0
        
        # Se iniziamo un nuovo drawdown
        if dd < 0 and current_drawdown_start is None:
            current_drawdown_start = i
            current_drawdown = dd
        # Se siamo in un drawdown e questo è più profondo
        elif dd < 0 and dd < current_drawdown:
            current_drawdown = dd
        
        drawdown_values.append(dd)
    
    # Completa l'ultimo periodo di drawdown se necessario
    if current_drawdown_start is not None:
        drawdown_periods.append({
            'start': current_drawdown_start,
            'end': len(portfolio_values) - 1,
            'duration': len(portfolio_values) - current_drawdown_start,
            'depth': current_drawdown
        })
    
    # Calcola le metriche di drawdown
    max_drawdown = min(drawdown_values) if drawdown_values else 0
    avg_drawdown_duration = sum([period['duration'] for period in drawdown_periods]) / len(drawdown_periods) if drawdown_periods else 0
    current_drawdown_value = drawdown_values[-1] if drawdown_values else 0
    
    drawdown_data = {
        'dates': all_data['dates'],
        'drawdownValues': drawdown_values,
        'metrics': {
            'maxDrawdown': max_drawdown,
            'avgDrawdownDuration': avg_drawdown_duration,
            'avgRecoveryTime': 0,  # Placeholder
            'currentDrawdown': current_drawdown_value
        }
    }
    
    # Calcola allocazione
    asset_names = []
    allocations = []
    total_value = portfolio_values[-1]  # Valore totale attuale
    
    # Calcola la percentuale di allocazione per ogni asset
    for symbol, asset_data in all_data['assetReturns'].items():
        asset_value = asset_data['values'][-1] if asset_data['values'] else 0
        if asset_value > 0:
            for asset in portfolio['assets']:
                if asset['symbol'] == symbol:
                    asset_name = asset['name']
                    break
            else:
                asset_name = symbol
            
            asset_names.append(asset_name)
            allocation_percentage = (asset_value / total_value * 100) if total_value > 0 else 0
            allocations.append(allocation_percentage)
    
    allocation_data = {
        'assets': asset_names,
        'allocations': allocations
    }
    
    # Risk/Return data
    asset_names = []
    asset_returns = []
    asset_risks = []
    
    for symbol, asset_data in all_data['assetReturns'].items():
        if 'returns' in asset_data and asset_data['returns']:
            for asset in portfolio['assets']:
                if asset['symbol'] == symbol:
                    asset_name = asset['name']
                    break
            else:
                asset_name = symbol
            
            asset_names.append(asset_name)
            
            # Calcola il rendimento annualizzato
            asset_return = np.mean(asset_data['returns']) * 252 * 100  # In percentuale
            
            # Calcola la volatilità annualizzata
            asset_risk = np.std(asset_data['returns']) * np.sqrt(252) * 100  # In percentuale
            
            asset_returns.append(asset_return)
            asset_risks.append(asset_risk)
    
    risk_return_data = {
        'assets': asset_names,
        'returns': asset_returns,
        'risks': asset_risks,
        'portfolioReturn': annualized_return,
        'portfolioRisk': volatility
    }
    
    # Distribuzione dei rendimenti
    if daily_returns:
        # Usa il metodo di Freedman-Diaconis per determinare la larghezza del bin
        q75, q25 = np.percentile(daily_returns, [75, 25])
        iqr = q75 - q25
        bin_width = 2 * iqr * (len(daily_returns) ** (-1/3)) if iqr > 0 else 0.5
        
        # Limita il numero di bin tra 5 e 20
        num_bins = min(max(int((max(daily_returns) - min(daily_returns)) / bin_width), 5), 20)
        
        # Crea bins e calcola le frequenze
        hist, bin_edges = np.histogram(daily_returns, bins=num_bins)
        
        # Crea le etichette per i bins
        bin_labels = []
        for i in range(len(bin_edges) - 1):
            bin_labels.append(f"{bin_edges[i]:.2f} a {bin_edges[i+1]:.2f}")
        
        returns_distribution = {
            'bins': bin_labels,
            'frequencies': hist.tolist()
        }
    else:
        returns_distribution = {
            'bins': [],
            'frequencies': []
        }
    
    # Correlazione
    asset_names = []
    correlation_matrix = []
    correlation_values = []
    
    # Raccogli tutti i dati di rendimento per gli asset
    assets_with_returns = {}
    for symbol, asset_data in all_data['assetReturns'].items():
        if 'returns' in asset_data and len(asset_data['returns']) > 1:
            for asset in portfolio['assets']:
                if asset['symbol'] == symbol:
                    asset_name = asset['name']
                    break
            else:
                asset_name = symbol
            
            asset_names.append(asset_name)
            assets_with_returns[asset_name] = asset_data['returns']
    
    # Calcola la matrice di correlazione se ci sono abbastanza dati
    if len(assets_with_returns) > 1:
        # Assicurati che tutti gli array abbiano la stessa lunghezza
        min_length = min(len(returns) for returns in assets_with_returns.values())
        
        # Crea un DataFrame con i rendimenti
        returns_data = {}
        for name, returns in assets_with_returns.items():
            returns_data[name] = returns[:min_length]
        
        df = pd.DataFrame(returns_data)
        corr_matrix = df.corr().values.tolist()
        
        # Converti la matrice in un formato adatto per il grafico
        for i, row_name in enumerate(asset_names):
            correlation_matrix.append([])
            for j, col_name in enumerate(asset_names):
                correlation_matrix[i].append(corr_matrix[i][j])
                correlation_values.append({
                    'x': row_name,
                    'y': col_name,
                    'v': corr_matrix[i][j]
                })
    
    correlation_data = {
        'labels': asset_names,
        'correlationMatrix': correlation_matrix,
        'correlationValues': correlation_values
    }
    
    # Crea l'oggetto completo con tutti i dati
    full_data = {
        'performance': performance_data,
        'drawdown': drawdown_data,
        'allocation': allocation_data,
        'riskReturn': risk_return_data,
        'returnsDistribution': returns_distribution,
        'correlation': correlation_data
    }
    
    # Salva nella cache
    cache_result(portfolio_id, period, 'full_analysis', full_data)
    
    return jsonify(full_data)

@app.route('/api/benchmark/<symbol>')
def get_benchmark_data(symbol):
    period = request.args.get('period', '1m')
    portfolio_id = request.args.get('portfolio_id')
    
    # Ottieni le date di inizio e fine
    end_date = datetime.now()
    
    # Determinare la data di inizio in base al periodo
    if period == '1m':
        start_date = end_date - timedelta(days=35)
    elif period == '3m':
        start_date = end_date - timedelta(days=100)
    elif period == '6m':
        start_date = end_date - timedelta(days=190)
    elif period == 'ytd':
        start_date = datetime(end_date.year, 1, 1)
    elif period == '1y':
        start_date = end_date - timedelta(days=380)
    else:  # 'all'
        start_date = end_date - timedelta(days=1900)
    
    try:
        # Ottieni i dati storici usando yfinance
        ticker = yf.Ticker(symbol)
        hist = ticker.history(start=start_date, end=end_date)
        
        if hist.empty:
            return jsonify({'error': 'Dati non disponibili per questo benchmark'}), 404
        
        # Normalizza i dati per il confronto
        initial_investment = 10000
        first_value = hist['Close'].iloc[0]
        normalized_values = [(value / first_value) * initial_investment for value in hist['Close']]
        dates = hist.index.strftime('%Y-%m-%d').tolist()
        
        return jsonify({
            'symbol': symbol,
            'name': ticker.info.get('shortName', symbol),
            'values': normalized_values,
            'dates': dates,
            'initial_investment': initial_investment,
            'return_percentage': ((hist['Close'].iloc[-1] / first_value) - 1) * 100
        })
    except Exception as e:
        print(f"Errore nel caricamento del benchmark {symbol}: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/portfolios/<portfolio_id>/stress-test')
def portfolio_stress_test(portfolio_id):
    if 'username' not in session:
        return redirect(url_for('home'))
    
    username = session['username']
    if portfolio_id not in users[username]['portfolios']:
        flash('Portfolio non trovato', 'error')
        return redirect(url_for('portfolios'))
    
    portfolio = users[username]['portfolios'][portfolio_id]
    return render_template('portfolio_stress_test.html', portfolio=portfolio, portfolio_id=portfolio_id)

@app.route('/api/portfolios/<portfolio_id>/stress-test', methods=['POST'])
def run_stress_test(portfolio_id):
    if 'username' not in session:
        return jsonify({'error': 'Non autorizzato'}), 401
    
    username = session['username']
    if portfolio_id not in users[username]['portfolios']:
        return jsonify({'error': 'Portfolio non trovato'}), 404
    
    portfolio = users[username]['portfolios'][portfolio_id]
    
    # Ottieni i parametri dello stress test
    data = request.json
    scenario = data.get('scenario', 'custom')
    
    # Valore attuale del portafoglio
    current_value = 0
    asset_values = {}
    
    for asset in portfolio['assets']:
        # Calcola la quantità netta posseduta
        net_quantity = 0
        for transaction in asset['transactions']:
            if transaction['type'] == 'buy':
                net_quantity += transaction['quantity']
            else:  # sell
                net_quantity -= transaction['quantity']
        
        # Calcola il valore attuale
        asset_value = net_quantity * asset.get('current_price', 0)
        current_value += asset_value
        
        # Salva il valore per asset per uso futuro
        asset_values[asset['symbol']] = {
            'name': asset['name'],
            'value': asset_value,
            'quantity': net_quantity,
            'price': asset.get('current_price', 0),
            'type': asset.get('type', 'Unknown')
        }
    
    # Definisci gli scenari predefiniti
    scenarios = {
        'crisis_2008': {
            'name': 'Crisi Finanziaria 2008',
            'description': 'Simulazione della crisi finanziaria del 2008-2009 con crollo dei mercati azionari.',
            'impacts': {
                'Equity': -0.38,      # -38% azionario
                'Bond': 0.05,         # +5% obbligazionario (flight to quality)
                'Commodity': -0.30,   # -30% commodities
                'RealEstate': -0.35,  # -35% immobiliare
                'Cash': 0.0,          # 0% liquidità
                'Crypto': -0.60,      # -60% crypto (ipotetico)
                'Default': -0.30      # -30% default per asset non categorizzati
            }
        },
        'inflation_shock': {
            'name': 'Shock Inflazionistico',
            'description': 'Scenario di alta inflazione con aumento aggressivo dei tassi di interesse.',
            'impacts': {
                'Equity': -0.15,      # -15% azionario
                'Bond': -0.20,        # -20% obbligazionario (a causa dell'aumento dei tassi)
                'Commodity': 0.25,    # +25% commodities
                'RealEstate': -0.10,  # -10% immobiliare
                'Cash': -0.08,        # -8% liquidità (erosione del potere d'acquisto)
                'Crypto': -0.25,      # -25% crypto
                'Default': -0.15      # -15% default
            }
        },
        'tech_bubble': {
            'name': 'Scoppio Bolla Tecnologica',
            'description': 'Simulazione di uno scoppio di una bolla nel settore tecnologico.',
            'impacts': {
                'Equity': -0.25,      # -25% azionario generale
                'Technology': -0.50,  # -50% tech
                'Bond': 0.05,         # +5% obbligazionario
                'Commodity': -0.05,   # -5% commodities
                'RealEstate': -0.10,  # -10% immobiliare
                'Cash': 0.0,          # 0% liquidità
                'Crypto': -0.40,      # -40% crypto
                'Default': -0.20      # -20% default
            }
        },
        'recession': {
            'name': 'Recessione Economica',
            'description': 'Scenario di recessione economica globale moderata.',
            'impacts': {
                'Equity': -0.20,      # -20% azionario
                'Bond': -0.05,        # -5% obbligazionario
                'Commodity': -0.15,   # -15% commodities
                'RealEstate': -0.15,  # -15% immobiliare
                'Cash': 0.0,          # 0% liquidità
                'Crypto': -0.30,      # -30% crypto
                'Default': -0.15      # -15% default
            }
        },
        'custom': {
            'name': 'Scenario Personalizzato',
            'description': 'Scenario personalizzato definito dall\'utente.',
            'impacts': data.get('impacts', {
                'Equity': -0.20,
                'Bond': -0.10,
                'Commodity': -0.15,
                'RealEstate': -0.15,
                'Cash': 0.0,
                'Crypto': -0.25,
                'Default': -0.15
            })
        }
    }
    
    # Ottieni lo scenario selezionato
    selected_scenario = scenarios.get(scenario, scenarios['custom'])
    
    # Mappa gli asset ai tipi per applicare gli impatti corretti
    asset_types_mapping = {
        'stock': 'Equity',
        'etf': 'Equity',  # Assumiamo ETF azionari come default
        'bond': 'Bond',
        'commodity': 'Commodity',
        'realestate': 'RealEstate',
        'cash': 'Cash',
        'crypto': 'Crypto'
    }
    
    # Specifici ETF o asset che necessitano di una mappatura speciale
    special_mapping = {
        'BTC-USD': 'Crypto',
        'ETH-USD': 'Crypto',
        'GLD': 'Commodity',
        'IAU': 'Commodity',
        'SLV': 'Commodity',
        'VNQ': 'RealEstate',
        'IYR': 'RealEstate',
        'AGG': 'Bond',
        'BND': 'Bond',
        'TLT': 'Bond',
        'SHY': 'Bond'
    }
    
    # Calcola l'impatto dello scenario
    stressed_values = {}
    total_stressed_value = 0
    impact_by_asset = {}
    
    for symbol, asset_data in asset_values.items():
        # Determina il tipo di asset per l'impatto
        asset_type = asset_data.get('type', '').lower()
        mapped_type = asset_types_mapping.get(asset_type, 'Default')
        
        # Controlla per mappature speciali
        if symbol in special_mapping:
            mapped_type = special_mapping[symbol]
        elif 'bond' in asset_data['name'].lower() or 'treasury' in asset_data['name'].lower():
            mapped_type = 'Bond'
        elif 'gold' in asset_data['name'].lower() or 'silver' in asset_data['name'].lower():
            mapped_type = 'Commodity'
        elif 'tech' in asset_data['name'].lower() or 'technology' in asset_data['name'].lower():
            mapped_type = 'Technology'
        
        # Ottieni l'impatto percentuale
        impact_pct = selected_scenario['impacts'].get(mapped_type, selected_scenario['impacts']['Default'])
        
        # Calcola il nuovo valore
        new_value = asset_data['value'] * (1 + impact_pct)
        stressed_values[symbol] = new_value
        total_stressed_value += new_value
        
        # Salva l'impatto per visualizzazione
        impact_by_asset[asset_data['name']] = {
            'original_value': asset_data['value'],
            'stressed_value': new_value,
            'impact_pct': impact_pct * 100,  # Converti in percentuale
            'absolute_impact': new_value - asset_data['value'],
            'type': mapped_type
        }
    
    # Calcola la perdita totale
    total_loss = total_stressed_value - current_value
    percentage_loss = (total_loss / current_value) * 100 if current_value > 0 else 0
    
    result = {
        'scenario': selected_scenario['name'],
        'description': selected_scenario['description'],
        'current_value': current_value,
        'stressed_value': total_stressed_value,
        'absolute_impact': total_loss,
        'percentage_impact': percentage_loss,
        'impact_by_asset': impact_by_asset
    }
    
    return jsonify(result)


@app.route('/portfolios/<portfolio_id>/assets/<symbol>/import_csv', methods=['POST'])
def import_csv_transactions(portfolio_id, symbol):
    if 'username' not in session:
        return jsonify({'error': 'Non autorizzato'}), 401
    
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
    
    # Controlla se è stato inviato un file
    if 'csvFile' not in request.files:
        flash('Nessun file selezionato', 'error')
        return redirect(url_for('portfolio_detail', portfolio_id=portfolio_id))
    
    file = request.files['csvFile']
    
    if file.filename == '':
        flash('Nessun file selezionato', 'error')
        return redirect(url_for('portfolio_detail', portfolio_id=portfolio_id))
    
    if not file.filename.endswith('.csv'):
        flash('Il file deve essere in formato CSV', 'error')
        return redirect(url_for('portfolio_detail', portfolio_id=portfolio_id))
    
    # Determina il separatore
    separator = ',' if request.form.get('separator') == 'comma' else ';'
    
    # Determina il formato della data
    date_format = '%Y-%m-%d' if request.form.get('date_format') == 'iso' else '%d/%m/%Y'
    
    try:
        # Leggi il file CSV
        stream = io.StringIO(file.stream.read().decode("UTF8"), newline='')
        csv_reader = csv.DictReader(stream, delimiter=separator)
        
        # Verifica che le colonne richieste siano presenti
        required_fields = ['date', 'type', 'quantity', 'price']
        
        # Ottieni i nomi delle colonne dal reader (adattando i nomi se necessario)
        fieldnames = [field.strip().lower() for field in csv_reader.fieldnames]
        
        # Crea una mappatura per i nomi delle colonne
        field_mapping = {}
        for req_field in required_fields:
            # Cerca corrispondenze esatte o parziali
            if req_field in fieldnames:
                field_mapping[req_field] = req_field
            else:
                # Cerca corrispondenze parziali (es. "Data" per "date")
                for field in fieldnames:
                    if req_field in field or field in req_field:
                        field_mapping[req_field] = field
                        break
        
        # Verifica che tutte le colonne richieste siano mappate
        missing_fields = [field for field in required_fields if field not in field_mapping]
        if missing_fields:
            flash(f"Colonne mancanti nel CSV: {', '.join(missing_fields)}", 'error')
            return redirect(url_for('portfolio_detail', portfolio_id=portfolio_id))
        
        # Elabora le righe
        imported_count = 0
        errors = []
        
        # Reset the stream
        stream.seek(0)
        next(csv_reader)  # Skip header
        
        for i, row in enumerate(csv_reader, start=2):  # Start from 2 to account for header
            try:
                # Usa la mappatura per ottenere i valori corretti
                date_str = row[field_mapping['date']].strip()
                type_str = row[field_mapping['type']].strip().lower()
                quantity_str = row[field_mapping['quantity']].strip().replace(',', '.')
                price_str = row[field_mapping['price']].strip().replace(',', '.')
                
                # Opzionali
                fee_str = row.get(field_mapping.get('fee', 'fee'), '0').strip().replace(',', '.')
                notes = row.get(field_mapping.get('notes', 'notes'), '').strip()
                
                # Convalida e conversione dei dati
                # Data
                try:
                    date_obj = datetime.strptime(date_str, date_format)
                    date_formatted = date_obj.strftime('%Y-%m-%d')
                except ValueError:
                    errors.append(f"Riga {i}: Formato data non valido '{date_str}'")
                    continue
                
                # Tipo
                if type_str not in ['buy', 'sell', 'acquisto', 'vendita']:
                    errors.append(f"Riga {i}: Tipo non valido '{type_str}'. Deve essere 'buy' o 'sell'")
                    continue
                
                # Converti 'acquisto'/'vendita' in 'buy'/'sell'
                if type_str == 'acquisto':
                    type_str = 'buy'
                elif type_str == 'vendita':
                    type_str = 'sell'
                
                # Quantità
                try:
                    quantity = float(quantity_str)
                    if quantity <= 0:
                        errors.append(f"Riga {i}: La quantità deve essere maggiore di zero")
                        continue
                except ValueError:
                    errors.append(f"Riga {i}: Quantità non valida '{quantity_str}'")
                    continue
                
                # Prezzo
                try:
                    price = float(price_str)
                    if price < 0:
                        errors.append(f"Riga {i}: Il prezzo non può essere negativo")
                        continue
                except ValueError:
                    errors.append(f"Riga {i}: Prezzo non valido '{price_str}'")
                    continue
                
                # Commissione (opzionale)
                fee = 0.0
                if fee_str:
                    try:
                        fee = float(fee_str)
                        if fee < 0:
                            errors.append(f"Riga {i}: La commissione non può essere negativa")
                            continue
                    except ValueError:
                        errors.append(f"Riga {i}: Commissione non valida '{fee_str}'")
                        continue
                
                # Aggiungi la transazione
                asset['transactions'].append({
                    'date': date_formatted,
                    'type': type_str,
                    'quantity': quantity,
                    'price': price,
                    'fee': fee,
                    'notes': notes
                })
                
                imported_count += 1
                
            except Exception as e:
                errors.append(f"Riga {i}: Errore generico - {str(e)}")
        
        # Salva le modifiche
        save_users(users)
        
        # Cancella la cache
        clear_portfolio_cache(portfolio_id)
        
        # Messaggi di successo/errore
        if imported_count > 0:
            flash(f"Importate con successo {imported_count} transazioni", 'success')
        
        if errors:
            error_message = "Errori durante l'importazione:<br>" + "<br>".join(errors[:10])
            if len(errors) > 10:
                error_message += f"<br>...e altri {len(errors) - 10} errori"
            flash(error_message, 'error')
        
        return redirect(url_for('portfolio_detail', portfolio_id=portfolio_id))
        
    except Exception as e:
        flash(f"Errore nell'elaborazione del file CSV: {str(e)}", 'error')
        return redirect(url_for('portfolio_detail', portfolio_id=portfolio_id))    


if __name__ == '__main__':
    app.run(debug=True, port=5001)  # Usa la porta 5001 invece della 5000