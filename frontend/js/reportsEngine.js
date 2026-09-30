/**
 * NWIS - Well Intelligence & Performance Reports Engine
 * Oil India Limited | Ministry of Petroleum & Natural Gas
 */

class ReportsEngine {
  constructor() {
    this.currentWellId = "OIL-AS-NHRK-104";
    this.initialized = false;
  }

  init() {
    if (this.initialized) {
      this.refreshData();
      return;
    }
    this.initialized = true;
    this.bindDOM();
    this.populateWellSelect();
    this.renderWellReport(this.currentWellId);
  }

  bindDOM() {
    this.selectWell = document.getElementById("reportWellSelect");
    this.btnDownloadPdf = document.getElementById("btnDownloadReportPdf");
    this.btnPrintReport = document.getElementById("btnPrintReport");
    this.btnRefresh = document.getElementById("btnRefreshReportData");

    if (this.selectWell) {
      this.selectWell.addEventListener("change", (e) => {
        this.currentWellId = e.target.value;
        this.renderWellReport(this.currentWellId);
      });
    }

    if (this.btnDownloadPdf) {
      this.btnDownloadPdf.addEventListener("click", () => {
        this.downloadPdfReport();
      });
    }

    if (this.btnPrintReport) {
      this.btnPrintReport.addEventListener("click", () => {
        this.printReport();
      });
    }

    if (this.btnRefresh) {
      this.btnRefresh.addEventListener("click", () => {
        this.refreshData();
        if (typeof showToast === "function") {
          showToast("Live telemetry and well metrics refreshed.");
        }
      });
    }
  }

  populateWellSelect() {
    if (!this.selectWell) return;
    this.selectWell.innerHTML = "";

    const availableWells = (typeof WELLS_DATA !== "undefined" && Array.isArray(WELLS_DATA))
      ? WELLS_DATA
      : [
          { wellId: "OIL-AS-NHRK-104", wellName: "Nahorkatiya-104 (Active Target)" },
          { wellId: "OIL-DGB-001", wellName: "Digboi Discovery Well #1" },
          { wellId: "OIL-BGJ-001", wellName: "Baghjan Extended Reach #1" },
          { wellId: "OIL-KMC-001", wellName: "Kumchai Exploration Well" },
          { wellId: "OIL-LKW-001", wellName: "Lakwa Production Well" },
          { wellId: "OIL-MRN-001", wellName: "Moran Deep Structure" },
        ];

    availableWells.forEach((w) => {
      const opt = document.createElement("option");
      opt.value = w.wellId;
      opt.textContent = `${w.wellId} • ${w.wellName || w.field || "Well"}`;
      if (w.wellId === this.currentWellId) {
        opt.selected = true;
      }
      this.selectWell.appendChild(opt);
    });
  }

  getWellData(wellId) {
    if (typeof WELLS_DATA !== "undefined" && Array.isArray(WELLS_DATA)) {
      const found = WELLS_DATA.find((w) => w.wellId === wellId);
      if (found) return found;
    }
    // Fallback default
    return {
      wellId: wellId,
      wellName: `${wellId} (Target Well)`,
      field: "Nahorkatiya",
      basin: "Assam-Arakan",
      district: "Dibrugarh",
      state: "Assam",
      blockName: "PEL-ASSAM-02",
      operator: "Oil India Limited",
      spudDate: "12-Mar-2024",
      status: "Active Drilling",
      targetDepthM: 3842,
      currentDepthM: 2501.3,
      formation: "Tipam Sandstone (Current)",
      formationAge: "Miocene to Pliocene",
      lithology: "Porous medium-grained sandstone intercalated with splintery carbonaceous shale",
      porePressurePpg: 14.8,
      fractureGradientPpg: 15.4,
      currentMudWeightPpg: 12.10,
      mudType: "Glycol-PHPA High Performance WBM",
      rigName: "BHEL 2000 HP (Rig #14 / NHRK Rig-A)",
    };
  }

