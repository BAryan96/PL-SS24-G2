from flask import Flask, render_template, request
from DB import fetch_data, get_columns
from stats import calculate_descriptive_stats

app = Flask(__name__)

@app.route("/")
def home():
    return render_template('index.html')

@app.route("/getdata", methods=["POST"])
def get_data():
    data_choice = request.form['data-choice']
    query = f"SELECT * FROM {data_choice}"
    df = fetch_data(query)

    if df.empty:
        json_data = []
    else:
        json_data = df.to_dict(orient='records')

    relevant_columns = {
        'products': ['price'],
        'customers': ['latitude', 'longitude'],
        'orders': ['nItems', 'total'],
        'stores': ['latitude', 'longitude', 'distance']
    }
    columns = relevant_columns.get(data_choice, [])

    return render_template('index.html', data=json_data, columns=columns, table_name=data_choice)

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
            'Sum': ['sum sales', 'sum customers'],
            'Mean': ['mean order location'],
            'Median': ['median order location'],
            'Range': ['range order location'],
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

    if table_name == 'stores' and column_name == 'sum profit':
        query = """
        SELECT s.storeID, SUM(o.total) AS profit
            FROM stores s
            JOIN orders o ON s.storeID = o.storeID
            GROUP BY s.storeID
            ORDER BY profit;
        """
    
        df = fetch_data(query)

    elif table_name == 'stores' and column_name == 'sum customers':
       query = """
       SELECT s.storeID, COUNT(DISTINCT o.customerID) AS num_customers
            FROM stores s
            JOIN orders o ON s.storeID = o.storeID
            GROUP BY s.storeID
            ORDER BY num_customers;
        """
       df = fetch_data(query)

    elif table_name == 'stores' and column_name == 'sum sales':
        query = """
        SELECT s.storeID, COUNT(o.orderID) AS num_orders
            FROM stores s
            JOIN orders o ON s.storeID = o.storeID
            GROUP BY s.storeID
            ORDER BY num_orders;
        """
        df = fetch_data(query)

    elif table_name == 'stores' and column_name == 'sum sold products':
        query = """
        SELECT s.storeID, SUM(o.nItems) AS total_sold_products
            FROM stores s
            JOIN orders o ON s.storeID = o.storeID
            GROUP BY s.storeID
            ORDER BY total_sold_products;
        """
        df = fetch_data(query)

    elif table_name == 'stores' and column_name == 'mean total':
        query = """
        SELECT s.storeID, AVG(o.total) AS average_total
            FROM stores s
            JOIN orders o ON s.storeID = o.storeID
            GROUP BY s.storeID
            ORDER BY average_total;
        """
        df = fetch_data(query)

    elif table_name == 'stores' and column_name == 'mean products/order':
        query = """
        SELECT s.storeID, AVG(o.nItems) AS average_products_per_order
            FROM stores s
            JOIN orders o ON s.storeID = o.storeID
            GROUP BY s.storeID
            ORDER BY average_products_per_order;
        """
        df = fetch_data (query)

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
        df = fetch_data (query)

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
        ORDER BY s.storeID;
"""
        df = fetch_data (query)

    else:
        # Falls eine andere Berechnung gewählt wird, hier einen Platzhalter für die allgemeine Statistikberechnung
        query = f"SELECT {column_name} FROM {table_name}"
        df = fetch_data(query)
        desc_stats = calculate_descriptive_stats(df[column_name])
        return render_template('index.html', stats=desc_stats.to_dict(), table_name=table_name)

    return render_template('result.html', data=df.to_dict(orient='records'), columns=df.columns)

if __name__ == "__main__":
    app.run(debug=True)