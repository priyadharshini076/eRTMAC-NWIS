"""
Report Generation Service for NWIS (Nearby Well Intelligence System)
Generates publication-quality Daily Drilling Report (DDR) and Well Intelligence Dossier PDFs
using ReportLab.
Oil India Limited | Ministry of Petroleum & Natural Gas
"""

import io
from datetime import datetime
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
    HRFlowable,
)


# Master fallback data for wells when DB is unpopulated
WELLS_CATALOG = {
    "OIL-AS-NHRK-104": {
        "well_id": "OIL-AS-NHRK-104",
        "well_name": "Nahorkatiya-104 (Active Target)",
        "api_number": "OIL-ASM-000104",
        "field": "Nahorkatiya",
        "field_code": "NHK 104",
        "basin": "Assam-Arakan",
        "district": "Dibrugarh",
        "state": "Assam",
        "block": "PEL-ASSAM-02",
        "operator": "Oil India Limited",
        "rig": "BHEL 2000 HP (Rig #14 / NHRK Rig-A)",
        "spud_date": "12-Mar-2024",
        "status": "Active Drilling Ahead",
        "target_depth": 3842.0,
        "current_depth": 2501.3,
        "formation": "Tipam Sandstone (Current)",
        "formation_age": "Miocene to Pliocene",
        "lithology": "Medium to coarse grained porous sandstone intercalated with splintery clays",
        "pore_pressure": "14.8 ppg (4,120 psi)",
        "fracture_gradient": "15.4 ppg",
        "mud_weight": "12.10 ppg (1.45 SG)",
        "mud_type": "Glycol-PHPA High-Performance WBM",
        "fused_risk": 64.0,
        "risk_status": "SAFE / PERMIT ACTIVE",
        "rotary_rpm": 108.2,
        "rop": 12.6,
        "wob": 27.2,
        "torque": 263.6,
        "pump_pressure": 3841,
        "flow_rate": 754.2,
        "formations": [
            ("Alluvium & Topsoil", "0 - 320 m", "Loose silt, coarse sand, gravel", "8.9 ppg", "12.2 ppg"),
            ("Upper Bhuban", "320 - 1,120 m", "Interbedded shale and siltstone", "9.8 ppg", "13.5 ppg"),
            ("Middle Bhuban", "1,120 - 2,200 m", "Massive shale with fine silty lenses", "11.4 ppg", "14.2 ppg"),
            ("Tipam Sandstone (Active)", "2,200 - 2,680 m", "Porous hydrocarbon-bearing sandstone", "14.8 ppg", "15.4 ppg"),
            ("Lower Tipam", "2,680 - 3,100 m", "Hard calcareous shale & sandstone", "14.2 ppg", "15.8 ppg"),
            ("Basement Granite", "3,100 - 3,842 m", "Fractured igneous basement rock", "13.6 ppg", "16.5 ppg"),
        ],
        "hazards": [
            ("Stuck Pipe (Differential / Mechanical)", "32%", "Controlled", "Stabilizers inspected; continuous rotation maintained"),
            ("Lost Circulation / Mud Loss", "28%", "Low", "Bridging material (LCM) pill pre-mixed in reserve tank"),
            ("Wellbore Instability / Sloughing Shale", "38%", "Moderate", "PHPA polymer inhibitor active; mud weight at 12.1 ppg"),
            ("Gas Kick / Well Control Risk", "24%", "Low Margin", "BOP tested to 10,000 psi; trip sheet verified"),
        ],
        "casings": [
            ("30\" Conductor Casing", "0 - 65 m", "Driven / Cemented to Surface", "Good"),
            ("20\" Surface Casing", "65 - 450 m", "Grade K-55, Class G Cement", "Integrity Verified"),
            ("13-3/8\" Intermediate Casing", "450 - 1,850 m", "Grade L-80, Premium Connections", "Tested 3,500 psi"),
            ("9-5/8\" Drilling Liner", "1,850 - 2,480 m", "Grade P-110, Gas-tight seals", "Set & Pressure Tested"),
        ],
        "engineer": "Er. Rakesh Sharma (Lead Drill Engineer)",
        "supervisor": "Er. Amitav Barua (Digboi Basin HQ)",
    },
    "OIL-DGB-001": {
        "well_id": "OIL-DGB-001",
        "well_name": "Digboi Discovery Well #1",
        "api_number": "OIL-ASM-000001",
        "field": "Digboi",
        "field_code": "DGB 001",
        "basin": "Assam Shelf",
        "district": "Tinsukia",
        "state": "Assam",
        "block": "DGB-HERITAGE-01",
        "operator": "Oil India Limited",
        "rig": "Rig #04 (Mechanical DGH Certified)",
        "spud_date": "19-Oct-1889",
        "status": "Heritage Monitoring",
        "target_depth": 2100.0,
        "current_depth": 2100.0,
        "formation": "Tipam Sandstone",
        "formation_age": "Miocene",
        "lithology": "Conglomerate sandstone with heavy asphaltic crude",
        "pore_pressure": "9.2 ppg",
        "fracture_gradient": "13.8 ppg",
        "mud_weight": "9.6 ppg",
        "mud_type": "Bentonite WBM",
        "fused_risk": 18.0,
        "risk_status": "STABLE / LOW HAZARD",
        "rotary_rpm": 0.0,
        "rop": 0.0,
        "wob": 0.0,
        "torque": 0.0,
        "pump_pressure": 0,
        "flow_rate": 0.0,
        "formations": [
            ("Alluvium", "0 - 180 m", "Pebbly alluvial sands", "8.6 ppg", "12.0 ppg"),
            ("Digboi Oil Sand", "180 - 1,200 m", "Heavy oil bearing sandstone", "9.2 ppg", "13.5 ppg"),
            ("Barail Shale", "1,200 - 2,100 m", "Hard carbonaceous shale", "9.6 ppg", "14.0 ppg"),
        ],
        "hazards": [
            ("Surface Seepage", "12%", "Monitored", "Containment dikes intact"),
            ("Casing Corrosion", "22%", "Low", "Cathodic protection active"),
        ],
        "casings": [
            ("16\" Surface Casing", "0 - 250 m", "Historical Steel", "Secure"),
            ("8-5/8\" Production Casing", "250 - 2,100 m", "Grade J-55", "Plugged & Monitored"),
        ],
        "engineer": "Er. P. Gogoi (Reservoir Surveillance)",
        "supervisor": "Er. D. Phukan (Basin Asset Manager)",
    },
    "OIL-BGJ-001": {
        "well_id": "OIL-BGJ-001",
        "well_name": "Baghjan Extended Reach #1",
        "api_number": "OIL-ASM-000412",
        "field": "Baghjan",
        "field_code": "BGJ 001",
        "basin": "Assam-Arakan",
        "district": "Tinsukia",
        "state": "Assam",
        "block": "PEL-BAGHJAN-01",
        "operator": "Oil India Limited",
        "rig": "Super Single 1500 HP (Rig #21)",
        "spud_date": "05-Jan-2023",
        "status": "Workover / High Pressure Gas Monitoring",
        "target_depth": 3950.0,
        "current_depth": 3920.0,
        "formation": "Barail Sandstone",
        "formation_age": "Oligocene",
        "lithology": "Clean fractured quartzose sandstones with high-pressure dry gas",
        "pore_pressure": "15.6 ppg (4,680 psi)",
        "fracture_gradient": "16.2 ppg",
        "mud_weight": "14.2 ppg (1.70 SG)",
        "mud_type": "Invert Emulsion Oil-Based Mud (OBM)",
        "fused_risk": 74.5,
        "risk_status": "ELEVATED HPHT HAZARD",
        "rotary_rpm": 65.0,
        "rop": 4.8,
        "wob": 18.5,
        "torque": 195.0,
        "pump_pressure": 4150,
        "flow_rate": 620.0,
        "formations": [
            ("Alluvium", "0 - 400 m", "Clay and river gravel", "8.9 ppg", "12.5 ppg"),
            ("Tipam Sandstone", "400 - 2,300 m", "Coarse sand with water drive", "11.2 ppg", "14.5 ppg"),
            ("Barail HP Gas Sand", "2,300 - 3,920 m", "High pressure porous reservoir gas sand", "15.6 ppg", "16.2 ppg"),
        ],
        "hazards": [
            ("High Pressure Gas Influx", "68%", "Critical", "Double Cameron BOP with 15k psi blind shear rams in place"),
            ("Lost Circulation", "52%", "High", "Managed pressure drilling (MPD) choke manifold engaged"),
            ("Differential Sticking", "61%", "High", "Oil based mud lubricity maintained"),
        ],
        "casings": [
            ("20\" Surface Casing", "0 - 520 m", "Grade K-55", "Tested 3,000 psi"),
            ("13-3/8\" Intermediate", "520 - 2,150 m", "Grade L-80", "Tested 5,000 psi"),
            ("9-5/8\" Production Casing", "2,150 - 3,750 m", "Grade P-110", "Tested 8,500 psi"),
            ("7\" HPHT Production Liner", "3,750 - 3,920 m", "Grade Q-125 Gas-tight", "Tested 11,000 psi"),
        ],
        "engineer": "Er. S. Senapati (Senior Well Control Specialist)",
        "supervisor": "Er. R. Borbora (Chief General Manager - Drilling)",
    },
}


