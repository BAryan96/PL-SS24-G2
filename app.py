from flask import Flask, render_template, request, jsonify
from DB import connect_to_database, get_cursor
import pandas as pd
from geopy.distance import geodesic

app = Flask(__name__)
conn = connect_to_database()
cur = get_cursor(conn)

@app.route("/kpitest")
def kpitest():
    return render_template('kpitest.html')

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

@app.route("/salesperformancedash")
def salesperformancedash():
    return render_template('salesperformancedash.html')

@app.route("/customerdash")
def customerdash():
    return render_template('customerdash.html')

@app.route("/productdash")
def productdash():
    return render_template('productdash.html')

@app.route("/storeperformancedash")
def productstoreperformancedashdash():
    return render_template('storeperformancedash.html')

@app.route("/orderdetailsdash")
def orderdetailsdash():
    return render_template('orderdetailsdash.html')

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

def execute_query(query):
    conn = connect_to_database()
    cursor = get_cursor(conn)
    cursor.execute(query)
    data = cursor.fetchall()
    cursor.close()
    conn.close()
    return data

@app.route("/getdata", methods=["POST"])
def get_data():
    if not request.is_json:
        return jsonify({"error": "Request data must be JSON"}), 415

    data = request.get_json()
    print("Received JSON data:", data)

    #data =  {'tables': ['customers', 'orders-Right'], 'columns': ['customerID', 'orderID'], 'chartType': 'bar', 'aggregations': ['', 'Anzahl'], 'filters': []}
    #data =  {'tables': ['orders', 'orders'], 'columns': ['orderDate-MM', 'total'], 'chartType': 'bar', 'aggregations': ['', 'Summe'], 'filters': []}
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
        ('products', 'orderitems'): ('SKU', 'SKU'),
        ('orderitems', 'orders'): ('orderID', 'orderID'),
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
        "Median": "SUBSTRING_INDEX(SUBSTRING_INDEX(GROUP_CONCAT({column} ORDER BY {column}), ',', ROUND(0.5 * COUNT(*) + 0.5)), ',', -1)",
        "Erstes Quartil": "SUBSTRING_INDEX(SUBSTRING_INDEX(GROUP_CONCAT({column} ORDER BY {column}), ',', ROUND(0.25 * COUNT(*) + 0.5)), ',', -1)",
        "Drittes Quartil": "SUBSTRING_INDEX(SUBSTRING_INDEX(GROUP_CONCAT({column} ORDER BY {column}), ',', ROUND(0.75 * COUNT(*) + 0.5)), ',', -1)"
    }

    date_formats = {
        '-DD.MM.YYYY HH24:MI:SS': '%d.%m.%Y %H:%i:%s',
        '-DD.MM.YYYY HH24:MI': '%d.%m.%Y %H:%i',
        '-DD.MM.YYYY HH24': '%d.%m.%Y %H',
        '-DD.MM.YYYY': '%d.%m.%Y',
        '-DD.MM': '%d.%m',
        '-DD.YYYY': '%d.%Y',
        '-MM.YYYY': '%m.%Y',
        '-DD': '%d',
        '-MM': '%m',
        '-YYYY': '%Y',
        '-HH24:MI': '%H:%i',
        '-HH24': '%H',
        '-MI': '%i',
        '-SS': '%s',
    }

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

    for filter in filters:
        filter_table = filter['filterTable']
        if filter_table not in tables:
            tables.append(filter_table)
            columns.append('')
            aggregations.append('')

    unique_tables = []
    for table in tables:
        if table not in unique_tables:
            unique_tables.append(table)

    join_conditions = []
    from_clause = unique_tables[0].split('-')[0]

    def find_join_path(start_table, end_table, joins):
        paths = {start_table: []}
        visited = {start_table}
        queue = [start_table]
        while queue:
            current_table = queue.pop(0)
            if current_table == end_table:
                return paths[current_table]
            for (table1, table2), (join_col1, join_col2) in joins.items():
                if table1 == current_table and table2 not in visited:
                    paths[table2] = paths[current_table] + [(table1, table2, join_col1, join_col2)]
                    visited.add(table2)
                    queue.append(table2)
                elif table2 == current_table and table1 not in visited:
                    paths[table1] = paths[current_table] + [(table2, table1, join_col2, join_col1)]
                    visited.add(table1)
                    queue.append(table1)
        return None

    join_paths = {}
    for i in range(1, len(unique_tables)):
        table1, table2 = unique_tables[i - 1].split('-')[0], unique_tables[i].split('-')[0]
        join_path = find_join_path(table1, table2, joins)
        if join_path:
            join_paths[(table1, table2)] = join_path
        else:
            return jsonify({"error": f"No valid join path found between {table1} and {table2}"}), 400

    for i in range(1, len(unique_tables)):
        table2 = unique_tables[i]
        join_type = 'JOIN'
        if '-' in table2:
            table2, join_type_suffix = table2.split('-')
            join_type = {
                'Left': 'LEFT JOIN',
                'Right': 'RIGHT JOIN',
                'Full': 'FULL JOIN'
            }.get(join_type_suffix, 'JOIN')

        table1 = unique_tables[i - 1].split('-')[0]
        path = join_paths.get((table1, table2))
        if path:
            for join in path:
                join_conditions.append(f"{join_type} {join[1]} ON {join[0]}.{join[2]} = {join[1]}.{join[3]}")

    join_query = " ".join(join_conditions)

    select_columns = []
    group_by_columns = []

    for table, col, agg in zip(tables, columns, aggregations):
        if col:
            table = table.split('-')[0]  # Remove join suffix for SQL usage
            full_column_name = None
            for suffix, date_format in date_formats.items():
                if col.endswith(suffix):
                    col = col[: -len(suffix)]
                    full_column_name = f"DATE_FORMAT({table}.{col}, '{date_format}')"
                    break
            if not full_column_name:
                full_column_name = f"{table}.{col}"

            aggregation_function = aggregation_functions.get(agg, "")
            if not aggregation_function:
                select_columns.append(full_column_name)
                if agg != "X":
                    group_by_columns.append(full_column_name)
            else:

                if agg in ["Diskrete Anzahl", "Median", "Erstes Quartil", "Drittes Quartil"]:
                    aggregation_sql = aggregation_function.format(column=full_column_name)
                    select_columns.append(aggregation_sql)
                    #select_columns.append(f"{aggregation_function} {full_column_name})")
                else:
                    select_columns.append(f"{aggregation_function}({full_column_name})")

    if not all(columns):
        print("Each table must have at least one column specified")
        return jsonify({"error": "Each table must have at least one column specified"}), 400

    select_query = ", ".join(select_columns)
    group_by_query = ", ".join(group_by_columns)

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



