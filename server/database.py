# Helper function to fetch single or multiple documents
def fetch_documents(table, **filters):
    query = supabase.table(table).select("*")
    for key, value in filters.items():
        query = query.eq(key, value)
    # If 'id' is in filters, assume single document
    if 'id' in filters:
        result = query.single().execute()
        return result.data  # dict or None
    else:
        result = query.execute()
        return result.data  # list of dicts
import os
from dotenv import load_dotenv
from supabase import create_client, Client
import boto3

load_dotenv()

#Supabase setup
supabase_url = os.getenv("SUPABASE_API_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_KEY")
#supabase: Client = create_client(supabase_url, supabase_key)
if not supabase_url or not supabase_key:
    raise ValueError("Missing Supabase credentials in environment variables")

supabase: Client = create_client(supabase_url, supabase_key)



#S3 setup

s3_client = boto3.client(
    "s3",
    endpoint_url =os.getenv("AWS_ENDPOINT_URL_S3"),
    region_name=os.getenv("AWS_REGION"),
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY")
)
BUCKET_NAME = os.getenv("AWS_S3_BUCKET_NAME")