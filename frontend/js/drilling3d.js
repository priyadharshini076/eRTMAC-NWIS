/**
 * drilling3d.js - Interactive 3D WebGL Drilling Simulation Model
 * Oil India Limited | NWIS (Nearby Well Intelligence System)
 * Three.js Real-Time 3D Rock Excavation Engine (Subsurface Strata, Thermal PDC Cutter & Directional Mud Motor)
 */

class Drilling3DModel {
  constructor(containerId) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    // View Groups
    this.subsurfaceGroup = null;
    this.thermalGroup = null;
    this.directionalGroup = null;

    // Dynamic Objects - Subsurface
    this.drillString = null;
    this.subsurfaceBit = null;
    this.topDrive = null;
    this.subsurfaceParticles = null;
    this.subsurfaceVelocities = [];

    // Dynamic Objects - Thermal PDC
    this.thermalBit = null;
    this.thermalBladesGroup = null;
    this.thermalSparks = null;
    this.thermalSparksVel = [];
    this.thermalJets = null;
    this.thermalJetsVel = [];
    this.thermalRockCuttings = null;
    this.thermalCuttingsVel = [];
    this.thermalShockwave = null;
    this.thermalHeatLight = null;

    // Dynamic Objects - Directional Mud Motor & Rock Strata
    this.directionalMotorGroup = null;
    this.directionalBitGroup = null;
    this.directionalMudVortex = null;
    this.directionalVortexVel = [];
    this.directionalRockCuttings = null;
    this.directionalCuttingsVel = [];
    this.directionalCrushDisc = null;
    this.directionalSparks = null;
    this.directionalSparksVel = [];
    this.directionalBentGroup = null;

    // State
    this.currentView = "subsurface";
    this.isDrilling = false;
    this.rpm = 110;
    this.currentDepth = 2501.3;
    this.bitY = -6.5;

    // Camera animation targets & presets
    this.viewPresets = {
      subsurface: {
        cameraPos: new THREE.Vector3(0, 0, 16),
        lookAt: new THREE.Vector3(0, -2, 0)
      },
      thermal: {
        cameraPos: new THREE.Vector3(0, -5.2, 4.4),
        lookAt: new THREE.Vector3(0, -6.6, 0)
      },
      directional: {
        cameraPos: new THREE.Vector3(3.2, -5.2, 5.0),
        lookAt: new THREE.Vector3(-0.6, -6.8, 0)
      }
    };

    this.targetCameraPos = new THREE.Vector3().copy(this.viewPresets.subsurface.cameraPos);
    this.targetLookAt = new THREE.Vector3().copy(this.viewPresets.subsurface.lookAt);
    this.currentLookAt = new THREE.Vector3().copy(this.viewPresets.subsurface.lookAt);

    // Orbit & Touch Controls
    this.isDragging = false;
    this.prevMousePos = { x: 0, y: 0 };
    this.spherical = { radius: 16, theta: 0, phi: Math.PI / 2 };