def fetch_data(query, params=None):
    conn = connect_to_database()
    cursor = get_cursor(conn)
    cursor.execute(query, params)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return pd.DataFrame(rows)

def calculate_kpis():
    query = """
        SELECT o.orderID, o.orderDate, o.storeID, o.total, oi.SKU, p.Category, o.nItems AS quantity, p.price,
               o.customerID, c.latitude AS customer_lat, c.longitude AS customer_lon, 
               s.latitude AS store_lat, s.longitude AS store_lon, s.city, s.state,
               p.name, p.size
        FROM orders o
        JOIN orderitems oi ON o.orderID = oi.orderID
        JOIN products p ON oi.SKU = p.SKU
        JOIN customers c ON o.customerID = c.customerID
        JOIN stores s ON o.storeID = s.storeID
        WHERE 1=1
    """
    
    # Fetch data
    df = fetch_data(query)
    
    # Sales Performance KPIs
    revenue = df['total'].sum()
    units_sold = df['quantity'].sum()
    avg_order_value = df['total'].mean()
    
    # Customer Insights KPIs
    reorder_rate = df.groupby('customerID').size().mean() #explain
    
    def calculate_distance(row):
        customer_coords = (row['customer_lat'], row['customer_lon'])
        store_coords = (row['store_lat'], row['store_lon'])
        return geodesic(customer_coords, store_coords).miles
    
    df['distance'] = df.apply(calculate_distance, axis=1)
    average_distance = df['distance'].mean()
    
    clv_df = df.groupby('customerID')['total'].sum()
    average_clv = clv_df.mean()
    
    customer_orders = df.groupby('customerID').size()
    regular_customers = (customer_orders > 5).sum()
    occasional_customers = ((customer_orders > 1) & (customer_orders <= 5)).sum() 
    one_time_customers = (customer_orders == 1).sum()
    potential_customers = (customer_orders == 0).sum()

    # Product Performance KPIs
    product_performance = df.groupby(['SKU', 'name', 'Category', 'size']).agg({
        'quantity': 'sum',
        'total': 'sum'
    }).rename(columns={'quantity': 'units_sold', 'total': 'revenue'}).reset_index()
    
    product_performance['order_frequency'] = df['orderDate'].diff().mean().total_seconds() / 60 / product_performance['units_sold']
    
    top_3_units_sold = product_performance.nlargest(3, 'units_sold')
    top_3_revenue = product_performance.nlargest(3, 'revenue')
    bottom_3_units_sold = product_performance.nsmallest(3, 'units_sold')
    bottom_3_revenue = product_performance.nsmallest(3, 'revenue')
    
    df['order_time_minutes'] = pd.to_datetime(df['orderDate']).astype(int) // 10**9 // 60
    product_performance['order_frequency_minutes'] = df.groupby('SKU')['order_time_minutes'].apply(lambda x: x.diff().mean()).reset_index(drop=True)
    
    # Store Performance KPIs
    store_performance = df.groupby(['storeID', 'city', 'state']).agg({
        'quantity': 'sum',
        'total': 'sum'
    }).rename(columns={'quantity': 'units_sold', 'total': 'revenue'}).reset_index()
    
    best_store_revenue = store_performance.nlargest(1, 'revenue')
    most_ordered_store = store_performance.nlargest(1, 'units_sold')
    
    reorder_df = df.groupby(['storeID', 'customerID']).size().reset_index(name='orders')
    store_reorder_rate = reorder_df.groupby('storeID')['orders'].mean().reset_index()
    best_store_reorder_rate = store_reorder_rate.nlargest(1, 'orders')

    top_3_units_sold_stores = store_performance.nlargest(3, 'units_sold')
    top_3_revenue_stores = store_performance.nlargest(3, 'revenue')
    bottom_3_units_sold_stores = store_performance.nsmallest(3, 'units_sold')
    bottom_3_revenue_stores = store_performance.nsmallest(3, 'revenue')
    
    # Order Details KPIs
    top_5_biggest_orders = df.nlargest(5, 'quantity')[['orderID', 'quantity']]
    top_5_biggest_orders['order_probability'] = (top_5_biggest_orders['quantity'] / df['quantity'].sum()) * 100
    top_5_biggest_orders['order_frequency_hours'] = (df['orderDate'].max() - df['orderDate'].min()).total_seconds() / 3600 / top_5_biggest_orders['quantity']

    average_order_size = df['quantity'].mean()
    
    df['order_time'] = pd.to_datetime(df['orderDate']).dt.time
    popular_order_time = df['order_time'].mode()[0]
    popular_order_minute = df['order_time'].dt.minute.mode()[0]
    
    df['order_month'] = pd.to_datetime(df['orderDate']).dt.month
    popular_order_month = df['order_month'].mode()[0]
    df['order_week'] = pd.to_datetime(df['orderDate']).dt.isocalendar().week
    popular_order_week = df['order_week'].mode()[0]
    df['order_day'] = pd.to_datetime(df['orderDate']).dt.day
    popular_order_day = df['order_day'].mode()[0]
    
    return {
        # Sales Performance KPIs
        'revenue': revenue,
        'units_sold': units_sold,
        'avg_order_value': avg_order_value,
        'reorder_rate': reorder_rate,
        # Customer Insights KPIs
        'average_distance': average_distance,
        'average_clv': average_clv,
        'regular_customers': regular_customers,
        'occasional_customers': occasional_customers,
        'one_time_customers': one_time_customers,
        'potential_customers' : potential_customers,
        # Product Performance KPIs
        'top_3_units_sold': top_3_units_sold.to_dict('records'),
        'top_3_revenue': top_3_revenue.to_dict('records'),
        'bottom_3_units_sold': bottom_3_units_sold.to_dict('records'),
        'bottom_3_revenue': bottom_3_revenue.to_dict('records'),
        'product_order_frequency_minutes': product_performance[['SKU', 'name', 'order_frequency_minutes']].to_dict('records'),
        # Store Performance KPIs
        'best_store_revenue': best_store_revenue.to_dict('records'),
        'most_ordered_store': most_ordered_store.to_dict('records'),
        'best_store_reorder_rate': best_store_reorder_rate.to_dict('records'),
        'top_3_units_sold_stores': top_3_units_sold_stores.to_dict('records'),
        'top_3_revenue_stores': top_3_revenue_stores.to_dict('records'),
        'bottom_3_units_sold_stores': bottom_3_units_sold_stores.to_dict('records'),
        'bottom_3_revenue_stores': bottom_3_revenue_stores.to_dict('records'),
        # Order Details KPIs
        'top_5_biggest_orders': top_5_biggest_orders.to_dict('records'),
        'average_order_size': average_order_size,
        'popular_order_time': popular_order_time.strftime("%H:%M:%S"),
        'popular_order_minute': popular_order_minute,
        'popular_order_month': popular_order_month,
        'popular_order_week': popular_order_week,
        'popular_order_day': popular_order_day
    }


