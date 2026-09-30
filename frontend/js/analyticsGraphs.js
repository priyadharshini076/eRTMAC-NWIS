/**
 * analyticsGraphs.js - High-Precision Real-Time Subsurface & Operational Analytics
 * Oil India Limited / NWIS (Nearby Well Intelligence System)
 * Light-Themed, Real-Time Interactive Telemetry Visualization Engine
 */

class AnalyticsGraphsEngine {
  constructor() {
    this.graphs = {};
    this.timer = null;
    this.telemetryData = {
      depth: 3420.0,
      porePressure: 11.82,
      currentMudWeight: 11.40,
      targetMudWeight: 12.10,
      fractureLimit: 13.50,
      gasUnits: 524.5,
      kickThreshold: 500.0,
      riskKick: 84.6,
      riskStuck: 68.5,
      riskCirc: 62.0,
      flowRate: 754,
      ecd: 12.38
    };
    this.init();
  }

  init() {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => this.setup());
    } else {
      this.setup();
    }
  }

  setup() {
    this.bindTooltips();
    this.startRealtimeTicker();
  }

  startRealtimeTicker() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.tickRealtimeStream();
    }, 1200);
  }

  tickRealtimeStream() {
    // 1. Natural micro-jitter simulating downhole LWD/MWD sensors
    const gasNoise = (Math.random() - 0.48) * 6.5;
    this.telemetryData.gasUnits = Math.max(505, Math.min(545, this.telemetryData.gasUnits + gasNoise));

    const ecdNoise = (Math.random() - 0.5) * 0.025;
    this.telemetryData.ecd = Math.max(12.34, Math.min(12.43, this.telemetryData.ecd + ecdNoise));

    const poreNoise = (Math.random() - 0.5) * 0.015;
    this.telemetryData.porePressure = Math.max(11.78, Math.min(11.86, this.telemetryData.porePressure + poreNoise));

    // Sync with global drilling engine if active
    if (window.drillingEngineInstance) {
      if (window.drillingEngineInstance.currentDepth) {
        // If simulation is running at a different depth, scale smoothly
        const simDepth = window.drillingEngineInstance.currentDepth;
        if (simDepth > 2000) {
          this.telemetryData.depth = simDepth;
        }
      }
      if (window.drillingEngineInstance.riskScore) {
        this.telemetryData.riskKick = window.drillingEngineInstance.riskScore;
      }
    }

    // 2. Update Header Live Badges
    const liveGeoVal = document.getElementById("liveGeoVal");
    if (liveGeoVal) {
      liveGeoVal.innerHTML = `Depth: <strong>${this.telemetryData.depth.toFixed(1)} m</strong> • Pore: <strong>${this.telemetryData.porePressure.toFixed(2)} PPG</strong>`;
    }

    const liveGasVal = document.getElementById("liveGasVal");
    if (liveGasVal) {
      liveGasVal.innerHTML = `Live Gas: <strong>${Math.round(this.telemetryData.gasUnits)} units</strong> • <span style="color:#dc2626; font-weight:700;">+${(gasNoise > 0 ? "+" : "") + gasNoise.toFixed(1)} u/hr</span>`;
    }

    const liveRiskVal = document.getElementById("liveRiskVal");
    if (liveRiskVal) {
      const risk = this.telemetryData.riskKick;
      const riskColor = risk >= 75 ? "#dc2626" : risk >= 50 ? "#d97706" : "#059669";
      const riskLabel = risk >= 75 ? "CRITICAL KICK ZONE" : risk >= 50 ? "ELEVATED" : "NORMAL";
      liveRiskVal.innerHTML = `Gas Kick: <strong style="color:${riskColor};">${risk.toFixed(1)}%</strong> (${riskLabel})`;
    }

    const liveEcdVal = document.getElementById("liveEcdVal");
    if (liveEcdVal) {
      liveEcdVal.innerHTML = `Flow: <strong>${this.telemetryData.flowRate} LPM</strong> • ECD: <strong>${this.telemetryData.ecd.toFixed(2)} PPG</strong>`;
    }

    // 3. Subtle micro-animation of live beacon circles in SVG
    const gasCircle = document.getElementById("offsetLivePoint");
    if (gasCircle) {
      // Offset live gas Y coordinate mapped: 50u = 185, 800u = 45 -> dynamic Y
      const gasRatio = (this.telemetryData.gasUnits - 50) / 750;
      const targetY = 185 - gasRatio * 140;
      gasCircle.setAttribute("cy", targetY.toFixed(1));
    }

    const ecdPoint = document.getElementById("ecdLivePoint");
    if (ecdPoint) {
      const ecdY = 100 + (this.telemetryData.ecd - 12.38) * 80;
      ecdPoint.setAttribute("cy", ecdY.toFixed(1));
    }
  }

  bindTooltips() {
    // 1. Geomechanics Tooltip
    this.attachGraphHover("graphContainerGeo", "crosshairGeo", "tooltipGeo", (normX, normY) => {
      // normX: 0..1 across X axis (approx 8.5 to 14.5 PPG)
      // normY: 0..1 across Y axis (approx 2000m to 3850m depth)
      const depth = Math.round(2000 + normY * 1850);
      const mudPpg = (9.0 + normX * 5.0).toFixed(2);
      const estPore = depth < 3000 ? (9.5 + (depth - 2000) * 0.0006).toFixed(2) : (10.1 + (depth - 3000) * 0.0038).toFixed(2);
      const frac = (13.2 + (depth - 2000) * 0.0002).toFixed(2);
      const safe = parseFloat(mudPpg) >= parseFloat(estPore) && parseFloat(mudPpg) <= parseFloat(frac);

      return `
        <div class="tip-header">DEPTH: ${depth.toLocaleString()} m</div>
        <div class="tip-row"><span>Interpolated Mud:</span><strong>${mudPpg} PPG</strong></div>
        <div class="tip-row"><span>Pore Pressure:</span><strong style="color:#dc2626">${estPore} PPG</strong></div>
        <div class="tip-row"><span>Fracture Ceiling:</span><strong style="color:#2563eb">${frac} PPG</strong></div>
        <div class="tip-row"><span>Window Status:</span><strong style="color:${safe ? "#059669" : "#dc2626"}">${safe ? "SAFE OPERATING" : "HAZARD BOUNDARY"}</strong></div>
      `;
    });

    // 2. Offset Correlation Tooltip
    this.attachGraphHover("graphContainerOffset", "crosshairOffset", "tooltipOffset", (normX) => {
      const depth = Math.round(3380 + normX * 50);
      const gasOffset = depth < 3410 ? Math.round(50 + (depth - 3380) * 3) : Math.round(140 + Math.pow((depth - 3410), 1.9) * 1.8);
      const histOffset = Math.round(48 + Math.pow(Math.max(0, depth - 3390), 2.1) * 0.5);
      const isKick = gasOffset >= 500;

      return `
        <div class="tip-header">DEPTH: ${depth} m</div>
        <div class="tip-row"><span>NHRK-104 Live Gas:</span><strong style="color:#0284c7">${gasOffset} units</strong></div>
        <div class="tip-row"><span>NHRK-98 Historical:</span><strong style="color:#dc2626">${histOffset} units</strong></div>
        <div class="tip-row"><span>Delta to Historical:</span><strong>${gasOffset - histOffset >= 0 ? "+" : ""}${gasOffset - histOffset} u</strong></div>
        <div class="tip-row"><span>Kick Zone Alarm:</span><strong style="color:${isKick ? "#dc2626" : "#059669"}">${isKick ? "CRITICAL EXCEEDANCE" : "BASELINE STABLE"}</strong></div>
      `;
    });

    // 3. Multi-Hazard ML Risk Tooltip
    this.attachGraphHover("graphContainerRisk", "crosshairRisk", "tooltipRisk", (normX) => {
      const hoursAgo = Math.round(24 * (1 - normX));
      const timeLabel = hoursAgo === 0 ? "NOW (Live Telemetry)" : `T - ${hoursAgo} hrs`;
      const gasRisk = Math.min(84.6, (36 + Math.pow(normX, 1.8) * 48.6)).toFixed(1);
      const stuckRisk = Math.min(68.5, (28 + normX * 40.5)).toFixed(1);
      const circRisk = Math.min(62.0, (22 + normX * 40.0)).toFixed(1);
      const isCrit = parseFloat(gasRisk) >= 75.0;

      return `
        <div class="tip-header">${timeLabel}</div>
        <div class="tip-row"><span>Gas Kick Probability:</span><strong style="color:#dc2626">${gasRisk}%</strong></div>
        <div class="tip-row"><span>Stuck Pipe Risk:</span><strong style="color:#d97706">${stuckRisk}%</strong></div>
        <div class="tip-row"><span>Lost Circulation:</span><strong style="color:#9333ea">${circRisk}%</strong></div>
        <div class="tip-row"><span>Threshold (75%):</span><strong style="color:${isCrit ? "#dc2626" : "#059669"}">${isCrit ? "EXCEEDED" : "SAFE"}</strong></div>
      `;
    });

    // 4. Hydraulics APWD Tooltip
    this.attachGraphHover("graphContainerHydraulics", "crosshairHydraulics", "tooltipHydraulics", (normX) => {
      const flow = Math.round(500 + normX * 400);
      const ecd = (11.8 + Math.pow((flow - 500) / 400, 1.3) * 0.75).toFixed(2);
      const statMw = "12.10";
      const margin = (13.4 - parseFloat(ecd)).toFixed(2);

      return `
        <div class="tip-header">MUD FLOW: ${flow} LPM</div>
        <div class="tip-row"><span>Dynamic ECD:</span><strong style="color:#059669">${ecd} PPG</strong></div>
        <div class="tip-row"><span>Static Mud Weight:</span><strong style="color:#d97706">${statMw} PPG</strong></div>
        <div class="tip-row"><span>Annular Delta (&Delta;P):</span><strong>+${(parseFloat(ecd) - 12.10).toFixed(2)} PPG</strong></div>
        <div class="tip-row"><span>Fracture Margin:</span><strong style="color:#2563eb">+${margin} PPG</strong></div>
      `;
    });
  }

  attachGraphHover(containerId, crosshairId, tooltipId, formatter) {
    const container = document.getElementById(containerId);
    const crosshair = document.getElementById(crosshairId);
    const tooltip = document.getElementById(tooltipId);
    if (!container || !crosshair || !tooltip) return;

    container.addEventListener("mouseenter", () => {
      crosshair.classList.remove("hidden");
      tooltip.classList.remove("hidden");
    });

    container.addEventListener("mouseleave", () => {
      crosshair.classList.add("hidden");
      tooltip.classList.add("hidden");
    });

    container.addEventListener("mousemove", (e) => {
      const rect = container.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      const normX = Math.max(0, Math.min(1, clientX / rect.width));
      const normY = Math.max(0, Math.min(1, clientY / rect.height));

      crosshair.style.left = `${clientX}px`;
      
      // Position tooltip with edge collision avoidance
      let tipX = clientX;
      if (tipX < 110) tipX = 110;
      if (tipX > rect.width - 110) tipX = rect.width - 110;
      
      let tipY = clientY - 12;
      if (tipY < 90) tipY = clientY + 70; // flip downwards if too high

      tooltip.style.left = `${tipX}px`;
      tooltip.style.top = `${tipY}px`;
      tooltip.innerHTML = formatter(normX, normY);
    });
  }
}

// Instantiate engine
window.analyticsGraphsEngine = new AnalyticsGraphsEngine();
