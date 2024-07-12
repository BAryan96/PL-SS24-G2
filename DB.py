import mariadb
import sys
import csv
import os

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
        """
    }

    for table, create_statement in create_table_statements.items():
        cur.execute(create_statement)
        print(f"Checked and created table {table} if not exists")

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
