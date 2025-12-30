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

print("=== Checking database contents ===\n")

# Check users
cursor.execute("SELECT id, clerk_id, email, created_at FROM users ORDER BY created_at DESC LIMIT 5")
users = cursor.fetchall()
print(f"Users ({len(users)} found):")
for user in users:
    print(f"  - ID: {user[0]}, clerk_id: {user[1]}, email: {user[2]}")

# Check projects
cursor.execute("SELECT id, name, clerk_id, created_at FROM projects ORDER BY created_at DESC LIMIT 5")
projects = cursor.fetchall()
print(f"\nProjects ({len(projects)} found):")
for project in projects:
    print(f"  - ID: {project[0]}, name: {project[1]}, clerk_id: {project[2]}")

# Check if there are any settings
cursor.execute("SELECT COUNT(*) FROM project_settings")
settings_count = cursor.fetchone()[0]
print(f"\nProject Settings: {settings_count} records")

# Check if there are any chats
cursor.execute("SELECT COUNT(*) FROM chats")
chats_count = cursor.fetchone()[0]
print(f"Chats: {chats_count} records")

# Check if there are any documents
cursor.execute("SELECT COUNT(*) FROM project_documents")
docs_count = cursor.fetchone()[0]
print(f"Documents: {docs_count} records")

cursor.close()
conn.close()
