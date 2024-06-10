from flask import Flask, render_template, request, jsonify
from DB import connect_to_database, get_cursor, fetch_data, get_columns
import time

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
    return render_template('basicbarchart.html')

@app.route("/heatmap")
def heatmap():
    return render_template('heatmap.html')

@app.route ("/salesperformancedash")
def salesperformancedash():
    return render_template ('salesperformancedash.html')

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
        "Median": ("SUBSTRING_INDEX(SUBSTRING_INDEX(GROUP_CONCAT({column} ORDER BY {column}), ',', "
               "ROUND(0.5 * COUNT(*) + 0.5)), ',', -1)"),
        "Erstes Quartil": ("SUBSTRING_INDEX(SUBSTRING_INDEX(GROUP_CONCAT({column} ORDER BY {column}), ',', "
                           "ROUND(0.25 * COUNT(*) + 0.5)), ',', -1)"),
        "Drittes Quartil": ("SUBSTRING_INDEX(SUBSTRING_INDEX(GROUP_CONCAT({column} ORDER BY {column}), ',', "
                            "ROUND(0.75 * COUNT(*) + 0.5)), ',', -1)")
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
    group_by_columns = []

    # Iterate over all tables, columns, and aggregations
    for table, col, agg in zip(tables, columns, aggregations):
        if col:
            full_column_name = f"{table}.{col}"
            aggregation_function = aggregation_functions.get(agg, "")
            if not aggregation_function:
                select_columns.append(full_column_name)  # No aggregation
                if agg != "X":
                    group_by_columns.append(full_column_name)  # Add to GROUP BY if no aggregation and not "X"
            else:
                if agg in ["Diskrete Anzahl", "Median", "Erstes Quartil", "Drittes Quartil"]:
                    select_columns.append(f"{aggregation_function} {full_column_name})")
                else:
                    select_columns.append(f"{aggregation_function}({full_column_name})")

    # Ensure every column is included
    if not all(columns):
        return jsonify({"error": "Each table must have at least one column specified"}), 400

    select_query = ", ".join(select_columns)
    group_by_query = ", ".join(group_by_columns)

    # Construct the final SQL query
    query = f"""
    SELECT {select_query}
    FROM {from_clause}
    {join_query}
    {filter_query}
    """

    if group_by_columns:
        query += f" GROUP BY {group_by_query}"

    print("Generated SQL Query:", query)
    cur.execute(query)
    data = cur.fetchall()

    response = {
        "chartType": chart_type
    }

    for idx, col in enumerate(columns):
        if col:
            if idx == 0:
                response["x"] = [row[idx] for row in data]
            else:
                response[f"y{idx-1}"] = [row[idx] for row in data]

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

@app.route("/get_geodata", methods=["POST"])
def get_geodata():
    data = request.get_json()
    if 'type' not in data:
        return jsonify({"error": "Missing required field: type"}), 400

    data_type = data['type']
    if data_type == 'stores':
        query = "SELECT latitude, longitude FROM stores"
    elif data_type == 'customers':
        query = "SELECT latitude, longitude FROM customers"
    else:
        return jsonify({"error": "Invalid type"}), 400

    cur.execute(query)
    results = cur.fetchall()

    # Convert results to the format expected by Leaflet markers
    geodata = [{'latitude': row[0], 'longitude': row[1]} for row in results]

    return jsonify(geodata)


@app.route("/stats", methods=["GET"])
def stats():
    return render_template('stats.html')

@app.route("/calculatestats", methods=["POST"])
def calculate_stats():
    table_name = request.form['table_name']
    column_name = request.form['column_name']
    
    query = f"SELECT {column_name} FROM {table_name}"
    df = fetch_data(query)
    
    # calculate descriptive statistics for chosen column
    desc_stats = calculate_descriptive_stats(df[column_name])

    relevant_columns = {
        'products': ['price'],
        'customers': ['latitude', 'longitude'],
        'orders': ['nItems', 'total'],
        'stores': ['latitude', 'longitude', 'distance']
    }
    columns = relevant_columns.get(table_name, [])

    return render_template('index.html', stats=desc_stats.to_dict(), columns=columns, table_name=table_name)

