/**
 * NWIS - Nearby Well Intelligence System
 * Drill Engineer Real-Time Operations Controller
 * Matches Reference 3D Subsurface Cutaway & 9 Real-Time Telemetry Metrics
 * Oil India Limited | Ministry of Petroleum & Natural Gas
 */

class DrillingOperationsEngine {
  constructor() {
    this.isDrilling = false;
    this.currentDepth = 2501.3;
    this.depthIncrement = 0.8; // +0.8 m per 5s (as in reference image)
    this.expectedTd = 3842.0;

    // Baseline Telemetry from reference screenshot
    this.telemetry = {
      rop: 12.6,
      ropDelta: "+2.4%",
      wob: 27.2,
      wobDelta: "+1.1%",
      torque: 263.6,
      torqueDelta: "+3.2%",
      rpm: 108.2,
      rpmDelta: "0.0%",
      pumpPressure: 3841,
      pumpDelta: "+0.8%",
      mudWeight: 11.16,
      mudDelta: "0.0%",
      flowRate: 754.2,
      flowDelta: "+1.5%",
      spp: 3840,
      sppDelta: "+0.8%",
      formation: "Tipam (Current)",
      estTimeToTd: 106
    };

    this.ws = null;
    this.wsConnected = false;
    this.countdownTimer = null;
    this.particleCanvas = null;
    this.particleCtx = null;
    this.particles = [];
    this.currentView = "subsurface";

    // Dynamic Risk Assessment Linkage & Interlock Threshold
    this.currentRiskScore = 71.5;
    this.riskThreshold = 80.0;

    this.init();
  }

  init() {
    this.bindDOM();
    this.initDrillSimulationFx();
    this.initWebSocket();
    this.renderMetrics();
    this.renderDrillingFx();
  }

