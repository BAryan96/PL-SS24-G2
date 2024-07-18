import mariadb
import sys
import csv
import os
from datetime import datetime

def connect_to_database():
    try:
        conn = mariadb.connect(
            user="root",
            password="123",
            host="127.0.0.1",
            port=3306,
            database="pizzag2"
        )
        conn.cursor().execute("SET time_zone = '+00:00';")
        print("Database connection successful.")
        return conn
    except mariadb.Error as e:
        print(f"Error connecting to MariaDB Platform: {e}")
        sys.exit(1)

def get_cursor(conn):
    return conn.cursor()

def check_and_create_tables(cur):
    create_table_statements = {
        "stores": """
            CREATE TABLE IF NOT EXISTS stores (
                storeID CHAR(7) PRIMARY KEY,
                zipcode INT(5),
                state_abbr CHAR(2),
                latitude DECIMAL(17,15),
                longitude DECIMAL(18,15),
                city TEXT,
                state TEXT,
                distance DECIMAL(21,16)
            )
        """,
        "products": """
            CREATE TABLE IF NOT EXISTS products (
                SKU CHAR(5) PRIMARY KEY,
                Name TEXT,
                Price DECIMAL(20,2),
                Category TEXT,
                Size TEXT,
                Ingredients TEXT,
                Launch DATE
            )
        """,
        "customers": """
            CREATE TABLE IF NOT EXISTS customers (
                customerID CHAR(7) PRIMARY KEY,
                latitude DECIMAL(17,15),
                longitude DECIMAL(18,15)
            )
        """,
        "weather": """
            CREATE TABLE IF NOT EXISTS weather (
                date_time DATETIME,
                temperature FLOAT,
                dew_point FLOAT,
                relative_humidity FLOAT,
                precipitation FLOAT,
                snowfall FLOAT,
                wind_direction FLOAT,
                wind_speed FLOAT,
                wind_gust FLOAT,
                pressure FLOAT,
                sunshine_duration FLOAT,
                condition_code FLOAT,
                storeID CHAR(7),
                PRIMARY KEY (date_time, storeID)
            )
        """, 
        "orders": """
            CREATE TABLE IF NOT EXISTS orders (
                orderID BIGINT(20) PRIMARY KEY,
                customerID CHAR(7),
                storeID CHAR(7),
                orderDate DATETIME,
                nItems BIGINT(20),
                total DECIMAL(20,2),
                FOREIGN KEY (customerID) REFERENCES customers(customerID),
                FOREIGN KEY (storeID) REFERENCES stores(storeID)
            )
        """, 
        "orderitems": """
            CREATE TABLE IF NOT EXISTS orderitems (
                SKU CHAR(5),
                orderID BIGINT(20),
                FOREIGN KEY (SKU) REFERENCES products(SKU),
                FOREIGN KEY (orderID) REFERENCES orders(orderID)
            )
        """
    }

    for table, create_statement in create_table_statements.items():
        cur.execute(create_statement)
        print(f"Checked and created table {table} if not exists")

def convert_datetime(datetime_str):
    if datetime_str:
        try:
            dt = datetime.fromisoformat(datetime_str.replace('Z', '+00:00'))
            return dt.strftime('%Y-%m-%d %H:%M:%S')
        except ValueError:
            return None
    return None

def load_data_from_csv(cur, conn, table_name, csv_file_path):
    if not os.path.isfile(csv_file_path):
        print(f"Error: CSV file not found: {csv_file_path}")
        return False

    with open(csv_file_path, 'r', newline='', encoding='utf-8') as csvfile:
        reader = csv.reader(csvfile)
        headers = next(reader)  # Skip the header row
        placeholders = ','.join(['%s'] * len(headers))
        query = f"INSERT INTO {table_name} ({','.join(headers)}) VALUES ({placeholders})"
        for row in reader:
            # Replace empty strings with None
            row = [None if col == '' else col for col in row]
            if table_name == 'orders' and row[3]:
                row[3] = convert_datetime(row[3])  # Convert the datetime string
            try:
                cur.execute(query, row)
            except mariadb.Error as e:
                print(f"Error inserting row {row}: {e}")
                return False
        conn.commit()
        print(f"Loaded data into {table_name} from {csv_file_path}")
    return True

def check_and_load_data(cur, conn, table_name, csv_file_path):
    cur.execute(f"SELECT COUNT(*) FROM {table_name}")
    count = cur.fetchone()[0]
    if count == 0:
        print(f"Table {table_name} is empty. Attempting to load data from {csv_file_path}")
        if not load_data_from_csv(cur, conn, table_name, csv_file_path):
            return False
    else:
        print(f"Table {table_name} is not empty. It has {count} rows. Skipping CSV load.")
    return True

def verify_table_data(cur):
    tables = ["stores", "products", "orders", "orderitems", "customers", "weather"]
    all_tables_have_data = True
    for table in tables:
        cur.execute(f"SELECT COUNT(*) FROM {table}")
        count = cur.fetchone()[0]
        if count == 0:
            print(f"Error: Table {table} has no data.")
            all_tables_have_data = False
        else:
            print(f"Table {table} has {count} rows.")
    return all_tables_have_data

# Example usage
conn = connect_to_database()
cur = get_cursor(conn)
check_and_create_tables(cur)

# Replace the path with the correct paths to your CSV files
csv_files = {
    "stores": "CSV/stores.csv",
    "products": "CSV/products.csv",
    "customers": "CSV/customers.csv",  # Load customers before orders
    "orders": "CSV/orders.csv",
    "orderitems": "CSV/orderitems.csv",
    "weather": "CSV/weather.csv"
}

for table, csv_file in csv_files.items():
    if not check_and_load_data(cur, conn, table, csv_file):
        print(f"Initialization failed: {table} table could not load data from {csv_file}.")
        sys.exit(1)

if verify_table_data(cur):
    print("All tables have data.")
else:
    print("Some tables are missing data.")

cur.close()
conn.close()