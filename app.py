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

    json_data = df.to_dict(orient='records')  # Konvertiere den DataFrame in eine Liste von Diktaten

    relevant_columns = {
        'products': ['price'],
        'customers': ['latitude', 'longitude'],
        'orders': ['nItems', 'total'],
        'stores': ['latitude', 'longitude', 'distance']
    }
    columns = relevant_columns.get(data_choice, [])

    return render_template('index.html', data=json_data, columns=columns, table_name=data_choice)

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

if __name__ == "__main__":
    app.run(debug=True)
