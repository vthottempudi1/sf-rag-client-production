from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from database import supabase

router = APIRouter(
    tags=["Users"]
)


@router.post("/create-user")
async def create_user(webhook_data: dict):
    try:
        #Get the event type and user data from Clerk webhook payload
        event_type = webhook_data.get("type")
        if event_type == "user.created":
            user_data = webhook_data.get("data", {})
            clerk_id = user_data.get("id")
            
            if not clerk_id:
                raise HTTPException(status_code=400, detail="Missing user ID in webhook data")
        
            result = supabase.table("users").insert({
                "clerk_id": clerk_id
            }).execute()
            
            return {
                "message": "User created successfully", 
                "data": result.data
            }
        else:
            return {
                "message": "Event type not handled",
                "event_type": event_type
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Webhook processing failed: {str(e)}")