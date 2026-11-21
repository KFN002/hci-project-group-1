"""
    This is the actual entry point for the Document Reviewer webapp.
    Here, fastAPI is initialize and the application is ran using uvicorn.
"""
import os
import json
import re
import tempfile
from pathlib import Path
from urllib import request
from urllib.error import URLError
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
from pypdf import PdfReader
from docx import Document

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

def extract_text(filename: str, content: bytes) -> str:
    extension = Path(filename).suffix.lower()

    if extension == ".txt":
        return content.decode("utf-8", errors="replace")

    if extension == ".pdf":
        with tempfile.NamedTemporaryFile(suffix=".pdf") as temporary:
            temporary.write(content)
            temporary.flush()
            reader = PdfReader(temporary.name)
            return "\n".join(page.extract_text() or "" for page in reader.pages)

    if extension == ".docx":
        with tempfile.NamedTemporaryFile(suffix=".docx") as temporary:
            temporary.write(content)
            temporary.flush()
            document = Document(temporary.name)
            paragraphs = [paragraph.text for paragraph in document.paragraphs]
            for table in document.tables:
                for row in table.rows:
                    paragraphs.append(" | ".join(cell.text for cell in row.cells))
            return "\n".join(paragraphs)

    if extension == ".doc":
        printable = re.findall(rb"[ -~]{20,}", content)
        return "\n".join(value.decode("ascii", errors="ignore") for value in printable)

    return ""

@app.post("/api/reviews")
async def create_review(
    files: list[UploadFile] = File(...),
    project_name: str = Form("Project"),
) -> dict[str, str]:
    document_parts: list[str] = []

    for uploaded_file in files:
        content = await uploaded_file.read()
        if len(content) > 25 * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"{uploaded_file.filename} exceeds 25 MB")

        try:
            text = extract_text(uploaded_file.filename or "document", content).strip()
        except Exception as exc:
            raise HTTPException(
                status_code=422,
                detail=f"Could not read {uploaded_file.filename}: {str(exc)}",
            ) from exc
        document_parts.append(
            f"## {uploaded_file.filename}\n\n{text or '[No extractable text found]'}"
        )

    if not document_parts:
        raise HTTPException(status_code=400, detail="No supported files were provided")

    combined_text = "\n\n".join(document_parts)
    if len(combined_text) > 120000:
        combined_text = combined_text[:120000] + "\n\n[Text truncated for model context]"

    prompt = (
        "You are reviewing a set of project documents. Produce a clear Markdown document named "
        f"Summary.md for the project '{project_name}'. Include: an executive summary, key points, "
        "important evidence, possible inconsistencies or missing information, and a concise conclusion. "
        "Base the result only on the documents below.\n\n"
        f"{combined_text}"
    )
    ollama_url = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
    ollama_model = os.getenv("OLLAMA_MODEL", "llama3.2")
    payload = json.dumps({
        "model": ollama_model,
        "prompt": prompt,
        "stream": False,
    }).encode("utf-8")

    api_request = request.Request(
        f"{ollama_url}/api/generate",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with request.urlopen(api_request, timeout=180) as response:
            result = json.loads(response.read().decode("utf-8"))
    except URLError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Ollama is unavailable at {ollama_url}. Start Ollama and ensure model '{ollama_model}' is installed.",
        ) from exc
    except TimeoutError as exc:
        raise HTTPException(status_code=504, detail="The Ollama review timed out") from exc

    summary = result.get("response", "").strip()
    if not summary:
        raise HTTPException(status_code=502, detail="Ollama returned an empty review")

    return {
        "filename": "Summary.md",
        "summary": summary,
        "model": ollama_model,
    }

# run the application using uvicorn
def main() -> None:
    HOST = os.getenv("HOST", "127.0.0.1")
    PORT = int(os.getenv("PORT", 8000))
    RELOAD = os.getenv("RELOAD", "true").lower() == "true"

    uvicorn.run("document_reviewer.main:app", host=HOST, port=PORT, reload=RELOAD)
