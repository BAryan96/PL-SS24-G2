import mariadb
import sys

def connect_to_database():
    try:
        conn = mariadb.connect(
            user="root",
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


def fetch_data(query):
    conn = connect_to_database()
    cursor = get_cursor(conn)
    cursor.execute(query)
    rows = cursor.fetchall()
    col_names = [desc[0] for desc in cursor.description]
    df = pd.DataFrame(rows, columns=col_names)
    cursor.close()
    conn.close()
    return df