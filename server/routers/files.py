from fastapi import APIRouter, Depends, FastAPI, HTTPException
from pydantic import BaseModel
from database import supabase
from typing import Optional
import uuid
from tasks import process_document

import os
from dotenv import load_dotenv

load_dotenv()  # Make sure this is called before accessing os.environ

from auth import get_current_user

import boto3

s3_client = boto3.client(
    's3',
    aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
    aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    region_name=os.environ.get('AWS_REGION', 'us-east-1'),
    endpoint_url=os.environ.get('AWS_ENDPOINT_URL_S3')  # Optional, only if using a custom endpoint
)
bucket_name = os.environ['AWS_S3_BUCKET_NAME']


router = APIRouter(
    tags=["files"]
)

class FileUploadRequest(BaseModel):
    filename: str
    file_size: int
    file_type: str
    
@router.get("/api/projects/{project_id}/files")
async def get_project_chats(
    project_id: str,
    clerk_id:str =Depends(get_current_user)
):
    try:
        # Get all files for this project -FK constraints ensure project exists and belongs to the user
        result = supabase.table("project_documents").select("*").eq("project_id", project_id).eq("clerk_id", clerk_id).order("created_at", desc=True).execute()
        
        return {
            "message": "Project files retrieved successfully",
            "data": result.data or []
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get project files: {str(e)}" 
)
    