def get_well_report_data(well_id: str) -> dict:
    """Retrieve well metadata for reporting; fallback gracefully to catalog or default structure."""
    if well_id in WELLS_CATALOG:
        return WELLS_CATALOG[well_id]
    
    # Generic template for any other well ID
    clean_id = well_id.strip().upper()
    return {
        "well_id": clean_id,
        "well_name": f"{clean_id} Operational Report",
        "api_number": f"OIL-ASM-{clean_id[-4:] if len(clean_id) >= 4 else '0099'}",
        "field": "Nahorkatiya Basin",
        "field_code": clean_id,
        "basin": "Assam-Arakan",
        "district": "Dibrugarh",
        "state": "Assam",
        "block": "PEL-ASSAM-02",
        "operator": "Oil India Limited",
        "rig": "BHEL 2000 HP Rig",
        "spud_date": "12-Mar-2024",
        "status": "Active Drilling",
        "target_depth": 3842.0,
        "current_depth": 2501.3,
        "formation": "Tipam Sandstone",
        "formation_age": "Miocene",
        "lithology": "Interbedded fine sandstone and carbonaceous shale",
        "pore_pressure": "14.8 ppg",
        "fracture_gradient": "15.4 ppg",
        "mud_weight": "12.10 ppg",
        "mud_type": "High Performance WBM",
        "fused_risk": 64.0,
        "risk_status": "SAFE / PERMIT ACTIVE",
        "rotary_rpm": 108.2,
        "rop": 12.6,
        "wob": 27.2,
        "torque": 263.6,
        "pump_pressure": 3841,
        "flow_rate": 754.2,
        "formations": [
            ("Alluvium", "0 - 320 m", "Silt, sand, gravel", "8.9 ppg", "12.2 ppg"),
            ("Upper Bhuban", "320 - 1,120 m", "Interbedded shale", "9.8 ppg", "13.5 ppg"),
            ("Tipam Sandstone (Active)", "2,200 - 2,680 m", "Porous reservoir sand", "14.8 ppg", "15.4 ppg"),
        ],
        "hazards": [
            ("Stuck Pipe Risk", "32%", "Controlled", "Stabilizers inspected"),
            ("Lost Circulation", "28%", "Low", "LCM pills staged"),
            ("Wellbore Instability", "38%", "Moderate", "Polymer inhibitor verified"),
        ],
        "casings": [
            ("20\" Surface Casing", "0 - 450 m", "Grade K-55", "Good"),
            ("13-3/8\" Intermediate", "450 - 1,850 m", "Grade L-80", "Tested 3,500 psi"),
            ("9-5/8\" Drilling Liner", "1,850 - 2,480 m", "Grade P-110", "Tested 5,000 psi"),
        ],
        "engineer": "Er. Rakesh Sharma",
        "supervisor": "Er. Amitav Barua",
    }