  bindDOM() {
    this.btnStartDrilling = document.getElementById("btnStartDrilling");
    this.btnStopDrilling = document.getElementById("btnStopDrilling");
    this.opStatusText = document.getElementById("opStatusText");

    // View Switcher System (Subsurface 3D, Bit Heat/Thermal, Directional Motor, Rig Floor CAD, Wellbore Casing)
    const cutawayImg = document.getElementById("subsurfaceCutawayImg");
    const btnFullScreen = document.getElementById("btnFullScreen");
    const viewPills = document.querySelectorAll("#drillViewPillsGroup .view-pill");

    const hudTitle = document.getElementById("hudViewTitle");
    const hudSub = document.getElementById("hudViewSub");
    const hudBadge1 = document.getElementById("hudBadge1");
    const hudBadge2 = document.getElementById("hudBadge2");
    const hudDot = document.getElementById("hudViewDot");

    const depthAxis = document.querySelector(".depth-scale-axis");
    const strataLabels = document.querySelector(".strata-layer-labels");

    const overlayThermal = document.getElementById("viewOverlayThermal");
    const overlayDirectional = document.getElementById("viewOverlayDirectional");

    const hideAllOverlays = () => {
      [overlayThermal, overlayDirectional].forEach(el => {
        if (el) el.classList.add("hidden");
      });
    };

    const viewsConfig = {
      subsurface: {
        image: "assets/drilling_subsurface.jpg",
        title: "3D SUBSURFACE STRATA OVERVIEW",
        sub: "Well OIL-AS-NHRK-104 • Tipam Formation @ 2,501.3 m",
        badge1: { text: "Real-time Telemetry", class: "blue" },
        badge2: { text: "Bit Active", class: "green" },
        showDepth: true,
        showStrata: true,
        overlay: null,
        transform: "scale(1.0) translateY(0)",
        toast: "3D Subsurface View: Full geological column and drill string trajectory."
      },
      thermal: {
        image: "assets/view_bit_thermal.jpg",
        title: "🔥 BIT HEAT & ROCK FRICTION (THERMAL CUTTER VIEW)",
        sub: "Continuous Drilling • PDC Tri-Cone Shearing • Friction Heat Dissipation",
        badge1: { text: "Temp 184.2 °C", class: "red" },
        badge2: { text: "Critical Friction", class: "amber" },
        showDepth: true,
        showStrata: false,
        overlay: overlayThermal,
        transform: "scale(1.02) translateY(0)",
        toast: "🔥 Bit Heat & Friction View: Monitoring active cutter heat generation and cooling jet."
      },
      directional: {
        image: "assets/view_directional_motor.png",
        title: "🧭 DIRECTIONAL MUD MOTOR & FRACTURE INTRUSION",
        sub: "Positive Displacement Motor (PDM) • Bent Sub 1.5° • Fractured Reservoir Zone",
        badge1: { text: "Inclination 24.8°", class: "amber" },
        badge2: { text: "Steerable Active", class: "green" },
        showDepth: true,
        showStrata: false,
        overlay: overlayDirectional,
        transform: "scale(1.02) translateY(0)",
        toast: "🧭 Directional Mud Motor View: Steerable assembly penetrating rock fractures into reservoir."
      }
    };

    const switchDrillView = (viewKey) => {
      const cfg = viewsConfig[viewKey] || viewsConfig.subsurface;
      this.currentView = viewKey;

      // 1. Update pills
      viewPills.forEach(pill => {
        if (pill.getAttribute("data-view") === viewKey) {
          pill.classList.add("active");
        } else {
          pill.classList.remove("active");
        }
      });

      // 2. Cross-fade image
      if (cutawayImg) {
        cutawayImg.style.opacity = "0.2";
        setTimeout(() => {
          cutawayImg.src = cfg.image;
          cutawayImg.style.transform = cfg.transform;
          cutawayImg.style.opacity = "0.95";
        }, 150);
      }

      // 3. Update HUD banner
      if (hudTitle) hudTitle.textContent = cfg.title;
      if (hudSub) hudSub.textContent = cfg.sub;
      if (hudBadge1) {
        hudBadge1.textContent = cfg.badge1.text;
        hudBadge1.className = `hud-badge ${cfg.badge1.class}`;
      }
      if (hudBadge2) {
        if (this.isDrilling) {
          hudBadge2.textContent = `DRILLING ACTIVE • ${Math.round(this.telemetry.rpm)} RPM`;
          hudBadge2.className = "hud-badge green";
        } else {
          hudBadge2.textContent = cfg.badge2.text;
          hudBadge2.className = `hud-badge ${cfg.badge2.class}`;
        }
      }

      // Update scene classes if drilling is active
      const sceneWrapper = document.getElementById("scene3dWrapper");
      if (sceneWrapper) {
        sceneWrapper.className = this.isDrilling
          ? `subsurface-viewport is-drilling-active view-${viewKey}`
          : `subsurface-viewport view-${viewKey}`;
      }

      // 4. Update axis / strata visibility
      if (depthAxis) depthAxis.style.display = cfg.showDepth ? "flex" : "none";
      if (strataLabels) strataLabels.style.display = cfg.showStrata ? "flex" : "none";

      // 5. Update Technical Overlays
      hideAllOverlays();
      if (cfg.overlay) {
        cfg.overlay.classList.remove("hidden");
      }

      showGlobalToast(cfg.toast);
    };

    this.switchDrillView = switchDrillView;

    // Attach pill click listeners
    viewPills.forEach(pill => {
      pill.addEventListener("click", () => {
        const vKey = pill.getAttribute("data-view");
        switchDrillView(vKey);
      });
    });

    // Floating Tools: Cycle Views & Zoom
    let currentZoom = 1.0;
    const vpTools = document.querySelectorAll(".vp-tool-btn");
    if (vpTools.length >= 4) {
      // Tool 0: Rotate/Cycle views
      const viewKeys = ["subsurface", "thermal", "directional"];
      vpTools[0].addEventListener("click", () => {
        const idx = viewKeys.indexOf(this.currentView || "subsurface");
        const nextKey = viewKeys[(idx + 1) % viewKeys.length];
        switchDrillView(nextKey);
      });

      // Tool 1: Reset View & Center
      vpTools[1].addEventListener("click", () => {
        currentZoom = 1.0;
        if (cutawayImg) cutawayImg.style.transform = "scale(1.0) translateY(0)";
        showGlobalToast("Viewport camera recentered.");
      });

      // Tool 2: Zoom In / Out Toggle
      vpTools[2].addEventListener("click", () => {
        currentZoom = currentZoom === 1.0 ? 1.25 : 1.0;
        if (cutawayImg) cutawayImg.style.transform = `scale(${currentZoom})`;
        showGlobalToast(`Camera Zoom: ${currentZoom === 1.0 ? "Normal (100%)" : "Magnified (125%)"}`);
      });
    }

    if (btnFullScreen) {
      btnFullScreen.addEventListener("click", () => {
        const card = document.querySelector(".card-3d-operation");
        if (card) {
          if (!document.fullscreenElement) {
            card.requestFullscreen().catch(() => {});
          } else {
            document.exitFullscreen();
          }
        }
      });
    }

    // Trend Filter Pills
    document.querySelectorAll(".trend-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        document.querySelectorAll(".trend-pill").forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        showGlobalToast(`Real-Time Trend switched to: ${pill.textContent}`);
      });
    });

    // View Lithology Link
    const btnLith = document.getElementById("btnViewLithology");
    if (btnLith) {
      btnLith.addEventListener("click", () => {
        showGlobalToast("Lithology Sheet: Tipam Sandstone with interbedded clay/shale.");
      });
    }

    // Footer View Alerts & Risk Analysis Button
    const btnFooterAlerts = document.getElementById("btnFooterViewAlerts");
    if (btnFooterAlerts) {
      btnFooterAlerts.addEventListener("click", () => {
        if (window.switchAppTab) {
          window.switchAppTab("alerts");
        } else {
          const navAlerts = document.getElementById("navAlerts");
          if (navAlerts) navAlerts.click();
        }
      });
    }

    // Start / Stop Drilling Buttons
    if (this.btnStartDrilling) {
      this.btnStartDrilling.addEventListener("click", () => this.startDrilling());
    }

    if (this.btnStopDrilling) {
      this.btnStopDrilling.addEventListener("click", () => this.stopDrilling());
    }
  }

  initDrillSimulationFx() {
    this.particleCanvas = document.getElementById("drillSimulationFxCanvas");
    if (!this.particleCanvas) return;
    this.particleCtx = this.particleCanvas.getContext("2d");

    const resize = () => {
      if (this.particleCanvas && this.particleCanvas.parentElement) {
        this.particleCanvas.width = this.particleCanvas.parentElement.clientWidth;
        this.particleCanvas.height = this.particleCanvas.parentElement.clientHeight;
      }
    };
    resize();
    window.addEventListener("resize", resize);

    // 1. Friction Sparks (for Thermal View)
    this.sparkParticles = [];
    for (let i = 0; i < 70; i++) {
      this.sparkParticles.push(this.createSpark());
    }

    // 2. High-Pressure Nozzle Jets (for Thermal View)
    this.jetParticles = [];
    for (let i = 0; i < 60; i++) {
      this.jetParticles.push(this.createJetDrop());
    }

    // 3. Directional Mud Motor Fluid & Rock Cuttings (for Directional View)
    this.mudStreamParticles = [];
    for (let i = 0; i < 65; i++) {
      this.mudStreamParticles.push(this.createMudParticle());
    }
    this.rockCuttingParticles = [];
    for (let i = 0; i < 45; i++) {
      this.rockCuttingParticles.push(this.createRockCutting());
    }

    // 4. Subsurface Circulation Loop (for Subsurface View)
    this.subsurfaceLoopParticles = [];
    for (let i = 0; i < 50; i++) {
      this.subsurfaceLoopParticles.push(this.createSubsurfaceParticle());
    }
  }

  createSpark(cx, cy) {
    const w = this.particleCanvas ? this.particleCanvas.width : 600;
    const h = this.particleCanvas ? this.particleCanvas.height : 500;
    const x = cx || (w * 0.50);
    const y = cy || (h * 0.69);
    const angle = (Math.random() * Math.PI) + Math.PI * 0.05;
    const speed = Math.random() * 5.5 + 2.5;
    const colors = ["#ffffff", "#fef08a", "#f59e0b", "#ef4444", "#f97316"];
    return {
      x: x + (Math.random() - 0.5) * 40,
      y: y + (Math.random() - 0.5) * 14,
      vx: Math.cos(angle) * speed * (Math.random() > 0.5 ? 1 : -1),
      vy: Math.sin(angle) * speed - 1.8,
      size: Math.random() * 2.8 + 1.2,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: Math.floor(Math.random() * 24) + 8,
      maxLife: 32
    };
  }

  createJetDrop(cx, cy) {
    const w = this.particleCanvas ? this.particleCanvas.width : 600;
    const h = this.particleCanvas ? this.particleCanvas.height : 500;
    const x = cx || (w * 0.50);
    const y = cy || (h * 0.67);
    const isLeft = Math.random() > 0.5;
    return {
      x: isLeft ? x - 18 : x + 18,
      y: y,
      vx: (isLeft ? -1 : 1) * (Math.random() * 4.5 + 2.0) + (Math.random() - 0.5) * 1.5,
      vy: Math.random() * 5.5 + 3.0,
      size: Math.random() * 3.5 + 1.5,
      alpha: Math.random() * 0.8 + 0.25,
      life: Math.floor(Math.random() * 20) + 8,
      maxLife: 28
    };
  }

  createMudParticle() {
    const w = this.particleCanvas ? this.particleCanvas.width : 600;
    const h = this.particleCanvas ? this.particleCanvas.height : 500;
    return {
      x: w * 0.38 + (Math.random() - 0.5) * 90,
      y: h * 0.45 + (Math.random() - 0.5) * 130,
      vx: (Math.random() - 0.35) * 3.5 + 1.2,
      vy: Math.random() * 3.2 + 1.8,
      size: Math.random() * 4.2 + 2.0,
      alpha: Math.random() * 0.75 + 0.25,
      life: Math.floor(Math.random() * 35) + 15,
      maxLife: 50
    };
  }

  createRockCutting() {
    const w = this.particleCanvas ? this.particleCanvas.width : 600;
    const h = this.particleCanvas ? this.particleCanvas.height : 500;
    return {
      x: w * 0.38 + (Math.random() - 0.5) * 32,
      y: h * 0.64 + (Math.random() - 0.5) * 28,
      vx: (Math.random() - 0.5) * 2.2 - 1.2,
      vy: -Math.random() * 3.2 - 1.2, // ascends with mud flow returns
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 3.6 + 2.2,
      life: Math.floor(Math.random() * 45) + 15,
      maxLife: 60
    };
  }

  createSubsurfaceParticle() {
    const w = this.particleCanvas ? this.particleCanvas.width : 600;
    const h = this.particleCanvas ? this.particleCanvas.height : 500;
    const isDown = Math.random() > 0.5;
    return {
      x: isDown ? w * 0.50 + (Math.random() - 0.5) * 8 : (w * 0.50 + (Math.random() > 0.5 ? 20 : -20) + (Math.random() - 0.5) * 8),
      y: Math.random() * h * 0.85,
      vy: isDown ? Math.random() * 4 + 3 : -(Math.random() * 3 + 2),
      size: Math.random() * 2.6 + 1.2,
      color: isDown ? "rgba(56, 189, 248, 0.85)" : "rgba(52, 211, 153, 0.75)",
      life: Math.floor(Math.random() * 60) + 20
    };
  }

  renderDrillingFx() {
    requestAnimationFrame(() => this.renderDrillingFx());
    if (!this.particleCtx || !this.particleCanvas) return;

    const ctx = this.particleCtx;
    const w = this.particleCanvas.width;
    const h = this.particleCanvas.height;

    ctx.clearRect(0, 0, w, h);

    if (!this.isDrilling) return;

    const vKey = this.currentView || "subsurface";

    if (vKey === "thermal") {
      // =========================================================================
      // VIEW 2: 🔥 BIT HEAT & ROCK FRICTION (THERMAL CUTTER ROTATION & SPARKS)
      // =========================================================================
      const cx = w * 0.50;
      const cy = h * 0.69;

      // 1. Pulsing Thermal Incandescent Heat Aura
      const pulseR = 52 + Math.sin(Date.now() * 0.015) * 10;
      const grad = ctx.createRadialGradient(cx, cy, 4, cx, cy, pulseR);
      grad.addColorStop(0, "rgba(255, 68, 0, 0.65)");
      grad.addColorStop(0.35, "rgba(245, 158, 11, 0.42)");
      grad.addColorStop(0.75, "rgba(239, 68, 68, 0.20)");
      grad.addColorStop(1, "rgba(239, 68, 68, 0)");

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
      ctx.fill();

      // 2. High-Pressure Cooling Mud Jets from Nozzles
      this.jetParticles.forEach((jp, idx) => {
        jp.x += jp.vx;
        jp.y += jp.vy;
        jp.life--;
        if (jp.life <= 0) {
          this.jetParticles[idx] = this.createJetDrop(cx, cy - 6);
        } else {
          ctx.fillStyle = `rgba(56, 189, 248, ${jp.alpha * 0.8})`;
          ctx.beginPath();
          ctx.arc(jp.x, jp.y, jp.size, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = `rgba(255, 255, 255, ${jp.alpha * 0.4})`;
          ctx.beginPath();
          ctx.arc(jp.x, jp.y, jp.size * 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // 3. High-Velocity Rock Friction Sparks
      this.sparkParticles.forEach((sp, idx) => {
        sp.x += sp.vx;
        sp.y += sp.vy;
        sp.vy += 0.18; // gravity
        sp.life--;
        if (sp.life <= 0) {
          this.sparkParticles[idx] = this.createSpark(cx, cy);
        } else {
          const ratio = sp.life / sp.maxLife;
          ctx.fillStyle = sp.color;
          ctx.shadowColor = sp.color;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, sp.size * ratio, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      // 4. Shimmering Convective Heat Waves
      ctx.strokeStyle = "rgba(255, 180, 50, 0.22)";
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 5; i++) {
        const offset = Math.sin(Date.now() * 0.009 + i * 1.4) * 7;
        ctx.beginPath();
        ctx.moveTo(cx - 36 + i * 18, cy - 10);
        ctx.bezierCurveTo(cx - 36 + i * 18 + offset, cy - 40, cx - 36 + i * 18 - offset, cy - 70, cx - 36 + i * 18, cy - 100);
        ctx.stroke();
      }

    } else if (vKey === "directional") {
      // =========================================================================
      // VIEW 3: 🧭 DIRECTIONAL MUD MOTOR & FRACTURE INTRUSION
      // =========================================================================
      const cx = w * 0.40;
      const cy = h * 0.65;

      // 1. Swirling Hydraulic Mud Turbine Streams
      this.mudStreamParticles.forEach((mp, idx) => {
        mp.x += mp.vx;
        mp.y += mp.vy;
        mp.life--;
        if (mp.life <= 0 || mp.y > h) {
          this.mudStreamParticles[idx] = this.createMudParticle();
        } else {
          ctx.fillStyle = `rgba(14, 165, 233, ${mp.alpha * 0.85})`;
          ctx.beginPath();
          ctx.arc(mp.x, mp.y, mp.size, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // 2. Rock Fracture Cuttings Flaking into Mud Stream
      this.rockCuttingParticles.forEach((rc, idx) => {
        rc.x += rc.vx;
        rc.y += rc.vy;
        rc.rot += rc.rotSpeed;
        rc.life--;
        if (rc.life <= 0 || rc.y < 0) {
          this.rockCuttingParticles[idx] = this.createRockCutting();
        } else {
          ctx.save();
          ctx.translate(rc.x, rc.y);
          ctx.rotate(rc.rot);
          ctx.fillStyle = "#a8a29e";
          ctx.strokeStyle = "#44403c";
          ctx.lineWidth = 1;
          ctx.fillRect(-rc.size / 2, -rc.size / 2, rc.size, rc.size * 1.3);
          ctx.strokeRect(-rc.size / 2, -rc.size / 2, rc.size, rc.size * 1.3);
          ctx.restore();
        }
      });

      // 3. Directional Motor Thrust Pulse Halo
      const thrustR = 26 + Math.sin(Date.now() * 0.012) * 6;
      const tGrad = ctx.createRadialGradient(cx, cy, 3, cx, cy, thrustR);
      tGrad.addColorStop(0, "rgba(56, 189, 248, 0.7)");
      tGrad.addColorStop(1, "rgba(56, 189, 248, 0)");
      ctx.fillStyle = tGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, thrustR, 0, Math.PI * 2);
      ctx.fill();

    } else {
      // =========================================================================
      // VIEW 1: 3D SUBSURFACE STRATA OVERVIEW (MUD CIRCULATION & LASER BIT MARKER)
      // =========================================================================
      this.subsurfaceLoopParticles.forEach((sp, idx) => {
        sp.y += sp.vy;
        if (sp.y < 0 || sp.y > h * 0.85) {
          this.subsurfaceLoopParticles[idx] = this.createSubsurfaceParticle();
        } else {
          ctx.fillStyle = sp.color;
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Live Laser Depth Line and Bit Crown Glow at Bottom of String
      const bitDepthY = h * 0.78;
      ctx.strokeStyle = "rgba(56, 189, 248, 0.45)";
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(w * 0.12, bitDepthY);
      ctx.lineTo(w * 0.88, bitDepthY);
      ctx.stroke();
      ctx.setLineDash([]);

      const bitGlow = ctx.createRadialGradient(w * 0.50, bitDepthY, 2, w * 0.50, bitDepthY, 22);
      bitGlow.addColorStop(0, "rgba(245, 158, 11, 0.85)");
      bitGlow.addColorStop(1, "rgba(245, 158, 11, 0)");
      ctx.fillStyle = bitGlow;
      ctx.beginPath();
      ctx.arc(w * 0.50, bitDepthY, 22, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  initWebSocket() {
    const wsUrl = `ws://${window.location.hostname || "localhost"}:8000/api/v1/ws/drilling`;
    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.wsConnected = true;
      };

      this.ws.onmessage = (event) => {
        try {
          const packet = JSON.parse(event.data);
          if (packet.type === "telemetry_pulse" && this.isDrilling) {
            this.handleTelemetryPacket(packet);
          }
        } catch (e) {}
      };

      this.ws.onclose = () => {
        this.wsConnected = false;
      };
      this.ws.onerror = () => {
        this.wsConnected = false;
      };
    } catch (err) {
      this.wsConnected = false;
    }
  }

  startDrilling() {
    const currentRole = (window.getCurrentRole ? window.getCurrentRole() : "drilling_engineer");

    // 1. SUPERVISOR IS MONITORING ONLY (CANNOT START SIMULATION)
    if (currentRole === "drilling_supervisor") {
      showGlobalToast("👁️ SUPERVISOR MONITORING MODE: You have real-time read-only access to downhole telemetry. Rotary simulation is operated by the Drilling Engineer.");
      return;
    }

    // 2. ENFORCE SUPERVISOR APPROVAL CLEARANCE GATE (DRILLING LOCKED UNTIL APPROVED)
    if (!window.isSupervisorApproved) {
      if (this.btnStartDrilling) {
        this.btnStartDrilling.classList.add("btn-shake");
        setTimeout(() => this.btnStartDrilling.classList.remove("btn-shake"), 500);
      }
      if (window.hasTriggeredThresholdExceeded) {
        const riskVal = window.thresholdExceededRisk ? window.thresholdExceededRisk.toFixed(1) + "%" : "81.8%";
        showGlobalToast(`⛔ ROTARY DRILLING LOCKED: Critical risk (${riskVal} > 80.0%) exceeded safety threshold! Supervisor approval & remediation required on Alerts page.`);
      } else {
        showGlobalToast("⛔ ROTARY DRILLING LOCKED: Drilling operations should be approved by Supervisor on the Alerts page before you can start.");
      }
      return;
    }

    if (this.isDrilling) return;
    this.isDrilling = true;

    if (this.btnStartDrilling) this.btnStartDrilling.disabled = true;
    if (this.btnStopDrilling) this.btnStopDrilling.disabled = false;
    if (this.opStatusText) {
      this.opStatusText.textContent = "Rotary Drilling Active (Dynamic 3D Simulation)";
      this.opStatusText.style.color = "#34d399";
    }

    // Activate 3D Viewport Dynamic Simulation Effects
    const sceneWrapper = document.getElementById("scene3dWrapper");
    if (sceneWrapper) {
      sceneWrapper.className = `subsurface-viewport is-drilling-active view-${this.currentView || "subsurface"}`;
    }
    const liveTag = document.getElementById("drillLiveIndicatorTag");
    if (liveTag) liveTag.style.display = "flex";

    const hudBadge2 = document.getElementById("hudBadge2");
    if (hudBadge2) {
      hudBadge2.textContent = "DRILLING ACTIVE • 108 RPM";
      hudBadge2.className = "hud-badge green";
    }

    if (this.ws && this.wsConnected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: "start", depth: this.currentDepth, increment: this.depthIncrement }));
    }

    // Continuous Real-Time Physics & Telemetry Jitter Loop (100ms)
    clearInterval(this.realtimeTicker);
    this.realtimeTicker = setInterval(() => {
      if (!this.isDrilling) {
        clearInterval(this.realtimeTicker);
        return;
      }
      this.tickRealtimePhysics();
    }, 100);

    // 5-second interval simulation step for macro formation advancement & risk
    clearInterval(this.countdownTimer);
    this.countdownTimer = setInterval(() => {
      if (!this.isDrilling) {
        clearInterval(this.countdownTimer);
        return;
      }
      this.triggerDepthAdvance();
    }, 5000);

    showGlobalToast("Rotary Drilling active: Active downhole rotation, cutter friction sparks & telemetry streaming.");
  }

  stopDrilling() {
    const currentRole = (window.getCurrentRole ? window.getCurrentRole() : "drilling_engineer");

    // SUPERVISOR IS MONITORING ONLY (CANNOT STOP SIMULATION)
    if (currentRole === "drilling_supervisor") {
      showGlobalToast("👁️ SUPERVISOR MONITORING MODE: Read-only access. Simulation cannot be stopped by Supervisor.");
      return;
    }

    if (!this.isDrilling) return;
    this.isDrilling = false;

    if (this.btnStartDrilling) this.btnStartDrilling.disabled = false;
    if (this.btnStopDrilling) this.btnStopDrilling.disabled = true;
    if (this.opStatusText) {
      this.opStatusText.textContent = "Standby (Circulating Off-Bottom)";
      this.opStatusText.style.color = "#f59e0b";
    }

    // Deactivate 3D Viewport Dynamic Simulation Effects
    const sceneWrapper = document.getElementById("scene3dWrapper");
    if (sceneWrapper) {
      sceneWrapper.className = `subsurface-viewport view-${this.currentView || "subsurface"}`;
    }
    const liveTag = document.getElementById("drillLiveIndicatorTag");
    if (liveTag) liveTag.style.display = "none";

    const hudBadge2 = document.getElementById("hudBadge2");
    if (hudBadge2) {
      hudBadge2.textContent = "BIT STANDBY • OFF-BOTTOM";
      hudBadge2.className = "hud-badge amber";
    }

    clearInterval(this.realtimeTicker);
    clearInterval(this.countdownTimer);

    if (this.ws && this.wsConnected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: "stop" }));
    }

    this.renderMetrics();
    showGlobalToast("Drilling paused. Downhole bit rotation halted.");
  }

  tickRealtimePhysics() {
    if (!this.isDrilling) return;

    // Smooth continuous depth advancement: ~0.02 m per second
    this.currentDepth = +(this.currentDepth + 0.002).toFixed(2);

    const now = Date.now();
    const ropJitter = Math.sin(now * 0.003) * 0.7 + (Math.random() - 0.5) * 0.25;
    const wobJitter = Math.cos(now * 0.002) * 0.5 + (Math.random() - 0.5) * 0.2;
    const tqJitter = Math.sin(now * 0.004) * 2.4 + (Math.random() - 0.5) * 0.8;
    const rpmJitter = (Math.random() - 0.5) * 0.8;

    const currentRop = (12.6 + ropJitter).toFixed(1);
    const currentWob = (27.2 + wobJitter).toFixed(1);
    const currentTq = (263.6 + tqJitter).toFixed(1);
    const currentRpm = (108.2 + rpmJitter).toFixed(1);

    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setVal("stripCurrentDepthNum", `${this.currentDepth.toFixed(1)} m`);
    setVal("tileDepthVal", `${this.currentDepth.toFixed(1)} m`);
    setVal("tileRopVal", `${currentRop} m/hr`);
    setVal("tileWobVal", `${currentWob} ton`);
    setVal("tileTorqueVal", `${currentTq} kNm`);
    setVal("tileRpmVal", `${currentRpm} rpm`);
    setVal("dockRotationVal", `${Math.round(108.2 + rpmJitter)} rpm`);

    const depthPointer = document.getElementById("depthPointerPill");
    const rulerDepthVal = document.getElementById("rulerDepthVal");
    if (rulerDepthVal) rulerDepthVal.textContent = `${this.currentDepth.toFixed(1)} m`;
    if (depthPointer) {
      const rulerPct = Math.min(92, Math.max(5, 5 + (this.currentDepth / 3842.0) * 87));
      depthPointer.style.top = `${rulerPct}%`;
      depthPointer.textContent = `${this.currentDepth.toFixed(1)} m`;
    }

    const calloutDepth = document.getElementById("calloutDepthVal");
    if (calloutDepth) calloutDepth.textContent = `${this.currentDepth.toFixed(1)} m`;

    const hudSub = document.getElementById("hudViewSub");
    if (hudSub && (!this.currentView || this.currentView === "subsurface")) {
      hudSub.textContent = `Well OIL-AS-NHRK-104 • Tipam Formation @ ${this.currentDepth.toFixed(1)} m`;
    }

    // Thermal view live heat flicker
    const bitTemp = document.getElementById("thermalBitTemp");
    if (bitTemp) {
      const tempVal = (182.4 + Math.sin(now * 0.004) * 3.6 + Math.random() * 0.8).toFixed(1);
      bitTemp.textContent = `${tempVal} °C`;
    }

    // Live indicator tag
    const liveIndicatorText = document.getElementById("drillLiveIndicatorText");
    if (liveIndicatorText) {
      liveIndicatorText.textContent = `ROTARY DRILLING ACTIVE • ${currentRpm} RPM • ${currentRop} m/hr`;
    }

    // Badge 2 update
    const hudBadge2 = document.getElementById("hudBadge2");
    if (hudBadge2) {
      hudBadge2.textContent = `DRILLING ACTIVE • ${Math.round(108.2 + rpmJitter)} RPM`;
      hudBadge2.className = "hud-badge green";
    }
  }

  triggerDepthAdvance() {
    this.currentDepth = +(this.currentDepth + this.depthIncrement).toFixed(1);

    // Dynamic risk increases as drill bit penetrates deeper into overpressured Tipam formation
    const riskIncrement = +(2.4 + (Math.random() * 0.6 - 0.3)).toFixed(1);
    this.currentRiskScore = +(this.currentRiskScore + riskIncrement).toFixed(1);

    // Realistic micro variations matching screenshot values
    this.telemetry.rop = +(12.6 + (Math.random() * 0.8 - 0.4)).toFixed(1);
    this.telemetry.wob = +(27.2 + (Math.random() * 0.6 - 0.3)).toFixed(1);
    this.telemetry.torque = +(263.6 + (Math.random() * 2.4 - 1.2)).toFixed(1);
    this.telemetry.rpm = +(108.2 + (Math.random() * 1.0 - 0.5)).toFixed(1);
    this.telemetry.pumpPressure = Math.round(3841 + (Math.random() * 10 - 5));
    this.telemetry.flowRate = +(754.2 + (Math.random() * 4.0 - 2.0)).toFixed(1);
    this.telemetry.spp = Math.round(3840 + (Math.random() * 8 - 4));

    // Synchronize with Risk Assessment model if available
    if (typeof WELLS_DATA !== "undefined" && WELLS_DATA[0] && WELLS_DATA[0].simulation) {
      WELLS_DATA[0].simulation.fusedScore = this.currentRiskScore;
      const kickHazard = WELLS_DATA[0].simulation.hazardProbabilities.find(h => h.name.includes("Kick") || h.name.includes("Stuck"));
      if (kickHazard) {
        kickHazard.probability = Math.min(99, Math.round(this.currentRiskScore + 4));
        kickHazard.status = this.currentRiskScore >= 80 ? "Critical" : (this.currentRiskScore >= 70 ? "High" : "Moderate");
      }
      if (window.renderSimulationResults && window.currentWell) {
        window.renderSimulationResults(window.currentWell, false);
      }
    }

    this.renderMetrics();

    // =========================================================================
    // SAFETY INTERLOCK: IF RISK CROSSES 80.0%, AUTOMATICALLY HALT & ESCALATE
    // =========================================================================
    if (this.currentRiskScore >= this.riskThreshold) {
      this.triggerThresholdExceededAutoStop();
      return;
    }
  }

  triggerThresholdExceededAutoStop() {
    this.isDrilling = false;
    clearInterval(this.countdownTimer);
    clearInterval(this.realtimeTicker);

    // Deactivate 3D Viewport Dynamic Simulation Effects
    const sceneWrapper = document.getElementById("scene3dWrapper");
    if (sceneWrapper) {
      sceneWrapper.className = `subsurface-viewport view-${this.currentView || "subsurface"}`;
    }
    const liveTag = document.getElementById("drillLiveIndicatorTag");
    if (liveTag) liveTag.style.display = "none";

    const hudBadge2 = document.getElementById("hudBadge2");
    if (hudBadge2) {
      hudBadge2.textContent = "SAFETY INTERLOCK LOCKED (>80%)";
      hudBadge2.className = "hud-badge red";
    }

    if (this.btnStartDrilling) {
      this.btnStartDrilling.disabled = false;
      this.btnStartDrilling.classList.add("btn-drilling-locked");
    }
    if (this.btnStopDrilling) this.btnStopDrilling.disabled = true;

    if (this.opStatusText) {
      this.opStatusText.textContent = `EMERGENCY SAFETY HOLD (Risk ${this.currentRiskScore.toFixed(1)}% > 80%)`;
      this.opStatusText.style.color = "#ef4444";
    }

    // Flag emergency hold requiring supervisor action
    window.isSupervisorApproved = false;
    window.hasTriggeredThresholdExceeded = true;
    window.thresholdExceededRisk = this.currentRiskScore;
    window.thresholdDepth = `${this.currentDepth.toFixed(1)} m`;

    if (window.updateSupervisorClearanceUI) {
      window.updateSupervisorClearanceUI();
    }

    if (this.ws && this.wsConnected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: "emergency_stop", reason: "risk_threshold_exceeded", risk: this.currentRiskScore }));
    }

    this.renderMetrics();

    showGlobalToast(`🚨 CRITICAL RISK THRESHOLD EXCEEDED (${this.currentRiskScore.toFixed(1)}% > 80.0%): Drilling auto-stopped by Safety Interlock! Escalated to Supervisor for approval.`);
  }

  handleTelemetryPacket(packet) {
    if (packet.current_depth_m) this.currentDepth = packet.current_depth_m;
    if (packet.rop_m_hr) this.telemetry.rop = packet.rop_m_hr;
    if (packet.wob_klbs) this.telemetry.wob = packet.wob_klbs;
    if (packet.rpm) this.telemetry.rpm = packet.rpm;
    if (packet.torque_kft_lb) this.telemetry.torque = packet.torque_kft_lb;
    if (packet.spp_psi) this.telemetry.spp = packet.spp_psi;
    if (packet.flow_rate_lpm) this.telemetry.flowRate = packet.flow_rate_lpm;

    this.renderMetrics();
  }

  renderMetrics() {
    const formattedDepth = `${this.currentDepth.toFixed(1)} m`;

    // 1. Depth Ruler Pointer Position on Left
    const depthPointer = document.getElementById("depthPointerPill");
    const rulerDepthVal = document.getElementById("rulerDepthVal");
    if (rulerDepthVal) rulerDepthVal.textContent = formattedDepth;
    if (depthPointer) {
      // Calculate normalized vertical position along ruler between 0m (top 5%) and 3842m (bottom 92%)
      const rulerPct = Math.min(92, Math.max(5, 5 + (this.currentDepth / 3842.0) * 87));
      depthPointer.style.top = `${rulerPct}%`;
    }

    // 2. Callout Card on Bit
    const calloutDepth = document.getElementById("calloutDepthVal");
    if (calloutDepth) calloutDepth.textContent = formattedDepth;

    // 3. Update Metric Tiles
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setVal("stripCurrentDepthNum", formattedDepth);
    setVal("tileDepthVal", formattedDepth);
    setVal("tileDepthDelta", `+0.8 m / 5s`);
    setVal("tileRopVal", `${this.telemetry.rop.toFixed(1)} m/hr`);
    setVal("tileWobVal", `${this.telemetry.wob.toFixed(1)} ton`);
    setVal("tileTorqueVal", `${this.telemetry.torque.toFixed(1)} kNm`);
    setVal("tileRpmVal", `${this.telemetry.rpm.toFixed(1)} rpm`);
    setVal("tilePumpVal", `${this.telemetry.pumpPressure.toLocaleString()} psi`);
    setVal("tileMudVal", `${this.telemetry.mudWeight.toFixed(2)} ppg`);
    setVal("tileFlowVal", `${this.telemetry.flowRate.toFixed(1)} LPM`);

    // Top Strip Progress Bar & Pct
    const depthPct = ((this.currentDepth / this.expectedTd) * 100).toFixed(1);
    const stripBar = document.getElementById("stripDepthMiniFill");
    if (stripBar) stripBar.style.width = `${depthPct}%`;
    setVal("stripDepthPctText", `(${depthPct}% of TD)`);

    // Dock Telemetry Chips
    setVal("dockRotationVal", `${Math.round(this.telemetry.rpm)} rpm`);
    setVal("dockAdvanceVal", `+0.8 m / 5s`);
    setVal("dockModeVal", "Auto");

    // Formation Progress Bar for Tipam (Current: 2,450 to 2,680m)
    const tipamPct = Math.min(100, Math.max(0, Math.round(((this.currentDepth - 2450) / (2680 - 2450)) * 100)));
    const formFill = document.getElementById("formCurrentProgressFill");
    if (formFill) formFill.style.width = `${tipamPct}%`;
    setVal("formCurrentProgressPct", `${tipamPct}%`);

    // Dynamic View HUD & Bit Temp Update
    const bitTemp = document.getElementById("thermalBitTemp");
    if (bitTemp) {
      const tempVal = (182 + (this.isDrilling ? (Math.random() * 6) : 0)).toFixed(1);
      bitTemp.textContent = `${tempVal} °C`;
    }
    const hudSub = document.getElementById("hudViewSub");
    if (hudSub && (!this.currentView || this.currentView === "subsurface")) {
      hudSub.textContent = `Well OIL-AS-NHRK-104 • Tipam Formation @ ${formattedDepth}`;
    }

    // Update Real-Time Risk Assessment Interlock Strip
    const liveRiskScoreEl = document.getElementById("liveDrillRiskScore");
    const riskMeterFill = document.getElementById("riskMeterFill");
    const riskInterlockStrip = document.getElementById("drillRiskInterlockStrip");
    const riskBadge = document.getElementById("riskInterlockStatusBadge");
    const riskStatusText = document.getElementById("riskInterlockStatusText");

    if (liveRiskScoreEl) liveRiskScoreEl.textContent = `${this.currentRiskScore.toFixed(1)}%`;
    if (riskMeterFill) {
      const fillPct = Math.min(100, Math.max(0, this.currentRiskScore));
      riskMeterFill.style.width = `${fillPct}%`;
    }

    if (this.currentRiskScore >= this.riskThreshold) {
      if (liveRiskScoreEl) liveRiskScoreEl.className = "risk-score-num text-red";
      if (riskInterlockStrip) riskInterlockStrip.className = "drill-risk-interlock-strip critical";
      if (riskBadge) riskBadge.className = "risk-interlock-status-badge badge-critical";
      if (riskStatusText) riskStatusText.textContent = "🚨 EMERGENCY SHUTDOWN (>80%)";
    } else if (this.currentRiskScore >= 75.0) {
      if (liveRiskScoreEl) liveRiskScoreEl.className = "risk-score-num text-amber";
      if (riskInterlockStrip) riskInterlockStrip.className = "drill-risk-interlock-strip warning";
      if (riskBadge) riskBadge.className = "risk-interlock-status-badge badge-warning";
      if (riskStatusText) riskStatusText.textContent = "⚠ WARNING (NEAR 80%)";
    } else {
      if (liveRiskScoreEl) liveRiskScoreEl.className = "risk-score-num text-emerald";
      if (riskInterlockStrip) riskInterlockStrip.className = "drill-risk-interlock-strip";
      if (riskBadge) riskBadge.className = "risk-interlock-status-badge badge-normal";
      if (riskStatusText) riskStatusText.textContent = "SAFE / PERMIT ACTIVE";
    }

    // 4. Update Time stamp
    const timeEl = document.getElementById("metricsTimeStamp");
    if (timeEl) {
      const now = new Date();
      timeEl.textContent = `Last updated: ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")} IST`;
    }

    // 5. Update Sidebar Bottom Rig Card TD
    const sidebarTd = document.getElementById("liveSidebarTd");
    if (sidebarTd) sidebarTd.textContent = formattedDepth;
  }
}

function showGlobalToast(msg) {
  const toast = document.getElementById("toastNotice");
  const toastMsg = document.getElementById("toastMessage");
  if (toast && toastMsg) {
    toastMsg.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3500);
  }
}

window.initDrillingEngine = function() {
  if (!window.drillingOpsEngineInstance) {
    window.drillingOpsEngineInstance = new DrillingOperationsEngine();
  }
};