    this.init();
  }

  init() {
    if (!this.container) return;

    if (typeof THREE === "undefined") {
      console.warn("Three.js library is not loaded. 3D WebGL viewport will be unavailable.");
      return;
    }

    try {
      this.initScene();
      this.buildLighting();
      this.buildSubsurfaceScene();
      this.buildThermalPdcScene();
      this.buildDirectionalMotorScene();
      this.setupControls();
      this.setView("subsurface");
      this.animate();

      window.addEventListener("resize", () => this.onResize());
    } catch (e) {
      console.error("Three.js WebGL initialization error:", e);
    }
  }

  initScene() {
    const width = this.container.clientWidth || 600;
    const height = this.container.clientHeight || 520;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060b14);
    this.scene.fog = new THREE.FogExp2(0x060b14, 0.024);

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.copy(this.targetCameraPos);
    this.camera.lookAt(this.targetLookAt);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.innerHTML = "";
    this.container.appendChild(this.renderer.domElement);
  }

  buildLighting() {
    // 1. Ambient Light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambientLight);

    // 2. Primary Key Light (Derrick & Toolface Highlight)
    const dirLight = new THREE.DirectionalLight(0xffffff, 1.3);
    dirLight.position.set(6, 14, 10);
    this.scene.add(dirLight);

    // 3. Electric Blue Downhole Annular Rim Light
    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.7);
    fillLight.position.set(-6, -8, -4);
    this.scene.add(fillLight);

    // 4. Dynamic Thermal Incandescent Glow Light
    this.thermalHeatLight = new THREE.PointLight(0xff4400, 3.5, 12);
    this.thermalHeatLight.position.set(0, -6.8, 1.2);
    this.scene.add(this.thermalHeatLight);
  }

  // =========================================================================
  // VIEW 1: 3D SUBSURFACE STRATA OVERVIEW
  // =========================================================================
  buildSubsurfaceScene() {
    this.subsurfaceGroup = new THREE.Group();

    // 1. Surface Rig Derrick Tower & Pad
    const padGeo = new THREE.CylinderGeometry(7, 7, 0.35, 32);
    const padMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.y = 4.3;
    this.subsurfaceGroup.add(pad);

    // Steel Derrick Legs (Oil India Red)
    const rigGroup = new THREE.Group();
    const legMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.6, roughness: 0.3 });
    const legGeo = new THREE.CylinderGeometry(0.06, 0.08, 4.6, 8);
    const pos = [
      { x: -1.1, z: -1.1, tx: -0.35, tz: -0.35 },
      { x: 1.1, z: -1.1, tx: 0.35, tz: -0.35 },
      { x: 1.1, z: 1.1, tx: 0.35, tz: 0.35 },
      { x: -1.1, z: 1.1, tx: -0.35, tz: 0.35 }
    ];
    pos.forEach(p => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set((p.x + p.tx) / 2, 6.6, (p.z + p.tz) / 2);
      rigGroup.add(leg);
    });

    // Crown Block
    const crownGeo = new THREE.BoxGeometry(1.1, 0.35, 1.1);
    const crownMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8 });
    const crown = new THREE.Mesh(crownGeo, crownMat);
    crown.position.y = 8.9;
    rigGroup.add(crown);

    // Top Drive Motor
    const tdGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.75, 16);
    const tdMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.85 });
    this.topDrive = new THREE.Mesh(tdGeo, tdMat);
    this.topDrive.position.set(0, 6.4, 0);
    rigGroup.add(this.topDrive);

    this.subsurfaceGroup.add(rigGroup);

    // 2. Stratigraphic Rock Columns (Geological Formations)
    const formations = [
      { name: "Alluvium / Dhekiajuli", depth: "0 - 450 m", color: 0x334155, y: 3.3, h: 1.6 },
      { name: "Girujan Formation", depth: "450 - 1,480 m", color: 0x1e3a5f, y: 1.7, h: 1.6 },
      { name: "Tipam Sandstone", depth: "1,480 - 2,850 m", color: 0x854d0e, y: 0.1, h: 1.6 },
      { name: "Surma Formation", depth: "2,850 - 3,300 m", color: 0x065f46, y: -1.5, h: 1.6 },
      { name: "Barail Carbonaceous Sand", depth: "3,300 - 3,950 m", color: 0x7f1d1d, y: -3.5, h: 2.4 }
    ];

    formations.forEach(f => {
      const geo = new THREE.CylinderGeometry(4.0, 4.0, f.h, 28, 1, true, Math.PI * 0.25, Math.PI * 1.5);
      const mat = new THREE.MeshStandardMaterial({
        color: f.color,
        side: THREE.BackSide,
        roughness: 0.85,
        transparent: true,
        opacity: 0.88
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = f.y;
      this.subsurfaceGroup.add(mesh);
    });

    // 3. Borehole Casing & Annular Depth Rings
    const casingGeo = new THREE.CylinderGeometry(0.72, 0.72, 10.5, 32, 1, true);
    const casingMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide
    });
    const casing = new THREE.Mesh(casingGeo, casingMat);
    casing.position.y = -1.0;
    this.subsurfaceGroup.add(casing);

    for (let y = 3.2; y >= -6.6; y -= 1.3) {
      const ringGeo = new THREE.RingGeometry(0.70, 0.74, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.45 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      this.subsurfaceGroup.add(ring);
    }

    // 4. Drill String & Subsurface Bit
    this.drillString = new THREE.Group();
    const pipeGeo = new THREE.CylinderGeometry(0.12, 0.12, 12.5, 20);
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
    const pipe = new THREE.Mesh(pipeGeo, pipeMat);
    this.drillString.add(pipe);

    // Drill String Tool Joints
    for (let y = 5.2; y >= -5.2; y -= 2.2) {
      const joint = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.18, 0.32, 16),
        new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.85 })
      );
      joint.position.y = y;
      this.drillString.add(joint);
    }

    // Heavy Drill Collars
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 2.0, 20),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9 })
    );
    collar.position.y = -5.3;
    this.drillString.add(collar);

    // PDC Bit at bottom
    const bitBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.42, 0.65, 16),
      new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9, roughness: 0.2 })
    );
    bitBody.position.y = this.bitY;
    this.subsurfaceBit = bitBody;
    this.drillString.add(this.subsurfaceBit);

    this.subsurfaceGroup.add(this.drillString);

    // 5. Solid Formation Bedrock at Borehole Bottom
    const bedGeo = new THREE.CylinderGeometry(3.8, 3.8, 2.2, 32);
    const bedMat = new THREE.MeshStandardMaterial({ color: 0x713f12, roughness: 0.92 });
    const bed = new THREE.Mesh(bedGeo, bedMat);
    bed.position.y = -7.6;
    this.subsurfaceGroup.add(bed);

    // 6. Rock Cutting Particles
    const pCount = 180;
    const pGeo = new THREE.BufferGeometry();
    const posArr = new Float32Array(pCount * 3);
    this.subsurfaceVelocities = [];

    for (let i = 0; i < pCount; i++) {
      posArr[i * 3] = (Math.random() - 0.5) * 0.6;
      posArr[i * 3 + 1] = this.bitY + Math.random() * 0.3;
      posArr[i * 3 + 2] = (Math.random() - 0.5) * 0.6;

      this.subsurfaceVelocities.push({
        vx: (Math.random() - 0.5) * 0.03,
        vy: 0.03 + Math.random() * 0.06,
        vz: (Math.random() - 0.5) * 0.03
      });
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(posArr, 3));
    this.subsurfaceParticles = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({ color: 0xf59e0b, size: 0.075, transparent: true, opacity: 0.85 })
    );
    this.subsurfaceGroup.add(this.subsurfaceParticles);

    this.scene.add(this.subsurfaceGroup);
  }

  // =========================================================================
  // VIEW 2: 🔥 BIT HEAT & ROCK FRICTION (PDC 3D ROCK EXCAVATION & DIGGING)
  // =========================================================================
  buildThermalPdcScene() {
    this.thermalGroup = new THREE.Group();

    // 1. Solid Sandstone Bedrock Excavation Floor
    const rockFloorGeo = new THREE.CylinderGeometry(3.5, 3.5, 2.5, 32);
    const rockFloorMat = new THREE.MeshStandardMaterial({
      color: 0x78350f, // Deep sandstone rock
      roughness: 0.95,
      metalness: 0.08
    });
    const rockFloor = new THREE.Mesh(rockFloorGeo, rockFloorMat);
    rockFloor.position.y = -8.2;
    this.thermalGroup.add(rockFloor);

    // Concentric Circular Cutter Kerfs (Rock Tracks carved into stone floor)
    for (let r = 0.45; r <= 1.05; r += 0.28) {
      const kerfGeo = new THREE.RingGeometry(r - 0.05, r + 0.05, 32);
      const kerfMat = new THREE.MeshStandardMaterial({
        color: 0x451a03,
        roughness: 0.9,
        side: THREE.DoubleSide
      });
      const kerf = new THREE.Mesh(kerfGeo, kerfMat);
      kerf.rotation.x = Math.PI / 2;
      kerf.position.y = -6.94;
      this.thermalGroup.add(kerf);
    }

    // Excavation Crater Wellbore Wall
    const craterGeo = new THREE.CylinderGeometry(1.35, 1.15, 1.8, 32, 1, true);
    const craterMat = new THREE.MeshStandardMaterial({
      color: 0x92400e,
      side: THREE.BackSide,
      roughness: 0.92
    });
    const crater = new THREE.Mesh(craterGeo, craterMat);
    crater.position.y = -6.7;
    this.thermalGroup.add(crater);

    // Compressive Rock Shockwave Mesh Ring (Excavation Stress Wave)
    const shockGeo = new THREE.RingGeometry(0.7, 1.05, 32);
    const shockMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide, transparent: true, opacity: 0.65 });
    this.thermalShockwave = new THREE.Mesh(shockGeo, shockMat);
    this.thermalShockwave.rotation.x = Math.PI / 2;
    this.thermalShockwave.position.y = -6.98;
    this.thermalGroup.add(this.thermalShockwave);

    // 2. High-Detail 3D PDC Drill Bit Assembly
    this.thermalBit = new THREE.Group();
    this.thermalBit.position.y = -6.45;

    // Heavy Drill Collar Above Bit
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.48, 0.48, 2.5, 24),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.92, roughness: 0.25 })
    );
    collar.position.y = 1.6;
    this.thermalBit.add(collar);

    // Tapered Bit Shank (Gold-Bronze Hardfacing Alloy)
    const shankGeo = new THREE.CylinderGeometry(0.48, 0.85, 0.95, 24);
    const shankMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.95,
      roughness: 0.22
    });
    const shank = new THREE.Mesh(shankGeo, shankMat);
    shank.position.y = 0.15;
    this.thermalBit.add(shank);

    // Rotating Cutter Blades Group
    this.thermalBladesGroup = new THREE.Group();

    // 4 Spiral PDC Cutter Blades
    const bladeGeo = new THREE.BoxGeometry(0.95, 0.38, 0.22);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.95, roughness: 0.2 });
    const diamondMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfef08a,
      emissiveIntensity: 0.75,
      metalness: 1.0,
      roughness: 0.05
    });

    for (let b = 0; b < 4; b++) {
      const bladeWrapper = new THREE.Group();
      bladeWrapper.rotation.y = (Math.PI / 2) * b;

      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.position.set(0, -0.35, 0);
      bladeWrapper.add(blade);

      // 4 Diamond Cutter Studs per Blade
      for (let c = 0; c < 4; c++) {
        const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.15, 12), diamondMat);
        stud.rotation.x = Math.PI / 2;
        const dist = 0.22 + c * 0.18;
        stud.position.set(dist, -0.42, 0.06);
        bladeWrapper.add(stud);
      }
      this.thermalBladesGroup.add(bladeWrapper);
    }

    // 3 Mud Nozzles
    const nozzleMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    for (let n = 0; n < 3; n++) {
      const angle = (n * 2 * Math.PI) / 3;
      const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.22, 10), nozzleMat);
      noz.position.set(Math.cos(angle) * 0.32, -0.46, Math.sin(angle) * 0.32);
      this.thermalBladesGroup.add(noz);
    }

    // Incandescent Glowing Thermal Contact Disc
    const heatDiscGeo = new THREE.CylinderGeometry(0.82, 0.88, 0.06, 24);
    const heatDiscMat = new THREE.MeshStandardMaterial({
      color: 0xff3b00,
      emissive: 0xff3b00,
      emissiveIntensity: 2.2,
      transparent: true,
      opacity: 0.85
    });
    const heatDisc = new THREE.Mesh(heatDiscGeo, heatDiscMat);
    heatDisc.position.y = -0.52;
    this.thermalBladesGroup.add(heatDisc);

    this.thermalBit.add(this.thermalBladesGroup);
    this.thermalGroup.add(this.thermalBit);

    // 3. Dynamic 3D Friction Sparks System
    const sparkCount = 120;
    const sparkGeo = new THREE.BufferGeometry();
    const sparkPos = new Float32Array(sparkCount * 3);
    this.thermalSparksVel = [];

    for (let i = 0; i < sparkCount; i++) {
      sparkPos[i * 3] = (Math.random() - 0.5) * 0.8;
      sparkPos[i * 3 + 1] = -7.0;
      sparkPos[i * 3 + 2] = (Math.random() - 0.5) * 0.8;

      const angle = Math.random() * Math.PI * 2;
      const spd = 0.06 + Math.random() * 0.12;
      this.thermalSparksVel.push({
        vx: Math.cos(angle) * spd,
        vy: 0.04 + Math.random() * 0.09,
        vz: Math.sin(angle) * spd,
        life: Math.random() * 30 + 10,
        maxLife: 40
      });
    }
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
    this.thermalSparks = new THREE.Points(
      sparkGeo,
      new THREE.PointsMaterial({ color: 0xfff08a, size: 0.095, transparent: true, opacity: 0.95 })
    );
    this.thermalGroup.add(this.thermalSparks);

    // 4. Dynamic 3D Rock Cuttings System
    const cutCount = 150;
    const cutGeo = new THREE.BufferGeometry();
    const cutPos = new Float32Array(cutCount * 3);
    this.thermalCuttingsVel = [];

    for (let i = 0; i < cutCount; i++) {
      cutPos[i * 3] = (Math.random() - 0.5) * 1.0;
      cutPos[i * 3 + 1] = -7.0 + Math.random() * 0.4;
      cutPos[i * 3 + 2] = (Math.random() - 0.5) * 1.0;

      this.thermalCuttingsVel.push({
        vx: (Math.random() - 0.5) * 0.05,
        vy: 0.05 + Math.random() * 0.08, // ascending in annulus
        vz: (Math.random() - 0.5) * 0.05
      });
    }
    cutGeo.setAttribute("position", new THREE.BufferAttribute(cutPos, 3));
    this.thermalRockCuttings = new THREE.Points(
      cutGeo,
      new THREE.PointsMaterial({ color: 0xd6d3d1, size: 0.09, transparent: true, opacity: 0.85 })
    );
    this.thermalGroup.add(this.thermalRockCuttings);

    // 5. Dynamic 3D High-Pressure Mud Nozzle Jets
    const jetCount = 90;
    const jetGeo = new THREE.BufferGeometry();
    const jetPos = new Float32Array(jetCount * 3);
    this.thermalJetsVel = [];

    for (let i = 0; i < jetCount; i++) {
      jetPos[i * 3] = (Math.random() - 0.5) * 0.4;
      jetPos[i * 3 + 1] = -6.85;
      jetPos[i * 3 + 2] = (Math.random() - 0.5) * 0.4;

      this.thermalJetsVel.push({
        vx: (Math.random() - 0.5) * 0.06,
        vy: -0.08 - Math.random() * 0.08,
        vz: (Math.random() - 0.5) * 0.06
      });
    }
    jetGeo.setAttribute("position", new THREE.BufferAttribute(jetPos, 3));
    this.thermalJets = new THREE.Points(
      jetGeo,
      new THREE.PointsMaterial({ color: 0x38bdf8, size: 0.075, transparent: true, opacity: 0.8 })
    );
    this.thermalGroup.add(this.thermalJets);

    this.scene.add(this.thermalGroup);
  }

  // =========================================================================
  // VIEW 3: 🧭 DIRECTIONAL MUD MOTOR & ROCK STRATA EXCAVATION (3D DIGGING)
  // =========================================================================
  buildDirectionalMotorScene() {
    this.directionalGroup = new THREE.Group();

    const bentSubAngle = 0.4328; // 24.8 degrees in radians

    // 1. Geological Multi-Strata Rock Formations Cutaway
    const rockStrata = [
      { color: 0x334155, y: -2.8, h: 2.2, r: 3.8 }, // Siltstone/Shale Upper Cap
      { color: 0x854d0e, y: -5.0, h: 2.4, r: 3.8 }, // Tipam Sandstone Main Reservoir
      { color: 0x1e293b, y: -7.2, h: 2.4, r: 3.8 }, // Fractured Carbonaceous Zone
      { color: 0x0f172a, y: -9.0, h: 2.0, r: 3.8 }  // Basement Hard Rock
    ];

    rockStrata.forEach(layer => {
      // Cylinder with front cutaway arc to reveal interior borehole digging
      const geo = new THREE.CylinderGeometry(layer.r, layer.r, layer.h, 32, 1, false, Math.PI * 0.28, Math.PI * 1.45);
      const mat = new THREE.MeshStandardMaterial({
        color: layer.color,
        roughness: 0.92,
        metalness: 0.1,
        side: THREE.DoubleSide
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = layer.y;
      this.directionalGroup.add(mesh);
    });

    // 2. 3D Carved Borehole Tunnel Wall following the Well Trajectory
    // Upper vertical wellbore channel
    const vertTunnelGeo = new THREE.CylinderGeometry(0.72, 0.72, 3.6, 28, 1, true, Math.PI * 0.25, Math.PI * 1.5);
    const tunnelMat = new THREE.MeshStandardMaterial({
      color: 0x292524,
      roughness: 0.95,
      side: THREE.BackSide
    });
    const vertTunnel = new THREE.Mesh(vertTunnelGeo, tunnelMat);
    vertTunnel.position.set(0, -3.8, 0);
    this.directionalGroup.add(vertTunnel);

    // Inclined 24.8° Carved Borehole Tunnel Socket
    const incTunnelGeo = new THREE.CylinderGeometry(0.74, 0.74, 3.2, 28, 1, true, Math.PI * 0.25, Math.PI * 1.5);
    const incTunnel = new THREE.Mesh(incTunnelGeo, tunnelMat);
    incTunnel.position.set(-0.62, -7.0, 0);
    incTunnel.rotation.z = bentSubAngle;
    this.directionalGroup.add(incTunnel);

    // Ribbed Bit Gauge Reamer Grooves in Tunnel Wall (showing cut rock)
    for (let i = 0; i < 5; i++) {
      const ringGeo = new THREE.RingGeometry(0.68, 0.73, 28);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x57534e, side: THREE.DoubleSide, opacity: 0.5, transparent: true });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(-0.35 - i * 0.18, -6.2 - i * 0.38, 0);
      ring.rotation.z = bentSubAngle;
      ring.rotation.x = Math.PI / 2;
      this.directionalGroup.add(ring);
    }

    // 3. Inclined Rock Bedrock Cutting Face (Where the Bit penetrates the stone!)
    // The bit cuts at around X = -0.95, Y = -8.1 along the 24.8° axis
    const rockFaceGeo = new THREE.CylinderGeometry(0.74, 0.74, 0.5, 28);
    const rockFaceMat = new THREE.MeshStandardMaterial({
      color: 0xa16207, // Fractured Tipam sandstone
      roughness: 0.95,
      metalness: 0.15
    });
    const rockFace = new THREE.Mesh(rockFaceGeo, rockFaceMat);
    rockFace.position.set(-0.96, -8.1, 0);
    rockFace.rotation.z = bentSubAngle;
    this.directionalGroup.add(rockFace);

    // Compressive Rock Crush Disc (Glowing stress halo at contact point)
    const crushGeo = new THREE.RingGeometry(0.1, 0.65, 24);
    const crushMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });
    this.directionalCrushDisc = new THREE.Mesh(crushGeo, crushMat);
    this.directionalCrushDisc.position.set(-0.96, -8.08, 0);
    this.directionalCrushDisc.rotation.z = bentSubAngle;
    this.directionalCrushDisc.rotation.x = Math.PI / 2;
    this.directionalGroup.add(this.directionalCrushDisc);

    // Radiating Rock Fractures / Fissures ahead of bit
    const fracLineMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.65 });
    const fractureCoords = [
      [-0.96, -8.1, 0, -1.6, -9.0, 0.4],
      [-0.96, -8.1, 0, -1.2, -9.4, -0.5],
      [-0.96, -8.1, 0, -2.1, -8.7, -0.2],
      [-0.96, -8.1, 0, -0.8, -9.5, 0.6]
    ];
    fractureCoords.forEach(coords => {
      const fGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(coords[0], coords[1], coords[2]),
        new THREE.Vector3(coords[3], coords[4], coords[5])
      ]);
      const fLine = new THREE.Line(fGeo, fracLineMat);
      this.directionalGroup.add(fLine);
    });

    // 4. Steerable Bottom Hole Assembly (BHA)
    this.directionalMotorGroup = new THREE.Group();
    this.directionalMotorGroup.position.set(0, -3.5, 0);

    // Upper Drill Collar
    const upCollar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.42, 2.2, 24),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.25 })
    );
    upCollar.position.y = 1.1;
    this.directionalMotorGroup.add(upCollar);

    // Positive Displacement Mud Motor (PDM) Power Section (Electric Blue Engineering Steel)
    const motorGeo = new THREE.CylinderGeometry(0.46, 0.46, 2.8, 24);
    const motorMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      metalness: 0.88,
      roughness: 0.28
    });
    const motor = new THREE.Mesh(motorGeo, motorMat);
    motor.position.y = -1.4;
    this.directionalMotorGroup.add(motor);

    // Stabilizer Ribs on Motor Housing
    for (let r = 0; r < 3; r++) {
      const rib = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 1.2, 0.14),
        new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.85 })
      );
      const angle = (r * 2 * Math.PI) / 3;
      rib.position.set(Math.cos(angle) * 0.48, -1.4, Math.sin(angle) * 0.48);
      rib.rotation.y = angle;
      this.directionalMotorGroup.add(rib);
    }

    // 5. Bent Sub Housing - ANGLED AT 24.8° INCLINATION!
    this.directionalBentGroup = new THREE.Group();
    this.directionalBentGroup.position.set(0, -2.8, 0);
    this.directionalBentGroup.rotation.z = bentSubAngle;

    // Angled Bent Sub Cylinder
    const bentGeo = new THREE.CylinderGeometry(0.44, 0.46, 1.1, 24);
    const bentMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9 });
    const bentSubMesh = new THREE.Mesh(bentGeo, bentMat);
    bentSubMesh.position.y = -0.55;
    this.directionalBentGroup.add(bentSubMesh);

    // Directional Drill Bit Assembly
    this.directionalBitGroup = new THREE.Group();
    this.directionalBitGroup.position.y = -1.1;

    // Bit Shank
    const dirBitShank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.44, 0.72, 0.8, 20),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.95, roughness: 0.2 })
    );
    dirBitShank.position.y = -0.4;
    this.directionalBitGroup.add(dirBitShank);

    // PDC Cutter Blades on Directional Bit (Shearing into rock)
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.92, roughness: 0.2 });
    const cutterToothMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfef08a,
      emissiveIntensity: 0.65,
      metalness: 1.0
    });

    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.32, 0.18), bladeMat);
      blade.rotation.y = (Math.PI / 3) * b;
      blade.position.y = -0.7;

      // Cutter teeth on blade
      for (let t = 0; t < 3; t++) {
        const tooth = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 8), cutterToothMat);
        tooth.position.set((t - 1) * 0.26, -0.18, 0.06);
        blade.add(tooth);
      }

      this.directionalBitGroup.add(blade);
    }

    this.directionalBentGroup.add(this.directionalBitGroup);
    this.directionalMotorGroup.add(this.directionalBentGroup);
    this.directionalGroup.add(this.directionalMotorGroup);

    // 6. Directional Trajectory Target Vector (Dashed Guide Line)
    const vecMat = new THREE.LineDashedMaterial({ color: 0x10b981, dashSize: 0.4, gapSize: 0.2, linewidth: 2 });
    const vecGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -2.8, 0),
      new THREE.Vector3(-Math.sin(bentSubAngle) * 4.6, -2.8 - Math.cos(bentSubAngle) * 4.6, 0)
    ]);
    const trajectoryLine = new THREE.Line(vecGeo, vecMat);
    trajectoryLine.computeLineDistances();
    this.directionalGroup.add(trajectoryLine);

    // 7. Dynamic 3D Rock Breakaway Chips (Bursts of crushed sandstone from cutting face)
    const frCount = 140;
    const frGeo = new THREE.BufferGeometry();
    const frPos = new Float32Array(frCount * 3);
    this.directionalCuttingsVel = [];

    for (let i = 0; i < frCount; i++) {
      frPos[i * 3] = -0.96 + (Math.random() - 0.5) * 0.5;
      frPos[i * 3 + 1] = -8.0 + Math.random() * 0.4;
      frPos[i * 3 + 2] = (Math.random() - 0.5) * 0.5;

      this.directionalCuttingsVel.push({
        vx: 0.03 + Math.random() * 0.05, // Ascend backwards along tunnel
        vy: 0.06 + Math.random() * 0.08,
        vz: (Math.random() - 0.5) * 0.04
      });
    }
    frGeo.setAttribute("position", new THREE.BufferAttribute(frPos, 3));
    this.directionalRockCuttings = new THREE.Points(
      frGeo,
      new THREE.PointsMaterial({ color: 0xf59e0b, size: 0.09, transparent: true, opacity: 0.9 })
    );
    this.directionalGroup.add(this.directionalRockCuttings);

    // 8. Friction Sparks at the Rock Contact Point
    const dSparkCount = 90;
    const dSparkGeo = new THREE.BufferGeometry();
    const dSparkPos = new Float32Array(dSparkCount * 3);
    this.directionalSparksVel = [];

    for (let i = 0; i < dSparkCount; i++) {
      dSparkPos[i * 3] = -0.96 + (Math.random() - 0.5) * 0.3;
      dSparkPos[i * 3 + 1] = -8.05;
      dSparkPos[i * 3 + 2] = (Math.random() - 0.5) * 0.3;

      const spd = 0.05 + Math.random() * 0.10;
      this.directionalSparksVel.push({
        vx: (Math.random() - 0.3) * spd,
        vy: Math.random() * spd + 0.04,
        vz: (Math.random() - 0.5) * spd,
        life: Math.random() * 25 + 8,
        maxLife: 35
      });
    }
    dSparkGeo.setAttribute("position", new THREE.BufferAttribute(dSparkPos, 3));
    this.directionalSparks = new THREE.Points(
      dSparkGeo,
      new THREE.PointsMaterial({ color: 0xfde047, size: 0.085, transparent: true, opacity: 0.95 })
    );
    this.directionalGroup.add(this.directionalSparks);

    // 9. Swirling Mud Turbine Vortex Stream
    const vCount = 130;
    const vGeo = new THREE.BufferGeometry();
    const vPos = new Float32Array(vCount * 3);
    this.directionalVortexVel = [];

    for (let i = 0; i < vCount; i++) {
      vPos[i * 3] = (Math.random() - 0.5) * 0.9;
      vPos[i * 3 + 1] = -2.5 - Math.random() * 3.5;
      vPos[i * 3 + 2] = (Math.random() - 0.5) * 0.9;

      this.directionalVortexVel.push({
        angle: Math.random() * Math.PI * 2,
        r: 0.55 + Math.random() * 0.35,
        vy: -0.06 - Math.random() * 0.06
      });
    }
    vGeo.setAttribute("position", new THREE.BufferAttribute(vPos, 3));
    this.directionalMudVortex = new THREE.Points(
      vGeo,
      new THREE.PointsMaterial({ color: 0x06b6d4, size: 0.08, transparent: true, opacity: 0.8 })
    );
    this.directionalGroup.add(this.directionalMudVortex);

    this.scene.add(this.directionalGroup);
  }

  // =========================================================================
  // VIEW SWITCHING & CAMERA PRESETS
  // =========================================================================
  setView(viewKey) {
    this.currentView = viewKey;

    if (viewKey === "thermal") {
      if (this.subsurfaceGroup) this.subsurfaceGroup.visible = false;
      if (this.thermalGroup) this.thermalGroup.visible = true;
      if (this.directionalGroup) this.directionalGroup.visible = false;

      this.targetCameraPos.copy(this.viewPresets.thermal.cameraPos);
      this.targetLookAt.copy(this.viewPresets.thermal.lookAt);

      if (this.thermalHeatLight) {
        this.thermalHeatLight.color.setHex(0xff3b00);
        this.thermalHeatLight.intensity = this.isDrilling ? 4.8 : 2.5;
        this.thermalHeatLight.position.set(0, -6.8, 1.2);
      }
    } else if (viewKey === "directional") {
      if (this.subsurfaceGroup) this.subsurfaceGroup.visible = false;
      if (this.thermalGroup) this.thermalGroup.visible = false;
      if (this.directionalGroup) this.directionalGroup.visible = true;

      this.targetCameraPos.copy(this.viewPresets.directional.cameraPos);
      this.targetLookAt.copy(this.viewPresets.directional.lookAt);

      if (this.thermalHeatLight) {
        this.thermalHeatLight.color.setHex(0x38bdf8);
        this.thermalHeatLight.intensity = this.isDrilling ? 3.5 : 1.8;
        this.thermalHeatLight.position.set(-0.96, -8.1, 1.2);
      }
    } else {
      if (this.subsurfaceGroup) this.subsurfaceGroup.visible = true;
      if (this.thermalGroup) this.thermalGroup.visible = false;
      if (this.directionalGroup) this.directionalGroup.visible = false;

      this.targetCameraPos.copy(this.viewPresets.subsurface.cameraPos);
      this.targetLookAt.copy(this.viewPresets.subsurface.lookAt);

      if (this.thermalHeatLight) {
        this.thermalHeatLight.color.setHex(0x38bdf8);
        this.thermalHeatLight.intensity = 1.5;
        this.thermalHeatLight.position.set(0, -6.8, 1.2);
      }
    }
  }

  setDrilling(isDrilling, rpm = 110) {
    this.isDrilling = isDrilling;
    this.rpm = rpm;

    if (this.thermalHeatLight) {
      if (this.currentView === "thermal") {
        this.thermalHeatLight.intensity = isDrilling ? 5.2 : 2.4;
      } else if (this.currentView === "directional") {
        this.thermalHeatLight.intensity = isDrilling ? 3.8 : 1.8;
      }
    }
  }

  setupControls() {
    this.container.addEventListener("mousedown", (e) => {
      this.isDragging = true;
      this.prevMousePos = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener("mouseup", () => {
      this.isDragging = false;
    });

    window.addEventListener("mousemove", (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.prevMousePos.x;
      const dy = e.clientY - this.prevMousePos.y;

      if (this.currentView === "thermal") {
        this.targetCameraPos.x += dx * 0.015;
        this.targetCameraPos.y = Math.max(-6.8, Math.min(-3.5, this.targetCameraPos.y - dy * 0.015));
      } else if (this.currentView === "directional") {
        this.targetCameraPos.x += dx * 0.015;
        this.targetCameraPos.y = Math.max(-7.0, Math.min(-3.0, this.targetCameraPos.y - dy * 0.015));
      } else {
        this.targetCameraPos.x += dx * 0.03;
        this.targetCameraPos.y = Math.max(-6, Math.min(8, this.targetCameraPos.y - dy * 0.03));
      }

      this.prevMousePos = { x: e.clientX, y: e.clientY };
    });

    // Touch support for mobile / tablets
    this.container.addEventListener("touchstart", (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.prevMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    }, { passive: true });

    window.addEventListener("touchend", () => {
      this.isDragging = false;
    });

    window.addEventListener("touchmove", (e) => {
      if (!this.isDragging || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - this.prevMousePos.x;
      const dy = e.touches[0].clientY - this.prevMousePos.y;

      this.targetCameraPos.x += dx * 0.015;
      this.targetCameraPos.y -= dy * 0.015;
      this.prevMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: true });

    this.container.addEventListener("wheel", (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY * 0.012;
      const dist = this.targetCameraPos.distanceTo(this.targetLookAt);
      if ((zoomFactor > 0 && dist < 28) || (zoomFactor < 0 && dist > 2.2)) {
        this.targetCameraPos.addScaledVector(
          this.targetCameraPos.clone().sub(this.targetLookAt).normalize(),
          zoomFactor
        );
      }
    }, { passive: false });
  }

  resetView() {
    const preset = this.viewPresets[this.currentView] || this.viewPresets.subsurface;
    this.targetCameraPos.copy(preset.cameraPos);
    this.targetLookAt.copy(preset.lookAt);
  }

  zoom(factor) {
    const offset = this.targetCameraPos.clone().sub(this.targetLookAt);
    offset.multiplyScalar(factor);
    this.targetCameraPos.copy(this.targetLookAt).add(offset);
  }

  // =========================================================================
  // ANIMATION LOOP - REAL-TIME 3D DIGGING SIMULATION
  // =========================================================================
  animate() {
    requestAnimationFrame(() => this.animate());
    const now = Date.now();

    // 1. Smooth Camera Glide (Lerp)
    this.camera.position.lerp(this.targetCameraPos, 0.08);
    this.currentLookAt.lerp(this.targetLookAt, 0.08);
    this.camera.lookAt(this.currentLookAt);

    // 2. Mechanical Rotation Speed (higher during active drilling)
    const rotSpeed = this.isDrilling ? (this.rpm / 60) * 0.14 : 0.022;

    // -------------------------------------------------------------
    // SUBSURFACE 3D OVERVIEW ANIMATION
    // -------------------------------------------------------------
    if (this.subsurfaceGroup && this.subsurfaceGroup.visible) {
      if (this.drillString) {
        this.drillString.rotation.y += rotSpeed;
      }
      if (this.topDrive) {
        this.topDrive.rotation.y += rotSpeed * 0.8;
      }
      if (this.subsurfaceParticles) {
        const pos = this.subsurfaceParticles.geometry.attributes.position.array;
        const vels = this.subsurfaceVelocities;
        for (let i = 0; i < vels.length; i++) {
          pos[i * 3] += vels[i].vx;
          pos[i * 3 + 1] += vels[i].vy * (this.isDrilling ? 1.5 : 0.7);
          pos[i * 3 + 2] += vels[i].vz;

          if (pos[i * 3 + 1] > this.bitY + 2.8) {
            pos[i * 3] = (Math.random() - 0.5) * 0.5;
            pos[i * 3 + 1] = this.bitY + Math.random() * 0.2;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
          }
        }
        this.subsurfaceParticles.geometry.attributes.position.needsUpdate = true;
      }
    }

    // -------------------------------------------------------------
    // 🔥 BIT HEAT & FRICTION (PDC CUTTER) 3D DIGGING ANIMATION
    // -------------------------------------------------------------
    if (this.thermalGroup && this.thermalGroup.visible) {
      if (this.thermalBladesGroup) {
        this.thermalBladesGroup.rotation.y += rotSpeed * 1.5;
      }

      // Axial Digging Feed Stroke into Rock Formation Bedrock
      if (this.thermalBit) {
        const feedOffset = Math.sin(now * (this.isDrilling ? 0.035 : 0.012)) * (this.isDrilling ? 0.065 : 0.02);
        this.thermalBit.position.y = -6.45 - feedOffset;
      }

      // Shockwave Ring Expanding Pulse (Compressive rock crush wave)
      if (this.thermalShockwave) {
        const pulse = (now * (this.isDrilling ? 0.004 : 0.002)) % 1;
        this.thermalShockwave.scale.set(1 + pulse * 0.85, 1 + pulse * 0.85, 1);
        this.thermalShockwave.material.opacity = (1 - pulse) * (this.isDrilling ? 0.85 : 0.45);
      }

      // Dynamic 3D Friction Sparks
      if (this.thermalSparks) {
        const sPos = this.thermalSparks.geometry.attributes.position.array;
        for (let i = 0; i < this.thermalSparksVel.length; i++) {
          const sv = this.thermalSparksVel[i];
          sPos[i * 3] += sv.vx;
          sPos[i * 3 + 1] += sv.vy;
          sPos[i * 3 + 2] += sv.vz;
          sv.vy -= 0.0035;

          sv.life--;
          if (sv.life <= 0) {
            sPos[i * 3] = (Math.random() - 0.5) * 0.7;
            sPos[i * 3 + 1] = -7.0;
            sPos[i * 3 + 2] = (Math.random() - 0.5) * 0.7;
            const a = Math.random() * Math.PI * 2;
            const sp = 0.05 + Math.random() * 0.12;
            sv.vx = Math.cos(a) * sp;
            sv.vy = 0.04 + Math.random() * 0.08;
            sv.vz = Math.sin(a) * sp;
            sv.life = sv.maxLife;
          }
        }
        this.thermalSparks.geometry.attributes.position.needsUpdate = true;
      }

      // Rock Cuttings Chipping Off Floor
      if (this.thermalRockCuttings) {
        const cPos = this.thermalRockCuttings.geometry.attributes.position.array;
        for (let i = 0; i < this.thermalCuttingsVel.length; i++) {
          const cv = this.thermalCuttingsVel[i];
          cPos[i * 3] += cv.vx;
          cPos[i * 3 + 1] += cv.vy * (this.isDrilling ? 1.6 : 0.8);
          cPos[i * 3 + 2] += cv.vz;

          if (cPos[i * 3 + 1] > -4.5) {
            cPos[i * 3] = (Math.random() - 0.5) * 0.9;
            cPos[i * 3 + 1] = -7.0;
            cPos[i * 3 + 2] = (Math.random() - 0.5) * 0.9;
          }
        }
        this.thermalRockCuttings.geometry.attributes.position.needsUpdate = true;
      }

      // Mud Nozzle Jets Blasting Downward
      if (this.thermalJets) {
        const jPos = this.thermalJets.geometry.attributes.position.array;
        for (let i = 0; i < this.thermalJetsVel.length; i++) {
          const jv = this.thermalJetsVel[i];
          jPos[i * 3] += jv.vx;
          jPos[i * 3 + 1] += jv.vy * (this.isDrilling ? 1.6 : 0.8);
          jPos[i * 3 + 2] += jv.vz;

          if (jPos[i * 3 + 1] < -7.1) {
            jPos[i * 3] = (Math.random() - 0.5) * 0.35;
            jPos[i * 3 + 1] = -6.85;
            jPos[i * 3 + 2] = (Math.random() - 0.5) * 0.35;
          }
        }
        this.thermalJets.geometry.attributes.position.needsUpdate = true;
      }
    }

    // -------------------------------------------------------------
    // 🧭 DIRECTIONAL MUD MOTOR & ROCK EXCAVATION 3D ANIMATION
    // -------------------------------------------------------------
    if (this.directionalGroup && this.directionalGroup.visible) {
      // 1. Bit Rotary Digging
      if (this.directionalBitGroup) {
        this.directionalBitGroup.rotation.y += rotSpeed * 1.8;
      }

      // 2. Axial Percussive Feed Stroke into 24.8° Rock Socket
      if (this.directionalBentGroup) {
        const feed = Math.sin(now * (this.isDrilling ? 0.04 : 0.015)) * (this.isDrilling ? 0.05 : 0.015);
        this.directionalBentGroup.position.y = -2.8 - feed * Math.cos(0.4328);
        this.directionalBentGroup.position.x = -feed * Math.sin(0.4328);
      }

      // 3. Compressive Rock Crush Pulse
      if (this.directionalCrushDisc) {
        const cPulse = (now * (this.isDrilling ? 0.005 : 0.002)) % 1;
        this.directionalCrushDisc.scale.set(1 + cPulse * 0.5, 1 + cPulse * 0.5, 1);
        this.directionalCrushDisc.material.opacity = (1 - cPulse) * (this.isDrilling ? 0.9 : 0.4);
      }

      // 4. Dynamic Rock Breakaway Chips Erupting from Rock Contact
      if (this.directionalRockCuttings) {
        const frPos = this.directionalRockCuttings.geometry.attributes.position.array;
        for (let i = 0; i < this.directionalCuttingsVel.length; i++) {
          const frv = this.directionalCuttingsVel[i];
          frPos[i * 3] += frv.vx * (this.isDrilling ? 1.6 : 0.8);
          frPos[i * 3 + 1] += frv.vy * (this.isDrilling ? 1.6 : 0.8);
          frPos[i * 3 + 2] += frv.vz;

          // Recycle when ascending above bent sub
          if (frPos[i * 3 + 1] > -3.2) {
            frPos[i * 3] = -0.96 + (Math.random() - 0.5) * 0.4;
            frPos[i * 3 + 1] = -8.0 + Math.random() * 0.3;
            frPos[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
          }
        }
        this.directionalRockCuttings.geometry.attributes.position.needsUpdate = true;
      }

      // 5. Dynamic 3D Friction Sparks at Rock Contact
      if (this.directionalSparks) {
        const dsPos = this.directionalSparks.geometry.attributes.position.array;
        for (let i = 0; i < this.directionalSparksVel.length; i++) {
          const dsv = this.directionalSparksVel[i];
          dsPos[i * 3] += dsv.vx;
          dsPos[i * 3 + 1] += dsv.vy;
          dsPos[i * 3 + 2] += dsv.vz;
          dsv.vy -= 0.0035;

          dsv.life--;
          if (dsv.life <= 0) {
            dsPos[i * 3] = -0.96 + (Math.random() - 0.5) * 0.25;
            dsPos[i * 3 + 1] = -8.05;
            dsPos[i * 3 + 2] = (Math.random() - 0.5) * 0.25;
            const spd = 0.05 + Math.random() * 0.10;
            dsv.vx = (Math.random() - 0.3) * spd;
            dsv.vy = Math.random() * spd + 0.04;
            dsv.vz = (Math.random() - 0.5) * spd;
            dsv.life = dsv.maxLife;
          }
        }
        this.directionalSparks.geometry.attributes.position.needsUpdate = true;
      }

      // 6. Swirling Hydraulic Mud Turbine Vortex
      if (this.directionalMudVortex) {
        const vPos = this.directionalMudVortex.geometry.attributes.position.array;
        for (let i = 0; i < this.directionalVortexVel.length; i++) {
          const vv = this.directionalVortexVel[i];
          vv.angle += (this.isDrilling ? 0.09 : 0.045);
          vPos[i * 3] = Math.cos(vv.angle) * vv.r;
          vPos[i * 3 + 1] += vv.vy * (this.isDrilling ? 1.5 : 0.8);
          vPos[i * 3 + 2] = Math.sin(vv.angle) * vv.r;

          if (vPos[i * 3 + 1] < -6.0) {
            vPos[i * 3 + 1] = -2.2;
          }
        }
        this.directionalMudVortex.geometry.attributes.position.needsUpdate = true;
      }
    }

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
}

// Global instance variable
window.drilling3dInstance = null;
