import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

url = os.getenv("SUPABASE_API_URL")
key = os.getenv("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

# Alter the projects table to make clerk_id nullable
try:
    result = supabase.rpc('exec_sql', {
        'sql': 'ALTER TABLE projects ALTER COLUMN clerk_id DROP NOT NULL;'
    }).execute()
    print("Successfully altered projects table")
except Exception as e:
    print(f"Error: {e}")
    # Try direct SQL if RPC doesn't work
    print("Trying alternative approach...")
