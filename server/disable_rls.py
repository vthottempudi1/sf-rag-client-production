import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

# Connect directly to PostgreSQL
conn = psycopg2.connect(
    host="localhost",
    port=54322,
    database="postgres",
    user="supabase_admin",
    password="postgres"
)

cursor = conn.cursor()

# Disable RLS on all tables
tables = [
    "users",
    "projects", 
    "project_settings",
    "project_documents",
    "document_chunks",
    "chats",
    "messages"
]

print("Disabling Row Level Security on all tables...")
for table in tables:
    try:
        cursor.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
        conn.commit()
        print(f"✓ Disabled RLS on {table}")
    except Exception as e:
        print(f"✗ Failed to disable RLS on {table}: {e}")
        conn.rollback()

cursor.close()
conn.close()

print("\n✅ RLS disabled on all tables. You can now test the API.")
