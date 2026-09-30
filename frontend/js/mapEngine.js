/**
 * NWIS - Nearby Well Intelligence System
 * OpenStreetMap & Live Backend Offset Intelligence Controller
 * Ministry of Petroleum & Natural Gas | Oil India Limited
 */

(function () {
  // Module State
  let leafletMap = null;
  let markersLayer = null;
  let bufferCircle = null;
  let targetMarker = null;
  let activeOverlaysLayer = null;
  let baseTileLayers = {};
  let currentBasemapLayer = null;

  let currentTargetWellId = "OIL-AS-NHRK-104";
  let currentOffsetWellId = "NHRK-98";
  let currentRadiusKm = 25;
  let currentStatusFilter = "All Statuses";
  let currentFormationFilter = "Barail Sandst";
  let activeLayerType = "stratigraphy";
  let controlsSetupDone = false;
  let latestGisData = null;

  // Initialize Map Engine
  function initMapEngine() {
    const mapContainer = document.getElementById("osmMapContainer");
    if (!mapContainer) return;

    if (!leafletMap) {
      // 1. Create Leaflet Map Instance
      leafletMap = L.map("osmMapContainer", {
        center: [27.3078, 95.3456],
        zoom: 11,
        zoomControl: false, // Custom controls matching UI
        attributionControl: false
      });
      window.leafletMapInstance = leafletMap;

      // 2. Base Tile Layers with High-Clarity Retina Rendering
      baseTileLayers = {
        voyager: L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
          maxZoom: 20,
          subdomains: "abcd",
          attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
        }),
        satellite: L.layerGroup([
          L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
            maxZoom: 19,
            attribution: "Esri Satellite"
          }),
          L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", {
            maxZoom: 19
          })
        ]),
        dark: L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
          maxZoom: 20,
          subdomains: "abcd",
          attribution: "&copy; CARTO Dark"
        }),
        osm: L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap contributors"
        })
      };

      // Default to Voyager: world-class geographic clarity & crisp high-DPI contrast
      currentBasemapLayer = baseTileLayers.voyager.addTo(leafletMap);

      // Layer groups for markers and overlays
      markersLayer = L.layerGroup().addTo(leafletMap);
      activeOverlaysLayer = L.layerGroup().addTo(leafletMap);

      // Map click resets or logs coordinates
      leafletMap.on("click", (e) => {
        const hudCoords = document.getElementById("hudCoordinates");
        if (hudCoords) {
          hudCoords.innerHTML = `<div>${e.latlng.lat.toFixed(4)}° N</div><div>${e.latlng.lng.toFixed(4)}° E</div><div class="hud-utm-tag">UTM ZONE 46N (WGS84)</div>`;
        }
      });

      // Window resize handler
      window.addEventListener("resize", () => {
        if (leafletMap) leafletMap.invalidateSize();
      });
    }

    if (!controlsSetupDone) {
      setupMapControls();
      controlsSetupDone = true;
    }

    // Refresh size repeatedly to guarantee smooth tiles rendering without grey boxes
    [30, 100, 250, 500].forEach((delay) => {
      setTimeout(() => {
        if (leafletMap) {
          leafletMap.invalidateSize();
        }
      }, delay);
    });

    // Fetch initial backend data
    fetchGisData(currentTargetWellId, currentRadiusKm, currentOffsetWellId, currentStatusFilter);
  }

  // Setup Event Listeners for Filters and Map Buttons
  function setupMapControls() {
    // 1. Search Input & Clear
    const searchInput = document.getElementById("mapWellSearchInput");
    const clearBtn = document.getElementById("mapSearchClearBtn");
    if (clearBtn && searchInput) {
      clearBtn.addEventListener("click", () => {
        searchInput.value = "";
        searchInput.focus();
      });
    }

    // 2. Field Tag Buttons
    document.querySelectorAll(".map-field-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".map-field-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const fieldCode = btn.getAttribute("data-field");
        if (fieldCode === "NHRK 104") {
          currentTargetWellId = "OIL-AS-NHRK-104";
          currentOffsetWellId = "NHRK-98";
        } else if (fieldCode === "DAD-1 202") {
          currentTargetWellId = "OIL-DGB-001";
          currentOffsetWellId = null;
        } else if (fieldCode === "KG 08") {
          currentTargetWellId = "OIL-MRN-001";
          currentOffsetWellId = null;
        }
        if (searchInput) searchInput.value = currentTargetWellId;
        fetchGisData(currentTargetWellId, currentRadiusKm, currentOffsetWellId, currentStatusFilter);
      });
    });

    // 3. Radius Slider
    const radiusSlider = document.getElementById("mapRadiusSlider");
    const radiusBadge = document.getElementById("mapRadiusBadge");
    const hudBufferBadge = document.getElementById("hudBufferBadge");
    if (radiusSlider && radiusBadge) {
      radiusSlider.addEventListener("input", (e) => {
        currentRadiusKm = parseFloat(e.target.value);
        radiusBadge.textContent = `${currentRadiusKm} km`;
        if (hudBufferBadge) hudBufferBadge.textContent = `Buffer: ${currentRadiusKm} km`;
        updateBufferCircle(currentRadiusKm);
      });

      radiusSlider.addEventListener("change", () => {
        fetchGisData(currentTargetWellId, currentRadiusKm, currentOffsetWellId, currentStatusFilter);
      });
    }

    // 4. Status Filter Dropdown
    const statusSelect = document.getElementById("mapStatusSelect");
    if (statusSelect) {
      statusSelect.addEventListener("change", (e) => {
        currentStatusFilter = e.target.value;
        fetchGisData(currentTargetWellId, currentRadiusKm, currentOffsetWellId, currentStatusFilter);
      });
    }

    // 5. Formation Filter Dropdown
    const formationSelect = document.getElementById("mapFormationSelect");
    if (formationSelect) {
      formationSelect.addEventListener("change", (e) => {
        currentFormationFilter = e.target.value;
        fetchGisData(currentTargetWellId, currentRadiusKm, currentOffsetWellId, currentStatusFilter);
      });
    }

    // 6. Search & Filter Button
    const searchFilterBtn = document.getElementById("btnMapSearchFilter");
    if (searchFilterBtn) {
      searchFilterBtn.addEventListener("click", () => {
        if (searchInput && searchInput.value.trim()) {
          currentTargetWellId = searchInput.value.trim();
        }
        fetchGisData(currentTargetWellId, currentRadiusKm, currentOffsetWellId, currentStatusFilter);
      });
    }

    // 7. Reset Filters Button
    const resetBtn = document.getElementById("btnMapResetFilters");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        currentTargetWellId = "OIL-AS-NHRK-104";
        currentOffsetWellId = "NHRK-98";
        currentRadiusKm = 25;
        currentStatusFilter = "All Statuses";
        currentFormationFilter = "Barail Sandst";
        if (searchInput) searchInput.value = currentTargetWellId;
        if (radiusSlider) radiusSlider.value = 25;
        if (radiusBadge) radiusBadge.textContent = "25 km";
        if (statusSelect) statusSelect.value = "All Statuses";
        if (formationSelect) formationSelect.value = "Barail Sandst";
        document.querySelectorAll(".map-field-btn").forEach((b) => {
          b.classList.toggle("active", b.getAttribute("data-field") === "NHRK 104");
        });
        fetchGisData(currentTargetWellId, currentRadiusKm, currentOffsetWellId, currentStatusFilter);
      });
    }

    // 8. HUD Layer Toggles (Stratigraphy, Seismic 3D, Pipeline Grid)
    document.querySelectorAll(".hud-tool-btn[data-layer]").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".hud-tool-btn[data-layer]").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        activeLayerType = btn.getAttribute("data-layer");
        renderOverlayLayer(activeLayerType);
      });
    });

    // 8b. Basemap Clarity Switcher (Ultra-Clear HD Voyager, Satellite Aerial, Dark GIS)
    document.querySelectorAll(".basemap-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".basemap-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        const basemapKey = btn.getAttribute("data-basemap");
        if (leafletMap && baseTileLayers && baseTileLayers[basemapKey]) {
          if (currentBasemapLayer && leafletMap.hasLayer(currentBasemapLayer)) {
            leafletMap.removeLayer(currentBasemapLayer);
          }
          currentBasemapLayer = baseTileLayers[basemapKey];
          currentBasemapLayer.addTo(leafletMap);
          if (window.showGlobalToast) {
            window.showGlobalToast(`Map Mode: ${btn.textContent.trim()} activated`);
          }
        }
      });
    });

    // 8c. Maximize Map Size Toggle (Expands map canvas to full screen width & height)
    const toggleMapMaximize = () => {
      const layout = document.querySelector(".map-view-layout");
      const label = document.getElementById("btnMapMaximizeLabel");
      const topBtn = document.getElementById("btnMapMaximizeTop");
      const expandBtn = document.getElementById("btnMapExpandCanvas");
      if (!layout) return;

      const isMaximized = layout.classList.toggle("map-maximized");
      if (label) label.textContent = isMaximized ? "Restore Split View" : "Maximize Map View";
      if (topBtn) topBtn.classList.toggle("active-max", isMaximized);
      if (expandBtn) expandBtn.classList.toggle("active", isMaximized);

      [40, 150, 300, 500].forEach((ms) => {
        setTimeout(() => {
          if (leafletMap) {
            leafletMap.invalidateSize();
            if (targetMarker) {
              leafletMap.panTo(targetMarker.getLatLng(), { animate: true });
            }
          }
        }, ms);
      });
    };

    const topMaxBtn = document.getElementById("btnMapMaximizeTop");
    if (topMaxBtn) topMaxBtn.addEventListener("click", toggleMapMaximize);

    const hudExpandBtn = document.getElementById("btnMapExpandCanvas");
    if (hudExpandBtn) hudExpandBtn.addEventListener("click", toggleMapMaximize);

    // 9. Zoom and Scale Buttons
    const btnZoomIn = document.getElementById("btnMapZoomIn");
    const btnZoomOut = document.getElementById("btnMapZoomOut");
    const btnFitBounds = document.getElementById("btnMapFitBounds");
    if (btnZoomIn) {
      btnZoomIn.addEventListener("click", () => leafletMap && leafletMap.zoomIn());
    }
    if (btnZoomOut) {
      btnZoomOut.addEventListener("click", () => leafletMap && leafletMap.zoomOut());
    }
    if (btnFitBounds) {
      btnFitBounds.addEventListener("click", () => {
        if (bufferCircle && leafletMap) {
          leafletMap.fitBounds(bufferCircle.getBounds(), { padding: [40, 40] });
        }
      });
    }

    // 10. Dossier Action: Compare with Target
    const compareBtn = document.getElementById("btnDossierCompareTarget");
    if (compareBtn) {
      compareBtn.addEventListener("click", () => {
        if (window.switchAppTab) {
          window.switchAppTab("correlation");
        }
      });
    }

    // 11. Dossier Action: Back to Live Well
    const backLiveBtn = document.getElementById("btnDossierBackLive");
    if (backLiveBtn) {
      backLiveBtn.addEventListener("click", () => {
        if (latestGisData && latestGisData.target_well && leafletMap) {
          leafletMap.flyTo([latestGisData.target_well.latitude, latestGisData.target_well.longitude], 12);
        }
      });
    }

    // 12. View on Map Top Button
    const btnViewOnMap = document.getElementById("btnMapViewOnMap");
    if (btnViewOnMap) {
      btnViewOnMap.addEventListener("click", () => {
        if (latestGisData && latestGisData.target_well && leafletMap) {
          leafletMap.flyTo([latestGisData.target_well.latitude, latestGisData.target_well.longitude], 12, { duration: 1 });
        }
      });
    }

    // 13. Dossier Close Button
    const btnDossierClose = document.getElementById("btnDossierClose");
    if (btnDossierClose) {
      btnDossierClose.addEventListener("click", () => {
        if (latestGisData && latestGisData.target_well && leafletMap) {
          leafletMap.flyTo([latestGisData.target_well.latitude, latestGisData.target_well.longitude], 12);
        }
      });
    }

    // 14. Dossier Tabs (Overview, Drilling Analysis, Geology, NPT)
    document.querySelectorAll(".offset-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".offset-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        const tabKey = tab.getAttribute("data-tab");
      });
    });
  }

  // Fetch GIS Data from FastAPI Backend
  async function fetchGisData(wellId, radiusKm, offsetWellId, status) {
    try {
      const url = `http://localhost:8000/api/v1/gis/wells?well_id=${encodeURIComponent(wellId)}&radius_km=${radiusKm}&status=${encodeURIComponent(status)}${offsetWellId ? `&offset_well_id=${encodeURIComponent(offsetWellId)}` : ""}`;
      
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`GIS API returned HTTP ${res.status}`);
      }
      const data = await res.json();
      latestGisData = data;
      renderGisData(data);
    } catch (err) {
      console.warn("Backend GIS endpoint fetch failed, falling back to local dataset:", err);
      // Fallback local dataset matching backend structure
      const fallbackData = createFallbackGisData(wellId, radiusKm, offsetWellId);
      latestGisData = fallbackData;
      renderGisData(fallbackData);
    }
  }

  // Render Full GIS Dataset onto Leaflet & Dossier UI
  function renderGisData(data) {
    const target = data.target_well;
    const offsets = data.offset_wells || [];
    const selectedOffset = data.selected_offset || offsets[0];
    const kpi = data.kpi_summary;
    const sync = data.sync_status;

    // 1. Update Telemetry Sub-Bar
    updateTelemetrySubBar(sync, target, offsets);

    // 2. Center Leaflet Map on Target
    if (leafletMap && target) {
      const targetPos = [target.latitude, target.longitude];
      leafletMap.setView(targetPos, 11);

      // Update Top-Left Coordinates HUD
      const hudCoords = document.getElementById("hudCoordinates");
      if (hudCoords) {
        hudCoords.innerHTML = `<div>${target.coordinates_dms?.lat || "27°18'28.4\" N"}</div><div>${target.coordinates_dms?.lon || "95°20'44.1\" E"}</div><div class="hud-utm-tag">${target.utm_zone || "UTM ZONE 46N (WGS84)"}</div>`;
      }

      // Update 25 km Buffer Circle
      updateBufferCircle(currentRadiusKm, targetPos);

      // 3. Render Markers on Leaflet
      renderMarkers(target, offsets, selectedOffset);
    }

    // 4. Update Right Offset Well Dossier
    if (selectedOffset) {
      renderOffsetDossier(selectedOffset, target);
    }

    // 5. Update Bottom 4 KPI Cards
    if (kpi) {
      renderBottomKpiCards(kpi);
    }
  }

  // Draw or Update Circular Buffer
  function updateBufferCircle(radiusKm, centerPos) {
    if (!leafletMap) return;
    const center = centerPos || (bufferCircle ? bufferCircle.getLatLng() : [27.3078, 95.3456]);

    if (bufferCircle) {
      bufferCircle.setLatLng(center);
      bufferCircle.setRadius(radiusKm * 1000);
    } else {
      bufferCircle = L.circle(center, {
        radius: radiusKm * 1000,
        color: "#0284c7",
        weight: 1.8,
        dashArray: "6, 6",
        fillColor: "#0284c7",
        fillOpacity: 0.08
      }).addTo(leafletMap);
    }
  }

  // Render Overlay Layer (Stratigraphy, Seismic 3D, Pipeline Grid)
  function renderOverlayLayer(layerType) {
    if (!leafletMap || !activeOverlaysLayer) return;
    activeOverlaysLayer.clearLayers();

    if (!latestGisData || !latestGisData.target_well) return;
    const target = latestGisData.target_well;
    const tLat = target.latitude;
    const tLon = target.longitude;

    if (layerType === "stratigraphy") {
      // Subsurface stratigraphic contour lines
      const poly1 = L.polygon([
        [tLat - 0.08, tLon - 0.12],
        [tLat - 0.04, tLon + 0.14],
        [tLat + 0.06, tLon + 0.10],
        [tLat + 0.03, tLon - 0.10]
      ], {
        color: "#f59e0b",
        weight: 1.2,
        fillColor: "rgba(245, 158, 11, 0.07)",
        dashArray: "4, 4"
      }).addTo(activeOverlaysLayer);
      poly1.bindTooltip("Barail Sandstone Facies Boundary", { permanent: false });

    } else if (layerType === "seismic") {
      // 3D Seismic In-line and Cross-line Grid
      for (let i = -3; i <= 3; i++) {
        L.polyline([
          [tLat + i * 0.03, tLon - 0.14],
          [tLat + i * 0.03, tLon + 0.14]
        ], { color: "#38bdf8", weight: 1, opacity: 0.45 }).addTo(activeOverlaysLayer);

        L.polyline([
          [tLat - 0.10, tLon + i * 0.04],
          [tLat + 0.10, tLon + i * 0.04]
        ], { color: "#38bdf8", weight: 1, opacity: 0.45 }).addTo(activeOverlaysLayer);
      }
    } else if (layerType === "pipeline") {
      // Trunk Crude & Gas Pipeline Grid
      const pipeLine1 = L.polyline([
        [tLat - 0.06, tLon - 0.10],
        [tLat - 0.01, tLon - 0.03],
        [tLat + 0.02, tLon + 0.02],
        [tLat + 0.08, tLon + 0.08]
      ], { color: "#10b981", weight: 2.5, dashArray: "8, 5" }).addTo(activeOverlaysLayer);
      pipeLine1.bindTooltip("Nahorkatiya-Digboi 12\" Crude Pipeline (Online)", { sticky: true });
    }
  }

  // Render Target and Offset Markers
  function renderMarkers(target, offsets, selectedOffset) {
    if (!markersLayer) return;
    markersLayer.clearLayers();

    // 1. Target Well Marker (Prominent Golden Pulsing Beacon)
    const targetIcon = L.divIcon({
      className: "custom-target-marker",
      html: `
        <div class="target-marker-beacon">
          <div class="target-beacon-core">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#000000">
              <path d="M12 2L4 22h16L12 2zm0 6l4 10H8l4-10z"/>
            </svg>
          </div>
          <div class="target-beacon-pulse"></div>
        </div>
        <div class="target-marker-label">OIL-AS-NHRK-104 (TARGET)</div>
      `,
      iconSize: [210, 56],
      iconAnchor: [105, 28]
    });

    targetMarker = L.marker([target.latitude, target.longitude], { icon: targetIcon, zIndexOffset: 1000 }).addTo(markersLayer);

    // Target Well Callout Card Popup
    const targetPopupContent = `
      <div class="leaflet-custom-callout">
        <div class="callout-header">
          <span>${target.well_id}</span>
          <span class="callout-tag">${target.status}</span>
        </div>
        <div class="callout-row"><span>Basin:</span><span>${target.basin}</span></div>
        <div class="callout-row"><span>Spud:</span><span>${target.spud_date}</span></div>
        <div class="callout-row"><span>TVD Depth:</span><span>${target.tvd_depth?.toLocaleString()} m</span></div>
        <div class="callout-row"><span>ROP:</span><span>${target.rop_current} m/hr</span></div>
        <div class="callout-row"><span>Target Horizon:</span><span>${target.target_horizon}</span></div>
        <button class="callout-btn-action" onclick="window.switchAppTab && window.switchAppTab('alerts')">
          ⚡ Analyze in Alerts Page
        </button>
      </div>
    `;

    targetMarker.bindPopup(targetPopupContent, {
      className: "leaflet-popup-dark",
      offset: [0, -25],
      autoPan: false
    });

    // Automatically open target popup
    targetMarker.openPopup();

    // 2. Offset Well Markers
    offsets.forEach((offset) => {
      const isSelected = selectedOffset && selectedOffset.well_id === offset.well_id;
      let statusColor = "#10b981"; // producing
      if (offset.status === "Completed") statusColor = "#0284c7";
      if (offset.status === "Shut-in") statusColor = "#ef4444";

      // NHRK-98 is highlighted as in the screenshot
      const isNhrk98 = offset.well_id.includes("98");

      const offsetIcon = L.divIcon({
        className: "custom-offset-marker",
        html: `
          <div class="offset-pin-wrap ${isSelected ? "selected-pin" : ""}">
            <div class="offset-pin-dot" style="background-color: ${statusColor};">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5">
                <circle cx="12" cy="12" r="8"/>
              </svg>
            </div>
            <div class="offset-pin-text ${isNhrk98 ? "highlight-badge" : ""}">
              • ${offset.well_id} ${offset.distance_km ? `(${offset.distance_km} km)` : ""}
            </div>
          </div>
        `,
        iconSize: [180, 42],
        iconAnchor: [90, 21]
      });

      const marker = L.marker([offset.latitude, offset.longitude], { icon: offsetIcon }).addTo(markersLayer);

      marker.on("click", () => {
        currentOffsetWellId = offset.well_id;
        renderOffsetDossier(offset, target);
        // Refresh markers to update selected highlight
        renderMarkers(target, offsets, offset);
      });
    });
  }

  // Update Top Telemetry Sub-Bar
  function updateTelemetrySubBar(sync, target, offsets) {
    const syncText = document.getElementById("mapSyncStatusText");
    if (syncText) {
      syncText.innerHTML = `
        <span class="tele-dot-online"></span>
        <span>GIS Sync: <strong>${sync?.source || "Digboi Central Datahub"}</strong> &bull; Last updated: ${sync?.last_updated || "14:52:08 IST"} &bull; <span class="text-green">${sync?.connection || "Online"}</span></span>
      `;
    }

    const countText = document.getElementById("mapOffsetCountTitle");
    if (countText) {
      countText.innerHTML = `Showing <strong>${offsets.length} Offset Wells</strong> within <strong>${currentRadiusKm} km</strong> of <strong>${target?.well_id || "OIL-AS-NHRK-104"}</strong> (${target?.field || "Nahorkatiya Field"})`;
    }

    const producingCount = offsets.filter((w) => w.status === "Producing").length;
    const completedCount = offsets.filter((w) => w.status === "Completed").length;
    const shutinCount = offsets.filter((w) => w.status === "Shut-in").length;

    const pillsContainer = document.getElementById("mapStatusPillsContainer");
    if (pillsContainer) {
      pillsContainer.innerHTML = `
        <span class="map-status-pill green">● ${producingCount} Producing</span>
        <span class="map-status-pill blue">● ${completedCount} Completed</span>
        <span class="map-status-pill red">● ${shutinCount} Shut-in</span>
      `;
    }
  }

  // Render Right Offset Well Intelligence Dossier
  function renderOffsetDossier(well, target) {
    const wellIdElem = document.getElementById("dossierWellId");
    if (wellIdElem) wellIdElem.textContent = well.well_id;

    const statusPill = document.getElementById("dossierStatusPill");
    if (statusPill) {
      statusPill.className = `badge-status-pill ${well.status_type || "completed"}`;
      statusPill.textContent = well.status;
    }

    const subElem = document.getElementById("dossierSubtitle");
    if (subElem) {
      subElem.textContent = `${well.field || "Nahorkatiya Field"} • Distance: ${well.distance_km || "2.4"} km ${well.bearing || "North-East"} from Active Target (${target?.well_id || "OIL-AS-NHRK-104"})`;
    }

    const dateHeader = document.getElementById("dossierDatesHeader");
    if (dateHeader) {
      dateHeader.textContent = `WELL TECHNICAL SPECIFICATIONS SPUD: ${well.spud_date || "15-Mar-2018"} | COMP: ${well.comp_date || "28-Aug-2018"}`;
    }

    // 2x3 Technical Specs
    const sDays = document.getElementById("specDaysToTd");
    if (sDays) sDays.textContent = `${well.days_to_td || "165"} days`;

    const sTvd = document.getElementById("specTvdMd");
    if (sTvd) sTvd.textContent = well.tvd_md || "3,842 / 4,100 m";

    const sMud = document.getElementById("specMudWt");
    if (sMud) sMud.textContent = well.mud_wt || "1.32 sg";

    const sRop = document.getElementById("specRop");
    if (sRop) sRop.textContent = well.rop_avg || "14.8 m/hr";

    const sBht = document.getElementById("specBht");
    if (sBht) sBht.textContent = well.bht || "128 °C";

    const sCuttings = document.getElementById("specCuttings");
    if (sCuttings) sCuttings.textContent = well.total_cuttings || "2.4 m³/m";

    // Historical Drilling Curve
    renderDrillingCurve(well.drilling_curve || [], well.npt_events || []);

    // Stratigraphic Formation Tops Table
    renderFormationTopsTable(well.formation_tops || []);

    // Archive Ref
    const refElem = document.getElementById("dossierArchiveRef");
    if (refElem) {
      refElem.textContent = `OIL Archive Ref: ${well.archive_ref || "NHRK-98-COMP-2019"}`;
    }
  }

  // Render Dynamic Historical Drilling Curve Chart (Days vs Depth)
  function renderDrillingCurve(curvePoints, nptEvents) {
    const container = document.getElementById("drillingCurveViewport");
    if (!container) return;

    if (!curvePoints || curvePoints.length === 0) {
      curvePoints = [
        { day: 0, md: 0, tvd: 0 },
        { day: 20, md: 800, tvd: 800 },
        { day: 35, md: 1200, tvd: 1200 },
        { day: 40, md: 1200, tvd: 1200 },
        { day: 70, md: 2300, tvd: 2250 },
        { day: 84, md: 3400, tvd: 3320 },
        { day: 88, md: 3400, tvd: 3320 },
        { day: 125, md: 3820, tvd: 3680 },
        { day: 165, md: 4100, tvd: 3842 }
      ];
    }

    const svgWidth = 340;
    const svgHeight = 125;
    const padX = 35;
    const padY = 20;
    const plotW = svgWidth - padX - 15;
    const plotH = svgHeight - padY - 20;

    const maxDay = Math.max(...curvePoints.map((p) => p.day), 165);
    const maxDepth = Math.max(...curvePoints.map((p) => p.md), 4500);

    const scaleX = (day) => padX + (day / maxDay) * plotW;
    const scaleY = (depth) => padY + (depth / maxDepth) * plotH;

    // Build SVG paths
    const mdPath = curvePoints
      .map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(p.day).toFixed(1)} ${scaleY(p.md).toFixed(1)}`)
      .join(" ");

    const tvdPath = curvePoints
      .map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(p.day).toFixed(1)} ${scaleY(p.tvd).toFixed(1)}`)
      .join(" ");

    let nptCalloutsSvg = "";
    if (nptEvents && nptEvents.length > 0) {
      nptEvents.forEach((ev) => {
        const x = scaleX(ev.day || 60);
        const y = scaleY(ev.depth || 2000);
        const isStuck = ev.label.includes("Stuck");
        const color = isStuck ? "#ef4444" : "#f59e0b";
        const bg = isStuck ? "rgba(239, 68, 68, 0.25)" : "rgba(245, 158, 11, 0.25)";

        nptCalloutsSvg += `
          <g transform="translate(${Math.min(x, 150)}, ${Math.max(y - 12, 22)})">
            <rect x="0" y="0" width="168" height="18" rx="3" fill="${bg}" stroke="${color}" stroke-width="1"/>
            <text x="5" y="12" font-size="8" font-family="'JetBrains Mono', monospace" font-weight="700" fill="${color}">${ev.label}</text>
          </g>
        `;
      });
    } else {
      // Default matching screenshot
      nptCalloutsSvg = `
        <g transform="translate(130, 80)">
          <rect x="0" y="0" width="165" height="16" rx="3" fill="rgba(239, 68, 68, 0.25)" stroke="#ef4444" stroke-width="0.8"/>
          <text x="4" y="11" font-size="7.5" font-family="'JetBrains Mono', monospace" font-weight="700" fill="#fca5a5">NPT: Stuck Pipe (Day 84-88 @ 3,400m)</text>
        </g>
        <g transform="translate(110, 42)">
          <rect x="0" y="0" width="165" height="16" rx="3" fill="rgba(245, 158, 11, 0.25)" stroke="#f59e0b" stroke-width="0.8"/>
          <text x="4" y="11" font-size="7.5" font-family="'JetBrains Mono', monospace" font-weight="700" fill="#fde68a">Loss: Mud Lost / 550b (Day 35-39 @ 1,200m)</text>
        </g>
      `;
    }

    container.innerHTML = `
      <svg viewBox="0 0 ${svgWidth} ${svgHeight}" class="curve-chart-svg">
        <!-- Grid lines -->
        <line x1="${padX}" y1="${padY}" x2="${padX + plotW}" y2="${padY}" stroke="#1e293b" stroke-width="1"/>
        <line x1="${padX}" y1="${padY + plotH * 0.33}" x2="${padX + plotW}" y2="${padY + plotH * 0.33}" stroke="#1e293b" stroke-width="1"/>
        <line x1="${padX}" y1="${padY + plotH * 0.66}" x2="${padX + plotW}" y2="${padY + plotH * 0.66}" stroke="#1e293b" stroke-width="1"/>
        <line x1="${padX}" y1="${padY + plotH}" x2="${padX + plotW}" y2="${padY + plotH}" stroke="#334155" stroke-width="1.2"/>
        <line x1="${padX}" y1="${padY}" x2="${padX}" y2="${padY + plotH}" stroke="#334155" stroke-width="1.2"/>

        <!-- Depth Axis Labels Y -->
        <text x="6" y="${padY + 4}" font-size="7.5" fill="#64748b">0m</text>
        <text x="6" y="${padY + plotH * 0.33 + 3}" font-size="7.5" fill="#64748b">1,500m</text>
        <text x="6" y="${padY + plotH * 0.66 + 3}" font-size="7.5" fill="#64748b">3,000m</text>
        <text x="6" y="${padY + plotH + 3}" font-size="7.5" fill="#64748b">4,500m</text>

        <!-- Days Axis Labels X -->
        <text x="${padX}" y="${svgHeight - 4}" font-size="7.5" fill="#64748b">Day 0</text>
        <text x="${padX + plotW * 0.3}" y="${svgHeight - 4}" font-size="7.5" fill="#64748b">50d</text>
        <text x="${padX + plotW * 0.6}" y="${svgHeight - 4}" font-size="7.5" fill="#64748b">100d</text>
        <text x="${padX + plotW - 20}" y="${svgHeight - 4}" font-size="7.5" fill="#64748b">165d</text>

        <!-- Historical Curves -->
        <!-- TVD (Yellow) -->
        <path d="${tvdPath}" fill="none" stroke="#facc15" stroke-width="2" stroke-linecap="round"/>
        <!-- MD (Cyan) -->
        <path d="${mdPath}" fill="none" stroke="#38bdf8" stroke-width="2" stroke-dasharray="3,3" stroke-linecap="round"/>

        <!-- Anomaly Callouts -->
        ${nptCalloutsSvg}
      </svg>
    `;
  }

  // Render Formation Tops Table
  function renderFormationTopsTable(tops) {
    const tableBody = document.getElementById("formationTopsTableBody");
    if (!tableBody) return;

    if (!tops || tops.length === 0) {
      tops = [
        { formation: "Barail Sandstone", top_m: "2,850 m", notes: "Interbedded carbonaceous shale & sand" },
        { formation: "Tipam Sandstone", top_m: "1,487 m", notes: "Fine-medium sandstone sequence" },
        { formation: "Girujan Clay", top_m: "1,103 m", notes: "Argillaceous sandstone & clay" }
      ];
    }

    tableBody.innerHTML = tops
      .map(
        (t) => `
        <tr>
          <td><strong>${t.formation}</strong></td>
          <td class="font-mono text-cyan">${t.top_m}</td>
          <td>${t.notes}</td>
        </tr>
      `
      )
      .join("");
  }

  // Render Bottom 4 KPI Cards Matching Screenshot
  function renderBottomKpiCards(kpi) {
    // Card 1: Offset Wells in Radius
    const c1Val = document.getElementById("kpiRadiusWellsVal");
    const c1Sub = document.getElementById("kpiRadiusWellsSub");
    const c1Tag = document.getElementById("kpiRadiusWellsTag");
    if (kpi.offset_wells_in_radius) {
      const c = kpi.offset_wells_in_radius;
      if (c1Val) c1Val.innerHTML = `${c.total_count} <span class="kpi-unit">Wells in ${c.radius_km} km</span>`;
      if (c1Sub) c1Sub.textContent = c.subtext || `${c.producing} Producing • ${c.completed} Completed • ${c.shutin} Shut-in`;
      if (c1Tag) c1Tag.textContent = `${c.synced_pct}% Synced`;
    }

    // Card 2: Historical Success Rate
    const c2Val = document.getElementById("kpiSuccessRateVal");
    const c2Sub = document.getElementById("kpiSuccessRateSub");
    const c2Tag = document.getElementById("kpiSuccessRateTag");
    if (kpi.historical_success_rate) {
      const s = kpi.historical_success_rate;
      if (c2Val) c2Val.innerHTML = `${s.rate_pct}% <span class="kpi-unit">${s.fraction_reached_td}</span>`;
      if (c2Sub) c2Sub.textContent = s.category || "Commercial Discovery";
      if (c2Tag) c2Tag.textContent = s.regional_delta || "+8.6% Regional";
    }

    // Card 3: Primary Hazard / Risk
    const c3Val = document.getElementById("kpiHazardRiskVal");
    const c3Sub = document.getElementById("kpiHazardRiskSub");
    const c3Tag = document.getElementById("kpiHazardRiskTag");
    if (kpi.primary_hazard_risk) {
      const h = kpi.primary_hazard_risk;
      if (c3Val) c3Val.innerHTML = `${h.risk_pct}% <span class="kpi-unit text-red">${h.hazard_title}</span>`;
      if (c3Sub) c3Sub.textContent = h.formation_zone || "Tipam Sandstone (2,400 - 2,850m)";
      if (c3Tag) c3Tag.textContent = h.mitigation_requirement || "LCM Required";
    }

    // Card 4: Average Time & Cost to TD
    const c4Val = document.getElementById("kpiTimeCostVal");
    const c4Sub = document.getElementById("kpiTimeCostSub");
    const c4Tag = document.getElementById("kpiTimeCostTag");
    if (kpi.average_time_cost_to_td) {
      const t = kpi.average_time_cost_to_td;
      if (c4Val) c4Val.innerHTML = `${t.days_to_td} <span class="kpi-unit">Days (${t.cost_inr})</span>`;
      if (c4Sub) c4Sub.textContent = t.benchmark_note || "Avg Offset AFE Benchmark";
      if (c4Tag) c4Tag.textContent = t.savings_note || "-0.36 Cost Savings";
    }
  }

  // Fallback Data Generator in Case Backend is Temporarily Unreachable
  function createFallbackGisData(wellId, radiusKm, offsetWellId) {
    const target = {
      well_id: wellId || "OIL-AS-NHRK-104",
      well_name: "OIL-AS-NHRK-104 (TARGET)",
      field: "Nahorkatiya Field",
      basin: "Nahorkatiya #14",
      spud_date: "12-Mar-2021",
      tvd_depth: 3842,
      rop_current: 14.8,
      target_horizon: "Barail Sandstone (Upper Eocene)",
      status: "ACTIVE DRILLING",
      latitude: 27.3078,
      longitude: 95.3456,
      utm_zone: "UTM ZONE 46N (WGS84)",
      coordinates_dms: { lat: "27°18'28.4\" N", lon: "95°20'44.1\" E" }
    };

    const offsets = [
      {
        well_id: "NHRK-98",
        field: "Nahorkatiya Field",
        status: "Completed",
        status_type: "completed",
        latitude: 27.3238,
        longitude: 95.3636,
        distance_km: 2.4,
        bearing: "North-East",
        spud_date: "15-Mar-2018",
        comp_date: "28-Aug-2018",
        days_to_td: 165,
        tvd_md: "3,842 / 4,100 m",
        mud_wt: "1.32 sg",
        rop_avg: "14.8 m/hr",
        bht: "128 °C",
        total_cuttings: "2.4 m³/m",
        archive_ref: "NHRK-98-COMP-2019",
        formation_tops: [
          { formation: "Barail Sandstone", top_m: "2,850 m", notes: "Interbedded carbonaceous shale & sand" },
          { formation: "Tipam Sandstone", top_m: "1,487 m", notes: "Fine-medium sandstone sequence" },
          { formation: "Girujan Clay", top_m: "1,103 m", notes: "Argillaceous sandstone & clay" }
        ],
        drilling_curve: [
          { day: 0, md: 0, tvd: 0 },
          { day: 20, md: 750, tvd: 750 },
          { day: 35, md: 1200, tvd: 1200 },
          { day: 40, md: 1200, tvd: 1200 },
          { day: 65, md: 2150, tvd: 2120 },
          { day: 84, md: 3400, tvd: 3320 },
          { day: 88, md: 3400, tvd: 3320 },
          { day: 125, md: 3820, tvd: 3680 },
          { day: 165, md: 4100, tvd: 3842 }
        ],
        npt_events: [
          { label: "NPT: Stuck Pipe (Day 84-88 @ 3,400m)", color: "#ef4444", depth: 3400, day: 84 },
          { label: "Loss: Mud Lost / 550b (Day 35-39 @ 1,200m)", color: "#f59e0b", depth: 1200, day: 35 }
        ]
      },
      {
        well_id: "NHRK-76",
        field: "Nahorkatiya Field",
        status: "Producing",
        status_type: "producing",
        latitude: 27.2858,
        longitude: 95.3606,
        distance_km: 3.1,
        bearing: "South-East",
        spud_date: "08-Jan-2017",
        comp_date: "14-Jun-2017",
        days_to_td: 158,
        tvd_md: "3,790 / 3,980 m",
        mud_wt: "1.28 sg",
        rop_avg: "16.2 m/hr",
        bht: "122 °C",
        total_cuttings: "2.2 m³/m",
        archive_ref: "NHRK-76-COMP-2017",
        formation_tops: [
          { formation: "Barail Sandstone", top_m: "2,820 m", notes: "Gas cap with strong pressure support" },
          { formation: "Tipam Sandstone", top_m: "1,450 m", notes: "Uniform quartz sandstone" },
          { formation: "Girujan Clay", top_m: "1,080 m", notes: "Overburden protective clay" }
        ],
        drilling_curve: [],
        npt_events: []
      },
      {
        well_id: "NHRK-85",
        field: "Nahorkatiya Field",
        status: "Producing",
        status_type: "producing",
        latitude: 27.3358,
        longitude: 95.3136,
        distance_km: 4.8,
        bearing: "North-West",
        spud_date: "14-Feb-2019",
        comp_date: "19-Jul-2019",
        days_to_td: 155,
        tvd_md: "3,810 / 4,050 m",
        mud_wt: "1.30 sg",
        rop_avg: "15.4 m/hr",
        bht: "125 °C",
        total_cuttings: "2.3 m³/m",
        archive_ref: "NHRK-85-COMP-2019",
        formation_tops: [],
        drilling_curve: [],
        npt_events: []
      },
      {
        well_id: "NHRK-67",
        field: "Nahorkatiya Field",
        status: "Shut-in",
        status_type: "shutin",
        latitude: 27.2728,
        longitude: 95.3206,
        distance_km: 5.2,
        bearing: "South-West",
        spud_date: "10-Nov-2015",
        comp_date: "22-May-2016",
        days_to_td: 194,
        tvd_md: "3,870 / 4,150 m",
        mud_wt: "1.35 sg",
        rop_avg: "12.8 m/hr",
        bht: "131 °C",
        total_cuttings: "2.6 m³/m",
        archive_ref: "NHRK-67-COMP-2016",
        formation_tops: [],
        drilling_curve: [],
        npt_events: []
      }
    ];

    return {
      sync_status: {
        source: "Digboi Central Datahub",
        last_updated: "14:52:08 IST",
        connection: "Online",
        active_field: "Nahorkatiya Field",
        total_offsets: 14
      },
      target_well: target,
      offset_wells: offsets,
      selected_offset: offsets[0],
      kpi_summary: {
        offset_wells_in_radius: {
          total_count: 14,
          radius_km: radiusKm,
          producing: 8,
          completed: 4,
          shutin: 2,
          synced_pct: 100,
          label: `14 Wells in ${radiusKm} km`,
          subtext: "8 Producing • 4 Completed • 2 Shut-in"
        },
        historical_success_rate: {
          rate_pct: 94.6,
          fraction_reached_td: "13 / 14 reached TD",
          category: "Commercial Discovery",
          regional_delta: "+8.6% Regional"
        },
        primary_hazard_risk: {
          risk_pct: 30,
          hazard_title: "Lost Circulation Risk",
          formation_zone: "Tipam Sandstone (2,400 - 2,850m)",
          mitigation_requirement: "LCM Required"
        },
        average_time_cost_to_td: {
          days_to_td: 34.2,
          cost_inr: "₹10.42 Cr / Well",
          benchmark_note: "Avg Offset AFE Benchmark",
          savings_note: "-0.36 Cost Savings"
        }
      }
    };
  }

  // Export globally
  window.initMapEngine = initMapEngine;
  window.fetchGisData = fetchGisData;
})();
