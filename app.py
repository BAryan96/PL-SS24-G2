from flask import Flask, render_template, request, jsonify, send_from_directory
from DB import connect_to_database, get_cursor

app = Flask(__name__)
conn = connect_to_database()
cur = get_cursor(conn)

#@app.route("//")
#def test():
#    return render_template('test.html')

@app.route("/")
def landingpage():
    return render_template('landingpage.html')

@app.route("/index")
def index():
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
    return render_template('basicbarcharttest.html')

@app.route("/heatmap")
def heatmap():
    return render_template('heatmap.html')

#wichtig 
@app.route("/tables")
def get_tables():
    cur.execute("SHOW TABLES")
    tables = [row[0] for row in cur.fetchall()]
    return jsonify({"tables": tables})

#wichtig
@app.route("/columns", methods=["POST"])
def get_columns():
    data = request.get_json()
    table = data.get('table')
    if not table:
        return jsonify({"error": "No table provided"}), 400

    cur.execute(f"SHOW COLUMNS FROM {table}")
    columns = [row[0] for row in cur.fetchall()]
    return jsonify({"columns": columns})

@app.route("/getdata", methods=["POST"])
def get_data():
    if not request.is_json:
        return jsonify({"error": "Request data must be JSON"}), 415

    data = request.get_json()
    print("Received JSON data:", data)

    tables = data.get('tables', [])
    columns = data.get('columns', [])
    chart_type = data.get('chartType')
    aggregation_type = data.get('aggregationType', '')

    if not tables or not columns or not chart_type:
        return jsonify({"error": "Missing required fields"}), 400

    filters = data.get('filters', [])

    joins = {
        ('products', 'order_items'): ('SKU', 'SKU'),
        ('order_items', 'orders'): ('orderID', 'orderID'),
        ('orders', 'customers'): ('customerID', 'customerID'),
        ('orders', 'stores'): ('storeID', 'storeID'),
    }

    if aggregation_type == "Summe":
        aggregation_function = "SUM("
    elif aggregation_type == "Max":
        aggregation_function = "MAX("
    elif aggregation_type == "Min":
        aggregation_function = "MIN("
    elif aggregation_type == "Anzahl":
        aggregation_function = "COUNT("
    elif aggregation_type == "Diskrete Anzahl":
        aggregation_function = "COUNT(DISTINCT "
    else:
        aggregation_function = None

    filter_query = ""
    if filters:
        filter_clauses = []
        for filter in filters:
            filter_table = filter['filterTable']
            filter_column = filter['filterColumn']
            filter_value = filter['filterValue']
            filter_clauses.append(f"{filter_table}.{filter_column} = '{filter_value}'")
        filter_query = " WHERE " + " OR ".join(filter_clauses)

    # Sicherstellen, dass die Filtertabelle in den Tabellen enthalten ist
    for filter in filters:
        filter_table = filter['filterTable']
        if filter_table not in tables:
            tables.append(filter_table)
            columns.append('')

    # Entfernen doppelter Tabellennamen
    unique_tables = []
    for table in tables:
        if table not in unique_tables:
            unique_tables.append(table)

    # Generierung der Join-Bedingungen
    join_conditions = []
    from_clause = unique_tables[0]
    for i in range(1, len(unique_tables)):
        table1, table2 = unique_tables[i - 1], unique_tables[i]
        if table1 != table2:
            if (table1, table2) in joins:
                join_column1, join_column2 = joins[(table1, table2)]
                join_conditions.append(f"JOIN {table2} ON {table1}.{join_column1} = {table2}.{join_column2}")
            elif (table2, table1) in joins:
                join_column1, join_column2 = joins[(table2, table1)]
                join_conditions.append(f"JOIN {table2} ON {table1}.{join_column2} = {table2}.{join_column1}")
            else:
                return jsonify({"error": f"No valid join path found between {table1} and {table2}"}), 400
        else:
            from_clause = table1  # Nur die erste Tabelle in der FROM-Klausel behalten, wenn die Tabellen gleich sind

    join_query = " ".join(join_conditions)

    if aggregation_function:
        select_columns = f"{columns[0]}, {aggregation_function}{columns[1]})"
        group_by = f"GROUP BY {columns[0]}"
    else:
        select_columns = ", ".join([f"{table}.{column}" for table, column in zip(tables, columns) if column])
        group_by = f"GROUP BY {', '.join([f'{table}.{column}' for table, column in zip(tables, columns) if column])}"

    query = f"""
    SELECT {select_columns}
    FROM {from_clause}
    {join_query}
    {filter_query}
    {group_by}
    """

    print("Generated SQL Query:", query)
    cur.execute(query)
    data = cur.fetchall()

    response = {
        "chartType": chart_type
    }

    for idx, col in enumerate(columns):
        if col:
            response[f"data{chr(88 + idx)}"] = [row[idx] for row in data]

    print(response)
    return jsonify(response)


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


#wichtig für heatmap, weitere relationen hinzufügen -> Aryan: Kann Raus
@app.route("/store-orders", methods=["GET"])
def get_store_orders():
    query = """
        SELECT stores.StoreID, COUNT(orders.OrderID) as orderCount
        FROM stores
        JOIN orders ON stores.StoreID = orders.StoreID
        GROUP BY stores.StoreID
    """
    cur.execute(query)
    results = cur.fetchall()
    return jsonify(results)


if __name__ == "__main__":
    app.run(debug=True)


if __name__ == "__main__":
    app.run(debug=True)
