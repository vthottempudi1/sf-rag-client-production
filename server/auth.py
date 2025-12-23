import os
from fastapi import Request, HTTPException
from clerk_backend_api import Clerk, AuthenticateRequestOptions

# Initialize Clerk client
clerk_client = Clerk(bearer_auth=os.getenv("CLERK_API_KEY"))



async def get_current_user(request: Request) -> str:
    try:
        request_state = clerk_client.authenticate_request(
            request,
            AuthenticateRequestOptions(
                accept_clerk_session=True,
                accept_jwt=True,
            )
        )

        if not request_state.is_authenticated:
            raise HTTPException(status_code=401, detail="Unauthenticated request")
        
        clerk_id = request_state.payload.get("sub")

        if not clerk_id:
            raise HTTPException(status_code=401, detail="Invalid authentication payload")
        return clerk_id


    except Exception as e:
        raise HTTPException(
            status_code=401,
             detail=f"Authentication failed: {str(e)}"
        )