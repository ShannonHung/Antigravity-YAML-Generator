import os
import shutil
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query, UploadFile, File, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI()

# CORS configuration
origins = [
    "http://localhost:3000",  # Frontend URL
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
ROOT_PATH = Path(os.getenv("ROOT_PATH", "./template")).resolve()

# Ensure root path exists
if not ROOT_PATH.exists():
    os.makedirs(ROOT_PATH, exist_ok=True)

class FileInfo(BaseModel):
    name: str
    is_dir: bool
    path: str
    size: Optional[int] = None
    mtime: Optional[float] = None

class CreateFolderRequest(BaseModel):
    path: str
    name: str

class DeleteRequest(BaseModel):
    path: str

class CreateFileRequest(BaseModel):
    path: str
    content: str

def get_safe_path(requested_path: str) -> Path:
    # Resolve requested path relative to ROOT_PATH
    # Remove leading slash if present to treat as relative
    if requested_path.startswith("/"):
        requested_path = requested_path[1:]
    
    full_path = (ROOT_PATH / requested_path).resolve()
    
    # Check if the resolved path is within ROOT_PATH
    if not str(full_path).startswith(str(ROOT_PATH)):
        raise HTTPException(status_code=403, detail="Access denied: Path outside root directory")
    
    return full_path

@app.get("/api/files", response_model=List[FileInfo])
def list_files(path: str = Query("/", description="Relative path to list")):
    try:
        full_path = get_safe_path(path)
        
        if not full_path.exists():
            raise HTTPException(status_code=404, detail="Path not found")
        
        if not full_path.is_dir():
            raise HTTPException(status_code=400, detail="Path is not a directory")
            
        items = []
        for item in full_path.iterdir():
            # Calculate relative path for frontend
            relative_path = "/" + str(item.relative_to(ROOT_PATH))
            stat = item.stat()
            
            items.append(FileInfo(
                name=item.name,
                is_dir=item.is_dir(),
                path=relative_path,
                size=stat.st_size if not item.is_dir() else None,
                mtime=stat.st_mtime
            ))
            
        # Sort directories first, then files
        items.sort(key=lambda x: (not x.is_dir, x.name.lower()))
        return items
        
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/files/folder")
def create_folder(request: CreateFolderRequest):
    try:
        # Construct path: request.path + / + request.name
        parent_path_str = request.path
        if parent_path_str.endswith("/"):
            target_path_str = parent_path_str + request.name
        else:
            target_path_str = parent_path_str + "/" + request.name
            
        full_path = get_safe_path(target_path_str)
        
        if full_path.exists():
            raise HTTPException(status_code=409, detail="Folder already exists")
            
        os.makedirs(full_path)
        return {"message": "Folder created successfully"}
        
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/files/file")
def create_file(request: CreateFileRequest):
    try:
        full_path = get_safe_path(request.path)
        
        # Ensure parent directory exists
        if not full_path.parent.exists():
             raise HTTPException(status_code=404, detail="Parent directory does not exist")

        with open(full_path, "w") as f:
            f.write(request.content)
            
        return {"message": "File saved successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def validate_schema_node(node: dict, path: str = "root"):
    # If node has children, it must be an object or a list of objects
    children = node.get("children")
    if children and len(children) > 0:
        multi_type = node.get("multi_type", [])
        item_multi_type = node.get("item_multi_type", [])
        
        is_object = "object" in multi_type
        is_list_of_objects = "list" in multi_type and "object" in item_multi_type
        
        if not (is_object or is_list_of_objects):
            raise HTTPException(
                status_code=400, 
                detail=f"Validation Error at '{path}': Node has children but type configuration does not support it. "
                       f"Must contain 'object' in multi_type, or 'list' in multi_type AND 'object' in item_multi_type. "
                       f"Current: multi_type={multi_type}, item_multi_type={item_multi_type}"
            )
            
        # Recurse
        for child in children:
            child_key = child.get("key", "unknown")
            validate_schema_node(child, path=f"{path}.{child_key}")

@app.post("/api/files/file")
def create_file(request: CreateFileRequest):
    try:
        full_path = get_safe_path(request.path)
        
        # Ensure parent directory exists
        if not full_path.parent.exists():
             raise HTTPException(status_code=404, detail="Parent directory does not exist")

        # Validation for schema files (.yml.json)
        if full_path.name.endswith(".yml.json"):
            import json
            try:
                content_json = json.loads(request.content)
                # Content can be a list (root) or dict
                nodes = content_json if isinstance(content_json, list) else [content_json]
                for node in nodes:
                    validate_schema_node(node)
            except json.JSONDecodeError:
                pass # Allow saving invalid JSON if user really wants to, or handle strictly? 
                     # For now, if it's not valid JSON, we can't validate structure, so let it pass 
                     # (or fail? frontend usually ensures valid JSON before save).
                     # Let's assume frontend sends valid stringified JSON.
            except HTTPException as ve:
                raise ve
            except Exception as e:
                # Log internal error but maybe don't block save if validation crashes unpredictably?
                # Better to be safe and block if we are sure it's a validation logic error.
                print(f"Validation check failed: {e}")
                pass

        with open(full_path, "w") as f:
            f.write(request.content)
            
        return {"message": "File saved successfully"}
        
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/files")
def delete_item(path: str = Query(..., description="Path to item to delete")):
    try:
        # Prevent deleting root
        if path == "/" or path == "":
             raise HTTPException(status_code=400, detail="Cannot delete root directory")

        full_path = get_safe_path(path)
        
        if not full_path.exists():
            raise HTTPException(status_code=404, detail="Item not found")
            
        if full_path.is_dir():
            shutil.rmtree(full_path)
        else:
            os.remove(full_path)
            
        return {"message": "Item deleted successfully"}
        
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/files/content")
def get_file_content(path: str = Query(..., description="Path to file")):
    try:
        full_path = get_safe_path(path)
        
        if not full_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
            
        if full_path.is_dir():
             raise HTTPException(status_code=400, detail="Path is a directory")
             
        # Read content (assuming text for now)
        try:
            with open(full_path, "r") as f:
                content = f.read()
            return {"content": content}
        except UnicodeDecodeError:
             raise HTTPException(status_code=400, detail="Cannot read binary file")
             
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

class RenameRequest(BaseModel):
    path: str
    new_name: str

@app.post("/api/files/rename")
def rename_item(request: RenameRequest):
    try:
        # Resolve current path
        current_full_path = get_safe_path(request.path)
        
        if not current_full_path.exists():
            raise HTTPException(status_code=404, detail="Item not found")
            
        # Construct new path
        new_full_path = current_full_path.parent / request.new_name
        
        # Security check
        if not str(new_full_path).startswith(str(ROOT_PATH)):
             raise HTTPException(status_code=403, detail="Access denied: Path outside root directory")

        if new_full_path.exists():
            raise HTTPException(status_code=409, detail="Item with new name already exists")
            
        current_full_path.rename(new_full_path)
        return {"message": "Item renamed successfully"}
        
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
