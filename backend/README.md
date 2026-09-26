# eRTMAC-NWIS Backend

AI-powered Nearby Wells Intelligence and Decision Support backend for SIH Problem Statement 26121 – eRTMAC-NWIS.

*Data disclaimer: The current project uses synthetic/OIL-style prototype data generated for SIH/NWIS development and testing. It is not Oil India Limited confidential operational data.*

## 1. Project Overview

The backend combines:
- Real-time drilling telemetry
- Historical offset-well intelligence
- Nearby-well and formation/depth correlation
- XGBoost ML early-warning prediction
- Transparent risk fusion
- Trigger-based decision logic
- WCR/DDR document evidence retrieval
- Gemini-based grounded RAG analysis
- Evidence/source traceability

### Core decision flow
```text
          Live Telemetry
                |
                v
  XGBoost Early-Warning Model
                |
                +-----------------------------+
                |                             |
                v                             v
        ML Early Warning            Historical Offset Intelligence
                                              |
                                              v
                                     Formation + Depth Correlation
                                              |
                      +---------------+---------------+
                      |                               |
                      +---------------v---------------+
                                      |
                                 Risk Fusion
                                      |
                            Low / Medium / High
                                      |
                               Trigger Engine
                                      |
                        +-------------+-------------+
                        |                           |
                  RAG required                 No RAG
                        |                           |
                        v                           v
                Evidence Retrieval             Monitoring
                        |
                        v
                     Gemini
                        |
                        v
              Grounded Recommendations
                        |
                        v
                 Engineer Decision
```

## 2. Current Backend Status

The following backend pipeline is implemented and tested:
- FastAPI application
- PostgreSQL + PostGIS
- SQLAlchemy models
- Alembic migrations
- Nearby-well search
- Historical Offset-Well Intelligence Builder
- WCR/DDR PDF ingestion
- Hybrid text extraction + OCR
- Document event extraction
- Validation and deduplication
- XGBoost V2 early-warning model
- Multiclass event-type model
- Risk Fusion V2
- Trigger Engine
- RAG retrieval with WCR/DDR deduplication
- Gemini/OpenAI-compatible LLM integration
- Evidence IDs and source traceability
- Unified `/decision-support` endpoint
- ML-only, historical-only, and combined fusion validation

The next major task is frontend/dashboard integration.

## 3. Repository Structure

Expected backend structure:

```text
eRTMAC-NWIS/
|
+-- backend/
|   +-- app/
|   |   +-- api/
|   |   |   +-- v1/
|   |   |       +-- health.py
|   |   |       +-- nearby.py
|   |   |       +-- intelligence.py
|   |   |       +-- risk.py
|   |   |       +-- trigger.py
|   |   |       +-- rag.py
|   |   |       +-- decision_support.py
|   |   |
|   |   +-- models/
|   |   +-- schemas/
|   |   +-- services/
|   |   |   +-- ocr_service.py
|   |   |   +-- extraction_service.py
|   |   |   +-- validation_service.py
|   |   |   +-- intelligence_service.py
|   |   |   +-- ml_inference_service.py
|   |   |   +-- ml_inference_service_v2.py
|   |   |   +-- risk_fusion_service_v2.py
|   |   |   +-- trigger_service.py
|   |   |   +-- rag_service.py
|   |   |   +-- llm_service.py
|   |   |   +-- decision_support_service.py
|   |   |
|   |   +-- main.py
|   |
|   +-- alembic/
|   +-- ml_artifacts_v2/
|   +-- scripts/
|   |   +-- train_nwis_models.py
|   |   +-- train_nwis_models_v2.py
|   |   +-- verify_ml.py
|   |   +-- verify_ml_v2.py
|   |   +-- find_fusion_test_case.py
|   |   +-- process_all_documents.py
|   |   +-- process_one_document.py
|   |   +-- seed_all.py
|   |
|   +-- requirements.txt
|   +-- .env
|
+-- data/
|   +-- documents/
|   |   +-- wcr/
|   |   +-- ddr/
|   +-- daily_logs/
|   +-- ...
|
+-- README.md
```

## 4. Environment

Current validated environment:
- **OS:** Windows
- **Python:** 3.11.9
- **scikit-learn:** 1.9.1
- **xgboost:** 3.2.0
- **joblib:** 1.6.0
- **PostgreSQL:** local instance
- **PostgreSQL port:** 5433
- **Database:** ertmac_nwis

*Docker is not required for the current backend workflow.*

## 5. Clone and Setup

```powershell
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd eRTMAC-NWIS\backend
```

