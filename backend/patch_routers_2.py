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

    # We can inject after Depends(get_db)
    if "current_user: User = Depends(allow_roles)" not in content:
        content = re.sub(r'(db:\s*Session\s*=\s*Depends\(get_db\))', r'\1,\n    current_user: User = Depends(allow_roles)', content)

    with open(file_path, "w") as f:
        f.write(content)

print("Patching complete 2.")
