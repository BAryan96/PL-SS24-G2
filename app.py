from flask import Flask, render_template, request, jsonify
import mariadb

app = Flask(__name__)

# Konfiguriere die Verbindung zur Datenbank
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

@app.route('/get_data', methods=['POST'])
def get_data():
    data = request.json
    orders = data.get('orders')
    customers = data.get('customers')
    orderItems = data.get('orderItems')
    products = data.get('products')
    stores = data.get('stores')

    queries = []
    
    if orders != 'None':
        queries.append(f"SELECT `{orders}` AS value, 'orders' AS source FROM Orders")
    if customers != 'None':
        queries.append(f"SELECT `{customers}` AS value, 'customers' AS source FROM Customers")
    if orderItems != 'None':
        queries.append(f"SELECT `{orderItems}` AS value, 'orderItems' AS source FROM OrderItems")
    if products != 'None':
        queries.append(f"SELECT `{products}` AS value, 'products' AS source FROM Products")
    if stores != 'None':
        queries.append(f"SELECT `{stores}` AS value, 'stores' AS source FROM Stores")
    
    if not queries:
        return jsonify([])

    query = " UNION ALL ".join(queries)

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(query)
        result = cursor.fetchall()
    except mariadb.ProgrammingError as e:
        print(f"Error: {e}")
        return jsonify({'error': str(e)}), 400
    finally:
        cursor.close()
        conn.close()

    response = [{'value': row[0], 'source': row[1]} for row in result]
    return jsonify(response)

if __name__ == "__main__":
    app.run(debug=True)