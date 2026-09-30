"""
Multi-Well Stratigraphic Correlation Analytics API
Provides multi-well stratigraphic fence diagrams, PPFG safe operating window pinch points,
cross-well drilling dynamics (ROP vs WOB), formation-specific risk matrix, casing programs,
and operational NPT timelines.
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Query, Depends
from sqlalchemy.orm import Session
from app.database.dependencies import get_db

router = APIRouter(tags=["Multi-Well Correlation"])

@router.get("/correlation/multi-well")
def get_multi_well_correlation(
    well_id: str = Query(default="OIL-AS-NHRK-104", description="Target Well Identifier"),
    compare_wells: Optional[str] = Query(default=None, description="Comma-separated list of offset well IDs"),
    tvd_min: float = Query(default=0, ge=0),
    tvd_max: float = Query(default=4500, le=10000),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Returns complete multi-well stratigraphic and geomechanical correlation dataset.
    Used by the Multi-Well Correlation Analytics page.
    """
    # 1. Stratigraphic Horizon Definitions
    horizons = [
        {
            "id": "girujan",
            "name": "Girujan Claystone",
            "top_m": 0,
            "bottom_m": 1200,
            "color": "rgba(203, 213, 225, 0.25)",
            "border_color": "#94a3b8",
            "description": "Claystone, shale with minor siltstone stringers"
        },
        {
            "id": "tipam",
            "name": "Tipam Sandstone",
            "top_m": 1200,
            "bottom_m": 2400,
            "color": "rgba(254, 240, 138, 0.22)",
            "border_color": "#eab308",
            "description": "Porous reservoir sands, high permeability, differential sticking threat"
        },
        {
            "id": "barail",
            "name": "Barail Sandstone",
            "top_m": 2400,
            "bottom_m": 3700,
            "color": "rgba(254, 215, 170, 0.25)",
            "border_color": "#f97316",
            "description": "Overpressured hydrocarbon sand, gas kick prone, narrow PPFG margin"
        },
        {
            "id": "kopili",
            "name": "Kopili Shale",
            "top_m": 3700,
            "bottom_m": 3900,
            "color": "rgba(224, 231, 255, 0.35)",
            "border_color": "#818cf8",
            "description": "Reactive sloughing shale, pack-off risk, micro-annulus"
        },
        {
            "id": "sylhet",
            "name": "Sylhet Limestone",
            "top_m": 3900,
            "bottom_m": 4500,
            "color": "rgba(207, 250, 254, 0.3)",
            "border_color": "#06b6d4",
            "description": "Fractured vuggy limestone, high lost-circulation threshold"
        }
    ]

    # 2. Well Profiles for Fence Diagram
    wells = [
        {
            "well_id": "OIL-AS-NHRK-104",
            "code": "NHRK-104",
            "title": "TARGET WELL",
            "is_target": True,
            "status": "Active Drilling",
            "distance_label": "Active Borehole",
            "current_depth_m": 3420.0,
            "td_m": 3842.0,
            "completed_info": "Drilling @ 3,420 m (Active)",
            "casing_shoes": [
                {"size": "30\"", "depth_m": 110, "label": "30\" @ 110m"},
                {"size": "20\"", "depth_m": 450, "label": "20\" @ 450m"},
                {"size": "13-3/8\"", "depth_m": 1180, "label": "13-3/8\" @ 1,180m"},
                {"size": "9-5/8\"", "depth_m": 3200, "label": "9-5/8\" @ 3,200m"}
            ],
            "hazards": [
                {"depth_m": 3420, "type": "bit", "label": "Bit: 3,420m", "color": "#0284c7"}
            ]
        },
        {
            "well_id": "OIL-AS-NHRK-98",
            "code": "NHRK-98",
            "title": "Offset Well (2.4 km)",
            "is_target": False,
            "status": "Completed",
            "distance_label": "2.4 km SW",
            "current_depth_m": 4100.0,
            "td_m": 4100.0,
            "completed_info": "TD: 4,100 m • Completed 2021",
            "casing_shoes": [
                {"size": "20\"", "depth_m": 420, "label": "20\" @ 420m"},
                {"size": "13-3/8\"", "depth_m": 1150, "label": "13-3/8\" @ 1,150m"},
                {"size": "9-5/8\"", "depth_m": 3150, "label": "9-5/8\" @ 3,150m"}
            ],
            "hazards": [
                {"depth_m": 2100, "type": "cement", "label": "Cement Channel @ 2,100m", "color": "#f97316"},
                {"depth_m": 3100, "type": "stuck", "label": "Stuck Pipe @ 3,100m", "color": "#a855f7"}
            ]
        },
        {
            "well_id": "OIL-AS-NHRK-76",
            "code": "NHRK-76",
            "title": "Offset Well (3.8 km)",
            "is_target": False,
            "status": "Completed",
            "distance_label": "3.8 km NW",
            "current_depth_m": 3920.0,
            "td_m": 3920.0,
            "completed_info": "TD: 3,920 m • Completed 2022",
            "casing_shoes": [
                {"size": "20\"", "depth_m": 440, "label": "20\" @ 440m"},
                {"size": "13-3/8\"", "depth_m": 1200, "label": "13-3/8\" @ 1,200m"},
                {"size": "9-5/8\"", "depth_m": 3180, "label": "9-5/8\" @ 3,180m"}
            ],
            "hazards": [
                {"depth_m": 3422, "type": "kick", "label": "Kick: 3,422m", "color": "#ef4444"}
            ]
        },
        {
            "well_id": "OIL-AS-NHRK-85",
            "code": "NHRK-85",
            "title": "Offset Well (5.1 km N)",
            "is_target": False,
            "status": "Completed",
            "distance_label": "5.1 km N",
            "current_depth_m": 4250.0,
            "td_m": 4250.0,
            "completed_info": "TD: 4,250 m • Deepest Offset",
            "casing_shoes": [
                {"size": "20\"", "depth_m": 460, "label": "20\" @ 460m"},
                {"size": "13-3/8\"", "depth_m": 1170, "label": "13-3/8\" @ 1,170m"},
                {"size": "9-5/8\"", "depth_m": 3250, "label": "9-5/8\" @ 3,250m"}
            ],
            "hazards": [
                {"depth_m": 2100, "type": "cement", "label": "Cement Channel @ 2,100m", "color": "#f97316"},
                {"depth_m": 3700, "type": "loss", "label": "Severe Loss @ 3,700m", "color": "#f59e0b"}
            ]
        },
        {
            "well_id": "OIL-AS-NHRK-67",
            "code": "NHRK-67",
            "title": "Offset Well (7.0 km S)",
            "is_target": False,
            "status": "Completed",
            "distance_label": "7.0 km S",
            "current_depth_m": 3850.0,
            "td_m": 3850.0,
            "completed_info": "TD: 3,850 m • Completed 2023",
            "casing_shoes": [
                {"size": "20\"", "depth_m": 430, "label": "20\" @ 430m"},
                {"size": "13-3/8\"", "depth_m": 1190, "label": "13-3/8\" @ 1,190m"},
                {"size": "9-5/8\"", "depth_m": 3120, "label": "9-5/8\" @ 3,120m"}
            ],
            "hazards": [
                {"depth_m": 2800, "type": "stuck", "label": "Stuck Pipe @ 2,800m", "color": "#a855f7"}
            ]
        }
    ]

    # 3. Summary KPIs
    summary_kpis = {
        "wells_analyzed": {
            "total": 5,
            "active": 1,
            "historical_offsets": 4,
            "subtext": "1 Active + 4 Historical Offsets"
        },
        "correlated_npt": {
            "percentage": 14.2,
            "hours": 112.5,
            "badge": "Risk Zone",
            "description": "Historical non-productive downtime"
        },
        "primary_hazard_risk": {
            "hazard": "Mud Loss",
            "formation": "Tipam Sandstone (2,400 - 3,400m)",
            "badge": "CRITICAL"
        },
        "ppfg_safe_window": {
            "window_sg": "1.28 - 1.32 SG",
            "badge_ppg": "10.68 - 11.01 PPG",
            "note": "Narrow margin in Barail / Kopili"
        },
        "correlated_cost_impact": {
            "amount_cr": 4.20,
            "formatted": "₹4.20 Cr",
            "description": "Historical NPT & remediation total"
        }
    }

    # 4. PPFG Correlation Curve Data
    ppfg_correlation = {
        "title": "PPFG Correlation (Pore Pressure & Fracture Gradient)",
        "badge": "Window Margin: Critical",
        "subtitle": "Overlaid pressure models highlighting safe mud window pinch points below 3,400m.",
        "pinch_point": {
            "depth_m": 3420,
            "margin_sg": 0.04,
            "margin_ppg": 0.33,
            "annotation": "Pinch: 0.04 SG (0.33 PPG)"
        },
        "points": [
            {"depth_m": 0, "target_planned_mw_sg": 1.10, "offset_pp_sg": 1.03, "fg_sg": 1.62},
            {"depth_m": 1200, "target_planned_mw_sg": 1.15, "offset_pp_sg": 1.08, "fg_sg": 1.68},
            {"depth_m": 2400, "target_planned_mw_sg": 1.20, "offset_pp_sg": 1.16, "fg_sg": 1.74},
            {"depth_m": 3200, "target_planned_mw_sg": 1.26, "offset_pp_sg": 1.24, "fg_sg": 1.72},
            {"depth_m": 3420, "target_planned_mw_sg": 1.30, "offset_pp_sg": 1.28, "fg_sg": 1.34},
            {"depth_m": 3700, "target_planned_mw_sg": 1.32, "offset_pp_sg": 1.30, "fg_sg": 1.36},
            {"depth_m": 4200, "target_planned_mw_sg": 1.34, "offset_pp_sg": 1.31, "fg_sg": 1.38}
        ]
    }

    # 5. Drilling Parameters Scatter Data (ROP vs WOB)
    drilling_parameters = {
        "title": "Drilling Parameter Correlation (ROP vs WOB)",
        "formation_tag": "Barail Sandstone Form.",
        "subtitle": "Cross-well parameter clustering. Bubble size reflects BHA vibration index (2-8Hz).",
        "clusters": {
            "optimal": "OPTIMAL DRILLING (12-18 klbs, 10-15 m/hr)",
            "severe_stick_slip": "Severe Stick-Slip (>28 klbs, >22 m/hr)"
        },
        "points": [
            {"wob_klbs": 12.0, "rop_m_hr": 9.5, "vibration_idx": 2.1, "well_code": "NHRK-104", "color": "#0284c7"},
            {"wob_klbs": 14.5, "rop_m_hr": 11.2, "vibration_idx": 2.4, "well_code": "NHRK-104", "color": "#0284c7"},
            {"wob_klbs": 16.0, "rop_m_hr": 13.0, "vibration_idx": 2.8, "well_code": "NHRK-98", "color": "#06b6d4"},
            {"wob_klbs": 18.0, "rop_m_hr": 14.8, "vibration_idx": 3.2, "well_code": "NHRK-98", "color": "#06b6d4"},
            {"wob_klbs": 20.0, "rop_m_hr": 15.5, "vibration_idx": 3.6, "well_code": "NHRK-76", "color": "#10b981"},
            {"wob_klbs": 22.0, "rop_m_hr": 16.8, "vibration_idx": 4.1, "well_code": "NHRK-76", "color": "#10b981"},
            {"wob_klbs": 28.5, "rop_m_hr": 22.0, "vibration_idx": 6.8, "well_code": "NHRK-85", "color": "#f59e0b"},
            {"wob_klbs": 30.0, "rop_m_hr": 23.5, "vibration_idx": 7.4, "well_code": "NHRK-85", "color": "#f59e0b"},
            {"wob_klbs": 32.5, "rop_m_hr": 25.2, "vibration_idx": 8.0, "well_code": "NHRK-67", "color": "#ef4444"}
        ]
    }

    # 6. Formation-Specific Risk Correlation Matrix
    risk_matrix = {
        "title": "Formation-Specific Risk Correlation Matrix",
        "tag": "5 Boreholes Queried",
        "subtitle": "Statistical incidence of historical drilling abnormalities cataloged per stratigraphic zone.",
        "rows": [
            {
                "formation": "Girujan Claystone",
                "wells_affected": "2 / 5 (40%)",
                "mud_loss": "Low (50 bbl)",
                "kick_risk": "None",
                "stuck_pipe": "None",
                "cementing": "Normal",
                "risk_score": "LOW",
                "badge_class": "badge-low"
            },
            {
                "formation": "Tipam Sandstone",
                "wells_affected": "4 / 5 (80%)",
                "mud_loss": "Severe (420 bbl)",
                "kick_risk": "1 Minor",
                "stuck_pipe": "1 Incident",
                "cementing": "Minor washouts",
                "risk_score": "HIGH",
                "badge_class": "badge-high"
            },
            {
                "formation": "Barail Sandstone",
                "wells_affected": "5 / 5 (100%)",
                "mud_loss": "Med (180 bbl)",
                "kick_risk": "2 Gas Kicks",
                "stuck_pipe": "3 Sticking",
                "cementing": "Channeling",
                "risk_score": "CRITICAL",
                "badge_class": "badge-critical"
            },
            {
                "formation": "Kopili Shale",
                "wells_affected": "3 / 5 (60%)",
                "mud_loss": "Low",
                "kick_risk": "1 Gas Kick",
                "stuck_pipe": "Pack-off",
                "cementing": "Micro-annulus",
                "risk_score": "MEDIUM",
                "badge_class": "badge-medium"
            },
            {
                "formation": "Sylhet Limestone",
                "wells_affected": "2 / 5 (40%)",
                "mud_loss": "High Frac Loss",
                "kick_risk": "None",
                "stuck_pipe": "None",
                "cementing": "High-Loss Slurry",
                "risk_score": "MEDIUM",
                "badge_class": "badge-medium"
            }
        ],
        "footer_note": "* Barail Sandstone presents compound hazard: Gas+loss cavitating + high differential sticking.",
        "remediation_link": "View Remediation Protocol →"
    }

    # 7. Casing Program & Cementing Practices
    casing_comparison = {
        "casing_strings": [
            {"name": "30\" Conductor", "depth_m": "110 m", "steel_grade": "X-52 Welded", "burst_rating": "1,650 psi"},
            {"name": "20\" Surface", "depth_m": "450 m", "steel_grade": "K-55 BTC", "burst_rating": "2,120 psi"},
            {"name": "13-3/8\" Intermediate", "depth_m": "1,180 m", "steel_grade": "L-80 BTC", "burst_rating": "3,320 psi"},
            {"name": "9-5/8\" Drilling", "depth_m": "3,200 m", "steel_grade": "P-110 Premium", "burst_rating": "7,650 psi"},
            {"name": "7\" Production Liner", "depth_m": "3,850 m", "steel_grade": "Q-125 VAM", "burst_rating": "10,430 psi"}
        ],
        "cementing_practices": {
            "slurry_density": "1.58 / 1.90 SG",
            "cbl_score": "91.4% (Good)",
            "compliance_text": "Target Well NHRK-104 currently casing compliant with API Spec 5CT."
        }
    }

    # 8. Operational Events & NPT Timeline
    npt_timeline = {
        "title": "Cross-Well Operational Events & NPT Timeline",
        "subtitle": "Cumulative 112.5 hours of documented NPT correlated to geological depth horizons across historical runs.",
        "metric_tag": "NPT Cost Metric: ₹1,25,000 / hr Rig Rate",
        "total_npt_hours": 112.5,
        "well_runs": [
            {
                "well_code": "NHRK-98",
                "total_hours_label": "64h Total",
                "events": [
                    {"label": "16h Mud Loss", "depth_start_m": 3100, "depth_end_m": 3400, "bg_color": "#fed7aa", "border_color": "#f97316", "text_color": "#9a3412"},
                    {"label": "48h Stuck Pipe (Barail)", "depth_start_m": 3500, "depth_end_m": 4100, "bg_color": "#e9d5ff", "border_color": "#a855f7", "text_color": "#6b21a8"}
                ]
            },
            {
                "well_code": "NHRK-76",
                "total_hours_label": "22h Total",
                "events": [
                    {"label": "22h Kick & Kill Ops", "depth_start_m": 3400, "depth_end_m": 3800, "bg_color": "#fecaca", "border_color": "#ef4444", "text_color": "#991b1b"}
                ]
            },
            {
                "well_code": "NHRK-85",
                "total_hours_label": "42h Total",
                "events": [
                    {"label": "14h LCM Pill", "depth_start_m": 3100, "depth_end_m": 3500, "bg_color": "#fed7aa", "border_color": "#f97316", "text_color": "#9a3412"},
                    {"label": "12h Cement Squeeze", "depth_start_m": 3700, "depth_end_m": 4100, "bg_color": "#fef08a", "border_color": "#eab308", "text_color": "#854d0e"}
                ]
            }
        ]
    }

    return {
        "status": "success",
        "well_id": well_id,
        "meta": {
            "module": "NWIS STRATIGRAPHIC MODULE",
            "code": "OFF - 4382-22-2024-08",
            "title": "Multi-Well Correlation Analytics",
            "subtitle": "Correlate drilling parameters, reservoir characteristics, operational events and formation-specific risks across wells.",
            "wells_correlated_count": 5,
            "last_sync": "29 Sep 2024, 14:32 IST"
        },
        "filter_state": {
            "target_well": "OIL-AS-NHRK-104 (Active @ 3,420m)",
            "compare_wells": ["NHRK-98", "NHRK-76", "NHRK-85", "NHRK-67", "NHRK-102"],
            "stratigraphic_horizons": "All Formations (Girujan, Tipam, Barail, Kopili, Sylhet)",
            "tvd_range": {"min": tvd_min, "max": tvd_max},
            "correlation_model": "Interpolated Spline (P50)",
            "tie_markers_count": 18
        },
        "summary_kpis": summary_kpis,
        "horizons": horizons,
        "wells": wells,
        "ppfg_correlation": ppfg_correlation,
        "drilling_parameters": drilling_parameters,
        "risk_matrix": risk_matrix,
        "casing_comparison": casing_comparison,
        "npt_timeline": npt_timeline
    }
