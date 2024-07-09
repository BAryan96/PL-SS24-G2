from flask import Flask, render_template, request, jsonify
from flask_caching import Cache
from DB import connect_to_database, get_cursor, check_and_create_tables, check_and_load_data, verify_table_data
import os
import sys
import math
import json

app = Flask(__name__)
cache = Cache(app, config={'CACHE_TYPE': 'simple'})  # Einfache Konfiguration für das Caching
conn = connect_to_database()
cur = get_cursor(conn)


def make_cache_key():
    return request.url + request.data.decode('utf-8')

def initialize_database():
    check_and_create_tables(cur)
    
    tables_and_csvs = {
        "stores": "CSV/stores.csv",
        "products": "CSV/products.csv",
        "orders": "CSV/orders.csv",
        "orderitems": "CSV/orderitems.csv",
        "customers": "CSV/customers.csv",
        "weather": "CSV/weather.csv"
    }
    
    for table, csv_file in tables_and_csvs.items():
        if not check_and_load_data(cur, conn, table, os.path.join(os.path.dirname(__file__), csv_file)):
            print(f"Initialization failed: {table} table could not load data from {csv_file}.")
            return False
    
    if not verify_table_data(cur):
        print("Initialization failed: Some tables have no data.")
        return False
    
    return True

@app.route("/")
def landingpage():
    return render_template('landingpage.html')

@app.route("/login")
def login():
    return render_template('login.html')

@app.route("/charts")
def charts():
    return render_template('charts.html')

@app.route("/stackedChart")
def stackedChart():
    return render_template('stackedChart.html')

@app.route("/largeScaleChart")
def largeScaleChart():
    return render_template('largeScaleChart.html')

@app.route("/donutChart")
def donutChart():
    return render_template('donutChart.html')

@app.route("/basicScatterChart")
def basicScatterChart():
    return render_template('basicScatterChart.html')

@app.route("/interactiveMap")
def interactiveMap():
    return render_template('interactiveMap.html')

@app.route("/basicBarChart")
def basicBarChart():
    return render_template('basicBarChart.html')

@app.route("/heatmap")
def heatmap():
    return render_template('heatmap.html')

