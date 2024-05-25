from flask import Flask, render_template, request, jsonify
from DB import connect_to_database, get_cursor

app = Flask(__name__)

conn = connect_to_database()
cur = get_cursor(conn)

@app.route("/")
def home():
    return render_template('index.html')

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
    #Hier änderungen hinzufügen


    table = request.form['table']
    column = request.form['column']
    cur.execute(f"SELECT {column} FROM {table}")
    data = [row[0] for row in cur.fetchall()]
    return jsonify({"data": data})

@app.route("/test")
def test():
    return render_template('test.html')

@app.route("/get_table", methods=["POST"])
def get_table():
    data_choice = request.form['data-choice']
    cur.execute(f"SELECT * FROM {data_choice}")
    row_headers = [x[0] for x in cur.description]  # Dies holt die Spaltennamen
    results = cur.fetchall()
    json_data = []
    for result in results:
        json_data.append(dict(zip(row_headers, result)))
    return render_template('index.html', data=json_data)

if __name__ == "__main__":
    app.run(debug=True)
