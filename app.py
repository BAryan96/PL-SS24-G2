from flask import Flask, render_template, request
from DB import connect_to_database, get_cursor

app = Flask(__name__)

conn = connect_to_database()
cur = get_cursor(conn)

@app.route("/")
def home():
    return render_template('index.html')

@app.route("/getdata", methods=["POST"])
def get_data():
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


#@app.route("/login")
#def home():
 #   return render_template('HTML/loginpage.html')
    #so immer auf die html pages linken