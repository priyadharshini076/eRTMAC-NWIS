/**
 * NWIS - Nearby Well Intelligence System
 * Core Application Controller for Map & Alerts Pages
 * Ministry of Petroleum & Natural Gas | Oil India Limited
 */

document.addEventListener("DOMContentLoaded", () => {
  let currentWell = WELLS_DATA[0]; // Default: OIL-AS-NHRK-104
  let activeTab = "alerts"; // Default active view: Alerts page

  // Elements
  const wellSelect = document.getElementById("targetWellSelect");
  const runSimBtn = document.getElementById("runSimulationBtn");
  const simLoaderOverlay = document.getElementById("simLoaderOverlay");
  const simProgressFill = document.getElementById("simProgressFill");
  const simStatusLog = document.getElementById("simStatusLog");
  const clockDisplay = document.getElementById("clockDisplay");
  const toastNotice = document.getElementById("toastNotice");
  const toastMessage = document.getElementById("toastMessage");

  // Navigation Items
  const navMap = document.getElementById("navMap");
  const navRiskAssessment = document.getElementById("navRiskAssessment");
  const navAlerts = document.getElementById("navAlerts");
  const navCorrelation = document.getElementById("navCorrelation");
  const navDrillEngineer = document.getElementById("navDrillEngineer");
  const navReports = document.getElementById("navReports");
  const navRagBot = document.getElementById("navRagBot");
  const pageRiskAssessment = document.getElementById("pageRiskAssessment");
  const pageAlerts = document.getElementById("pageAlerts");
  const pageCorrelation = document.getElementById("pageCorrelation");
  const pageMap = document.getElementById("pageMap");
  const pageRagBot = document.getElementById("pageRagBot");

  // Populate Dropdown
  function populateWellDropdown(filter = "ALL") {
    wellSelect.innerHTML = "";
    WELLS_DATA.forEach(well => {
      if (filter === "ALL" || well.fieldCode.includes(filter) || well.field.toUpperCase().includes(filter)) {
        const option = document.createElement("option");
        option.value = well.wellId;
        option.textContent = `${well.wellId} • ${well.wellName} (${well.field} Field - ${well.riskZone})`;
        if (well.wellId === currentWell.wellId) {
          option.selected = true;
        }
        wellSelect.appendChild(option);
      }
    });
  }

  // Filter Buttons
  document.querySelectorAll(".field-tag-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".field-tag-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const tag = btn.getAttribute("data-field");
      populateWellDropdown(tag);
      if (wellSelect.options.length > 0) {
        wellSelect.selectedIndex = 0;
        onWellChange(wellSelect.value);
      }
    });
  });

  // Well Dropdown Change
  wellSelect.addEventListener("change", (e) => {
    onWellChange(e.target.value);
  });

  function onWellChange(wellId) {
    currentWell = getWellById(wellId);
    window.currentWell = currentWell;
    updateQuickInputs();
    // Auto-update or prompt simulation
    renderSimulationResults(currentWell, false);
  }

  window.currentWell = currentWell;

  // Update quick inputs (depth, formation)
  function updateQuickInputs() {
    const depthInput = document.getElementById("bitDepthInput");
    if (depthInput) depthInput.value = currentWell.currentDepthM;
    const formationTag = document.getElementById("formationTag");
    if (formationTag) formationTag.textContent = `${currentWell.formation} (${currentWell.formationAge})`;
    const statusHighlight = document.getElementById("statusWellHighlight");
    if (statusHighlight) statusHighlight.textContent = `${currentWell.wellId} (${currentWell.field} Field)`;
    const offsetCount = document.getElementById("offsetCountText");
    if (offsetCount) offsetCount.textContent = `Showing ${currentWell.offsetWellsCount} Offset Wells within 25 km of ${currentWell.wellId}`;
  }

  // Render Simulation Results
  function renderSimulationResults(well, animated = true) {
    window.renderSimulationResults = renderSimulationResults;
    const sim = well.simulation;
    
    // 1. Fused Score & Gauge
    const scoreVal = document.getElementById("fusedScoreVal");
    const gaugeCircle = document.getElementById("fusedGaugeCircle");
    const riskBadge = document.getElementById("riskLevelBadge");
    const riskDesc = document.getElementById("fusedRiskDesc");
    const confidenceVal = document.getElementById("modelConfidenceVal");

    if (scoreVal) scoreVal.textContent = sim.fusedScore.toFixed(1);
    if (confidenceVal) confidenceVal.textContent = `${sim.confidence}%`;
    if (riskDesc) {
      riskDesc.textContent = `Unified ML Hazard Index for ${well.wellName} at current depth ${well.currentDepthM}m. Primary driver: ${sim.hazardProbabilities[0].name}.`;
    }

    if (riskBadge) {
      riskBadge.textContent = sim.riskLevel;
      if (sim.fusedScore >= 70) {
        riskBadge.className = "risk-level-badge badge-critical";
        riskBadge.style.color = "#f87171";
        riskBadge.style.backgroundColor = "rgba(220, 38, 38, 0.25)";
        riskBadge.style.borderColor = "rgba(220, 38, 38, 0.5)";
      } else if (sim.fusedScore >= 45) {
        riskBadge.className = "risk-level-badge";
        riskBadge.style.color = "#fbbf24";
        riskBadge.style.backgroundColor = "rgba(245, 158, 11, 0.25)";
        riskBadge.style.borderColor = "rgba(245, 158, 11, 0.5)";
      } else {
        riskBadge.className = "risk-level-badge";
        riskBadge.style.color = "#34d399";
        riskBadge.style.backgroundColor = "rgba(16, 185, 129, 0.25)";
        riskBadge.style.borderColor = "rgba(16, 185, 129, 0.5)";
      }
    }

    // Gauge circumference is 2 * PI * 60 ~= 377
    if (gaugeCircle) {
      const offset = 377 - (377 * (sim.fusedScore / 100));
      gaugeCircle.style.strokeDashoffset = offset;
      gaugeCircle.style.stroke = sim.fusedScore >= 70 ? "#dc2626" : (sim.fusedScore >= 45 ? "#ea580c" : "#16a34a");
    }

    // 2. Individual Hazard Probability Bars
    const hazardContainer = document.getElementById("hazardBarsContainer");
    if (hazardContainer) {
      hazardContainer.innerHTML = "";
      sim.hazardProbabilities.forEach(hazard => {
        const row = document.createElement("div");
        row.className = "hazard-row-card";

        let tagClass = "tag-low";
        if (hazard.status === "Critical") tagClass = "tag-critical";
        else if (hazard.status === "High") tagClass = "tag-high";
        else if (hazard.status === "Moderate") tagClass = "tag-moderate";

        row.innerHTML = `
          <div class="hazard-header">
            <span class="hazard-name">
              <span class="dot" style="width:7px; height:7px; border-radius:50%; background-color:${hazard.color};"></span>
              ${hazard.name}
            </span>
            <div class="hazard-score-tag">
              <span class="hazard-trend">${hazard.trend}</span>
              <span class="hazard-pct" style="color: ${hazard.color}">${hazard.probability}%</span>
              <span class="hazard-tag ${tagClass}">${hazard.status}</span>
            </div>
          </div>
          <div class="hazard-bar-track">
            <div class="hazard-bar-fill" style="width: ${animated ? '0%' : hazard.probability + '%'}; background-color: ${hazard.color};" data-target="${hazard.probability}"></div>
          </div>
        `;
        hazardContainer.appendChild(row);
      });

      if (animated) {
        setTimeout(() => {
          document.querySelectorAll(".hazard-bar-fill").forEach(fill => {
            fill.style.width = fill.getAttribute("data-target") + "%";
          });
        }, 80);
      }
    }

    // 3. Telemetry Anomalies
    const telemetryContainer = document.getElementById("telemetryStripContainer");
    if (telemetryContainer) {
      telemetryContainer.innerHTML = "";
      sim.telemetryAnomalies.forEach(tele => {
        const cell = document.createElement("div");
        cell.className = `telemetry-cell ${tele.alert ? 'anomaly' : ''}`;
        cell.innerHTML = `
          <div class="tele-label">${tele.parameter}</div>
          <div class="tele-value">${tele.current}</div>
          <div class="tele-delta">${tele.delta}</div>
        `;
        telemetryContainer.appendChild(cell);
      });
    }

    // 4. Explanations (Geological Drivers & Offset Precedents)
    const geoList = document.getElementById("geoDriversList");
    if (geoList) {
      geoList.innerHTML = "";
      sim.explanations.geologicalDrivers.forEach(text => {
        const li = document.createElement("li");
        li.className = "expl-item";
        li.innerHTML = `<span class="expl-bullet"></span><span>${text}</span>`;
        geoList.appendChild(li);
      });
    }

    const offsetList = document.getElementById("offsetPrecedentsList");
    if (offsetList) {
      offsetList.innerHTML = "";
      sim.explanations.offsetPrecedents.forEach(text => {
        const li = document.createElement("li");
        li.className = "expl-item";
        li.innerHTML = `<span class="expl-bullet" style="background-color:#d97706;"></span><span>${text}</span>`;
        offsetList.appendChild(li);
      });
    }

    // 5. SHAP Feature Importance
    const shapContainer = document.getElementById("shapBarsContainer");
    if (shapContainer) {
      shapContainer.innerHTML = "";
      sim.explanations.featureImportance.forEach(item => {
        const row = document.createElement("div");
        row.className = "shap-row";
        row.innerHTML = `
          <div class="shap-info">
            <span>${item.feature}</span>
            <span class="shap-weight">${item.weight}% Impact</span>
          </div>
          <div class="shap-track">
            <div class="shap-fill" style="width: ${item.weight * 2.4}%"></div>
          </div>
        `;
        shapContainer.appendChild(row);
      });
    }

    // 6. Recommended Actions
    const actionsGrid = document.getElementById("actionCardsGrid");
    if (actionsGrid) {
      actionsGrid.innerHTML = "";
      sim.recommendedActions.forEach(action => {
        let pClass = "priority-standard";
        let cardClass = "action-standard";
        if (action.priority === "IMMEDIATE" || action.priority === "CRITICAL") {
          pClass = "priority-immediate";
          cardClass = "action-immediate";
        } else if (action.priority === "OPERATIONAL") {
          pClass = "priority-operational";
          cardClass = "action-operational";
        } else if (action.priority === "CONTINGENCY") {
          pClass = "priority-contingency";
          cardClass = "action-contingency";
        }

        const card = document.createElement("div");
        card.className = `action-item-card ${cardClass}`;
        card.innerHTML = `
          <div class="action-card-header">
            <span class="action-priority-badge ${pClass}">${action.priority}</span>
            <span class="action-category">${action.category}</span>
          </div>
          <div class="action-title">${action.action}</div>
          <div class="action-desc">${action.detail}</div>
        `;
        actionsGrid.appendChild(card);
      });
    }

    // 7. Parameter Matrix Table
    const paramTableBody = document.getElementById("paramTableBody");
    if (paramTableBody) {
      paramTableBody.innerHTML = "";
      sim.parameterMatrix.forEach(row => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><strong>${row.parameter}</strong></td>
          <td class="param-val-current">${row.current}</td>
          <td class="param-val-rec">${row.recommended}</td>
          <td class="param-val-safe">${row.safeRange}</td>
        `;
        paramTableBody.appendChild(tr);
      });
    }

    // 8. SOP Reference
    const sopCode = document.getElementById("sopCodeTag");
    if (sopCode) sopCode.textContent = sim.sopReference;
  }

  // Run ML Simulation Button Trigger
  runSimBtn.addEventListener("click", () => {
    executeSimulation();
  });

  function executeSimulation() {
    simLoaderOverlay.classList.add("active");
    simProgressFill.style.width = "0%";
    simStatusLog.textContent = "Connecting to NWIS Real-Time Data Pipeline...";

    const stages = [
      { progress: "18%", msg: "Ingesting MWD/LWD telemetry & active surface drilling sensors..." },
      { progress: "42%", msg: "Computing geomechanical pore pressure vs fracture gradient window..." },
      { progress: "68%", msg: "Querying 14 offset wells in 25km radius (Assam-Arakan Basin)..." },
      { progress: "88%", msg: "Running Gradient Boosting & XGBoost multi-hazard classifiers..." },
      { progress: "100%", msg: "Synthesizing RAG mitigation protocols & Oil India SOP directives..." }
    ];

    stages.forEach((stage, idx) => {
      setTimeout(() => {
        simProgressFill.style.width = stage.progress;
        simStatusLog.textContent = stage.msg;
      }, (idx + 1) * 350);
    });

    setTimeout(() => {
      simLoaderOverlay.classList.remove("active");
      renderSimulationResults(currentWell, true);
      showToast(`ML Simulation complete for ${currentWell.wellId}: Risk Score ${currentWell.simulation.fusedScore}/100.`);
    }, stages.length * 350 + 200);
  }

  // Helper to fetch current active role from session
  function getCurrentRole() {
    try {
      const savedUser = localStorage.getItem("nwis_user") || localStorage.getItem("wigms_user");
      if (savedUser) {
        const u = JSON.parse(savedUser);
        if (u && u.role) return u.role;
      }
    } catch (e) {}
    return "drilling_engineer";
  }
  window.getCurrentRole = getCurrentRole;

  // Supervisor Approval Clearance State (Default: Locked / Waiting for action)
  window.isSupervisorApproved = false;

  // Role Customization Engine
  function applyRoleCustomizations(targetRole) {
    const role = targetRole || getCurrentRole();

    const supervisorBtns = document.getElementById("supervisorActionButtons");
    const engineerNotice = document.getElementById("engineerApprovalNotice");
    const btnStart = document.getElementById("btnStartDrilling");
    const btnStop = document.getElementById("btnStopDrilling");
    const supervisorChip = document.getElementById("supervisorMonitoringChip");
    const btnGoToAlerts = document.getElementById("btnGoToAlertsApproval");

    if (role === "drilling_engineer") {
      // 1. ALERTS PAGE: Drilling Engineer CANNOT have approve/reject options
      if (supervisorBtns) supervisorBtns.classList.add("hidden");
      if (engineerNotice) engineerNotice.classList.remove("hidden");

      // 2. DRILL ENGINEER PAGE: Can operate controls, but locked until supervisor approved
      if (supervisorChip) supervisorChip.classList.add("hidden");
      if (btnStart) btnStart.classList.remove("hidden");
      if (btnStop) btnStop.classList.remove("hidden");

      if (btnGoToAlerts) {
        btnGoToAlerts.innerHTML = window.isSupervisorApproved
          ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><span>View Supervisor Clearance</span>`
          : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C9.243 2 7 4.243 7 7v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7c0-2.757-2.243-5-5-5zm-3 5c0-1.654 1.346-3 3-3s3 1.346 3 3v3H9V7z"/></svg><span>Check Supervisor Clearance Status</span>`;
      }
    } else if (role === "drilling_supervisor") {
      // 1. ALERTS PAGE: Supervisor HAS attractive Approve / Reject buttons
      if (supervisorBtns) supervisorBtns.classList.remove("hidden");
      if (engineerNotice) engineerNotice.classList.add("hidden");

      // 2. DRILL ENGINEER PAGE: Monitoring ONLY (cannot start / stop simulation)
      if (btnStart) btnStart.classList.add("hidden");
      if (btnStop) btnStop.classList.add("hidden");
      if (supervisorChip) supervisorChip.classList.remove("hidden");

      if (btnGoToAlerts) {
        btnGoToAlerts.innerHTML = window.isSupervisorApproved
          ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><span>Manage Active Permit</span>`
          : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg><span>Go to Alerts Page to Authorize Permit</span>`;
      }
    } else {
      // ADMINISTRATOR: Both should be available as like now
      if (supervisorBtns) supervisorBtns.classList.remove("hidden");
      if (engineerNotice) engineerNotice.classList.add("hidden");

      if (supervisorChip) supervisorChip.classList.add("hidden");
      if (btnStart) btnStart.classList.remove("hidden");
      if (btnStop) btnStop.classList.remove("hidden");

      if (btnGoToAlerts) {
        btnGoToAlerts.innerHTML = window.isSupervisorApproved
          ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><span>View Clearance Authorization</span>`
          : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg><span>Go to Alerts Page to Approve</span>`;
      }
    }
  }
  window.applyRoleCustomizations = applyRoleCustomizations;

  function updateSupervisorClearanceUI() {
    const card = document.getElementById("supervisorApprovalGatewayCard");
    const statusPill = document.getElementById("supervisorStatusPill");
    const statusText = document.getElementById("supervisorStatusText");
    const explanation = document.getElementById("supervisorApprovalExplanation");
    const permitCode = document.getElementById("supervisorPermitCode");
    const drillFloorState = document.getElementById("drillFloorStateText");
    const btnApproveText = document.getElementById("btnSupervisorApproveText");

    // Drilling Engineer notice box elements
    const engNotice = document.getElementById("engineerApprovalNotice");
    const engTitle = document.getElementById("engNoticeTitle");
    const engDesc = document.getElementById("engNoticeDesc");
    const engBadge = document.getElementById("engNoticeBadgeText");
    const engIconBox = document.getElementById("engNoticeIconBox");

    // Drill Engineer elements
    const drillBanner = document.getElementById("drillClearanceBanner");
    const drillTitle = document.getElementById("drillClearanceTitle");
    const drillDesc = document.getElementById("drillClearanceDesc");
    const drillIcon = document.getElementById("drillClearanceIcon");
    const btnStart = document.getElementById("btnStartDrilling");
    const startText = document.getElementById("startDrillingBtnText");
    const startIcon = document.getElementById("startDrillingBtnIcon");

    if (window.isSupervisorApproved) {
      if (card) card.classList.add("approved");
      if (statusPill) {
        statusPill.className = "supervisor-status-pill status-approved";
      }
      if (statusText) {
        statusText.innerHTML = "✓ SUPERVISOR APPROVAL GRANTED — DRILLING PERMIT ISSUED";
      }
      if (explanation) {
        explanation.innerHTML = "<strong>DRILLING PERMIT #OIL-AS-2024-DRL-8921 AUTHORIZED:</strong> Pre-drill mitigations verified (Barite weighted up to 12.1 PPG, vacuum degasser online, kick shut-in briefed). Safe geomechanical window confirmed. <strong>Rotary drilling is officially authorized.</strong>";
      }
      if (permitCode) {
        permitCode.textContent = "OIL-AS-2024-DRL-8921 (AUTHORIZED & VALID)";
      }
      if (drillFloorState) {
        drillFloorState.className = "appr-meta-val text-emerald";
        drillFloorState.textContent = "PERMIT ACTIVE — ROTARY DRILLING AUTHORIZED";
      }
      if (btnApproveText) {
        btnApproveText.textContent = "✓ PERMIT ISSUED (CLICK TO REVOKE/HOLD)";
      }

      // Update Drilling Engineer Notice Box
      if (engNotice) engNotice.classList.add("approved");
      if (engTitle) engTitle.textContent = "✓ SUPERVISORY CLEARANCE ACTIVE — ROTARY DRILLING UNLOCKED";
      if (engDesc) {
        engDesc.innerHTML = "Supervisor (Er. Rajiv Bordoloi) has verified downhole mitigations and <strong>granted authorization for Permit #OIL-AS-2024-DRL-8921</strong>. Rotary drilling console is unlocked and ready for execution.";
      }
      if (engBadge) engBadge.textContent = "APPROVED BY SUPERVISOR";
      if (engIconBox) {
        engIconBox.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
      }

      // Update Drill Engineer Page Banner & Buttons
      if (drillBanner) {
        drillBanner.className = "supervisor-clearance-alert-banner approved";
      }
      if (drillIcon) {
        drillIcon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
      }
      if (drillTitle) {
        drillTitle.textContent = "✓ DRILLING AUTHORIZED: SUPERVISOR APPROVAL #OIL-AS-2024-DRL-8921 ISSUED";
      }
      if (drillDesc) {
        drillDesc.textContent = "Supervisory clearance issued by Er. Rajiv Bordoloi. Safe geomechanical operating window confirmed (Mud weight 12.1 PPG vs Tipam Pore 11.8 PPG). Rotary drilling may proceed.";
      }
      if (btnStart) {
        btnStart.classList.remove("btn-drilling-locked");
        btnStart.title = "Start Rotary Drilling (Clearance Active)";
      }
      if (startText) startText.textContent = "START DRILLING";
      if (startIcon) {
        startIcon.innerHTML = `<polygon points="5 3 19 12 5 21 5 3"/>`;
      }
    } else {
      if (card) card.classList.remove("approved");
      if (statusPill) {
        statusPill.className = "supervisor-status-pill status-waiting";
      }

      const isThresholdStop = !!window.hasTriggeredThresholdExceeded;
      const riskVal = window.thresholdExceededRisk ? window.thresholdExceededRisk.toFixed(1) + "%" : "81.8%";
      const depthVal = window.thresholdDepth || "2,503.7 m";

      if (statusText) {
        statusText.innerHTML = isThresholdStop
          ? `<span class="pulsing-amber-dot" style="background:#ef4444;box-shadow:0 0 8px #ef4444;"></span><span>CRITICAL RISK THRESHOLD EXCEEDED (${riskVal} &gt; 80.0%) — SUPERVISOR ACTION MANDATORY</span>`
          : `<span class="pulsing-amber-dot"></span><span>WAITING FOR THE SUPERVISOR ACTION</span>`;
      }
      if (explanation) {
        explanation.innerHTML = isThresholdStop
          ? `<strong>EMERGENCY SAFETY SHUTDOWN TRIGGERED:</strong> Drilling on Rig NHRK RIG-A was <strong>automatically stopped</strong> after depth advance to ${depthVal} in the over-pressured Tipam formation. Real-time gas kick risk reached <strong>${riskVal}</strong>, crossing the mandatory <strong>80.0% safety threshold</strong>. Drill string rotation is locked. Rig Operations Supervisor must review downhole pore underbalance and authorize the remediation permit (weighing up mud to 12.1 PPG) before rotary drilling can resume.`
          : `Drilling operations on <strong>Rig NHRK RIG-A (Well OIL-AS-NHRK-104)</strong> are currently in <strong>SAFE STANDBY</strong>. Rotary drill string rotation is locked. Downhole gas kick risk and pressure underbalance require verified supervisory clearance. When the Rig Operations Supervisor clicks approve, the permit is digitally validated and the Drill Engineer console is immediately authorized to commence drilling.`;
      }
      if (permitCode) {
        permitCode.textContent = isThresholdStop
          ? `OIL-AS-2024-SUP-9182 (EMERGENCY HOLD — RISK ${riskVal})`
          : "OIL-AS-2024-SUP-9182 (PENDING SIGN-OFF)";
      }
      if (drillFloorState) {
        drillFloorState.className = "appr-meta-val text-amber";
        drillFloorState.textContent = isThresholdStop
          ? `EMERGENCY SAFETY HOLD (RISK ${riskVal} > 80%)`
          : "STANDBY LOCKED (OFF-BOTTOM)";
      }
      if (btnApproveText) {
        btnApproveText.textContent = isThresholdStop
          ? "✓ GRANT SUPERVISORY APPROVAL & REMEDIATE"
          : "✓ GRANT SUPERVISORY APPROVAL (ISSUE PERMIT)";
      }

      // Update Drilling Engineer Notice Box
      if (engNotice) engNotice.classList.remove("approved");
      if (engTitle) {
        engTitle.textContent = isThresholdStop
          ? `🚨 EMERGENCY SAFETY HOLD — RISK EXCEEDED 80% THRESHOLD (${riskVal})`
          : "MANDATORY SUPERVISORY CLEARANCE REQUIRED";
      }
      if (engDesc) {
        engDesc.innerHTML = isThresholdStop
          ? `Rotary drilling was <strong>automatically halted</strong> because real-time risk reached <strong>${riskVal}</strong> (crossing the 80.0% safety threshold). As a <strong>Drilling Engineer</strong>, you cannot restart the simulation. The permit <strong>should be approved by Supervisor (Er. Rajiv Bordoloi)</strong> with mud remediation before operations can resume.`
          : `As a <strong>Drilling Engineer</strong>, you do not have permission to self-authorize drilling operations. This permit <strong>should be approved by Supervisor (Er. Rajiv Bordoloi)</strong> before rotary drilling can commence. Rig floor rotary controls remain locked in safety standby.`;
      }
      if (engBadge) {
        engBadge.textContent = isThresholdStop
          ? "SUPERVISOR ACTION REQUIRED (RISK > 80%)"
          : "SHOULD BE APPROVED BY SUPERVISOR";
      }
      if (engIconBox) {
        engIconBox.innerHTML = isThresholdStop
          ? `<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
          : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
      }

      // Update Drill Engineer Page
      if (drillBanner) {
        drillBanner.className = isThresholdStop
          ? "supervisor-clearance-alert-banner critical"
          : "supervisor-clearance-alert-banner pending";
      }
      if (drillIcon) {
        drillIcon.innerHTML = isThresholdStop
          ? `<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
          : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
      }
      if (drillTitle) {
        drillTitle.textContent = isThresholdStop
          ? `🚨 DRILLING AUTO-STOPPED: CRITICAL RISK EXCEEDED (${riskVal} > 80.0%)`
          : "ROTARY DRILLING LOCKED — WAITING FOR SUPERVISOR ACTION";
      }
      if (drillDesc) {
        drillDesc.textContent = isThresholdStop
          ? `Safety Interlock auto-halted drilling operations at ${depthVal}. Real-time downhole risk surged to ${riskVal}. Supervisory approval and mud remediation required on Alerts page before operations can resume.`
          : "Rig floor rotary drilling is placed on safety hold. Critical risk assessment anomalies require supervisory clearance on the Alerts page before the drill string can be engaged.";
      }
      if (btnStart) {
        btnStart.classList.add("btn-drilling-locked");
        btnStart.title = isThresholdStop
          ? `Locked: Risk ${riskVal} exceeded 80% safety limit. Supervisor approval required.`
          : "Locked: Waiting for Supervisor action on Alerts page";
      }
      if (startText) {
        startText.textContent = isThresholdStop ? "LOCKED (RISK > 80%)" : "LOCKED (APPROVAL REQ.)";
      }
      if (startIcon) {
        startIcon.innerHTML = `<path d="M12 2C9.243 2 7 4.243 7 7v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7c0-2.757-2.243-5-5-5zm-3 5c0-1.654 1.346-3 3-3s3 1.346 3 3v3H9V7z"/>`;
      }
    }

    // Apply role-specific visibility rules
    applyRoleCustomizations();
  }
  window.updateSupervisorClearanceUI = updateSupervisorClearanceUI;

  // Navigation switching
  function switchTab(target) {
    activeTab = target;
    const pageDrillEngineer = document.getElementById("pageDrillEngineer");
    const pageRiskAssessment = document.getElementById("pageRiskAssessment");
    const pageAlerts = document.getElementById("pageAlerts");
    const pageCorrelation = document.getElementById("pageCorrelation");
    const pageMap = document.getElementById("pageMap");

    // Hide all pages
    if (pageRiskAssessment) pageRiskAssessment.classList.add("hidden");
    if (pageAlerts) pageAlerts.classList.add("hidden");
    if (pageCorrelation) pageCorrelation.classList.add("hidden");
    if (pageMap) pageMap.classList.add("hidden");
    if (pageDrillEngineer) pageDrillEngineer.classList.add("hidden");
    if (pageRagBot) pageRagBot.classList.add("hidden");

    // Clear active navigation styles
    if (navRiskAssessment) navRiskAssessment.classList.remove("active");
    if (navAlerts) navAlerts.classList.remove("active");
    if (navCorrelation) navCorrelation.classList.remove("active");
    if (navMap) navMap.classList.remove("active");
    if (navDrillEngineer) navDrillEngineer.classList.remove("active");
    if (navReports) navReports.classList.remove("active");
    if (navRagBot) navRagBot.classList.remove("active");

    if (target === "assessment") {
      if (navRiskAssessment) navRiskAssessment.classList.add("active");
      if (pageRiskAssessment) pageRiskAssessment.classList.remove("hidden");
    } else if (target === "alerts") {
      if (navAlerts) navAlerts.classList.add("active");
      if (pageAlerts) pageAlerts.classList.remove("hidden");
    } else if (target === "correlation") {
      if (navCorrelation) navCorrelation.classList.add("active");
      if (pageCorrelation) pageCorrelation.classList.remove("hidden");
      if (window.initCorrelationEngine) {
        window.initCorrelationEngine();
      }
    } else if (target === "map") {
      if (navMap) navMap.classList.add("active");
      if (pageMap) pageMap.classList.remove("hidden");
      if (window.initMapEngine) {
        window.initMapEngine();
      }
      [40, 120, 250, 450].forEach((d) => {
        setTimeout(() => {
          if (window.leafletMapInstance) {
            window.leafletMapInstance.invalidateSize();
          }
        }, d);
      });
    } else if (target === "engineer") {
      if (navDrillEngineer) navDrillEngineer.classList.add("active");
      if (pageDrillEngineer) pageDrillEngineer.classList.remove("hidden");
      
      // Initialize 3D Engine on first display
      if (window.initDrillingEngine) {
        window.initDrillingEngine();
      }
    } else if (target === "ragbot") {
      if (navRagBot) navRagBot.classList.add("active");
      if (pageRagBot) pageRagBot.classList.remove("hidden");
      if (window.ragChatbotInstance) {
        window.ragChatbotInstance.loadQuickStats();
        window.ragChatbotInstance.scrollToBottom();
      }
    } else {
      showToast(`Switched view to ${target.toUpperCase()}`);
    }
  }

  window.switchAppTab = switchTab;

  // Navigation event listeners
  if (navMap) {
    navMap.addEventListener("click", (e) => {
      e.preventDefault();
      switchTab("map");
    });
  }

  if (navRagBot) {
    navRagBot.addEventListener("click", (e) => {
      e.preventDefault();
      switchTab("ragbot");
    });
  }

  if (navRiskAssessment) {
    navRiskAssessment.addEventListener("click", (e) => {
      e.preventDefault();
      switchTab("assessment");
    });
  }

  if (navAlerts) {
    navAlerts.addEventListener("click", (e) => {
      e.preventDefault();
      switchTab("alerts");
    });
  }

  if (navCorrelation) {
    navCorrelation.addEventListener("click", (e) => {
      e.preventDefault();
      switchTab("correlation");
    });
  }

  if (navDrillEngineer) {
    navDrillEngineer.addEventListener("click", (e) => {
      e.preventDefault();
      switchTab("engineer");
    });
  }

  if (navReports) {
    navReports.addEventListener("click", (e) => {
      e.preventDefault();
      showToast("Reports Portal • Daily Drilling Reports (DDR) & SCADA Archive");
    });
  }

  const linkRemediation = document.getElementById("linkToRemediation");
  if (linkRemediation) {
    linkRemediation.addEventListener("click", (e) => {
      e.preventDefault();
      switchTab("alerts");
    });
  }

  // Supervisor Approval Actions
  const btnApprove = document.getElementById("btnSupervisorApprove");
  if (btnApprove) {
    btnApprove.addEventListener("click", () => {
      window.isSupervisorApproved = !window.isSupervisorApproved;
      
      if (window.isSupervisorApproved) {
        // Remediate risk down to safe operating margin (64.0%)
        const previousRisk = window.thresholdExceededRisk ? window.thresholdExceededRisk.toFixed(1) + "%" : "81.8%";
        window.hasTriggeredThresholdExceeded = false;
        
        if (window.drillingOpsEngineInstance) {
          window.drillingOpsEngineInstance.currentRiskScore = 64.0;
          window.drillingOpsEngineInstance.telemetry.mudWeight = 12.1;
          window.drillingOpsEngineInstance.renderMetrics();
        }
        if (currentWell && currentWell.simulation) {
          currentWell.simulation.fusedScore = 64.0;
          currentWell.currentMudWeightPpg = 12.1;
          renderSimulationResults(currentWell, false);
        }
        
        updateSupervisorClearanceUI();
        showToast(`✓ Supervisor Approval Granted! Mud weighted to 12.1 PPG, risk remediated from ${previousRisk} to 64.0%. Drill Engineer console unlocked.`);
      } else {
        updateSupervisorClearanceUI();
        showToast("⚠ Drilling Permit Revoked / Standby Hold Restored.");
      }
    });
  }

  const btnReject = document.getElementById("btnSupervisorReject");
  if (btnReject) {
    btnReject.addEventListener("click", () => {
      window.isSupervisorApproved = false;
      updateSupervisorClearanceUI();
      showToast("⚠ Remediation Requested: Rig floor placed on mandatory safety hold.");
    });
  }

  const btnSwitchToEng = document.getElementById("btnSwitchToDrillEngineer");
  if (btnSwitchToEng) {
    btnSwitchToEng.addEventListener("click", () => {
      switchTab("engineer");
    });
  }

  const btnGoToAlerts = document.getElementById("btnGoToAlertsApproval");
  if (btnGoToAlerts) {
    btnGoToAlerts.addEventListener("click", () => {
      switchTab("alerts");
    });
  }

  const btnPrintClearance = document.getElementById("btnPrintClearanceReport");
  if (btnPrintClearance) {
    btnPrintClearance.addEventListener("click", () => {
      window.print();
    });
  }

  // Map Well click to switch to Risk Assessment
  const mapCalloutBtn = document.getElementById("analyzeInAlertsBtn");
  if (mapCalloutBtn) {
    mapCalloutBtn.addEventListener("click", () => {
      switchTab("assessment");
      executeSimulation();
    });
  }

  const mapCompareBtn = document.getElementById("mapCompareBtn");
  if (mapCompareBtn) {
    mapCompareBtn.addEventListener("click", () => {
      switchTab("assessment");
      executeSimulation();
    });
  }

  // Acknowledge & Dispatch to Rig Floor
  const btnDispatch = document.getElementById("btnDispatchRig");
  if (btnDispatch) {
    btnDispatch.addEventListener("click", () => {
      showToast(`✓ Hazard Alert & Mitigations Dispatched to Rig #${currentWell.rigName}!`);
    });
  }

  // Export Dossier
  const btnExport = document.getElementById("btnExportDossier");
  if (btnExport) {
    btnExport.addEventListener("click", () => {
      window.print();
    });
  }

  // Reset Simulation
  const btnReset = document.getElementById("btnResetSim");
  if (btnReset) {
    btnReset.addEventListener("click", () => {
      onWellChange(currentWell.wellId);
      showToast("Simulation parameters reset to live baseline.");
    });
  }

  // Toast Notification
  function showToast(message) {
    if (!toastNotice) return;
    toastMessage.textContent = message;
    toastNotice.classList.add("show");
    setTimeout(() => {
      toastNotice.classList.remove("show");
    }, 3800);
  }
  window.showToast = showToast;

  // Digital Live Clock (HH:mm:ss IST)
  function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    if (clockDisplay) {
      clockDisplay.textContent = `${hours}:${minutes}:${seconds} IST`;
    }
  }
  setInterval(updateClock, 1000);
  updateClock();

  // Subtle SCADA telemetry pulse simulation on bottom card
  setInterval(() => {
    const liveRop = document.getElementById("liveSidebarRop");
    if (liveRop) {
      const base = 14.8;
      const jitter = (Math.random() * 0.8 - 0.4).toFixed(1);
      liveRop.textContent = `${(base + parseFloat(jitter)).toFixed(1)} m/hr`;
    }
  }, 3000);

  // Initial Setup
  populateWellDropdown("ALL");
  updateQuickInputs();
  renderSimulationResults(currentWell, false);
  updateSupervisorClearanceUI();
  
  // Check location hash for initial view
  const currentHash = window.location.hash.replace("#", "").toLowerCase();
  if (currentHash && ["map", "assessment", "alerts", "correlation", "engineer"].includes(currentHash)) {
    switchTab(currentHash);
  } else {
    switchTab("alerts");
  }

  window.addEventListener("hashchange", () => {
    const hash = window.location.hash.replace("#", "").toLowerCase();
    if (hash && ["map", "assessment", "alerts", "correlation", "engineer"].includes(hash)) {
      switchTab(hash);
    }
  });
});

