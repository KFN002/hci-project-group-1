"""
    This is the actual entry point for the Document Reviewer webapp.
    Here, fastAPI is initialize and the application is ran using uvicorn.
"""
import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

# global variables
current_dir = Path(__file__).resolve().parent

# initialize FastAPI app
app = FastAPI(title="Document Reviewer", version="0.1.0")

# mount to endpoints for the different static files (css, js, assets)
app.mount("/styles", StaticFiles(directory=(current_dir.parent / "styles")), name="static")
app.mount("/scripts", StaticFiles(directory=(current_dir.parent / "scripts")), name="static")
app.mount("/assets", StaticFiles(directory=(current_dir.parent / "assets")), name="static")

# Root endpoint 
@app.get("/", response_class=HTMLResponse)
async def read_root() -> str:
    # get the actual html content for the main page
    main_html_file = current_dir.parent / "views" / "index.html"

    with open(main_html_file, "r", encoding="utf-8") as f:
        html_content = f.read()
        return html_content

# Health check endpoint
@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}

# run the application using uvicorn
def main() -> None:
    HOST = os.getenv("HOST", "127.0.0.1")
    PORT = int(os.getenv("PORT", 8000))
    RELOAD = os.getenv("RELOAD", "true").lower() == "true"

    uvicorn.run("document_reviewer.main:app", host=HOST, port=PORT, reload=RELOAD)
