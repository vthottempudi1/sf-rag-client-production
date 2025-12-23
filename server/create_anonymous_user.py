import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

url = os.getenv("SUPABASE_API_URL")
key = os.getenv("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(url, key)

# Insert anonymous user
try:
    result = supabase.table("users").insert({
        "clerk_id": "anonymous"
    }).execute()
    print("Successfully created anonymous user")
    print(result.data)
except Exception as e:
    print(f"Error: {e}")
