from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
from pydantic import BaseModel
from database import supabase
from typing import Optional

from auth import get_current_user_clerk_id

router = APIRouter(
    tags=["Projects"]
)

class ProjectCreate(BaseModel):
    name: str
    description: str = ""


class ProjectSettings(BaseModel):
    embedding_model: Optional[str] = None
    rag_strategy: Optional[str] = None
    agent_type: Optional[str] = None
    chunks_per_search: Optional[int] = None
    final_context_size: Optional[int] = None
    similarity_threshold: Optional[float] = None
    number_of_queries: Optional[int] = None
    reranking_enabled: Optional[bool] = None
    reranking_model: Optional[str] = None
    vector_weight: Optional[float] = None
    keyword_weight: Optional[float] = None

@router.get("/api/projects")
def get_projects():
    try:
        result = supabase.table("projects").select("*").execute()
        return {
            "message": "Projects retrieved successfully", 
            "data": result.data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get projects: {str(e)}")

@router.get("/api/projects/{project_id}")
async def get_project_details(
    project_id: str,
    current_user_clerk_id: str = Depends(get_current_user_clerk_id)
):
    try:
        result = supabase.table("projects").select("*").eq("id", project_id).eq("clerk_id", current_user_clerk_id).execute()
        if not result.data or len(result.data) == 0:
            raise HTTPException(status_code=404, detail="Project not found")
        return {
            "message": "Project retrieved successfully",
            "data": result.data[0]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get project: {str(e)}")
    
@router.post("/api/projects")
async def create_project(
    project: ProjectCreate,
    current_user_clerk_id: str = Depends(get_current_user_clerk_id)
):
    try:
        # Ensure user exists in users table (auto-create if not)
        user_check = supabase.table("users").select("*").eq("clerk_id", current_user_clerk_id).execute()
        if not user_check.data:
            user_insert = supabase.table("users").insert({"clerk_id": current_user_clerk_id}).execute()
            if not user_insert.data:
                raise HTTPException(status_code=500, detail="Failed to create user for project")

        project_result = supabase.table("projects").insert({
            "name": project.name,
            "description": project.description,
            "clerk_id": current_user_clerk_id
        }).execute()
        if not project_result.data:
            raise HTTPException(status_code=500, detail="Failed to create project")
        created_project = project_result.data[0]
        project_id = created_project["id"]
        # Create default settings for the project
        settings_result = supabase.table("project_settings").insert({
            "project_id": project_id,
            "embedding_model": "text-embedding-3-small",
            "rag_strategy": "basic",
            "agent_type": "agentic",
            "chunks_per_search": 10,
            "final_context_size": 5,
            "similarity_threshold": 0.3,
            "number_of_queries": 5,
            "reranking_enabled": True,
            "reranking_model": "rerank-english-v3.0",
            "vector_weight": 0.7,
            "keyword_weight": 0.3
        }).execute()
        if not settings_result.data:
            supabase.table("projects").delete().eq("id", project_id).execute()
            raise HTTPException(status_code=500, detail="Failed to create project settings")
        return {
            "message": "Project created successfully",
            "data": created_project
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create project: {str(e)}")

@router.delete("/api/projects/{project_id}")
def delete_project(project_id: str):
    try:
        # Verify project exists
        project_check = supabase.table("projects").select("*").eq("id", project_id).execute()
        if not project_check.data:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Delete project settings
        supabase.table("project_settings").delete().eq("project_id", project_id).execute()
        
        # Delete project
        deleted_result = supabase.table("projects").delete().eq("id", project_id).execute()
        
        if not deleted_result.data:
            raise HTTPException(status_code=500, detail="Failed to delete project")
        
        return {
            "message": "Project deleted successfully",
            "data": deleted_result.data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete project: {str(e)}")

@router.get("/api/projects/{project_id}/chats")
async def get_project_chats(
    project_id: str,
    current_user_clerk_id: str = Depends(get_current_user_clerk_id)
):
    try:
        result = supabase.table("chats").select("*").eq("project_id", project_id).eq("clerk_id", current_user_clerk_id).order("created_at", desc=True).execute()
        return {
            "message": "Project chats retrieved successfully",
            "data": result.data or []
        }
    except Exception as e:
        # Return empty array if table doesn't exist
        if "PGRST" in str(e):
            return {
                "message": "Project chats retrieved successfully",
                "data": []
            }
        raise HTTPException(status_code=500, detail=f"Failed to get project chats: {str(e)}")

@router.get("/api/projects/{project_id}/settings")
async def get_project_settings(
    project_id: str,
    current_user_clerk_id: str = Depends(get_current_user_clerk_id)
):
    try:
        # Verify user owns the project
        project_check = supabase.table("projects").select("id").eq("id", project_id).eq("clerk_id", current_user_clerk_id).execute()
        if not project_check.data:
            raise HTTPException(status_code=404, detail="Project not found")
        settings_result = supabase.table("project_settings").select("*").eq("project_id", project_id).execute()
        if not settings_result.data or len(settings_result.data) == 0:
            # Return default settings if not found
            return {
                "message": "Project settings retrieved successfully",
                "data": {
                    "project_id": project_id,
                    "embedding_model": "text-embedding-3-small",
                    "rag_strategy": "basic",
                    "agent_type": "agentic"
                }
            }
        return {
            "message": "Project settings retrieved successfully",
            "data": settings_result.data[0]
        }
    except Exception as e:
        # Return default settings if table doesn't exist
        if "PGRST" in str(e):
            return {
                "message": "Project settings retrieved successfully",
                "data": {
                    "project_id": project_id,
                    "embedding_model": "text-embedding-3-small",
                    "rag_strategy": "basic",
                    "agent_type": "agentic"
                }
            }
        raise HTTPException(status_code=500, detail=f"Failed to get project settings: {str(e)}")

@router.get("/api/projects/{project_id}/documents")
async def get_project_documents(
    project_id: str,
    current_user_clerk_id: str = Depends(get_current_user_clerk_id)
):
    try:
        result = supabase.table("project_documents").select("*").eq("project_id", project_id).eq("clerk_id", current_user_clerk_id).order("created_at", desc=True).execute()
        return {
            "message": "Project documents retrieved successfully",
            "data": result.data or []
        }
    except Exception as e:
        # Return empty array if table doesn't exist
        if "PGRST" in str(e):
            return {
                "message": "Project documents retrieved successfully",
                "data": []
            }
        raise HTTPException(status_code=500, detail=f"Failed to get project documents: {str(e)}")
    



@router.put("/api/projects/{project_id}/settings")
async def update_project_settings(
    project_id: str, 
    settings: ProjectSettings, 
    current_user_clerk_id: str = Depends(get_current_user_clerk_id)
): 
    try: 
        # First verify the project exists and belongs to the user
        project_result = supabase.table("projects").select("id").eq("id", project_id).eq("clerk_id", current_user_clerk_id).execute()    
        if not project_result.data:
            raise HTTPException(status_code=404, detail = f"Project not found or access denied")

        # Perform the update
        result = supabase.table("project_settings").update(settings.model_dump()).eq("project_id", project_id).execute()

        if not result.data:
            raise HTTPException(status_code=404, detail = f"Project settings not found")

        return {
            "message": "Project settings updated successfully", 
            "data": result.data[0]
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail = f"Failed to update project settings: {str(e)}")
