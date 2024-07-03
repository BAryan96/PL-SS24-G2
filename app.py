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

@app.route("/interactivemap")
def interactivemap():
    return render_template('interactivemap.html')

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
def storeperformancedash():
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

@app.route("/getdata", methods=["POST"])
def get_data():
    if not request.is_json:
        return jsonify({"error": "Request data must be JSON"}), 415

    data = request.get_json()

    #data =  {'tables': ['orders', 'orders'], 'columns': ['orderDate-MM.YYYY', 'total'], 'chartType': 'bar', 'aggregations': ['', 'Summe'], 'filters': [] }
   #data =  Received JSON data: {'tables': ['stores', 'orders'], 'columns': ['state', 'total'], 'chartType': 'bar', 'aggregations': ['', 'Summe'], 'filters': []}
    print("Received JSON data:", data)

    required_fields = ['tables', 'columns', 'chartType', 'aggregations']
    missing_fields = [field for field in required_fields if field not in data]

    if missing_fields:
        return jsonify({"error": f"Missing required fields: {', '.join(missing_fields)}"}), 400

    tables = data['tables']
    columns = data['columns']
    chart_type = data['chartType']
    aggregations = data['aggregations']
    filters = data.get('filters', [])
    orderby = data.get('orderby', [])

    if not isinstance(tables, list) or not isinstance(columns, list) or not isinstance(aggregations, list) or not isinstance(orderby, list):
        return jsonify({"error": "Tables, columns, aggregations, and orderby must be lists"}), 400

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
        "Median": "PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY",
        "Erstes Quartil": "PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY",
        "Drittes Quartil": "PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY"
    }

    date_formats = {
        '-DD.MM.YYYY HH24:MI:SS': '%d.%m.%Y %H:%i:%s',
        '-DD.MM.YYYY HH24:MI': '%d.%m.%Y %H:%i',
        '-DD.MM.YYYY HH24': '%d.%m.%Y %H',
        '-DD.MM.YYYY': '%d.%m.%Y',
        '-DD.MM': '%d.%m',
        '-DD.YYYY': '%d.%Y',
        '-MM.YYYY': '%m.%Y',
        '-YYYY.MM': '%Y.%m',
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
                
                full_column_name = None
                for suffix, date_format in date_formats.items():
                    if filter_column.endswith(suffix):
                        filter_column = filter_column[: -len(suffix)]
                        full_column_name = f"DATE_FORMAT({filter_table}.{filter_column}, '{date_format}')"
                        break
                if not full_column_name:
                    full_column_name = f"{filter_table}.{filter_column}"

                filter_clauses.append(f"{full_column_name} = '{filter_value}'")
            else:
                or_clauses = []
                for filter in chart_filter_list:
                    filter_table = filter.get('filterTable')
                    filter_column = filter.get('filterColumn')
                    filter_value = filter.get('filterValue')
                    if not filter_table or not filter_column or filter_value is None:
                        return jsonify({"error": "Each filter must have filterTable, filterColumn, and filterValue"}), 400
                    
                    full_column_name = None
                    for suffix, date_format in date_formats.items():
                        if filter_column.endswith(suffix):
                            filter_column = filter_column[: -len(suffix)]
                            full_column_name = f"DATE_FORMAT({filter_table}.{filter_column}, '{date_format}')"
                            break
                    if not full_column_name:
                        full_column_name = f"{filter_table}.{filter_column}"

                    or_clauses.append(f"{full_column_name} = '{filter_value}'")
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
                    select_columns.append(f"{aggregation_function} {full_column_name})")
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

    if orderby:
        orderby_columns = []
        for table, col, orby in zip(tables, columns, orderby):
            if orby:
                table = table.split('-')[0]  # Remove join suffix for SQL usage
                full_column_name = None
                for suffix, date_format in date_formats.items():
                    if col.endswith(suffix):
                        col = col[: -len(suffix)]
                        full_column_name = f"DATE_FORMAT({table}.{col}, '{date_format}')"
                        break
                if not full_column_name:
                    full_column_name = f"{table}.{col}"
                
                orderby_columns.append(f"{full_column_name} {orby.upper()}")
        if orderby_columns:
            query += f" ORDER BY {', '.join(orderby_columns)}"

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



def fetch_data(query, conn):
    cursor = conn.cursor()
    
    try:
        cursor.execute(query)
        rows = cursor.fetchall()
        
        if cursor.description is None:
            raise ValueError("Die Abfrage hat keine beschreibenden Informationen zurückgegeben. Überprüfen Sie die SQL-Abfrage.")
        
        column_names = [desc[0] for desc in cursor.description]
        
        return pd.DataFrame(rows, columns=column_names)
    except Exception as e:
        print(f"Fehler beim Abrufen der Daten: {e}")
        return None
    finally:
        cursor.close()

def fetch_all_data():
    conn = connect_to_database()
    
    try:
        orders_query = """
            SELECT orderID, orderDate, storeID, total, customerID, nItems AS quantity
            FROM orders
        """
        orders = fetch_data(orders_query, conn)
        
        order_items_query = """
            SELECT orderID, SKU
            FROM orderitems
        """
        order_items = fetch_data(order_items_query, conn)
        
        products_query = """
            SELECT SKU, category, price, name, size
            FROM products
        """
        products = fetch_data(products_query, conn)
        
        customers_query = """
            SELECT customerID, latitude AS customer_lat, longitude AS customer_lon
            FROM customers
        """
        customers = fetch_data(customers_query, conn)
        
        stores_query = """
            SELECT storeID, latitude AS store_lat, longitude AS store_lon, city, state
            FROM stores
        """
        stores = fetch_data(stores_query, conn)
        
        return orders, order_items, products, customers, stores
    finally:
        conn.close()

def calculate_sales_performance_kpis():
    orders, _, _, _, _ = fetch_all_data()
    
    revenue = orders['total'].sum()
    units_sold = orders['quantity'].sum()
    avg_order_value = orders['total'].mean()
    reorder_rate = orders.groupby('customerID').size().mean()
    
    return {
        'revenue': f'${float(revenue):.2f}',
        'units_sold': int(units_sold),
        'avg_order_value': f'${float(avg_order_value):.2f}',
        'reorder_rate': float(reorder_rate)
    }

def calculate_customer_kpis():
    try:
        orders, _, _, customers, stores = fetch_all_data()

        print("Orders DataFrame:")
        print(orders.head())
        
        print("Customers DataFrame:")
        print(customers.head())
        
        print("Stores DataFrame:")
        print(stores.head())

        orders = orders.merge(customers, on='customerID', how='inner')
        orders = orders.merge(stores, on='storeID', how='inner')

        def calculate_distance(row):
            customer_coords = (row['customer_lat'], row['customer_lon'])
            store_coords = (row['store_lat'], row['store_lon'])
            return geodesic(customer_coords, store_coords).miles

        average_distance_miles = new_func(orders, calculate_distance)
        average_distance_km = average_distance_miles * 1.60934
        
        print("Orders DataFrame after merging:")
        print(orders.head())
        
        clv_df = orders.groupby('customerID')['total'].sum()
        average_clv = round(clv_df.mean(), 2)
        
        customer_orders = orders.groupby('customerID').size()
        regular_customers = (customer_orders > 5).sum()
        occasional_customers = ((customer_orders > 1) & (customer_orders <= 5)).sum() 
        one_time_customers = (customer_orders == 1).sum()
        potential_customers = (customer_orders == 0).sum()
        
        return {
            'average_distance_miles': float(average_distance_miles),
            'average_distance_km': float(average_distance_km),
            'average_clv': float(average_clv),
            'regular_customers': int(regular_customers),
            'occasional_customers': int(occasional_customers),
            'one_time_customers': int(one_time_customers),
            'potential_customers': int(potential_customers)
        }
    except Exception as e:
        print(f"Fehler bei der Berechnung der Kunden-KPIs: {e}")
        return {}

def new_func(orders, calculate_distance):
    orders['distance'] = orders.apply(calculate_distance, axis=1)
    average_distance = orders['distance'].mean()
    return average_distance

def calculate_product_performance_kpis():
    orders, order_items, products, _, _ = fetch_all_data()

    df = order_items.merge(products, on='SKU', how='outer')
    df = df.merge(orders, on='orderID', how='outer')

    df['total'] = pd.to_numeric(df['total'], errors='coerce')
    df['quantity'] = pd.to_numeric(df['quantity'], errors='coerce')
    
    product_performance = df.groupby(['name', 'category', 'size']).agg({
        'quantity': 'sum',
        'total': 'sum'
    }).rename(columns={'quantity': 'units_sold', 'total': 'revenue'}).reset_index()
    
    top_3_units_sold = product_performance.nlargest(3, 'units_sold')
    top_3_revenue = product_performance.nlargest(3, 'revenue').round(2)
    bottom_3_units_sold = product_performance.nsmallest(3, 'units_sold')
    bottom_3_revenue = product_performance.nsmallest(3, 'revenue').round(2)

    top_3_revenue['revenue'] = top_3_revenue['revenue'].apply(lambda x: f'${x:.2f}')
    bottom_3_revenue['revenue'] = bottom_3_revenue['revenue'].apply(lambda x: f'${x:.2f}')
    top_3_units_sold['revenue'] = top_3_units_sold['revenue'].apply(lambda x: f'${x:.2f}')
    bottom_3_units_sold['revenue'] = bottom_3_units_sold['revenue'].apply(lambda x: f'${x:.2f}')
    
    return {
        'top_3_units_sold': top_3_units_sold.astype(str).to_dict('records'),
        'top_3_revenue': top_3_revenue.astype(str).to_dict('records'),
        'bottom_3_units_sold': bottom_3_units_sold.astype(str).to_dict('records'),
        'bottom_3_revenue': bottom_3_revenue.astype(str).to_dict('records')
    }

def calculate_store_performance_kpis():
    orders, _, _, _, stores = fetch_all_data()

    df = orders.merge(stores, on='storeID', how='inner')
    
    store_performance = df.groupby(['storeID', 'city', 'state']).agg({
        'quantity': 'sum',
        'total': 'sum'
    }).rename(columns={'quantity': 'units_sold', 'total': 'revenue'}).reset_index()

    store_performance['revenue'] = pd.to_numeric(store_performance['revenue'], errors='coerce')
    store_performance['units_sold'] = pd.to_numeric(store_performance['units_sold'], errors='coerce')
    
    reorder_df = df.groupby(['storeID', 'customerID']).size().reset_index(name='orders')
    store_reorder_rate = reorder_df.groupby('storeID')['orders'].mean().reset_index()
    best_store_reorder_rate = store_reorder_rate.nlargest(1, 'orders')

    top_3_units_sold_stores = store_performance.nlargest(3, 'units_sold').round(2)
    top_3_units_sold_stores = top_3_units_sold_stores.drop(columns=['revenue'])
    bottom_3_units_sold_stores = store_performance.nsmallest(3, 'units_sold').round(2)
    bottom_3_units_sold_stores = bottom_3_units_sold_stores.drop(columns=['revenue'])
    
    top_3_revenue_stores = store_performance.nlargest(3, 'revenue')
    top_3_revenue_stores = top_3_revenue_stores.drop(columns=['units_sold'])
    bottom_3_revenue_stores = store_performance.nsmallest(3, 'revenue').round(2)
    bottom_3_revenue_stores = bottom_3_revenue_stores.drop(columns=['units_sold'])
    
    top_3_revenue_stores['revenue'] = top_3_revenue_stores['revenue'].apply(lambda x: f'${x:.2f}')
    bottom_3_revenue_stores['revenue'] = bottom_3_revenue_stores['revenue'].apply(lambda x: f'${x:.2f}')
    
    return {
        'best_store_reorder_rate': best_store_reorder_rate.astype(str).to_dict('records'),
        'top_3_units_sold_stores': top_3_units_sold_stores.astype(str).to_dict('records'),
        'top_3_revenue_stores': top_3_revenue_stores.astype(str).to_dict('records'),
        'bottom_3_units_sold_stores': bottom_3_units_sold_stores.astype(str).to_dict('records'),
        'bottom_3_revenue_stores': bottom_3_revenue_stores.astype(str).to_dict('records')
    }

@app.route('/kpiforsalesperformancedash', methods=['GET'])
def kpiforsalesperformancedash():
    kpis = calculate_sales_performance_kpis()
    return jsonify(kpis)

@app.route('/kpiforcustomerdash', methods=['GET'])
def kpiforcustomerdash():
    kpis = calculate_customer_kpis()
    return jsonify(kpis)

@app.route('/kpiforproductdash', methods=['GET'])
def kpiforproductdash():
    kpis = calculate_product_performance_kpis()
    return jsonify(kpis)

@app.route('/kpiforstoredash', methods=['GET'])
def kpiforstoredash():
    kpis = calculate_store_performance_kpis()
    return jsonify(kpis)

if __name__ == '__main__':
    app.run(debug=True)