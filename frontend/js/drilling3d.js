/**
 * NWIS - Nearby Well Intelligence System
 * Interactive 3D Wellbore & Drilling Simulation Model
 * Oil India Limited | Ministry of Petroleum & Natural Gas
 */

class Drilling3DModel {
  constructor(canvasContainerId) {
    this.container = document.getElementById(canvasContainerId);
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.drillString = null;
    this.drillBit = null;
    this.topDrive = null;
    this.particles = null;
    this.derrick = null;
    this.rockLayers = [];
    this.isDrilling = false;
    this.rpm = 110;
    this.currentDepth = 3842.0;
    this.bitY = -6.5; // normalized 3D position
    this.animId = null;

    this.init();
  }

  init() {
    if (!this.container) return;

    // Check if Three.js is available
    if (typeof THREE === "undefined") {
      this.initCanvasFallback();
      return;
    }

    try {
      this.initThreeScene();
    } catch (e) {
      console.warn("WebGL initialization failed, falling back to 2D Canvas:", e);
      this.initCanvasFallback();
    }
  }

  initThreeScene() {
    const width = this.container.clientWidth || 600;
    const height = this.container.clientHeight || 480;

    // 1. Scene & Camera
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0c121c);
    this.scene.fog = new THREE.FogExp2(0x0c121c, 0.035);

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 1, 15);
    this.camera.lookAt(0, -2, 0);

    // 2. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.container.innerHTML = "";
    this.container.appendChild(this.renderer.domElement);

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(5, 12, 8);
    this.scene.add(dirLight);

    const bitSpotLight = new THREE.PointLight(0x38bdf8, 2, 10);
    bitSpotLight.position.set(0, -6, 2);
    this.scene.add(bitSpotLight);

    // 4. Build Environment
    this.buildSurfaceRig();
    this.buildStratigraphyLayers();
    this.buildBoreholeCasing();
    this.buildDrillStringAndBit();
    this.buildRockCuttingParticles();

    // 5. Mouse Orbit Interaction
    this.setupInteractivity();

    // 6. Animation Loop
    this.animate();

    // Window Resize
    window.addEventListener("resize", () => this.onResize());
  }

  buildSurfaceRig() {
    // Surface Ground Plate
    const groundGeo = new THREE.CylinderGeometry(8, 8, 0.4, 32);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = 4.2;
    this.scene.add(ground);

    // Steel Derrick Tower (Lattice Structure)
    const towerGroup = new THREE.Group();
    const legMat = new THREE.MeshStandardMaterial({ color: 0xc22026, metalness: 0.6, roughness: 0.4 });
    const trussMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.8, roughness: 0.3 });

    // 4 Main Rig Legs
    const legGeo = new THREE.CylinderGeometry(0.06, 0.08, 4.5, 8);
    const pos = [
      { x: -1.2, z: -1.2, tx: -0.4, tz: -0.4 },
      { x: 1.2, z: -1.2, tx: 0.4, tz: -0.4 },
      { x: 1.2, z: 1.2, tx: 0.4, tz: 0.4 },
      { x: -1.2, z: 1.2, tx: -0.4, tz: 0.4 }
    ];

    pos.forEach(p => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set((p.x + p.tx) / 2, 6.45, (p.z + p.tz) / 2);
      towerGroup.add(leg);
    });

    // Rig Crown Block at Top
    const crownGeo = new THREE.BoxGeometry(1.2, 0.4, 1.2);
    const crownMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b });
    const crown = new THREE.Mesh(crownGeo, crownMat);
    crown.position.y = 8.8;
    towerGroup.add(crown);

    // Top Drive Unit
    const tdGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.8, 16);
    const tdMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.7 });
    this.topDrive = new THREE.Mesh(tdGeo, tdMat);
    this.topDrive.position.set(0, 6.2, 0);
    towerGroup.add(this.topDrive);

    this.derrick = towerGroup;
    this.scene.add(this.derrick);
  }

  buildStratigraphyLayers() {
    // Geological formations sliced cutaway
    const layers = [
      { name: "Alluvium / Dhekiajuli", depth: "0 - 450m", color: 0x334155, y: 3.2, h: 1.6 },
      { name: "Girujan Formation", depth: "450 - 1,480m", color: 0x1e3a5f, y: 1.6, h: 1.6 },
      { name: "Tipam Sandstone", depth: "1,480 - 2,850m", color: 0x854d0e, y: 0.0, h: 1.6 },
      { name: "Surma Formation", depth: "2,850 - 3,300m", color: 0x065f46, y: -1.6, h: 1.6 },
      { name: "Barail Carbonaceous Sandstone", depth: "3,300 - 3,950m (ACTIVE)", color: 0x7f1d1d, y: -3.6, h: 2.4 }
    ];

    layers.forEach(l => {
      const geo = new THREE.CylinderGeometry(4.2, 4.2, l.h, 24, 1, true, Math.PI * 0.25, Math.PI * 1.5);
      const mat = new THREE.MeshStandardMaterial({
        color: l.color,
        side: THREE.BackSide,
        roughness: 0.9,
        transparent: true,
        opacity: 0.85
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = l.y;
      this.scene.add(mesh);
      this.rockLayers.push(mesh);
    });
  }

  buildBoreholeCasing() {
    // Outer Casing Cylinder (Semi-transparent wireframe/glass)
    const casingGeo = new THREE.CylinderGeometry(0.7, 0.7, 10, 32, 1, true);
    const casingMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      wireframe: false
    });
    const casing = new THREE.Mesh(casingGeo, casingMat);
    casing.position.y = -1;
    this.scene.add(casing);

    // Wellbore Grid Rings
    for (let y = 3; y >= -6.5; y -= 1.2) {
      const ringGeo = new THREE.RingGeometry(0.68, 0.72, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.4 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      this.scene.add(ring);
    }
  }

  buildDrillStringAndBit() {
    this.drillString = new THREE.Group();

    // 1. Drill Pipe Shaft
    const pipeGeo = new THREE.CylinderGeometry(0.12, 0.12, 12, 20);
    const pipeMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.9,
      roughness: 0.2
    });
    const pipe = new THREE.Mesh(pipeGeo, pipeMat);
    pipe.position.y = 0;
    this.drillString.add(pipe);

    // Tool Joints (Ribs along pipe)
    for (let y = 5; y >= -5; y -= 2.2) {
      const jointGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.3, 16);
      const jointMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8 });
      const joint = new THREE.Mesh(jointGeo, jointMat);
      joint.position.y = y;
      this.drillString.add(joint);
    }

    // Heavy Weight Drill Collars (BHA section)
    const collarGeo = new THREE.CylinderGeometry(0.24, 0.24, 2, 20);
    const collarMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.3 });
    const collar = new THREE.Mesh(collarGeo, collarMat);
    collar.position.y = -5.2;
    this.drillString.add(collar);

    // 2. PDC / Tri-cone Drill Bit at Bottom
    const bitGroup = new THREE.Group();

    // Bit Shank / Body
    const bitBodyGeo = new THREE.CylinderGeometry(0.24, 0.42, 0.6, 16);
    const bitBodyMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9, roughness: 0.2 });
    const bitBody = new THREE.Mesh(bitBodyGeo, bitBodyMat);
    bitGroup.add(bitBody);

    // PDC Cutter Blades
    const bladeGeo = new THREE.BoxGeometry(0.52, 0.2, 0.12);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.95 });
    for (let r = 0; r < 4; r++) {
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      blade.rotation.y = (Math.PI / 4) * r;
      blade.position.y = -0.22;
      bitGroup.add(blade);
    }

    // Nozzles / Jets (Mud Circulation Ports)
    const nozzleMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    for (let n = 0; n < 3; n++) {
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.15, 8), nozzleMat);
      const angle = (n * 2 * Math.PI) / 3;
      nozzle.position.set(Math.cos(angle) * 0.18, -0.32, Math.sin(angle) * 0.18);
      bitGroup.add(nozzle);
    }

    bitGroup.position.y = this.bitY;
    this.drillBit = bitGroup;
    this.drillString.add(this.drillBit);

    this.scene.add(this.drillString);
  }

  buildRockCuttingParticles() {
    const particleCount = 180;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = [];

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 0.6;
      positions[i * 3 + 1] = this.bitY + Math.random() * 0.3;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 0.6;

      velocities.push({
        vx: (Math.random() - 0.5) * 0.04,
        vy: 0.03 + Math.random() * 0.06, // flowing upward with mud
        vz: (Math.random() - 0.5) * 0.04,
        origY: this.bitY
      });
    }

    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xf59e0b,
      size: 0.08,
      transparent: true,
      opacity: 0.8
    });

    this.particles = new THREE.Points(geo, mat);
    this.particlesVelocities = velocities;
    this.scene.add(this.particles);
  }

  setupInteractivity() {
    let isDragging = false;
    let prevMousePos = { x: 0, y: 0 };

    this.container.addEventListener("mousedown", (e) => {
      isDragging = true;
      prevMousePos = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener("mouseup", () => {
      isDragging = false;
    });

    window.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMousePos.x;
      const deltaY = e.clientY - prevMousePos.y;

      this.scene.rotation.y += deltaX * 0.008;
      this.camera.position.y = Math.max(-5, Math.min(8, this.camera.position.y - deltaY * 0.02));

      prevMousePos = { x: e.clientX, y: e.clientY };
    });

    // Scroll Zoom
    this.container.addEventListener("wheel", (e) => {
      e.preventDefault();
      this.camera.position.z = Math.max(6, Math.min(26, this.camera.position.z + e.deltaY * 0.015));
    });
  }

  setCameraPreset(preset) {
    if (preset === "bit") {
      this.camera.position.set(0, this.bitY + 1.2, 5.5);
      this.camera.lookAt(0, this.bitY, 0);
    } else if (preset === "surface") {
      this.camera.position.set(0, 5.5, 9);
      this.camera.lookAt(0, 4.5, 0);
    } else {
      // Full Profile
      this.camera.position.set(0, 0, 15);
      this.camera.lookAt(0, -2, 0);
    }
  }

  updateDrillingState(isDrilling, currentDepthM, rpm = 110) {
    this.isDrilling = isDrilling;
    this.currentDepth = currentDepthM;
    this.rpm = rpm;

    // Advance bit slightly deeper visually as depth increases
    const minDepth = 3840;
    const maxDepth = 4100;
    const depthFrac = Math.min(1, Math.max(0, (currentDepthM - minDepth) / (maxDepth - minDepth)));
    const targetY = -6.5 - depthFrac * 1.5;

    if (this.drillBit) {
      this.drillBit.position.y = targetY;
      this.bitY = targetY;
    }
  }

  animate() {
    this.animId = requestAnimationFrame(() => this.animate());

    // Rotate Drill String when drilling or rotating
    if (this.drillString) {
      const rotSpeed = this.isDrilling ? (this.rpm / 60) * 0.12 : 0.005;
      this.drillString.rotation.y += rotSpeed;
    }

    // Top Drive pulse
    if (this.topDrive && this.isDrilling) {
      this.topDrive.rotation.y += 0.05;
    }

    // Update Rock Cutting Particles
    if (this.particles && this.isDrilling) {
      const positions = this.particles.geometry.attributes.position.array;
      const vels = this.particlesVelocities;

      for (let i = 0; i < vels.length; i++) {
        positions[i * 3] += vels[i].vx;
        positions[i * 3 + 1] += vels[i].vy;
        positions[i * 3 + 2] += vels[i].vz;

        // Reset particle when it travels 2.5m up the annulus
        if (positions[i * 3 + 1] > this.bitY + 2.5) {
          positions[i * 3] = (Math.random() - 0.5) * 0.5;
          positions[i * 3 + 1] = this.bitY + Math.random() * 0.2;
          positions[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
        }
      }
      this.particles.geometry.attributes.position.needsUpdate = true;
    }

    this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  // Graceful 2D/Isometric Canvas fallback if Three.js or WebGL is blocked
  initCanvasFallback() {
    const canvas = document.createElement("canvas");
    canvas.width = this.container.clientWidth || 600;
    canvas.height = this.container.clientHeight || 480;
    this.container.innerHTML = "";
    this.container.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    let angle = 0;
    const renderFallback = () => {
      ctx.fillStyle = "#0c121c";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Stratigraphy bands
      const w = canvas.width;
      const bands = [
        { name: "Girujan Formation", col: "#1e3a5f", y: 80, h: 70 },
        { name: "Tipam Sandstone", col: "#854d0e", y: 150, h: 90 },
        { name: "Surma Formation", col: "#065f46", y: 240, h: 80 },
        { name: "Barail Carbonaceous Sandstone (Active)", col: "#7f1d1d", y: 320, h: 130 }
      ];

      bands.forEach(b => {
        ctx.fillStyle = b.col + "55";
        ctx.fillRect(80, b.y, w - 160, b.h);
        ctx.strokeStyle = "#38bdf833";
        ctx.strokeRect(80, b.y, w - 160, b.h);
        ctx.fillStyle = "#94a3b8";
        ctx.font = "10px sans-serif";
        ctx.fillText(b.name, 90, b.y + 18);
      });

      // Borehole Centerline
      const cx = w / 2;
      ctx.strokeStyle = "#0284c7";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(cx, 30);
      ctx.lineTo(cx, 400);
      ctx.stroke();

      // Rotating Bit
      angle += this.isDrilling ? 0.15 : 0.02;
      ctx.save();
      ctx.translate(cx, 400);
      ctx.rotate(angle);
      ctx.fillStyle = "#d97706";
      ctx.fillRect(-18, -12, 36, 24);
      ctx.restore();

      // Bit depth HUD
      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 13px monospace";
      ctx.fillText(`BIT DEPTH: ${this.currentDepth.toFixed(2)} m (Barail Formation)`, cx + 30, 395);

      requestAnimationFrame(renderFallback);
    };
    renderFallback();
  }
}
