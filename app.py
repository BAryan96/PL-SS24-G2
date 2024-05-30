from flask import Flask, render_template, request, jsonify
from DB import connect_to_database, get_cursor

app = Flask(__name__)
conn = connect_to_database()
cur = get_cursor(conn)

@app.route("/")
def landingpage():
    return render_template('index.html')

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

@app.route("/tables")
def get_tables():
    cur.execute("SHOW TABLES")
    tables = [row[0] for row in cur.fetchall()]
    return jsonify({"tables": tables})

@app.route("/columns", methods=["POST"])
def get_columns():
    table = request.form['table']
    cur.execute(f"SHOW COLUMNS FROM {table}")
    columns = [row[0] for row in cur.fetchall()]
    return jsonify({"columns": columns})


@app.route("/getdata", methods=["POST"])
def get_data():
    table1 = request.form['table1']
    column1 = request.form['column1']
    table2 = request.form['table2']
    column2 = request.form['column2']

    # Erstellung der Joins basierend auf den Tabellenbeziehungen
    joins = {
        ('products', 'order_items'): ('SKU', 'SKU'),
        ('orderitems', 'orders'): ('orderID', 'orderID'),
        ('orders', 'customers'): ('customerID', 'customerID'),
        ('orders', 'stores'): ('storeID', 'storeID'),
    }
    
    # Überprüfen, ob ein direkter Join möglich ist
    if table1 == table2:
        query = f"SELECT {column1}, {column2} FROM {table1}"
    elif (table1, table2) in joins:
        join_column1, join_column2 = joins[(table1, table2)]
        query = f"SELECT t1.{column1}, t2.{column2} FROM {table1} t1 JOIN {table2} t2 ON t1.{join_column1} = t2.{join_column2}"
    elif (table2, table1) in joins:
        join_column1, join_column2 = joins[(table2, table1)]
        query = f"SELECT t1.{column1}, t2.{column2} FROM {table1} t1 JOIN {table2} t2 ON t1.{join_column2} = t2.{join_column1}"
    else:
        # Fixing für JOINS 2 oder 3 Grades
        for (t1, t2), (jc1, jc2) in joins.items():
            if (table1 == t1 and table2 in [k for k, v in joins if v[0] == jc1]) or \
               (table1 == t2 and table2 in [k for k, v in joins if v[1] == jc2]):
                join_column1, join_column2 = joins[(table1, t2 if table1 == t1 else t1)]
                query = f"""
                SELECT t1.{column1}, t2.{column2}
                FROM {table1} t1
                JOIN {t2 if table1 == t1 else t1} t2_inter ON t1.{join_column1} = t2_inter.{jc1}
                JOIN {table2} t2 ON t2_inter.{jc2} = t2.{join_column2}
                """
                break
        else:
            return jsonify({"error": "No valid join path found"}), 400
        

    print("Generated SQL Query:", query)
    cur.execute(query)
    data = cur.fetchall()

    dataX = [row[0] for row in data]
    dataY = [row[1] for row in data]

    return jsonify({"dataX": dataX, "dataY": dataY})

@app.route("/test")
def test():
    return render_template('test.html')

@app.route("/get_table", methods=["POST"])
def get_table():
    data_choice = request.form['data-choice']
    cur.execute(f"SELECT * FROM {data_choice}")
    row_headers = [x[0] for x in cur.description]
    results = cur.fetchall()

    json_data = []
    for result in results:
        json_data.append(dict(zip(row_headers, result)))
    return render_template('index.html', data=json_data)

@app.route("/api/data", methods=["GET"])
def get_relation_data():
    relation = request.args.get('relation')
    if relation == "customer_orders":
        query = """
            SELECT customers.CustomerID, COUNT(orders.OrderID) 
            FROM customers 
            JOIN orders ON customers.CustomerID = orders.CustomerID 
            GROUP BY customers.CustomerID
        """
    elif relation == "product_sales":
        query = """
            SELECT products.Name, COUNT(orderItems.SKU) 
            FROM products 
            JOIN orderItems ON products.SKU = orderItems.SKU 
            GROUP BY products.Name
        """
    elif relation == "store_sales":
        query = """
            SELECT stores.StoreID, COUNT(orders.OrderID) 
            FROM stores 
            JOIN orders ON stores.StoreID = orders.StoreID 
            GROUP BY stores.StoreID
        """
    elif relation == "orderitems":
        query = """
            SELECT orders.OrderID, orderItems.SKU, products.Name 
            FROM orders 
            JOIN orderItems ON orders.OrderID = orderItems.OrderID 
            JOIN products ON orderItems.SKU = products.SKU
        """
    elif relation == "customer_orderitems":
        query = """
            SELECT customers.CustomerID, orders.OrderID, orderItems.SKU, products.Name 
            FROM customers 
            JOIN orders ON customers.CustomerID = orders.CustomerID 
            JOIN orderItems ON orders.OrderID = orderItems.OrderID 
            JOIN products ON orderItems.SKU = products.SKU
        """
    elif relation == "store_orderitems":
        query = """
            SELECT stores.StoreID, orders.OrderID, orderItems.SKU, products.Name 
            FROM stores 
            JOIN orders ON stores.StoreID = orders.StoreID 
            JOIN orderItems ON orders.OrderID = orderItems.OrderID 
            JOIN products ON orderItems.SKU = products.SKU
        """
    else:
        return jsonify({"error": "Invalid relation"}), 400

    cur.execute(query)
    data = cur.fetchall()
    return jsonify(data)

@app.route("/store-orders", methods=["GET"])
def get_store_orders():
    query = """
        SELECT storeID, COUNT(orderID) as orderCount
        FROM orders
        GROUP BY storeID
    """
    cur.execute(query)
    results = cur.fetchall()
    return jsonify(results)

if __name__ == "__main__":
    app.run(debug=True)