  renderWellReport(wellId) {
    const well = this.getWellData(wellId);

    // If active drilling well, sync live telemetry from drilling engine if available
    let depth = well.currentDepthM || 2501.3;
    let rop = 12.6;
    let wob = 27.2;
    let torque = 263.6;
    let rpm = 108.2;
    let pumpPressure = 3841;
    let mudWeight = well.currentMudWeightPpg || 12.10;
    let flowRate = 754.2;
    let riskScore = 64.0;
    let riskStatus = "SAFE / PERMIT ACTIVE";

    if (wellId === "OIL-AS-NHRK-104" && window.drillingOpsEngineInstance) {
      const eng = window.drillingOpsEngineInstance;
      depth = +(eng.currentDepth || 2501.3).toFixed(1);
      rop = +(eng.telemetry.rop || 12.6).toFixed(1);
      wob = +(eng.telemetry.wob || 27.2).toFixed(1);
      torque = +(eng.telemetry.torque || 263.6).toFixed(1);
      rpm = +(eng.telemetry.rpm || 108.2).toFixed(1);
      pumpPressure = Math.round(eng.telemetry.pumpPressure || 3841);
      mudWeight = +(eng.telemetry.mudWeight || 12.10).toFixed(2);
      flowRate = +(eng.telemetry.flowRate || 754.2).toFixed(1);
      riskScore = +(eng.currentRiskScore || 64.0).toFixed(1);
      riskStatus = riskScore >= 80.0 ? "CRITICAL INTERLOCK" : "SAFE / PERMIT ACTIVE";
    } else if (well.simulation) {
      riskScore = +(well.simulation.fusedScore || 64.0).toFixed(1);
      riskStatus = well.simulation.riskLevel || "STABLE MONITORING";
    }

    const targetDepth = well.targetDepthM || 3842;
    const progressPct = ((depth / targetDepth) * 100).toFixed(1);

    // Update Header
    const titleEl = document.getElementById("reportWellTitle");
    if (titleEl) titleEl.textContent = `${well.wellName || well.wellId}`;

    const subtitleEl = document.getElementById("reportWellSubtitle");
    if (subtitleEl) {
      subtitleEl.textContent = `${well.field || "Assam"} Field • ${well.basin || "Assam-Arakan"} Basin • Rig: ${well.rigName || "NHRK Rig-A"} • Spud: ${well.spudDate || "12-Mar-2024"}`;
    }

    const statusBadge = document.getElementById("reportWellStatusBadge");
    if (statusBadge) {
      statusBadge.textContent = well.status || "Active Drilling";
      statusBadge.className = `card-badge ${depth > 0 && depth < targetDepth ? "badge-green" : "badge-blue"}`;
    }

    // Update 4 Top KPI Pills
    const kpiDepth = document.getElementById("reportKpiDepth");
    if (kpiDepth) kpiDepth.textContent = `${depth.toLocaleString()} m`;

    const kpiDepthSub = document.getElementById("reportKpiDepthSub");
    if (kpiDepthSub) kpiDepthSub.textContent = `${progressPct}% of ${targetDepth.toLocaleString()} m TD`;

    const kpiFormation = document.getElementById("reportKpiFormation");
    if (kpiFormation) kpiFormation.textContent = well.formation || "Tipam Sandstone";

    const kpiRop = document.getElementById("reportKpiRopWob");
    if (kpiRop) kpiRop.textContent = `${rop} m/h • ${wob} t`;

    const kpiRisk = document.getElementById("reportKpiRisk");
    if (kpiRisk) {
      kpiRisk.textContent = `${riskScore}%`;
      kpiRisk.style.color = riskScore >= 80 ? "#ef4444" : riskScore >= 70 ? "#f59e0b" : "#10b981";
    }

    const kpiRiskSub = document.getElementById("reportKpiRiskSub");
    if (kpiRiskSub) kpiRiskSub.textContent = riskStatus;

    // Card 1: Well Master Technical Parameters
    this.setElText("repParamWellId", `${well.wellId} (${well.apiNumber || "OIL-ASM-000104"})`);
    this.setElText("repParamOperator", `${well.operator || "Oil India Limited"}`);
    this.setElText("repParamLocation", `${well.district || "Dibrugarh"}, ${well.state || "Assam"} (${well.basin || "Assam-Arakan"} Basin)`);
    this.setElText("repParamBlock", `${well.blockName || "PEL-ASSAM-02"}`);
    this.setElText("repParamSpud", `${well.spudDate || "12-Mar-2024"}`);
    this.setElText("repParamRig", `${well.rigName || "BHEL 2000 HP Rig #14"}`);
    this.setElText("repParamTD", `${targetDepth.toLocaleString()} m TVD`);
    this.setElText("repParamPorePres", `${well.porePressurePpg ? well.porePressurePpg + " ppg" : "14.8 ppg"}`);
    this.setElText("repParamFracGrad", `${well.fractureGradientPpg ? well.fractureGradientPpg + " ppg" : "15.4 ppg"}`);
    this.setElText("repParamMudSystem", `${well.mudType || "Glycol-PHPA WBM"}`);

    // Card 2: 8 Telemetry Tiles
    this.setElText("repTileDepth", `${depth.toLocaleString()} m`);
    this.setElText("repTileRop", `${rop} m/hr`);
    this.setElText("repTileWob", `${wob} ton`);
    this.setElText("repTileTorque", `${torque} kNm`);
    this.setElText("repTileRpm", `${rpm} rpm`);
    this.setElText("repTilePump", `${pumpPressure.toLocaleString()} psi`);
    this.setElText("repTileMud", `${mudWeight} ppg`);
    this.setElText("repTileFlow", `${flowRate} LPM`);

    // Card 3: Formations Table
    this.renderFormationsTable(well, depth);

    // Card 4: AI Hazard Probabilities
    this.renderHazardsList(well, riskScore);

    // Card 5: Casings Table
    this.renderCasingsTable(well);

    // Card 6: Sign-off
    this.setElText("repSignEngineer", well.engineer || "Er. Rakesh Sharma");
    this.setElText("repSignSupervisor", well.supervisor || "Er. Amitav Barua");
  }

