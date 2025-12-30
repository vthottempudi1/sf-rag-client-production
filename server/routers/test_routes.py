"""
Run this script to see all registered routes in your FastAPI app
Usage: python test_routes.py
"""

from main import app

print("\n=== REGISTERED ROUTES ===\n")
for route in app.routes:
    if hasattr(route, 'methods'):
        methods = ', '.join(route.methods)
        print(f"{methods:10} {route.path}")

print("\n=== END ===\n")