@router.post("/api/projects/{project_id}/files/upload-url")
async def get_file_upload_url(
    project_id: str,
    file_request: FileUploadRequest,
    clerk_id: str = Depends(get_current_user)
):
    try:
        # Verify project exists and belongs to user
        project_result = supabase.table("projects").select("*").eq("id", project_id).eq("clerk_id", clerk_id).execute()
        if not project_result.data:
            raise HTTPException(status_code=404, detail="Project not found or not authorized")

        # Generate pre-signed S3 upload URL
        file_extension = file_request.filename.split(".")[-1] if '.' in file_request.filename else ""
        uniq_id = str(uuid.uuid4())
        s3_key = f"Projects/{project_id}/documents/{uniq_id}.{file_extension}"

        # Generate presigned URL (expire in 1 hour)
        presigned_url = s3_client.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': bucket_name,
                'Key': s3_key,
                'ContentType': file_request.file_type
            },
            ExpiresIn=3600
        )

        # Create a record with pending status
        document_result = supabase.table("project_documents").insert({
            "project_id": project_id,
            "clerk_id": clerk_id,
            "filename": file_request.filename,
            "s3_key": s3_key,
            "file_size": file_request.file_size,
            "file_type": file_request.file_type,
            "source_type": "file",  # ← IMPORTANT: Set source_type for files
            "processing_status": "uploading"
        }).execute()

        if not document_result.data:
            raise HTTPException(status_code=500, detail="Failed to create document record")

        # Fetch the full document record after insert
        document_id = document_result.data[0]["id"]
        full_doc_result = supabase.table("project_documents").select("*").eq("id", document_id).single().execute()
        document = full_doc_result.data if full_doc_result.data else document_result.data[0]

        return {
            "message": "Upload URL generated successfully",
            "data": {
                "upload_url": presigned_url,
                "document": document,
                "s3_key": s3_key
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate upload URL: {str(e)}")



@router.post("/api/projects/{project_id}/files/confirm")
async def confirm_file_upload(
    project_id: str,
    confirm_request: dict,
    clerk_id: str = Depends(get_current_user)
):
    try:
        s3_key = confirm_request.get("s3_key")
        if not s3_key:
            raise HTTPException(status_code=400, detail="s3_key is required")
        # Update document status to 'uploaded'
        update_result = supabase.table("project_documents").update({
            "processing_status": "queued"
        }).eq("project_id", project_id).eq("clerk_id", clerk_id).eq("s3_key", s3_key).execute()
        document = update_result.data[0]
        document_id = document['id']

        if not update_result.data or len(update_result.data) == 0:
            raise HTTPException(status_code=404, detail="Document not found or not authorized")

        # Fetch the full document after update (by s3_key)
        updated_doc_result = supabase.table("project_documents").select("*").eq("s3_key", s3_key).single().execute()
        updated_doc = updated_doc_result.data

        #Start background processing task

        # Trigger Celery task to process the document
        task = process_document.delay(document_id)
        print(f"Started Celery task with ID: {task.id}")

        #store this task ID so that we can track it later if nedded
        supabase.table("project_documents").update({
            "task_id": str(task.id)
        }).eq("id", document_id).execute()


        #Return JASON response
        return {
            "message": "File upload confirmed and processing started with Celery",
            "data": updated_doc
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to confirm file upload: {str(e)}")


class UrlAddRequest(BaseModel):
    url: str

@router.post("/api/projects/{project_id}/urls")
async def add_website_url(
    project_id: str,
    url_request: UrlAddRequest,
    clerk_id: str = Depends(get_current_user)
):
    try:
        url = url_request.url.strip()
        if not url.startswith(("http://","https://")):
            url = "https://" + url

        # Insert new URL record
        insert_result = supabase.table("project_documents").insert({
            "project_id": project_id,
            "clerk_id": clerk_id,
            "source_url": url,
            "filename": url,
            "s3_key": "",  # Empty for URLs
            "file_size": 0,
            "file_type": "text/html",
            "source_type": "url",  # ← CRITICAL FIX: Set source_type for URLs
            "processing_status": "queued"
        }).execute()

        if not insert_result.data:
            raise HTTPException(status_code=500, detail="Failed to create URL record")

        created_url_record = insert_result.data[0]
        document_id = created_url_record["id"]
        # Trigger Celery task to process the URL
        task = process_document.delay(document_id)
        print(f"Started Celery task with ID: {task.id} for URL processing")
        #store this task ID so that we can track it later if nedded
        supabase.table("project_documents").update({
            "task_id": str(task.id)
        }).eq("id", document_id).execute()

        return {
            "message": "Website URL added successfully and processing started",
            "data": created_url_record
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to add website URL: {str(e)}")
    
@router.delete("/api/projects/{project_id}/files/{file_id}")
async def delete_project_file(
    project_id: str,
    file_id: str,
    clerk_id: str = Depends(get_current_user)
):
    try:
        # Get the document to find its S3 key
        try:
            doc_result = supabase.table("project_documents").select("*").eq("id", file_id).eq("project_id", project_id).eq("clerk_id", clerk_id).single().execute()
            if not doc_result.data:
                return {"message": "Document not found or already deleted", "data": None}
            s3_key = doc_result.data.get("s3_key")
        except Exception as e:
            return {"message": "Document not found or already deleted", "data": None}

        # Delete the document record from the database
        delete_result = supabase.table("project_documents").delete().eq("id", file_id).eq("project_id", project_id).eq("clerk_id", clerk_id).execute()
        if not delete_result.data or len(delete_result.data) == 0:
            raise HTTPException(status_code=404, detail="Document not found or not authorized")

        # Delete the file from S3 if it has an S3 key
        if s3_key:
            s3_client.delete_object(Bucket=bucket_name, Key=s3_key)

        return {
            "message": "Project file deleted successfully",
            "data": delete_result.data[0]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete project file: {str(e)}")

@router.get("/api/projects/{project_id}/files/{file_id}/chunks")
async def get_file_chunks(project_id: str, file_id: str, clerk_id: str = Depends(get_current_user)):
    try:
        # Check that the document exists and belongs to the user
        doc_result = supabase.table("project_documents").select("*").eq("id", file_id).eq("project_id", project_id).eq("clerk_id", clerk_id).single().execute()
        if not doc_result.data:
            raise HTTPException(status_code=404, detail="Document not found or not authorized")

        # Fetch all chunks for this document
        chunks_result = supabase.table("document_chunks").select("*").eq("document_id", file_id).order("chunk_index").execute()
        return chunks_result.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get file chunks: {str(e)}")