@app.route("/boxplot")
def boxplot():
    return render_template('boxplot.html')

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
@cache.cached(timeout=6000, key_prefix=make_cache_key)  # Cache für 6000 Sekunden mit dynamischem Key
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
        ('stores', 'weather'): ('storeID', 'storeID'),
    }
    aggregation_functions = {
        "Sum": "SUM",
        "Max": "MAX",
        "Min": "MIN",
        "Count": "COUNT",
        "Distinct Count": "COUNT(DISTINCT",
        "Average": "AVG",
        "Variance": "VARIANCE",
        "Standard Deviation": "STDDEV",
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
                if agg in ["Distinct Count"]:
                    select_columns.append(f"{aggregation_function} {full_column_name})")
                else:
                    select_columns.append(f"{aggregation_function}({full_column_name})")


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


@app.route("/calculate_customer_distance_kpi", methods=["POST"])
@cache.cached(timeout=6000, key_prefix=make_cache_key)  # Cache for 6000 seconds with dynamic key
def calculate_customer_distance_kpi():
    if not request.is_json:
        return jsonify({"error": "Request data must be JSON"}), 415

    try:
        data_request = request.get_json()
        filters = data_request.get('filters', [])
        print("Received request data:", data_request)  # Print request data

        # Retrieve the necessary data for KPI calculation
        customer_data = get_customer_data(filters)
        store_data = get_store_data(filters)
        
        if 'error' in customer_data or 'error' in store_data:
            print("Error in data retrieval")  # Print error message
            return jsonify({"error": "Error retrieving data"}), 400
            
        # Separate customers into categories
        categorized_customers = categorize_customers(customer_data)
        
        # Calculate average distance for each category
        distances = calculate_distances(categorized_customers, store_data)
        
        print("Calculated distances:", distances)  # Print calculated distances
        return jsonify(distances)
    except Exception as e:
        print(f"Error occurred: {str(e)}")
        return jsonify({"error": str(e)}), 500


def get_customer_data(filters=[]):
    print("Fetching customer data...")  # Print message
    request_data = {
        "tables": ["customers", "customers", "customers" , "orders-Left", "orders-Left"],
        "columns": ["customerID", "latitude", "longitude", "total", "orderID"],
        "chartType": "kpi",
        "aggregations": ["", "", "", "Summe", "Anzahl"],
        "filters": filters
    }
    response = get_data_from_backend(request_data)
    if "error" not in response:
        data = {
            "customerID": response.get("x", []),
            "latitude": response.get("y0", []),
            "longitude": response.get("y1", []),
            "total_amount": response.get("y2", []),
            "order_count": response.get("y3", [])
        }
        # Combine the data into a list of tuples
        combined_data = list(zip(
            data["customerID"],
            data["latitude"],
            data["longitude"],
            data["total_amount"],
            data["order_count"]
        ))
        #print("Customer data fetched:", combined_data)  # Print fetched data
        return combined_data
    else:
        print("Error fetching customer data:", response)
        return {"error": "Error fetching customer data"}


def get_store_data(filters=[]):
    print("Fetching store data...")  # Print message
    request_data = {
        "tables": ["stores", "stores", "stores" ],
        "columns": ["storeID", "latitude", "longitude"],
        "chartType": "kpi",
        "aggregations": ["", "", ""],
        "filters": filters
    }
    response = get_data_from_backend(request_data)
    if "error" not in response:
        data = {
            "storeID": response.get("x", []),
            "store_lat": response.get("y0", []),
            "store_lon": response.get("y1", [])
        }
        # Combine the data into a list of tuples
        combined_data = list(zip(
            data["storeID"],
            data["store_lat"],
            data["store_lon"]
        ))
        #print("Store data fetched:", combined_data)  # Print fetched data
        return combined_data
    else:
        print("Error fetching store data:", response)
        return {"error": "Error fetching store data"}

    
def get_data_from_backend(request_data):
    print("Sending request to /getdata with data:", request_data)
    response = app.test_client().post(
        "/getdata",
        data=json.dumps(request_data),
        content_type='application/json'
    )

    if response.status_code == 200:
        try:
            data = response.get_json()
            #print("Response JSON data:", data)
            return data
        except json.JSONDecodeError as e:
            print("Error decoding JSON:", str(e))
            return {"error": "Error decoding JSON"}
    else:
        print("Error fetching data:", response.status_code, response.data)
        return {"error": "Error fetching data"}


def categorize_customers(customer_data):
    print("Categorizing customers...")  # Print message
    categories = {
        "All Customers": [],
        "Potential Customers": [],
        "One-Time Buyers": [],
        "Occasional Buyers": [],
        "Frequent Buyers": []
    }
    #print("test cx1", customer_data)
    for customer in customer_data:
        customerID, latitude, longitude, total_amount, order_count = customer
        categories["All Customers"].append(customer)

        if order_count == 0:
            categories["Potential Customers"].append(customer)
        elif order_count == 1:
            categories["One-Time Buyers"].append(customer)
        elif 2 <= order_count <= 20:
            categories["Occasional Buyers"].append(customer)
        else:
            categories["Frequent Buyers"].append(customer)

    #print("Customers categorized:", categories)  # Print categorized customers
    return categories


def calculate_distances(categorized_customers, store_data):
    print("Calculating distances...")  # Print message
    distances = {}

    for category, customers in categorized_customers.items():
        total_distance_km = 0
        count = 0

        for customer in customers:
            customerID, cust_lat, cust_lon, total_amount, order_count = customer
            cust_lat = float(cust_lat)  # Convert decimal.Decimal to float
            cust_lon = float(cust_lon)  # Convert decimal.Decimal to float
            min_distance_km = float('inf')

            for store in store_data:
                storeID, store_lat, store_lon = store
                store_lat = float(store_lat)  # Convert decimal.Decimal to float
                store_lon = float(store_lon)  # Convert decimal.Decimal to float
                distance_km = haversine_distance(cust_lat, cust_lon, store_lat, store_lon)
                if distance_km < min_distance_km:
                    min_distance_km = distance_km

            if min_distance_km != float('inf'):
                total_distance_km += min_distance_km
                count += 1

        average_distance_km = total_distance_km / count if count > 0 else 0
        average_distance_miles = average_distance_km * 0.621371

        distances[category] = {
            "averageDistanceKm": average_distance_km,
            "averageDistanceMiles": average_distance_miles
        }

    print("Distances calculated:", distances)  # Print calculated distances
    return distances


def haversine_distance(lat1, lon1, lat2, lon2):
    def to_radians(degrees):
        return degrees * math.pi / 180

    R = 6371  # Earth radius in km
    dLat = to_radians(lat2 - lat1)
    dLon = to_radians(lon2 - lon1)
    a = math.sin(dLat / 2) ** 2 + math.cos(to_radians(lat1)) * math.cos(to_radians(lat2)) * math.sin(dLon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


if __name__ == "__main__":
    if not initialize_database():
        print("Initialization failed.")
        sys.exit(1)
    app.run(debug=True)