Create/activate the virtual environment:
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

Install dependencies:
```powershell
pip install -r requirements.txt
```
If a dependency is missing locally, install it into the virtual environment rather than the global Python installation.

## 6. PostgreSQL Setup

Create a PostgreSQL database named: `ertmac_nwis`

The current project uses port: `5433` (PostGIS is required).

In PostgreSQL:
```sql
CREATE DATABASE ertmac_nwis;
```
Then connect to the database and enable PostGIS:
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```
The project also uses `pgvector` where enabled by the current branch/database configuration.

*Do not commit real database passwords to GitHub.*

## 7. Environment Variables

Create `.env` inside `backend/`:

```env
DATABASE_URL=postgresql+psycopg2://postgres:<PASSWORD>@localhost:5433/ertmac_nwis
SECRET_KEY=ertmac-secret-key
API_V1_PREFIX=/api/v1
PROJECT_NAME=eRTMAC-NWIS

RAG_LLM_ENABLED=true
RAG_LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/
RAG_LLM_API_KEY=<YOUR_GEMINI_API_KEY>
RAG_LLM_MODEL=gemini-3.8-flash
RAG_LLM_TIMEOUT_SECONDS=60
```
Use your own API key. **Never commit `.env` to GitHub.**

## 8. Alembic / Database Migration

From `backend/`:
```powershell
alembic upgrade head
```
*Important: the database URL handling already accounts for `%` escaping in the Alembic configuration.*

The database currently contains tables including:
- `wells_master`
- `drilling_events`
- `daily_drilling_logs`
- `documents`
- `extracted_document_data`
- `document_events`
- `alembic_version`

PostGIS system objects are also present.

## 9. Synthetic Data Baseline

Current validated synthetic dataset sizes:
- **Wells:** 150
- **Historical events:** 2,000
- **Daily drilling logs:** 30,000
- **WCR documents:** 150
- **DDR documents:** 150
- **Total documents:** 300
- **Document events:** 1,560

Document event breakdown:
- **WCR events:** 1,000
- **DDR events:** 560

The 300 documents have already been successfully processed by the current extraction/validation pipeline.

## 10. FastAPI Startup

From `eRTMAC-NWIS\backend`:

```powershell
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
```

- **Backend URL:** http://127.0.0.1:8000
- **Swagger UI:** http://127.0.0.1:8000/docs
- **Health check:** `GET /api/v1/health`
- **Database health check:** `GET /api/v1/db-health`

## 11. Main API Endpoints

### Health
```http
GET /api/v1/health
GET /api/v1/db-health
```

### Nearby Wells
```http
GET /api/v1/nearby-wells?well_id=OIL-NHK-013&radius=5000
```
This endpoint uses the nearby-well/geospatial capability.

### Historical Intelligence
```http
GET /api/v1/wells/{well_id}/intelligence?radius=5000
```
Provides:
- nearby well count
- same-formation nearby wells
- event distribution
- correlated historical depth intervals
- severity information
- mitigation/lesson evidence

### ML + Risk Fusion
```http
GET /api/v1/wells/{well_id}/risk
```
Typical query used during testing:
`/api/v1/wells/OIL-NHK-013/risk?radius=5000&depth_tolerance=150&minimum_supporting_wells=2&recent_window=10`

### Trigger Engine
```http
GET /api/v1/wells/{well_id}/trigger
```
Converts the fused risk into a trigger state/action. Current policy:
- `score >= 70  -> High    -> RAG_RETRIEVAL`
- `score >= 40  -> Medium  -> ENHANCED_MONITORING`
- `score < 40   -> Low     -> CONTINUE_MONITORING`

### RAG Context & Analysis
```http
GET /api/v1/wells/{well_id}/rag-context
GET /api/v1/wells/{well_id}/rag-analysis
```
Retrieves historical WCR/DDR evidence and runs evidence-grounded analysis through the LLM layer.

### Unified Decision Support
```http
GET /api/v1/wells/{well_id}/decision-support
```
This is the main endpoint for frontend integration.

For integration testing only:
`GET /api/v1/wells/{well_id}/decision-support?force_rag=true`
*`force_rag=true` is not normal trigger behavior. It is used to test the complete RAG/Gemini path even when the trigger policy says RAG is not required.*

## 12. Risk Fusion Logic

Current fusion is intentionally transparent.
- ML component = incident_probability × 70
- Historical component = historical_score_normalized_to_30
- Final score = ML component + Historical component

The final score is capped at 100.

Historical scoring considers:
- severity
- number of supporting wells
- distance from the current depth to the historical interval

Historical matching uses the configured `depth_tolerance_m`. The API can return multiple historical depth-match signals, while the closest qualifying interval is exposed as the `primary_historical_interval`.

## 13. ML Model V2

Current model files:
- `backend\ml_artifacts_v2\nwis_event_detector_xgb_v2.joblib`
- `backend\ml_artifacts_v2\nwis_event_type_xgb_v2.joblib`
- `backend\ml_artifacts_v2\ml_training_report.json`

### Binary detector
- **Model:** XGBoost binary event detector
- **Target:** incident occurs in the next 3 telemetry rows
- **Selected threshold:** 0.39
- **Threshold selection metric:** F2 on validation set

Validated V2 test metrics recorded during training:
- ROC-AUC : 0.7315
- PR-AUC  : 0.4886
- Recall  : 0.8789
- F1      : 0.3563
- F2      : 0.5539

*The model is used as an early-warning signal, not as a calibrated probability of failure. Do not display the model probability as a guaranteed or calibrated failure probability.*

### Event-type model
The multiclass model provides advisory event candidates including: Mud Loss, Stuck Pipe, Kick, Cementing Issue, Torque Spike, Pressure Spike. It is an advisory signal for retrieval/context and is not the final risk decision maker.

## 14. Important ML Inference Detail

The V2 detector uses engineered telemetry features, including:
- depth/pressure/torque/RPM/mud-weight/WOB/flow deltas
- percentage changes
- rolling means/std
- slopes
- acceleration
- torque/RPM relationship
- pressure/flow relationship
- time delta
- field/district/formation

Leakage columns intentionally excluded during V2 training include: `risk_zone`, `event_label`, `alert_level`, `nearby_well_radius_km`, `well_id`.

The deployed inference code should remain consistent with the features saved inside the model bundle.

## 15. RAG Pipeline

The current RAG path is deterministic retrieval + grounded LLM generation.

### Retrieval flow
```text
Current well -> Formation -> Current depth -> Depth window -> Preferred event types from risk/ML signals -> Large raw candidate pool -> WCR/DDR deduplication -> Relevance ranking -> Top evidence records
```

The retrieval process currently supports:
- formation filtering
- depth-window filtering
- preferred event types
- severity-aware ranking
- depth proximity
- WCR/DDR incident grouping/deduplication
- evidence IDs (EV-001, EV-002, ...)
- source event IDs, documents, pages, extraction method

### Evidence traceability
Every generated finding/recommendation should be traceable to one or more evidence IDs. The LLM validation layer rejects findings/actions that contain invalid or missing evidence references.

## 16. Gemini / LLM Layer

The LLM layer uses an OpenAI-compatible Gemini endpoint configured through `.env`.
Current model: `gemini-3.8-flash`

The prompt is designed so that the model:
- only uses supplied evidence
- references evidence IDs
- does not invent historical facts
- does not treat historical events as current events
- does not present uncalibrated ML output as guaranteed probability
- rephrases/combines documented mitigation and lessons
- includes a caution that historical recurrence is not guaranteed

There is retry handling for temporary LLM failures and a deterministic fallback path when the LLM is unavailable.

## 17. OCR / Document Processing

Document processing is hybrid:
```text
PDF -> Direct text extraction -> If page text is insufficient -> OCR -> Normalization -> WCR/DDR event extraction -> Validation -> DB document event records
```

OCR stack currently includes: PyMuPDF, Tesseract, OpenCV, Pillow, NumPy. Scanned-page handling includes duplicate-page text detection.

## 18. Tested Fusion Scenarios

Three complementary cases have been validated.

**Case A – ML + Historical**
- Well: `OIL-NHK-013`, Tipam, 2214 m
- ML alert: `TRUE`, Historical depth signal: `TRUE`
- Final score: `58.28` (Medium) -> `Enhanced Monitoring`
- Primary historical signal observed: Torque Spike, 2184–2248 m, 2 supporting wells

**Case B – ML only**
- Well: `OIL-NHK-004`, Tipam, 2857 m
- ML alert: `TRUE`, Historical contribution: `0`
- Final score: `36.8` (Low) -> `Continue Monitoring`

**Case C – Historical only**
- Well: `OIL-BGJ-002`, Tipam, 2501 m
- ML alert: `FALSE` (score 25.19), Historical contribution: `17.52`
- Final score: `35.15` (Low) -> `Continue Monitoring`
- Primary historical signal: Stuck Pipe, 2314–2453 m, 48 m from current depth, 2 supporting wells
- Trigger correctly contains `HISTORICAL_DEPTH_MATCH` and does not include `ML_EARLY_WARNING`.

## 19. Useful Verification Commands

Verify model loading:
```powershell
python scripts\verify_ml_v2.py
```
Search for a historical-only fusion case:
```powershell
python scripts\find_fusion_test_case.py
```
Test API health:
```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/v1/health
```
Test DB health:
```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/v1/db-health
```

## 20. Git / Team Workflow

Before pushing:
```powershell
git status
git add .
git commit -m "Complete backend ML risk fusion and RAG pipeline"
git push origin main
```
If your branch naming is different, push to the team's agreed branch instead.

**Do NOT commit:**
`.env`, `venv/`, `__pycache__/`, `*.pyc`, local secrets/API keys, local database dumps.

Check that `.gitignore` covers local environments and secrets.

## 21. Recommended GitHub Handoff Message

Use this when handing the backend to another team member:

```text
Backend baseline is ready.

