from flask import Flask
app = Flask(__name__)



@app.route("/")
def home():

    return "Hello, Flask!"





#Debug ging information.
if __name__ == "__main__":
    app.run(debug=True)