@app.route('/kpiforsalesperformancedash', methods=['GET'])
def kpiforsalesperformancedash():
    kpis = calculate_kpis()
    limited_kpis = dict(list(kpis.items())[:4])  # Select only the first 4 KPIs
    return jsonify(limited_kpis)

@app.route('/kpiforcustomerdash', methods=['GET'])
def kpiforcustomerdash():
    kpis = calculate_kpis()
    limited_kpis = dict(list(kpis.items())[4:10])  # Select only KPI 5-10
    return jsonify(limited_kpis)

@app.route('/kpiforproductdash', methods=['GET'])
def kpiforproductdash():
    kpis = calculate_kpis()
    limited_kpis = dict(list(kpis.items())[10:15]) # Select only KPI 11-15
    return jsonify(limited_kpis)

@app.route('/kpiforstoredash', methods=['GET'])
def kpiforstoredash():
    kpis = calculate_kpis()
    limited_kpis = dict(list(kpis.items())[15:22]) # Select only KPI 16-22
    return jsonify(limited_kpis)

@app.route('/kpifororderdash', methods=['GET'])
def kpifororderdash():
    kpis = calculate_kpis()
    limited_kpis = dict(list(kpis.items())[22:29]) # Select only KPI 23-29
    return jsonify(limited_kpis)




def convert_to_float(df_column):
    # convert to float
    df_column = df_column.astype(float)


@app.route('/calculatestatsdetails', methods=['POST'])
def calculate_stats_details():
    request_data = request.json
    table_name = request_data.get('table_name', '')
    column_name = request_data.get('column_name', '')

    if table_name == 'products' and column_name == 'sum sales':
        query = """
        SELECT p.SKU, COUNT(oi.SKU) AS total_sales
        FROM products p
        JOIN orderitems oi ON p.SKU = oi.SKU
        GROUP BY p.SKU
        ORDER BY total_sales DESC;
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
    elif table_name == 'customers' and column_name == 'sum total':
        query = """
        SELECT customerID, SUM(total) AS total_spent
        FROM orders
        GROUP BY customerID
        ORDER BY total_spent DESC;
        """

    else:
        return jsonify({'error': 'Invalid table or column name'}), 400
        
    try:
        data = execute_query(query)
        response_data = {
            'x': [row[0] for row in data],
            'y0': [row[1] for row in data],
        }
        return jsonify(response_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

    

if __name__ == '__main__':
    app.run(debug=True)