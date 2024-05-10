import mariadb
import sys

def connect_to_database():
    try:
        conn = mariadb.connect(
            user="micho",
            password="123",
            host="127.0.0.1",
            port=3306,
            database="pizzag2"
        )
        print("Database connection successful.")
        return conn
    except mariadb.Error as e:
        print(f"Error connecting to MariaDB Platform: {e}")
        sys.exit(1)

def get_cursor(conn):
    return conn.cursor()