  renderFormationsTable(well, currentDepth) {
    const tbody = document.getElementById("reportStrataTbody");
    if (!tbody) return;

    const strataRows = [
      { name: "Alluvium & Topsoil", range: "0 – 320 m", top: 0, bottom: 320, litho: "Loose river gravel, silt, coarse unconsolidated sand", pp: "8.9 ppg", fg: "12.2 ppg" },
      { name: "Upper Bhuban", range: "320 – 1,120 m", top: 320, bottom: 1120, litho: "Interbedded grey shale, sandy siltstone", pp: "9.8 ppg", fg: "13.5 ppg" },
      { name: "Middle Bhuban", range: "1,120 – 2,200 m", top: 1120, bottom: 2200, litho: "Massive dark shale with thin limestone stringers", pp: "11.4 ppg", fg: "14.2 ppg" },
      { name: "Tipam Sandstone (Active)", range: "2,200 – 2,680 m", top: 2200, bottom: 2680, litho: "Porous hydrocarbon-bearing sandstone, brittle fracture zone", pp: "14.8 ppg", fg: "15.4 ppg" },
      { name: "Lower Tipam", range: "2,680 – 3,100 m", top: 2680, bottom: 3100, litho: "Hard calcareous sandstone with carbonaceous laminae", pp: "14.2 ppg", fg: "15.8 ppg" },
      { name: "Basement Complex", range: "3,100 – 3,842 m", top: 3100, bottom: 3842, litho: "Dense metamorphic/granitic crystalline basement rock", pp: "13.6 ppg", fg: "16.5 ppg" }
    ];

    tbody.innerHTML = "";
    strataRows.forEach((s) => {
      const isCurrent = currentDepth >= s.top && currentDepth <= s.bottom;
      const tr = document.createElement("tr");
      if (isCurrent) tr.className = "tr-active-highlight";

      tr.innerHTML = `
        <td><strong>${s.name}</strong> ${isCurrent ? '<span class="card-badge badge-green" style="margin-left:6px; font-size:9px;">DRILLING NOW</span>' : ''}</td>
        <td>${s.range}</td>
        <td>${s.litho}</td>
        <td>${s.pp}</td>
        <td>${s.fg}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  renderHazardsList(well, riskScore) {
    const container = document.getElementById("reportHazardsContainer");
    if (!container) return;

    const hazards = [
      { name: "Stuck Pipe (Differential / Mechanical)", pct: 32, sev: "Controlled", desc: "Stabilizers inspected; continuous rotation maintained without slip", color: "#10b981" },
      { name: "Lost Circulation / Mud Losses", pct: 28, sev: "Low", desc: "Bridging LCM materials staged in reserve pits; pump rates optimized", color: "#10b981" },
      { name: "Wellbore Instability / Sloughing Shale", pct: 38, sev: "Moderate", desc: "Glycol-PHPA inhibitor active; hole caliper logging within 4% gauge", color: "#f59e0b" },
      { name: "Gas Kick / Well Control Margin", pct: 24, sev: "Low Margin", desc: "BOP accumulator tested to 10k psi; choke manifold lines operational", color: "#10b981" },
      { name: "Cutter Face Thermal Overheating", pct: 44, sev: "Monitored", desc: "Mud jet nozzle flow maintained at 754 LPM to suppress PDC thermal stress", color: "#f59e0b" },
    ];

    container.innerHTML = "";
    hazards.forEach((h) => {
      const row = document.createElement("div");
      row.className = "hazard-row-item";
      row.innerHTML = `
        <div class="hazard-meta">
          <div class="hazard-title">${h.name}</div>
          <div class="hazard-desc">${h.desc}</div>
        </div>
        <div class="hazard-progress-wrap">
          <div class="hazard-bar-bg">
            <div class="hazard-bar-fill" style="width: ${h.pct}%; background-color: ${h.color};"></div>
          </div>
          <span class="hazard-pct" style="color: ${h.color};">${h.pct}%</span>
        </div>
      `;
      container.appendChild(row);
    });
  }

  renderCasingsTable(well) {
    const tbody = document.getElementById("reportCasingTbody");
    if (!tbody) return;

    const casings = [
      { size: '30" Conductor Casing', interval: "0 – 65 m", spec: "Driven / API 5L Grade B", test: "Visual / Good Return" },
      { size: '20" Surface Casing', interval: "65 – 450 m", spec: "Grade K-55, BTC, Class G Cement", test: "Tested 2,000 psi (15 min)" },
      { size: '13-3/8" Intermediate Casing', interval: "450 – 1,850 m", spec: "Grade L-80, VAM TOP Connections", test: "Tested 3,500 psi (30 min)" },
      { size: '9-5/8" Drilling Liner', interval: "1,850 – 2,480 m", spec: "Grade P-110, Gas-tight Premium", test: "Tested 5,000 psi (Integrity Pass)" },
      { size: '7" Production Liner (Planned)', interval: "2,480 – 3,842 m", spec: "Grade Q-125 Sour Service Cr-13", test: "Awaiting Target Depth" }
    ];

    tbody.innerHTML = "";
    casings.forEach((c) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>${c.size}</strong></td>
        <td>${c.interval}</td>
        <td>${c.spec}</td>
        <td><span class="card-badge ${c.test.includes('Pass') || c.test.includes('Good') || c.test.includes('Tested') ? 'badge-green' : 'badge-amber'}">${c.test}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  setElText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  refreshData() {
    this.renderWellReport(this.currentWellId);
  }

  async downloadPdfReport() {
    const wellId = this.currentWellId || "OIL-AS-NHRK-104";
    const downloadBtn = this.btnDownloadPdf;
    const originalText = downloadBtn ? downloadBtn.innerHTML : "";

    if (downloadBtn) {
      downloadBtn.innerHTML = `
        <svg class="spinner-sm" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none">
          <circle cx="12" cy="12" r="10" stroke-width="3"></circle>
        </svg>
        <span>Generating PDF...</span>
      `;
      downloadBtn.disabled = true;
    }

    try {
      // Fetch official PDF stream from FastAPI backend
      const response = await fetch(`http://localhost:8000/api/v1/reports/well/${encodeURIComponent(wellId)}/pdf`, {
        method: "GET",
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.style.display = "none";
      a.href = url;
      a.download = `${wellId.replace(/-/g, "_")}_Daily_Drilling_Report.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      if (typeof showToast === "function") {
        showToast(`✓ Official PDF Report for ${wellId} downloaded successfully.`);
      }
    } catch (err) {
      console.warn("Backend PDF generation download failed, invoking print fallback:", err);
      if (typeof showToast === "function") {
        showToast("⚠ Direct download failed; opening printable PDF save dialog.");
      }
      this.printReport();
    } finally {
      if (downloadBtn) {
        downloadBtn.innerHTML = originalText;
        downloadBtn.disabled = false;
      }
    }
  }

  printReport() {
    window.print();
  }
}

// Global instance
window.reportsEngineInstance = new ReportsEngine();
