# NWIS — Nearby Well Intelligence System — Frontend Running Guide

## Quick Start Commands

### Option 1: Python HTTP Server (Recommended)
From your terminal / PowerShell:
```powershell
# Navigate to the frontend directory
cd e:\ertmac\frontend

# Start the local web server
python -m http.server 8080
```
Then open your browser at:
👉 **[http://localhost:8080](http://localhost:8080)**

---

### Option 2: Node.js / NPX Serve
If you prefer using Node.js:
```powershell
cd e:\ertmac\frontend
npx serve .
```

---

### Option 3: Direct Browser Launch
You can also open the file directly in your default browser:
```powershell
Start-Process "e:\ertmac\frontend\index.html"
```
Or right-click [`index.html`](file:///e:/ertmac/frontend/index.html) in your IDE and choose **"Open with Live Server"**.