@app.route("/performstats", methods=["POST"])
def perform_stats():
    table_choice = request.form['table-choice']
    stat_choice = request.form['stat-choice']
    
    custom_stats_options = {
        'stores': {
            'Sum': ['sum profit', 'sum customers', 'sum sales', 'sum sold products'],
            'Mean': ['mean total', 'mean products/order', 'mean distance customer/store', 'mean reorder rate'],
            'Median': ['median total', 'median products/order', 'median distance customer/store', 'median reorder rate'],
            'Range': ['range total', 'range products/order', 'range distance customer/store', 'range reorder rate'],
            'Standard Deviation': ['standard deviation total', 'standard deviation products/order', 'standard deviation distance customer/store', 'standard deviation reorder rate'],
            'Q1': ['Q1 total', 'Q1 products/order', 'Q1 distance customer/store', 'Q1 reorder rate'],
            'Q2': ['Q2 total', 'Q2 products/order', 'Q2 distance customer/store', 'Q2 reorder rate'],
            'Q3': ['Q3 total', 'Q3 products/order', 'Q3 distance customer/store', 'Q3 reorder rate']
        },
        'customers': {
            'Sum': ['sum total', 'sum orders', 'sum products'],
            'Mean': ['mean total', 'mean products/order'],
            'Median': ['median total', 'median products/order'],
            'Range': ['range total', 'range products/order'],
            'Standard Deviation': ['standard deviation total', 'standard deviation products/order'],
            'Q1': ['Q1 total', 'Q1 products/order'],
            'Q2': ['Q2 total', 'Q2 products/order'],
            'Q3': ['Q3 total', 'Q3 products/order']
        },
        'products': {
            'Sum': ['sum sales', 'sum customers', 'sum total'],
            'Mean': ['mean order location'],
            'Median': ['median order location'],
            'Standard Deviation': ['standard deviation order location'],
            'Q1': ['Q1 order location'],
            'Q2': ['Q2 order location'],
            'Q3': ['Q3 order location']
        }
    }

    columns = custom_stats_options.get(table_choice, {}).get(stat_choice, [])

    return render_template('perform_stats.html', columns=columns, table_choice=table_choice, stat_choice=stat_choice)