Implemented:
- FastAPI APIs
- PostgreSQL/PostGIS
- 150 synthetic wells
- 2,000 historical drilling events
- 30,000 telemetry rows
- 300 WCR/DDR documents
- OCR + extraction + validation
- XGBoost V2 early-warning model
- Risk Fusion
- Trigger Engine
- RAG retrieval + WCR/DDR deduplication
- Gemini grounded analysis
- Unified decision-support endpoint

Validated scenarios:
1. ML + Historical: OIL-NHK-013
2. ML only: OIL-NHK-004
3. Historical only: OIL-BGJ-002

Next task:
Build the frontend/Drilling Engineer dashboard against:
GET /api/v1/wells/{well_id}/decision-support

Swagger:
http://127.0.0.1:8000/docs
```

## 22. Frontend Integration Contract

The frontend should primarily consume:
`GET /api/v1/wells/{well_id}/decision-support`

Recommended dashboard sections:
1. Current Well / Formation / Depth
2. Current Telemetry
3. ML Early-Warning Signal
4. Risk Score + Risk Class
5. Historical Depth Signals
6. Nearby Wells
7. Trigger / Recommended Monitoring Action
8. RAG Findings
9. Recommended Actions
10. Evidence / Source Documents

For Medium/High risk states, surface the historical evidence and reasoning clearly.
For Low risk with no historical match, avoid presenting historical RAG context as an active risk signal.

## 23. Important Design Rules for Future Changes

**Do not mix these concepts:**
- ML prediction
- Historical occurrence
- Current telemetry event
- RAG historical evidence
- Final risk score
- Trigger action

A historical offset event is not proof that the same event is happening on the current well.

**Do not use uncalibrated ML probabilities as guaranteed probabilities.**
Use wording such as "ML early-warning probability", "ML early-warning score", or "Model signal" rather than claiming a calibrated probability of failure.

**Keep RAG grounded.** Every generated recommendation must remain traceable to retrieved evidence.

**Keep `force_rag=true` for testing only.** Normal production flow should respect the trigger policy.

## 24. Known Limitations

- The current data is synthetic and intended for prototyping/demo use.
- The ML detector is an early-warning model and is not calibrated as a real-world failure probability.
- The multiclass event-type model is advisory.
- RAG depends on the availability and quality of extracted WCR/DDR events.
- Current RAG/LLM behavior should remain evidence-grounded; do not add free-form operational facts to prompts without corresponding source evidence.
- The dashboard/frontend is the next major integration task.

## 25. Suggested Next Development Tasks

1. **Priority 1:** Frontend Drilling Engineer dashboard
2. **Priority 2:** Well selection + current telemetry panel
3. **Priority 3:** Risk visualization and historical depth signals
4. **Priority 4:** RAG evidence/source viewer
5. **Priority 5:** Engineer decision/action logging
6. **Priority 6:** Role-based views for Drilling Engineer, Drilling Supervisor, Geologist, and Well Planner

## 26. Quick Start Summary

```powershell
# Clone
git clone <REPO_URL>
cd eRTMAC-NWIS\backend

# Environment
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Database
# Create ertmac_nwis on PostgreSQL port 5433
# Enable PostGIS
# Configure backend\.env

# Migrations
alembic upgrade head

# Run
uvicorn app.main:app --reload

# Open Swagger
start http://127.0.0.1:8000/docs
```

Main frontend integration endpoint:
`GET /api/v1/wells/{well_id}/decision-support`

### Backend handoff status
Backend core is ready for team continuation. The recommended next step is frontend/dashboard integration using the existing decision-support response contract.
