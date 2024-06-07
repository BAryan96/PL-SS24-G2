from flask import Flask, render_template, request, jsonify, send_from_directory
from DB import connect_to_database, get_cursor

app = Flask(__name__)
conn = connect_to_database()
cur = get_cursor(conn)

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

@app.route("/map")
def morphingmap():
    return render_template('map.html')

@app.route("/basicbarchart")
def basicbarchart():
    return render_template('basicbarcharttest.html')

@app.route("/heatmap")
def heatmap():
    return render_template('heatmap.html')

@app.route('/static/data/USA.json')
def serve_usa_json():
    return send_from_directory('static/data', 'USA.json')

#wichtig 
@app.route("/tables")
def get_tables():
    cur.execute("SHOW TABLES")
    tables = [row[0] for row in cur.fetchall()]
    return jsonify({"tables": tables})


#wichtig
@app.route("/columns", methods=["POST"])
def get_columns():
    table = request.form['table']
    cur.execute(f"SHOW COLUMNS FROM {table}")
    columns = [row[0] for row in cur.fetchall()]
    return jsonify({"columns": columns})

@app.route("/getdata", methods=["POST"])
def get_data():
    if not request.is_json:
        return jsonify({"error": "Request data must be JSON"}), 415

    data = request.get_json()
    print("Received JSON data:", data)

    # Check for required fields
    required_fields = ['tables', 'columns', 'chartType', 'aggregations']
    missing_fields = [field for field in required_fields if field not in data]

    if missing_fields:
        return jsonify({"error": f"Missing required fields: {', '.join(missing_fields)}"}), 400

    tables = data['tables']
    columns = data['columns']
    chart_type = data['chartType']
    aggregations = data['aggregations']
    filters = data.get('filters', [])

    if not isinstance(tables, list) or not isinstance(columns, list) or not isinstance(aggregations, list):
        return jsonify({"error": "Tables, columns, and aggregations must be lists"}), 400

    if len(aggregations) < len(columns):
        aggregations.extend([""] * (len(columns) - len(aggregations)))

    if len(columns) < len(aggregations):
        return jsonify({"error": "The length of aggregations cannot be greater than the length of columns"}), 400

    joins = {
        ('products', 'order_items'): ('SKU', 'SKU'),
        ('order_items', 'orders'): ('orderID', 'orderID'),
        ('orders', 'customers'): ('customerID', 'customerID'),
        ('orders', 'stores'): ('storeID', 'storeID'),
    }

    aggregation_functions = {
        "Summe": "SUM",
        "Max": "MAX",
        "Min": "MIN",
        "Anzahl": "COUNT",
        "Diskrete Anzahl": "COUNT(DISTINCT",
        "Durchschnitt": "AVG",
        "Varianz": "VARIANCE",
        "Standardabweichung": "STDDEV",
        "Median": "PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY",
        "Erstes Quartil": "PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY",
        "Drittes Quartil": "PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY"
    }

    # Construct filter query
    filter_query = ""
    if filters:
        chart_filters = {}
        for filter in filters:
            chart_id = filter.get('chartId')
            if chart_id not in chart_filters:
                chart_filters[chart_id] = []
            chart_filters[chart_id].append(filter)

        filter_clauses = []
        for chart_id, chart_filter_list in chart_filters.items():
            if len(chart_filter_list) == 1:
                filter = chart_filter_list[0]
                filter_table = filter.get('filterTable')
                filter_column = filter.get('filterColumn')
                filter_value = filter.get('filterValue')
                if not filter_table or not filter_column or filter_value is None:
                    return jsonify({"error": "Each filter must have filterTable, filterColumn, and filterValue"}), 400
                filter_clauses.append(f"{filter_table}.{filter_column} = '{filter_value}'")
            else:
                or_clauses = []
                for filter in chart_filter_list:
                    filter_table = filter.get('filterTable')
                    filter_column = filter.get('filterColumn')
                    filter_value = filter.get('filterValue')
                    if not filter_table or not filter_column or filter_value is None:
                        return jsonify({"error": "Each filter must have filterTable, filterColumn, and filterValue"}), 400
                    or_clauses.append(f"{filter_table}.{filter_column} = '{filter_value}'")
                filter_clauses.append(f"({' OR '.join(or_clauses)})")

        if filter_clauses:
            filter_query = " WHERE " + " AND ".join(filter_clauses)

    # Ensure that the filter table is in the tables list
    for filter in filters:
        filter_table = filter['filterTable']
        if filter_table not in tables:
            tables.append(filter_table)
            columns.append('')
            aggregations.append('')

    # Remove duplicate table names
    unique_tables = []
    for table in tables:
        if table not in unique_tables:
            unique_tables.append(table)

    # Generate join conditions
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
            from_clause = table1  # Only keep the first table in the FROM clause if the tables are the same

    join_query = " ".join(join_conditions)

    # Construct the select clause
    select_columns = []
    has_aggregation = False  # Flag to check if any aggregation is present

    # Iterate over all tables, columns, and aggregations
    for table, col, agg in zip(tables, columns, aggregations):
        if col:
            full_column_name = f"{table}.{col}"
            aggregation_function = aggregation_functions.get(agg, "")
            if not aggregation_function:
                if agg == "":
                    select_columns.append(full_column_name)  # No aggregation
                else:
                    return jsonify({"error": f"Unsupported aggregation type: {agg}"}), 400
            else:
                has_aggregation = True  # Set the flag if there is any aggregation
                if agg in ["Diskrete Anzahl", "Median", "Erstes Quartil", "Drittes Quartil"]:
                    select_columns.append(f"{aggregation_function} {full_column_name}) AS {col}_{agg}")
                else:
                    select_columns.append(f"{aggregation_function}({full_column_name}) AS {col}_{agg}")

    # Ensure every column is included
    if not all(columns):
        return jsonify({"error": "Each table must have at least one column specified"}), 400

    select_query = ", ".join(select_columns)

    # Only create group_by_columns if there is an aggregation
    group_by_query = ""
    if has_aggregation:
        group_by_columns = [f"{table}.{column}" for table, column, agg in zip(tables, columns, aggregations) if column and not aggregation_functions.get(agg, "")]
        group_by_query = ", ".join(group_by_columns)

    # Construct the final SQL query
    query = f"""
    SELECT {select_query}
    FROM {from_clause}
    {join_query}
    {filter_query}
    """

    if group_by_query:
        query += f" GROUP BY {group_by_query}"

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
