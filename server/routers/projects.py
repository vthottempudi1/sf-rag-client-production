from fastapi import APIRouter, Depends, FastAPI, HTTPException
from pydantic import BaseModel
from database import supabase
from typing import Optional

router = APIRouter(
    tags=["Projects"]
)

class ProjectCreate(BaseModel):
    name: str
    description: str = ""

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
def get_project(project_id: str):
    try:
        result = supabase.table("projects").select("*").eq("id", project_id).execute()
        
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
def create_project(project: ProjectCreate):
    try:
        #insert new project into database table
        project_result = supabase.table("projects").insert({
            "name": project.name,
            "description": project.description,
            "clerk_id": "anonymous"  # Temporary: use default clerk_id
        }).execute()

        if not project_result.data:
            raise HTTPException(status_code=500, detail="Failed to create project")
        
        created_project = project_result.data[0]
        project_id = created_project["id"]
        #Create default settings for the project
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
        #Verify project exists
        project_check = supabase.table("projects").select("*").eq("id", project_id).execute()
        if not project_check.data:
            raise HTTPException(status_code=404, detail="Project not found")
        
        #Delete project settings
        supabase.table("project_settings").delete().eq("project_id", project_id).execute()
        
        #Delete project
        deleted_result = supabase.table("projects").delete().eq("id", project_id).execute()
        
        if not deleted_result.data:
            raise HTTPException(status_code=500, detail="Failed to delete project")
        
        return {
            "message": "Project deleted successfully",
            "data": deleted_result.data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete project: {str(e)}")