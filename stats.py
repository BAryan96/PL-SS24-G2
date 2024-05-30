import pandas as pd

def calculate_descriptive_stats(df_column):
    # convert to float
    df_column = df_column.astype(float)
    
    stats = {
        'Sum': df_column.sum(),
        'Mean': df_column.mean(),
        'Median': df_column.median(),
        'Range': df_column.max() - df_column.min(),
        'Standard Deviation': df_column.std(),
        'Q1': df_column.quantile(0.25),
        'Q2': df_column.quantile(0.5),  # Equivalent to Median
        'Q3': df_column.quantile(0.75)
    }
    stats_df = pd.DataFrame([stats])
    return stats_df
    