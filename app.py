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

# Route zum Abrufen der Daten
@app.route('/get_data', methods=['POST'])
def get_data():
    data = request.json
    query_parts = []

    # Baue die Abfrage basierend auf den ausgewählten Feldern
    if data['orders'] != 'None':
        query_parts.append(f"SELECT {data['orders']} FROM Orders")
    if data['customers'] != 'None':
        query_parts.append(f"SELECT {data['customers']} FROM Customers")
    if data['orderItems'] != 'None':
        query_parts.append(f"SELECT {data['orderItems']} FROM Orderitems")
    if data['products'] != 'None':
        query_parts.append(f"SELECT {data['products']} FROM Products")
    if data['stores'] != 'None':
        query_parts.append(f"SELECT {data['stores']} FROM Stores")

    # Verknüpfe die Abfragen mit UNION ALL (oder einer anderen geeigneten Methode)
    query = " UNION ALL ".join(query_parts)

    # Führe die Abfrage aus und sammle die Daten
    connection = get_db_connection()
    cursor = connection.cursor()
    cursor.execute(query)
    result = cursor.fetchall()
    cursor.close()
    connection.close()

    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True)
