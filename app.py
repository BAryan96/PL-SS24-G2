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
        json_data = df.to_dict(orient='records')  # Konvertiere den DataFrame in eine Liste von Diktaten

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

if __name__ == "__main__":
    app.run(debug=True)