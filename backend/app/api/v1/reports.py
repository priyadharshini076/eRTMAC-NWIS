"""
Reports API Router for NWIS
Provides PDF download and JSON endpoints for well drilling metrics and dossiers.
Oil India Limited | Ministry of Petroleum & Natural Gas
"""

from fastapi import APIRouter, Response, HTTPException
from fastapi.responses import Response
from app.services.report_service import generate_well_pdf_report, get_well_report_data

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/well/{well_id}/pdf")
def download_well_pdf(well_id: str):
    """
    Generate and stream an official PDF Daily Drilling Log & Well Dossier
    for the specified well ID.
    """
    try:
        pdf_bytes = generate_well_pdf_report(well_id)
        filename = f"{well_id.replace('-', '_')}_Drilling_Report.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition",
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF report: {str(e)}")


@router.get("/well/{well_id}/data")
def get_well_metrics_data(well_id: str):
    """
    Retrieve structured well metrics and geological metadata for report rendering.
    """
    try:
        data = get_well_report_data(well_id)
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retrieve well report data: {str(e)}")