@app.route("/calculatestatsdetails", methods=["POST"])
def calculate_stats_details():
    table_name = request.form['table_name']
    column_name = request.form['column-choice']

    query = ""
    if table_name == 'stores' and column_name == 'sum profit':
        query = """
        SELECT s.storeID, SUM(o.total) AS profit
        FROM stores s
        JOIN orders o ON s.storeID = o.storeID
        GROUP BY s.storeID
        ORDER BY profit;
        """
    
    elif table_name == 'stores' and column_name == 'sum customers':
       query = """
       SELECT s.storeID, COUNT(DISTINCT o.customerID) AS num_customers
       FROM stores s
       JOIN orders o ON s.storeID = o.storeID
       GROUP BY s.storeID
       ORDER BY num_customers;
       """

    elif table_name == 'stores' and column_name == 'sum sales':
        query = """
        SELECT s.storeID, COUNT(o.orderID) AS num_orders
        FROM stores s
        JOIN orders o ON s.storeID = o.storeID
        GROUP BY s.storeID
        ORDER BY num_orders;
        """
    
    elif table_name == 'stores' and column_name == 'sum sold products':
        query = """
        SELECT s.storeID, SUM(o.nItems) AS total_sold_products
        FROM stores s
        JOIN orders o ON s.storeID = o.storeID
        GROUP BY s.storeID
        ORDER BY total_sold_products;
        """
    
    elif table_name == 'stores' and column_name == 'mean total':
        query = """
        SELECT s.storeID, AVG(o.total) AS average_total
        FROM stores s
        JOIN orders o ON s.storeID = o.storeID
        GROUP BY s.storeID
        ORDER BY average_total;
        """
    
    elif table_name == 'stores' and column_name == 'mean products/order':
        query = """
        SELECT s.storeID, AVG(o.nItems) AS average_products_per_order
        FROM stores s
        JOIN orders o ON s.storeID = o.storeID
        GROUP BY s.storeID
        ORDER BY average_products_per_order;
        """
    
    elif table_name == 'stores' and column_name == 'mean distance customer/store':
        query = """
        SELECT 
            s.storeID, 
            AVG(
                6371 * ACOS(
                    COS(RADIANS(s.latitude)) * COS(RADIANS(c.latitude)) * COS(RADIANS(c.longitude) - RADIANS(s.longitude)) + 
                    SIN(RADIANS(s.latitude)) * SIN(RADIANS(c.latitude))
                )
            ) AS average_distance
        FROM stores s
        JOIN orders o ON s.storeID = o.storeID
        JOIN customers c ON o.customerID = c.customerID
        GROUP BY s.storeID
        ORDER BY average_distance;
        """
    
    elif table_name == 'stores' and column_name == 'mean reorder rate':
        query = """
        SELECT
            s.storeID,
            AVG(customer_orders.num_orders) AS avg_reorder_rate
        FROM stores s
        JOIN (
            SELECT
                o.storeID,
                o.customerID,
                COUNT(o.orderID) AS num_orders
            FROM orders o
            GROUP BY o.storeID, o.customerID
        ) AS customer_orders ON s.storeID = customer_orders.storeID
        GROUP BY s.storeID
        ORDER BY avg_reorder_rate;
        """
    
    elif table_name == 'stores' and (column_name == 'median total' or column_name == 'Q2 total'):
        query = """
        WITH ordered_totals AS (
            SELECT 
                s.storeID, 
                o.total, 
                ROW_NUMBER() OVER (PARTITION BY s.storeID ORDER BY o.total) AS row_num, 
                COUNT(*) OVER (PARTITION BY s.storeID) AS total_count 
            FROM stores s
            JOIN orders o ON s.storeID = o.storeID
        )
        SELECT 
            storeID, 
            AVG(total) AS median_total 
        FROM ordered_totals 
        WHERE row_num IN (FLOOR((total_count + 1) / 2), FLOOR((total_count + 2) / 2))
        GROUP BY storeID
        ORDER BY median_total;
        """
    
    elif table_name == 'stores' and (column_name == 'median products/order' or column_name == 'Q2 products/order'):
        query = """
        WITH ordered_items AS (
            SELECT 
                s.storeID, 
                o.nItems, 
                ROW_NUMBER() OVER (PARTITION BY s.storeID ORDER BY o.nItems) AS row_num, 
                COUNT(*) OVER (PARTITION BY s.storeID) AS total_count 
            FROM stores s
            JOIN orders o ON s.storeID = o.storeID
        )
        SELECT 
            storeID, 
            AVG(nItems) AS median_nItems 
        FROM ordered_items 
        WHERE row_num IN (FLOOR((total_count + 1) / 2), FLOOR((total_count + 2) / 2))
        GROUP BY storeID
        ORDER BY median_nItems;
        """
    
    elif table_name == 'stores' and (column_name == 'median distance customer/store' or column_name == 'Q2 distance customer/store'):
        query = """
        WITH ordered_distances AS (
            SELECT 
                s.storeID, 
                6371 * ACOS(
                    COS(RADIANS(s.latitude)) * COS(RADIANS(c.latitude)) * COS(RADIANS(c.longitude) - RADIANS(s.longitude)) + 
                    SIN(RADIANS(s.latitude)) * SIN(RADIANS(c.latitude))
                ) AS distance, 
                ROW_NUMBER() OVER (PARTITION BY s.storeID ORDER BY distance) AS row_num, 
                COUNT(*) OVER (PARTITION BY s.storeID) AS total_count 
            FROM stores s
            JOIN orders o ON s.storeID = o.storeID
            JOIN customers c ON o.customerID = c.customerID
        )
        SELECT 
            storeID, 
            AVG(distance) AS median_distance 
        FROM ordered_distances 
        WHERE row_num IN (FLOOR((total_count + 1) / 2), FLOOR((total_count + 2) / 2))
        GROUP BY storeID
        ORDER BY median_distance;
        """
    
    elif table_name == 'stores' and (column_name == 'median reorder rate' or column_name == 'Q2 reorder rate'):
        query = """
        WITH customer_orders AS (
            SELECT 
                o.storeID, 
                o.customerID, 
                COUNT(o.orderID) AS num_orders 
            FROM orders o 
            GROUP BY o.storeID, o.customerID
        ), ordered_reorder_rates AS (
            SELECT 
                storeID, 
                num_orders, 
                ROW_NUMBER() OVER (PARTITION BY storeID ORDER BY num_orders) AS row_num, 
                COUNT(*) OVER (PARTITION BY storeID) AS total_count 
            FROM customer_orders
        )
        SELECT 
            storeID, 
            AVG(num_orders) AS median_reorder_rate 
        FROM ordered_reorder_rates 
        WHERE row_num IN (FLOOR((total_count + 1) / 2), FLOOR((total_count + 2) / 2))
        GROUP BY storeID
        ORDER BY median_reorder_rate;
        """
    elif table_name == 'stores' and column_name == 'range total':
        query = """
        SELECT 
            s.storeID, 
            MIN(o.total) AS min_total, 
            MAX(o.total) AS max_total, 
            (MAX(o.total) - MIN(o.total)) AS range_total
        FROM 
            stores s
        JOIN 
            orders o ON s.storeID = o.storeID
        GROUP BY 
            s.storeID
        ORDER BY 
            range_total;
        """
    
    elif table_name == 'stores' and column_name == 'range products/order':
        query = """
        SELECT 
            s.storeID, 
            MIN(o.nItems) AS min_products, 
            MAX(o.nItems) AS max_products, 
            (MAX(o.nItems) - MIN(o.nItems)) AS range_products
        FROM 
            stores s
        JOIN 
            orders o ON s.storeID = o.storeID
        GROUP BY 
            s.storeID
        ORDER BY 
            range_products;
        """
    
    elif table_name == 'stores' and column_name == 'range distance customer/store':
        query = """
        SELECT 
            s.storeID, 
            MIN(distance) AS min_distance, 
            MAX(distance) AS max_distance, 
            (MAX(distance) - MIN(distance)) AS range_distance
        FROM (
            SELECT 
                s.storeID, 
                6371 * ACOS(
                    COS(RADIANS(s.latitude)) * COS(RADIANS(c.latitude)) * COS(RADIANS(c.longitude) - RADIANS(s.longitude)) + 
                    SIN(RADIANS(s.latitude)) * SIN(RADIANS(c.latitude))
                ) AS distance
            FROM 
                stores s
            JOIN 
                orders o ON s.storeID = o.storeID
            JOIN 
                customers c ON o.customerID = c.customerID
        ) distances
        GROUP BY 
            storeID
        ORDER BY 
            range_distance;
        """
    
    elif table_name == 'stores' and column_name == 'range reorder rate':
        query = """
        SELECT 
            s.storeID, 
            MIN(customer_orders.num_orders) AS min_reorder_rate, 
            MAX(customer_orders.num_orders) AS max_reorder_rate, 
            (MAX(customer_orders.num_orders) - MIN(customer_orders.num_orders)) AS range_reorder_rate
        FROM 
            stores s
        JOIN (
            SELECT 
                o.storeID, 
                o.customerID, 
                COUNT(o.orderID) AS num_orders
            FROM 
                orders o
            GROUP BY 
                o.storeID, o.customerID
        ) AS customer_orders ON s.storeID = customer_orders.storeID
        GROUP BY 
            s.storeID
        ORDER BY 
            range_reorder_rate;
        """

    elif table_name == 'stores' and column_name == 'standard deviation total':
        query = """
        SELECT 
            s.storeID, 
            STDDEV(o.total) AS stddev_total
        FROM 
            stores s
        JOIN 
            orders o ON s.storeID = o.storeID
        GROUP BY 
            s.storeID
        ORDER BY 
            stddev_total;
        """
    
    elif table_name == 'stores' and column_name == 'standard deviation products/order':
        query = """
        SELECT 
            s.storeID, 
            STDDEV(o.nItems) AS stddev_products_per_order
        FROM 
            stores s
        JOIN 
            orders o ON s.storeID = o.storeID
        GROUP BY 
            s.storeID
        ORDER BY 
            stddev_products_per_order;
        """
    
    elif table_name == 'stores' and column_name == 'standard deviation distance customer/store':
        query = """
        SELECT 
            s.storeID, 
            STDDEV(distance) AS stddev_distance
        FROM (
            SELECT 
                s.storeID, 
                6371 * ACOS(
                    COS(RADIANS(s.latitude)) * COS(RADIANS(c.latitude)) * COS(RADIANS(c.longitude) - RADIANS(s.longitude)) + 
                    SIN(RADIANS(s.latitude)) * SIN(RADIANS(c.latitude))
                ) AS distance
            FROM 
                stores s
            JOIN 
                orders o ON s.storeID = o.storeID
            JOIN 
                customers c ON o.customerID = c.customerID
        ) distances
        GROUP BY 
            storeID
        ORDER BY 
            stddev_distance;
        """
    
    elif table_name == 'stores' and column_name == 'standard deviation reorder rate':
        query = """
    	SELECT 
            s.storeID, 
            STDDEV(customer_orders.num_orders) AS stddev_reorder_rate
        FROM 
            stores s
        JOIN (
            SELECT 
                o.storeID, 
                o.customerID, 
                COUNT(o.orderID) AS num_orders
            FROM 
                orders o
            GROUP BY 
                o.storeID, o.customerID
        ) AS customer_orders ON s.storeID = customer_orders.storeID
        GROUP BY 
            s.storeID
        ORDER BY 
            stddev_reorder_rate;
        """

    elif table_name == 'stores' and column_name == 'Q1 total':
        query = """
        SELECT storeID, 
        SUBSTRING_INDEX(
            SUBSTRING_INDEX(
                GROUP_CONCAT(total ORDER BY total), 
                ',', 
                ROUND(0.25 * COUNT(*) + 0.5)
            ), 
            ',', 
            -1
        ) AS Q1_total
        FROM orders
        GROUP BY storeID
        ORDER BY Q1_total;
        """
    
    elif table_name == 'stores' and column_name == 'Q1 products/order':
        query = """
        SELECT storeID, 
        SUBSTRING_INDEX(
            SUBSTRING_INDEX(
                GROUP_CONCAT(nItems ORDER BY nItems), 
                ',', 
                ROUND(0.25 * COUNT(*) + 0.5)
            ), 
            ',', 
            -1
        ) AS Q1_products_per_order
        FROM orders
        GROUP BY storeID
        ORDER BY Q1_products_per_order;
        """
    
    elif table_name == 'stores' and column_name == 'Q1 distance customer/store':
        query = """
        SELECT storeID, 
        SUBSTRING_INDEX(
            SUBSTRING_INDEX(
                GROUP_CONCAT(distance ORDER BY distance), 
                ',', 
                ROUND(0.25 * COUNT(*) + 0.5)
            ), 
            ',', 
            -1
        ) AS Q1_distance
        FROM (
            SELECT 
                s.storeID, 
                6371 * ACOS(
                    COS(RADIANS(s.latitude)) * COS(RADIANS(c.latitude)) * COS(RADIANS(c.longitude) - RADIANS(s.longitude)) + 
                    SIN(RADIANS(s.latitude)) * SIN(RADIANS(c.latitude))
                ) AS distance
            FROM stores s
            JOIN orders o ON s.storeID = o.storeID
            JOIN customers c ON o.customerID = c.customerID
        ) distances
        GROUP BY storeID
        ORDER BY Q1_distance;
        """
    
    elif table_name == 'stores' and column_name == 'Q1 reorder rate':
        query = """
    	SELECT storeID, 
        SUBSTRING_INDEX(
            SUBSTRING_INDEX(
                GROUP_CONCAT(num_orders ORDER BY num_orders), 
                ',', 
                ROUND(0.25 * COUNT(*) + 0.5)
            ), 
            ',', 
            -1
        ) AS Q1_reorder_rate
        FROM (
            SELECT 
                o.storeID, 
                o.customerID, 
                COUNT(o.orderID) AS num_orders
            FROM orders o 
            GROUP BY o.storeID, o.customerID
        ) customer_orders
        GROUP BY storeID
        ORDER BY Q1_reorder_rate;
        """

    elif table_name == 'stores' and column_name == 'Q3 total':
        query = """
        SELECT storeID, 
       SUBSTRING_INDEX(
           SUBSTRING_INDEX(
               GROUP_CONCAT(total ORDER BY total), 
               ',', 
               ROUND(0.75 * COUNT(*) + 0.5)
           ), 
           ',', 
           -1
       ) AS Q3_total
        FROM orders
        GROUP BY storeID
        ORDER BY Q3_total;
        """
    
    elif table_name == 'stores' and column_name == 'Q3 products/order':
        query = """
        SELECT storeID, 
        SUBSTRING_INDEX(
            SUBSTRING_INDEX(
                GROUP_CONCAT(nItems ORDER BY nItems), 
                ',', 
                ROUND(0.75 * COUNT(*) + 0.5)
            ), 
            ',', 
            -1
        ) AS Q3_products_per_order
        FROM orders
        GROUP BY storeID
        ORDER BY Q3_products_per_order;
        """
    
    elif table_name == 'stores' and column_name == 'Q3 distance customer/store':
        query = """
        SELECT storeID, 
        SUBSTRING_INDEX(
            SUBSTRING_INDEX(
                GROUP_CONCAT(distance ORDER BY distance), 
                ',', 
                ROUND(0.75 * COUNT(*) + 0.5)
            ), 
            ',', 
            -1
        ) AS Q3_distance
    FROM (
        SELECT 
            s.storeID, 
            6371 * ACOS(
                COS(RADIANS(s.latitude)) * COS(RADIANS(c.latitude)) * COS(RADIANS(c.longitude) - RADIANS(s.longitude)) + 
                SIN(RADIANS(s.latitude)) * SIN(RADIANS(c.latitude))
            ) AS distance
            FROM stores s
            JOIN orders o ON s.storeID = o.storeID
            JOIN customers c ON o.customerID = c.customerID
        ) distances
        GROUP BY storeID
        ORDER BY Q3_distance;
        """
    
    elif table_name == 'stores' and column_name == 'Q3 reorder rate':
        query = """
    	SELECT storeID, 
        SUBSTRING_INDEX(
            SUBSTRING_INDEX(
                GROUP_CONCAT(num_orders ORDER BY num_orders), 
                ',', 
                ROUND(0.75 * COUNT(*) + 0.5)
            ), 
            ',', 
            -1
        ) AS Q3_reorder_rate
        FROM (
            SELECT 
                o.storeID, 
                o.customerID, 
                COUNT(o.orderID) AS num_orders
            FROM orders o 
            GROUP BY o.storeID, o.customerID
        ) customer_orders
        GROUP BY storeID
        ORDER BY Q3_reorder_rate;
        """

    elif table_name == 'products' and column_name == 'sum sales':
        query = """
        SELECT p.SKU, COUNT(oi.SKU) AS total_sales
        FROM products p
        JOIN orderitems oi ON p.SKU = oi.SKU
        GROUP BY p.SKU
        ORDER BY total_sales DESC;
        """
    
    elif table_name == 'products' and column_name == 'sum customers':
        query = """
        SELECT p.SKU, COUNT(DISTINCT o.customerID) AS total_customers
        FROM products p
        JOIN orderitems oi ON p.SKU = oi.SKU
        JOIN orders o ON oi.orderID = o.orderID
        GROUP BY p.SKU
        ORDER BY total_customers DESC;
        """
    
    elif table_name == 'products' and column_name == 'sum total':
        query = """
        SELECT p.SKU, SUM(o.total) AS total_money
        FROM products p
        JOIN orderitems oi ON p.SKU = oi.SKU
        JOIN orders o ON oi.orderID = o.orderID
        GROUP BY p.SKU
        ORDER BY total_money DESC;
        """
    
    elif table_name == 'products' and column_name == 'mean order location':
        query = """
        SELECT 
            p.SKU, 
            AVG(c.latitude) AS avg_latitude, 
            AVG(c.longitude) AS avg_longitude
        FROM 
            products p
        JOIN 
            orderitems oi ON p.SKU = oi.SKU
        JOIN 
            orders o ON oi.orderID = o.orderID
        JOIN 
            customers c ON o.customerID = c.customerID
        GROUP BY 
            p.SKU
        ORDER BY avg_latitude;
    """
    
    elif table_name == 'products' and (column_name == 'median order location' or column_name == 'Q2'):
        query = """
    	WITH ordered_latitudes AS (
        SELECT 
            p.SKU, 
            c.latitude, 
            ROW_NUMBER() OVER (PARTITION BY p.SKU ORDER BY c.latitude) AS row_num, 
            COUNT(*) OVER (PARTITION BY p.SKU) AS total_count 
        FROM products p
        JOIN orderitems oi ON p.SKU = oi.SKU
        JOIN orders o ON oi.orderID = o.orderID
        JOIN customers c ON o.customerID = c.customerID
            ),
        ordered_longitudes AS (
            SELECT 
                p.SKU, 
                c.longitude, 
                ROW_NUMBER() OVER (PARTITION BY p.SKU ORDER BY c.longitude) AS row_num, 
                COUNT(*) OVER (PARTITION BY p.SKU) AS total_count 
        FROM products p
        JOIN orderitems oi ON p.SKU = oi.SKU
        JOIN orders o ON oi.orderID = o.orderID
        JOIN customers c ON o.customerID = c.customerID
        )
        SELECT 
            latitudes.SKU, 
            AVG(latitudes.latitude) AS median_latitude, 
            AVG(longitudes.longitude) AS median_longitude
        FROM 
            ordered_latitudes latitudes
        JOIN 
            ordered_longitudes longitudes ON latitudes.SKU = longitudes.SKU AND latitudes.row_num = longitudes.row_num
        WHERE 
            latitudes.row_num IN (FLOOR((latitudes.total_count + 1) / 2), FLOOR((latitudes.total_count + 2) / 2))
            AND longitudes.row_num IN (FLOOR((longitudes.total_count + 1) / 2), FLOOR((longitudes.total_count + 2) / 2))
        GROUP BY 
            latitudes.SKU
        ORDER BY 
            median_latitude;
        """
    
    elif table_name == 'products' and column_name == 'standard deviation order location':
        query = """
    	SELECT 
            p.SKU, 
            STDDEV(c.latitude) AS stddev_latitude, 
            STDDEV(c.longitude) AS stddev_longitude
        FROM 
            products p
        JOIN 
            orderitems oi ON p.SKU = oi.SKU
        JOIN 
            orders o ON oi.orderID = o.orderID
        JOIN 
            customers c ON o.customerID = c.customerID
        GROUP BY 
            p.SKU
        ORDER BY 
            p.SKU;
        """

    elif table_name == 'products' and column_name == 'Q1 order location':
        query = """
        SELECT 
        p.SKU, 
        SUBSTRING_INDEX(
            SUBSTRING_INDEX(
                GROUP_CONCAT(c.latitude ORDER BY c.latitude), 
                ',', 
                ROUND(0.25 * COUNT(*) + 0.5)
            ), 
            ',', 
            -1
        ) AS Q1_latitude,
        SUBSTRING_INDEX(
            SUBSTRING_INDEX(
                GROUP_CONCAT(c.longitude ORDER BY c.longitude), 
                ',', 
                ROUND(0.25 * COUNT(*) + 0.5)
            ), 
            ',', 
            -1
        ) AS Q1_longitude
        FROM 
            products p
        JOIN 
            orderitems oi ON p.SKU = oi.SKU
        JOIN 
            orders o ON oi.orderID = o.orderID
        JOIN 
            customers c ON o.customerID = c.customerID
        GROUP BY 
            p.SKU
        ORDER BY 
            Q1_latitude, Q1_longitude;
        """
    
    elif table_name == 'products' and column_name == 'Q3 order location':
        query = """
    	SELECT 
        p.SKU, 
        SUBSTRING_INDEX(
            SUBSTRING_INDEX(
                GROUP_CONCAT(c.latitude ORDER BY c.latitude), 
                ',', 
                ROUND(0.75 * COUNT(*) + 0.5)
            ), 
            ',', 
            -1
        ) AS Q3_latitude,
        SUBSTRING_INDEX(
            SUBSTRING_INDEX(
                GROUP_CONCAT(c.longitude ORDER BY c.longitude), 
                ',', 
                ROUND(0.75 * COUNT(*) + 0.5)
            ), 
            ',', 
            -1
        ) AS Q3_longitude
        FROM 
            products p
        JOIN 
            orderitems oi ON p.SKU = oi.SKU
        JOIN 
            orders o ON oi.orderID = o.orderID
        JOIN 
            customers c ON o.customerID = c.customerID
        GROUP BY 
            p.SKU
        ORDER BY 
            Q3_latitude, Q3_longitude;
        """

    elif table_name == 'customers' and column_name == 'sum total':
        query = """
        SELECT customerID, SUM(total) AS total_spent
        FROM orders
        GROUP BY customerID
        ORDER BY total_spent DESC;
        """
    
    elif table_name == 'customers' and column_name == 'sum orders':
        query = """
        SELECT customerID, COUNT(orderid) AS order_amount
        FROM orders
        GROUP BY customerID
        ORDER BY order_amount DESC;
        """
    
    elif table_name == 'customers' and column_name == 'sum products':
        query = """
        SELECT customerID, SUM(nItems) AS sum_customer_products
        FROM orders
        GROUP BY customerID
        ORDER BY sum_customer_products DESC;
        """
    
    elif table_name == 'customers' and column_name == 'mean total':
        query = """
    	SELECT customerID, AVG(total) AS average_total_price
        FROM orders
        GROUP BY customerID
        ORDER BY average_total_price DESC;
        """

    elif table_name == 'customers' and column_name == 'mean products/order':
        query = """
    	SELECT customerID, AVG(nItems) AS average_products_per_order
        FROM orders
        GROUP BY customerID
        ORDER BY average_products_per_order DESC;
        """

    elif table_name == 'customers' and (column_name == 'median total' or column_name == 'Q2 total'):
        query = """
    	WITH ordered_totals AS (
        SELECT 
            customerID,
            total,
            ROW_NUMBER() OVER (PARTITION BY customerID ORDER BY total) AS row_num,
            COUNT(*) OVER (PARTITION BY customerID) AS total_count
        FROM orders
    )
        SELECT 
            customerID,
            AVG(total) AS median_total
        FROM ordered_totals
        WHERE row_num IN (FLOOR((total_count + 1) / 2), FLOOR((total_count + 2) / 2))
        GROUP BY customerID
        ORDER BY median_total;
        """

    elif table_name == 'customers' and (column_name == 'median products/order' or column_name == 'Q2 products/order'):
        query = """
    	WITH ordered_products AS (
        SELECT 
            c.customerID,
            o.orderID,
            o.nItems,
            ROW_NUMBER() OVER (PARTITION BY c.customerID ORDER BY o.nItems) AS row_num,
            COUNT(*) OVER (PARTITION BY c.customerID) AS total_count
        FROM 
            customers c
        JOIN 
            orders o ON c.customerID = o.customerID
        )
        SELECT 
            customerID,
            AVG(nItems) AS median_nItems
        FROM 
            ordered_products
        WHERE 
            row_num IN (FLOOR((total_count + 1) / 2), CEIL((total_count + 1) / 2))
        GROUP BY 
            customerID
        ORDER BY 
            customerID;
        """

    elif table_name == 'customers' and column_name == 'range total':
        query = """
    	SELECT 
            customerID, 
            MAX(total) AS max_total, 
            MIN(total) AS min_total, 
            (MAX(total) - MIN(total)) AS range_total
        FROM 
            orders
        GROUP BY 
            customerID
        ORDER BY range_total DESC;
        """

    elif table_name == 'customers' and column_name == 'range products/order':
        query = """
    	SELECT
            customerID,
            MAX(nItems) AS max_products_per_order,
            MIN(nItems) AS min_products_per_order,
            (MAX(nItems) - MIN (nItems)) AS range_products_per_order
        FROM
            orders
        GROUP BY 
            customerID
        ORDER BY range_products_per_order DESC;
        """

    elif table_name == 'customers' and column_name == 'standard deviation total':
        query = """
    	SELECT 
            customerID, 
            STDDEV(total) AS stddev_total
        FROM 
            orders
        GROUP BY 
            customerID
        ORDER BY 
            stddev_total;
        """

    elif table_name == 'customers' and column_name == 'standard deviation products/order':
        query = """
    	SELECT 
            o.customerID, 
            STDDEV(o.nItems) AS stddev_products_per_order
        FROM 
            orders o
        GROUP BY 
            o.customerID
        ORDER BY 
            stddev_products_per_order;
        """

    elif table_name == 'customers' and column_name == 'Q1 total':
        query = """
    	SELECT customerID, 
            SUBSTRING_INDEX(
                SUBSTRING_INDEX(
                    GROUP_CONCAT(total ORDER BY total), 
                    ',', 
                    ROUND(0.25 * COUNT(*) + 0.5)
                ), 
                ',', 
                -1
            ) AS Q1_total
        FROM orders
        GROUP BY customerID
        ORDER BY Q1_total DESC;
        """

    elif table_name == 'customers' and column_name == 'Q1 products/order':
        query = """
    	WITH ordered_nItems AS (
        SELECT 
            o.customerID, 
            o.nItems, 
            ROW_NUMBER() OVER (PARTITION BY o.customerID ORDER BY o.nItems) AS row_num, 
            COUNT(*) OVER (PARTITION BY o.customerID) AS total_count 
        FROM orders o
        )
        SELECT 
            customerID, 
            AVG(nItems) AS Q1_nItems 
        FROM ordered_nItems 
        WHERE row_num IN (FLOOR(0.25 * total_count) + 1, CEIL(0.25 * total_count))
        GROUP BY customerID
        ORDER BY Q1_nItems DESC;
        """

    elif table_name == 'customers' and column_name == 'Q3 total':
        query = """
    	SELECT customerID, 
            SUBSTRING_INDEX(
                SUBSTRING_INDEX(
                    GROUP_CONCAT(total ORDER BY total), 
                    ',', 
                    ROUND(0.75 * COUNT(*) + 0.5)
                ), 
                ',', 
                -1
            ) AS Q3_total
        FROM orders
        GROUP BY customerID
        ORDER BY Q3_total DESC;
        """

    elif table_name == 'customers' and column_name == 'Q3 products/order':
        query = """
    	WITH ordered_nItems AS (
        SELECT 
            o.customerID, 
            o.nItems, 
            ROW_NUMBER() OVER (PARTITION BY o.customerID ORDER BY o.nItems) AS row_num, 
            COUNT(*) OVER (PARTITION BY o.customerID) AS total_count 
        FROM orders o
        )
        SELECT 
            customerID, 
            AVG(nItems) AS Q3_nItems 
        FROM ordered_nItems 
        WHERE row_num IN (FLOOR(0.75 * total_count) + 1, CEIL(0.75 * total_count))
        GROUP BY customerID
        ORDER BY Q3_nItems DESC;
        """

    else:
        # Falls eine andere Berechnung gewählt wird, hier einen Platzhalter für die allgemeine Statistikberechnung
        query = f"SELECT {column_name} FROM {table_name}"
        df = fetch_data(query)
        desc_stats = calculate_descriptive_stats(df[column_name])
        return render_template('index.html', stats=desc_stats.to_dict(), table_name=table_name)

    df = fetch_data(query)
    return render_template('result.html', data=df.to_dict(orient='records'), columns=df.columns)


if __name__ == "__main__":
    app.run(debug=True)
