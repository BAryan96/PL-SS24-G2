from flask import Flask, render_template, request, jsonify
import mariadb
from flask_caching import Cache

app = Flask(__name__)

# Konfiguration des Caches
app.config['CACHE_TYPE'] = 'RedisCache'
app.config['CACHE_REDIS_HOST'] = 'localhost'
app.config['CACHE_REDIS_PORT'] = 6379
app.config['CACHE_REDIS_DB'] = 0
app.config['CACHE_REDIS_URL'] = 'redis://localhost:6379/0'
app.config['CACHE_DEFAULT_TIMEOUT'] = 300  # Cache timeout in seconds

cache = Cache(app)

def get_db_connection():
    return mariadb.connect(
        user="root",
        password="123",
        host="localhost",
        port=3306,
        database="pizzag2"
    )

@app.route("/")
def landingpage():
    return render_template('landingpage.html')

@app.route("/login")
def login():
    return render_template('login.html')

@app.route("/charts")
def charts():
    return render_template('charts.html')

@app.route("/stackedchart")
def stackedchart():
    return render_template('stackedchart.html')

@app.route("/largescalechart")
def largescalechart():
    return render_template('largescalechart.html')

@app.route("/donutchart")
def donutchart():
    return render_template('donutchart.html')

@app.route("/basicscatterchart")
def basicscatterchart():
    return render_template('basicscatterchart.html')

@app.route("/morphingmap")
def morphingmap():
    return render_template('morphingmap.html')

@app.route("/basicbarchart")
def basicbarchart():
    return render_template('basicbarchart.html')

@app.route("/heatmap")
def heatmap():
    return render_template('heatmap.html')

@cache.cached(timeout=300, query_string=True)
@app.route('/get_data', methods=['POST'])
def get_data():
    try:
        data = request.json
        if not data:
            print("No JSON data received")
            return jsonify({'error': 'No JSON data received'}), 400

        xAxis = data.get('xAxis')
        yAxis = data.get('yAxis')

        if not xAxis or not yAxis or xAxis == 'None' or yAxis == 'None':
            print("Missing xAxis or yAxis selection")
            return jsonify({'error': 'Please select both xAxis and yAxis fields'}), 400

        # Extrahiere Tabellen- und Spaltennamen
        try:
            xTable, xColumn = xAxis.split('.')
            yTable, yColumn = yAxis.split('.')
        except ValueError as e:
            print(f"Error splitting xAxis or yAxis: {e}")
            return jsonify({'error': 'Invalid xAxis or yAxis format'}), 400

        # Debugging-Ausgaben
        print(f"xAxis: {xAxis}, yAxis: {yAxis}")
        print(f"xTable: {xTable}, xColumn: {xColumn}")
        print(f"yTable: {yTable}, yColumn: {yColumn}")

        # Bestimme die Verknüpfungsbedingung basierend auf den Tabellenstrukturen
        join_condition = ""
        if xTable == 'orders' and yTable == 'customers':
            join_condition = "orders.customerID = customers.customerID"
        elif xTable == 'orders' and yTable == 'stores':
            join_condition = "orders.storeID = stores.storeID"
        elif xTable == 'orderitems' and yTable == 'orders':
            join_condition = "orderitems.orderID = orders.orderID"
        elif xTable == 'orderitems' and yTable == 'products':
            join_condition = "orderitems.SKU = products.SKU"
        else:
            print("Unsupported table combination")
            return jsonify({'error': 'Unsupported table combination'}), 400

        # SQL-Abfrage mit Gruppierung und Aggregation, begrenzt auf 5 Datensätze
        query = f"""
        SELECT {xTable}.{xColumn} AS xValue, SUM({yTable}.{yColumn}) AS yValue
        FROM {xTable}
        JOIN {yTable} ON {join_condition}
        GROUP BY {xTable}.{xColumn}
        ORDER BY yValue DESC
        LIMIT 5
        """

        print(f"Executing query: {query}")

        conn = get_db_connection()
        cursor = conn.cursor()

        try:
            cursor.execute(query)
            result = cursor.fetchall()
        except mariadb.ProgrammingError as e:
            print(f"SQL error: {e}")
            return jsonify({'error': str(e)}), 400
        finally:
            cursor.close()
            conn.close()

        response = [{'xValue': row[0], 'yValue': row[1]} for row in result]
        print(f"Query result: {response}")
        return jsonify(response)
    except Exception as e:
        print(f"Unexpected error: {e}")
        return jsonify({'error': str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)