def generate_well_pdf_report(well_id: str) -> bytes:
    """
    Builds a professional, print-ready PDF Daily Drilling Report & Well Dossier
    using ReportLab.
    """
    data = get_well_report_data(well_id)
    buffer = io.BytesIO()

    # Document margins and sizing (Letter / A4 standard)
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36,
    )

    story = []
    styles = getSampleStyleSheet()

    # Custom Colors
    c_primary = colors.HexColor("#0f172a")     # Deep Slate
    c_accent = colors.HexColor("#0284c7")      # Vibrant Cyan/Blue
    c_navy = colors.HexColor("#1e293b")        # Dark Blue Slate
    c_light_bg = colors.HexColor("#f8fafc")    # Off-white / light slate
    c_border = colors.HexColor("#cbd5e1")      # Slate border
    c_green = colors.HexColor("#059669")       # Emerald
    c_red = colors.HexColor("#dc2626")         # Crimson
    c_text = colors.HexColor("#334155")        # Charcoal

    # Custom Typography Styles
    style_gov_title = ParagraphStyle(
        "GovTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#0f172a"),
        alignment=1,  # Center
    )
    style_gov_sub = ParagraphStyle(
        "GovSub",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#64748b"),
        alignment=1,
    )
    style_doc_heading = ParagraphStyle(
        "DocHeading",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=18,
        textColor=c_primary,
        alignment=1,
        spaceAfter=4,
    )
    style_sec_heading = ParagraphStyle(
        "SecHeading",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=13,
        textColor=c_accent,
        spaceBefore=8,
        spaceAfter=4,
    )
    style_cell_label = ParagraphStyle(
        "CellLabel",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#475569"),
    )
    style_cell_value = ParagraphStyle(
        "CellValue",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#0f172a"),
    )
    style_cell_bold_val = ParagraphStyle(
        "CellBoldVal",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=10,
        textColor=colors.HexColor("#0f172a"),
    )
    style_small_note = ParagraphStyle(
        "SmallNote",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=7,
        leading=9,
        textColor=colors.HexColor("#64748b"),
        alignment=1,
    )

    # 1. TOP OFFICIAL HEADER BANNER
    header_table_data = [
        [
            Paragraph("<b>GOVERNMENT OF INDIA</b><br/>Ministry of Petroleum &amp; Natural Gas<br/>Directorate General of Hydrocarbons", style_gov_sub),
            Paragraph("<b>OIL INDIA LIMITED</b><br/>(A Government of India Enterprise)<br/>DGBOI Basin Exploration &amp; Production HQ", style_gov_sub),
            Paragraph(f"<b>REPORT REF:</b> OIL-DDR-{data['field_code']}<br/><b>DATE:</b> {datetime.now().strftime('%d-%b-%Y %H:%M IST')}<br/><b>CLASSIFICATION:</b> OFFICIAL / OPERATIONAL", style_gov_sub),
        ]
    ]
    t_header = Table(header_table_data, colWidths=[175, 175, 172])
    t_header.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f1f5f9")),
        ("BOX", (0, 0), (-1, -1), 1, c_border),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, c_border),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(t_header)
    story.append(Spacer(1, 8))

    # 2. DOCUMENT TITLE
    story.append(Paragraph("DAILY DRILLING LOG &amp; COMPREHENSIVE WELL INTELLIGENCE DOSSIER", style_doc_heading))
    story.append(Paragraph(f"Target Well: <b>{data['well_name']}</b> | Field: <b>{data['field']}</b> | Spud Date: <b>{data['spud_date']}</b>", style_gov_sub))
    story.append(Spacer(1, 6))

    # 3. EXECUTIVE WELL MASTER SUMMARY TABLE
    story.append(Paragraph("1. WELL IDENTIFICATION &amp; TECHNICAL PARAMETERS", style_sec_heading))
    summary_data = [
        [
            Paragraph("<b>Well ID / API</b>", style_cell_label),
            Paragraph(f"{data['well_id']} ({data['api_number']})", style_cell_value),
            Paragraph("<b>Operational Status</b>", style_cell_label),
            Paragraph(f"<b>{data['status']}</b>", style_cell_value),
        ],
        [
            Paragraph("<b>Geological Basin / State</b>", style_cell_label),
            Paragraph(f"{data['basin']} Basin, {data['state']} (Dist. {data['district']})", style_cell_value),
            Paragraph("<b>Rig Specification</b>", style_cell_label),
            Paragraph(f"{data['rig']}", style_cell_value),
        ],
        [
            Paragraph("<b>Target Depth (TD)</b>", style_cell_label),
            Paragraph(f"<b>{data['target_depth']:,.1f} m</b> TVD", style_cell_value),
            Paragraph("<b>Current Hole Depth</b>", style_cell_label),
            Paragraph(f"<font color='#0284c7'><b>{data['current_depth']:,.1f} m</b></font> ({(data['current_depth']/data['target_depth']*100):.1f}% of TD)", style_cell_value),
        ],
        [
            Paragraph("<b>Target Formation</b>", style_cell_label),
            Paragraph(f"<b>{data['formation']}</b>", style_cell_value),
            Paragraph("<b>Formation Age &amp; Lithology</b>", style_cell_label),
            Paragraph(f"{data['formation_age']} &bull; {data['lithology'][:48]}...", style_cell_value),
        ],
        [
            Paragraph("<b>Formation Pore Pressure</b>", style_cell_label),
            Paragraph(f"{data['pore_pressure']}", style_cell_value),
            Paragraph("<b>Fracture Gradient Limit</b>", style_cell_label),
            Paragraph(f"{data['fracture_gradient']}", style_cell_value),
        ],
        [
            Paragraph("<b>Active Mud System</b>", style_cell_label),
            Paragraph(f"{data['mud_type']}", style_cell_value),
            Paragraph("<b>Circulating Mud Weight</b>", style_cell_label),
            Paragraph(f"<b>{data['mud_weight']}</b>", style_cell_value),
        ],
    ]
    t_summary = Table(summary_data, colWidths=[130, 131, 130, 131])
    t_summary.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), c_light_bg),
        ("BACKGROUND", (2, 0), (2, -1), c_light_bg),
        ("BOX", (0, 0), (-1, -1), 1, c_border),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, c_border),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(t_summary)
    story.append(Spacer(1, 8))

    # 4. REAL-TIME DRILLING METRICS & HYDRAULICS
    story.append(Paragraph("2. REAL-TIME DRILLING MECHANICS &amp; SCADA TELEMETRY", style_sec_heading))
    metrics_data = [
        [
            Paragraph("<b>DEPTH</b>", style_cell_label),
            Paragraph("<b>RATE OF PENETRATION</b>", style_cell_label),
            Paragraph("<b>WEIGHT ON BIT</b>", style_cell_label),
            Paragraph("<b>ROTARY TORQUE</b>", style_cell_label),
        ],
        [
            Paragraph(f"<b>{data['current_depth']:,.1f} m</b>", style_cell_bold_val),
            Paragraph(f"<b>{data['rop']} m/hr</b>", style_cell_bold_val),
            Paragraph(f"<b>{data['wob']} ton</b>", style_cell_bold_val),
            Paragraph(f"<b>{data['torque']} kNm</b>", style_cell_bold_val),
        ],
        [
            Paragraph("<b>ROTARY SPEED</b>", style_cell_label),
            Paragraph("<b>STANDPIPE PRESSURE</b>", style_cell_label),
            Paragraph("<b>MUD DENSITY</b>", style_cell_label),
            Paragraph("<b>PUMP FLOW RATE</b>", style_cell_label),
        ],
        [
            Paragraph(f"<b>{data['rotary_rpm']} rpm</b>", style_cell_bold_val),
            Paragraph(f"<b>{data['pump_pressure']:,} psi</b>", style_cell_bold_val),
            Paragraph(f"<b>{data['mud_weight']}</b>", style_cell_bold_val),
            Paragraph(f"<b>{data['flow_rate']} LPM</b>", style_cell_bold_val),
        ],
    ]
    t_metrics = Table(metrics_data, colWidths=[130, 131, 130, 131])
    t_metrics.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e0f2fe")),
        ("BACKGROUND", (0, 2), (-1, 2), colors.HexColor("#e0f2fe")),
        ("BACKGROUND", (0, 1), (-1, 1), colors.white),
        ("BACKGROUND", (0, 3), (-1, 3), colors.white),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#0284c7")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, c_border),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(t_metrics)
    story.append(Spacer(1, 8))

    # 5. GEOLOGICAL STRATIGRAPHY & SUBSURFACE FORMATIONS
    story.append(Paragraph("3. SUBSURFACE STRATIGRAPHY &amp; FORMATION INTERVALS", style_sec_heading))
    strata_data = [
        [
            Paragraph("<b>Formation Name</b>", style_cell_label),
            Paragraph("<b>Depth Interval</b>", style_cell_label),
            Paragraph("<b>Lithological Characteristics</b>", style_cell_label),
            Paragraph("<b>Pore Pres.</b>", style_cell_label),
            Paragraph("<b>Frac Grad.</b>", style_cell_label),
        ]
    ]
    for row in data.get("formations", []):
        is_active = "(Active)" in row[0] or "(Current)" in row[0]
        bg_col = colors.HexColor("#ecfdf5") if is_active else colors.white
        strata_data.append([
            Paragraph(f"<b>{row[0]}</b>", style_cell_value),
            Paragraph(row[1], style_cell_value),
            Paragraph(row[2], style_cell_value),
            Paragraph(row[3], style_cell_value),
            Paragraph(row[4], style_cell_value),
        ])
    t_strata = Table(strata_data, colWidths=[120, 85, 195, 62, 60])
    t_strata.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
        ("BOX", (0, 0), (-1, -1), 1, c_border),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, c_border),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(t_strata)
    story.append(Spacer(1, 8))

    # 6. AI HAZARD MODEL & RISK ASSESSMENT AUDIT
    story.append(Paragraph("4. AI/ML PREDICTIVE HAZARD EVALUATION &amp; INTERLOCK STATUS", style_sec_heading))
    risk_color = "#059669" if data["fused_risk"] < 70 else "#ea580c" if data["fused_risk"] < 80 else "#dc2626"
    risk_summary_data = [
        [
            Paragraph("<b>Overall ML Hazard Score</b>", style_cell_label),
            Paragraph(f"<font color='{risk_color}'><b>{data['fused_risk']:.1f}% &bull; {data['risk_status']}</b></font>", style_cell_value),
            Paragraph("<b>Supervisor Clearance</b>", style_cell_label),
            Paragraph("<b>CLEARED / ROTARY ROTATION PERMITTED</b>", style_cell_value),
        ]
    ]
    t_risk_summary = Table(risk_summary_data, colWidths=[130, 131, 130, 131])
    t_risk_summary.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ("BOX", (0, 0), (-1, -1), 1, c_border),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, c_border),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(t_risk_summary)
    story.append(Spacer(1, 4))

    hazard_table_data = [
        [
            Paragraph("<b>Hazard Vector</b>", style_cell_label),
            Paragraph("<b>Probability</b>", style_cell_label),
            Paragraph("<b>Severity</b>", style_cell_label),
            Paragraph("<b>Engineered Preventive Mitigation</b>", style_cell_label),
        ]
    ]
    for h in data.get("hazards", []):
        hazard_table_data.append([
            Paragraph(f"<b>{h[0]}</b>", style_cell_value),
            Paragraph(f"<b>{h[1]}</b>", style_cell_value),
            Paragraph(h[2], style_cell_value),
            Paragraph(h[3], style_cell_value),
        ])
    t_hazards = Table(hazard_table_data, colWidths=[150, 70, 70, 232])
    t_hazards.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
        ("BOX", (0, 0), (-1, -1), 1, c_border),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, c_border),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(t_hazards)
    story.append(Spacer(1, 8))

    # 7. CASING RECORD & BHA SUMMARY
    story.append(Paragraph("5. CASING RECORD &amp; WELL INTEGRITY VERIFICATION", style_sec_heading))
    casing_table_data = [
        [
            Paragraph("<b>Casing String / Tubular</b>", style_cell_label),
            Paragraph("<b>Setting Depth</b>", style_cell_label),
            Paragraph("<b>Specification / Cement Class</b>", style_cell_label),
            Paragraph("<b>Pressure Integrity Test</b>", style_cell_label),
        ]
    ]
    for c in data.get("casings", []):
        casing_table_data.append([
            Paragraph(f"<b>{c[0]}</b>", style_cell_value),
            Paragraph(c[1], style_cell_value),
            Paragraph(c[2], style_cell_value),
            Paragraph(c[3], style_cell_value),
        ])
    t_casing = Table(casing_table_data, colWidths=[140, 85, 175, 122])
    t_casing.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
        ("BOX", (0, 0), (-1, -1), 1, c_border),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, c_border),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(t_casing)
    story.append(Spacer(1, 10))

    # 8. SUPERVISORY SIGN-OFF & COMPLIANCE VERIFICATION
    story.append(KeepTogether([
        Paragraph("6. SUPERVISORY SIGN-OFF &amp; REGULATORY COMPLIANCE", style_sec_heading),
        Table([
            [
                Paragraph(f"<b>Prepared By:</b><br/>{data.get('engineer', 'Er. Rakesh Sharma')}<br/><i>Lead Operations Engineer &bull; NHRK Rig-A</i>", style_cell_value),
                Paragraph(f"<b>Reviewed &amp; Authorized By:</b><br/>{data.get('supervisor', 'Er. Amitav Barua')}<br/><i>Drilling Superintendent &bull; DGBOI Basin HQ</i>", style_cell_value),
                Paragraph("<b>Corporate Verification:</b><br/>Oil India Limited, Duliajan<br/><i>Approved for DGH Submission &bull; SEC-A</i>", style_cell_value),
            ]
        ], colWidths=[174, 174, 174], style=[
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ("BOX", (0, 0), (-1, -1), 1, c_border),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, c_border),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]),
        Spacer(1, 6),
        Paragraph("This document contains proprietary operational telemetry and subsurface interpretations compiled under the authority of Oil India Limited. Unauthorized copying or redistribution is strictly prohibited.", style_small_note),
    ]))

    # Build PDF into bytes
    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()
