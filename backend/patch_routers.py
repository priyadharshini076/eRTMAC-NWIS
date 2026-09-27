import os
import re

routers = {
    "nearby.py": ["drilling_engineer", "drilling_supervisor", "geologist", "well_planner", "admin"],
    "intelligence.py": ["drilling_engineer", "drilling_supervisor", "geologist", "well_planner", "admin"],
    "trigger.py": ["drilling_engineer", "drilling_supervisor", "admin"],
    "rag.py": ["drilling_engineer", "drilling_supervisor", "geologist", "well_planner", "admin"],
    "decision_support.py": ["drilling_engineer", "drilling_supervisor", "admin"]
}

base_dir = r"c:\Users\priya\eRTMAC-NWIS\backend\app\api\v1"

for file_name, roles in routers.items():
    file_path = os.path.join(base_dir, file_name)
    with open(file_path, "r") as f:
        content = f.read()

    if "from app.api import deps" not in content:
        content = content.replace("from app.database.dependencies import get_db\n", "from app.database.dependencies import get_db\nfrom app.api import deps\nfrom app.models.user import User\n")

    roles_str = ", ".join([f'"{r}"' for r in roles])
    role_checker_str = f'allow_roles = deps.RoleChecker([{roles_str}])\n\n@router.'
    
    if "allow_roles = deps.RoleChecker" not in content:
        content = content.replace("@router.", role_checker_str, 1)

    if "current_user: User = Depends(allow_roles)" not in content:
        content = content.replace("db: Session = Depends(get_db),", "db: Session = Depends(get_db),\n    current_user: User = Depends(allow_roles),")

    with open(file_path, "w") as f:
        f.write(content)

print("Patching complete.")
