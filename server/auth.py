import os
from fastapi import Request, HTTPException, Header
from clerk_backend_api import Clerk
from typing import Optional
import jwt

# Initialize Clerk client
CLERK_API_KEY = os.getenv("CLERK_API_KEY")
clerk_client = Clerk(bearer_auth=CLERK_API_KEY) if CLERK_API_KEY else None



async def get_current_user(
    authorization: Optional[str] = Header(None)
) -> str:
    try:
        print(f"Authorization header: {authorization}")  # Debug
            # Try to get token from Authorization header
        token = None
        if authorization and authorization.startswith("Bearer "):
            token = authorization.replace("Bearer ", "")
        
        print(f"Extracted token: {token[:20] if token else None}...")  # Debug
        
        if not token:
            raise HTTPException(status_code=401, detail="No authentication token provided")
        
        # Decode the JWT token to get the user ID (without verification for now)
        try:
            # Clerk JWTs have the user_id in the 'sub' claim
            decoded = jwt.decode(token, options={"verify_signature": False})
            print(f"Decoded token: {decoded}")  # Debug
            clerk_id = decoded.get("sub")
            
            if not clerk_id:
                raise HTTPException(status_code=401, detail="Invalid token - no user ID")
            
            print(f"Returning clerk_id: {clerk_id}")  # Debug
            return clerk_id
            
        except jwt.DecodeError as decode_error:
            raise HTTPException(
                status_code=401,
                detail=f"Token decode failed: {str(decode_error)}"
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail=f"Authentication failed: {str(e)}"
        )

# Alias for compatibility with routers expecting get_current_user_clerk_id
get_current_user_clerk_id = get_current_user