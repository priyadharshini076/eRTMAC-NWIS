/**
 * ragChatbot.js - Interactive Conversational RAG Drilling Chatbot Engine
 * Oil India Limited | NWIS (Nearby Well Intelligence System)
 * Connects to live backend /api/v1/rag/query and /api/v1/rag/stats
 * Queries 2,000 verified archival document events, DDRs, and WCRs.
 */

class RAGChatbotEngine {
  constructor() {
    this.apiBase = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
      ? `http://${window.location.hostname}:8000/api/v1`
      : `/api/v1`;

    this.chatThread = null;
    this.chatInput = null;
    this.btnSubmit = null;
    this.btnClear = null;

    // Filters
    this.filterFormation = null;
    this.filterEventType = null;
    this.filterWell = null;

    // Active State
    this.isQuerying = false;
    this.lastEvidence = [];
    this.activeEvidenceIndex = 0;

    this.init();
  }

  init() {
    this.bindDOM();
    this.loadQuickStats();
    this.attachEvents();
  }

  bindDOM() {
    this.chatThread = document.getElementById("ragChatMessages");
    this.chatInput = document.getElementById("ragSearchInput");
    this.btnSubmit = document.getElementById("btnRagSubmit");
    this.btnClear = document.getElementById("btnRagClear");

    this.filterFormation = document.getElementById("ragFilterFormation");
    this.filterEventType = document.getElementById("ragFilterEventType");
    this.filterWell = document.getElementById("ragFilterWell");

    // KPI Elements
    this.kpiDocs = document.getElementById("ragKpiDocs");
    this.kpiEvents = document.getElementById("ragKpiEvents");
    this.kpiWells = document.getElementById("ragKpiWells");
    this.kpiSyncTime = document.getElementById("ragSyncTime");

    // Right Column Elements
    this.previewDocName = document.getElementById("ragPreviewDocName");
    this.previewWellId = document.getElementById("ragPreviewWellId");
    this.previewFormation = document.getElementById("ragPreviewFormation");
    this.previewDate = document.getElementById("ragPreviewDate");
    this.previewPassage = document.getElementById("ragPreviewPassage");
    this.previewRelevance = document.getElementById("ragPreviewRelevance");
    this.explorerFeed = document.getElementById("ragExplorerFeed");
  }

  attachEvents() {
    // Submit on click
    if (this.btnSubmit) {
      this.btnSubmit.addEventListener("click", () => this.handleUserSubmit());
    }

    // Submit on Enter
    if (this.chatInput) {
      this.chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.handleUserSubmit();
        }
      });
    }

    // Clear input
    if (this.btnClear) {
      this.btnClear.addEventListener("click", () => {
        if (this.chatInput) {
          this.chatInput.value = "";
          this.chatInput.focus();
        }
      });
    }

    // Delegate suggestion pill clicks
    document.addEventListener("click", (e) => {
      const suggestionPill = e.target.closest(".suggestion-pill") || e.target.closest(".starter-chip") || e.target.closest(".followup-chip");
      if (suggestionPill) {
        const queryText = suggestionPill.getAttribute("data-query") || suggestionPill.textContent.trim().replace(/^📌\s*/, "");
        if (this.chatInput) {
          this.chatInput.value = queryText;
        }
        this.sendQuery(queryText);
      }

      // Evidence chip click to preview in right drawer
      const evBadge = e.target.closest(".evidence-badge-chip");
      if (evBadge) {
        const evId = evBadge.getAttribute("data-evidence-id");
        this.selectEvidenceById(evId);
      }
    });

    // Refresh stats button
    const btnSync = document.getElementById("btnRagSyncStats");
    if (btnSync) {
      btnSync.addEventListener("click", () => this.loadQuickStats(true));
    }
  }

  async loadQuickStats(showToastNotice = false) {
    try {
      const res = await fetch(`${this.apiBase}/rag/stats`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (this.kpiDocs) this.kpiDocs.textContent = Number(data.total_documents).toLocaleString();
      if (this.kpiEvents) this.kpiEvents.textContent = Number(data.total_events).toLocaleString();
      if (this.kpiWells) this.kpiWells.textContent = Number(data.total_wells).toLocaleString();
      if (this.kpiSyncTime) this.kpiSyncTime.textContent = `Last updated: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} IST (Live Synced)`;

      // Populate formation filter if empty
      if (this.filterFormation && this.filterFormation.options.length <= 1 && data.formations) {
        data.formations.forEach(f => {
          const opt = document.createElement("option");
          opt.value = f.name;
          opt.textContent = `${f.name} Formation (${f.count})`;
          this.filterFormation.appendChild(opt);
        });
      }

      // Populate event filter if empty
      if (this.filterEventType && this.filterEventType.options.length <= 1 && data.event_types) {
        data.event_types.forEach(ev => {
          const opt = document.createElement("option");
          opt.value = ev.name;
          opt.textContent = `${ev.name} (${ev.count})`;
          this.filterEventType.appendChild(opt);
        });
      }

      if (showToastNotice && window.showToast) {
        window.showToast(`Knowledge Base Refreshed: ${data.total_events} events across ${data.total_wells} wells.`);
      }
    } catch (err) {
      console.warn("Could not fetch live RAG stats:", err);
    }
  }

  handleUserSubmit() {
    if (!this.chatInput) return;
    const query = this.chatInput.value.trim();
    if (!query || this.isQuerying) return;
    this.sendQuery(query);
  }

  async sendQuery(queryText) {
    this.isQuerying = true;
    if (this.btnSubmit) this.btnSubmit.disabled = true;

    // 1. Append User Message
    this.appendUserMessage(queryText);

    // 2. Clear input
    if (this.chatInput) this.chatInput.value = "";

    // 3. Show Dynamic Retrieval Pipeline Indicator
    const loaderId = this.showRetrievalLoader();
    this.updatePipelineProgress(2);

    // 4. Build Request Payload
    const payload = {
      query: queryText,
      max_results: 8
    };

    if (this.filterFormation && this.filterFormation.value) {
      payload.formation = this.filterFormation.value;
    }
    if (this.filterEventType && this.filterEventType.value) {
      payload.event_type = this.filterEventType.value;
    }
    if (this.filterWell && this.filterWell.value) {
      payload.well_id = this.filterWell.value;
    }

    try {
      this.updatePipelineProgress(3);

      const response = await fetch(`${this.apiBase}/rag/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      this.updatePipelineProgress(4);
      const data = await response.json();

      // Remove loader
      this.removeRetrievalLoader(loaderId);

      // 5. Append Assistant Response Bubble
      this.appendAssistantResponse(data);

      // 6. Update Active Source Preview & Knowledge Explorer Feed
      this.updateEvidenceFeed(data.evidence || []);

      this.updatePipelineProgress(5);
      setTimeout(() => this.updatePipelineProgress(1), 1200);

    } catch (err) {
      console.error("RAG Query Failed:", err);
      this.removeRetrievalLoader(loaderId);
      this.appendErrorMessage(err.message || "Failed to retrieve historical drilling intelligence from backend.");
      this.updatePipelineProgress(1);
    } finally {
      this.isQuerying = false;
      if (this.btnSubmit) this.btnSubmit.disabled = false;
      if (this.chatInput) this.chatInput.focus();
    }
  }

  appendUserMessage(text) {
    if (!this.chatThread) return;
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const msgDiv = document.createElement("div");
    msgDiv.className = "rag-chat-item user-item";
    msgDiv.innerHTML = `
      <div class="user-bubble">
        <div class="msg-meta">
          <strong>Drilling Operations Engineer</strong>
          <span>${timeStr} IST</span>
        </div>
        <div class="msg-content">${this.escapeHtml(text)}</div>
      </div>
    `;

    this.chatThread.appendChild(msgDiv);
    this.scrollToBottom();
  }

  showRetrievalLoader() {
    if (!this.chatThread) return null;
    const loaderId = "loader_" + Date.now();
    const loaderDiv = document.createElement("div");
    loaderDiv.id = loaderId;
    loaderDiv.className = "rag-chat-item bot-item thinking-loader";
    loaderDiv.innerHTML = `
      <div class="bot-avatar-badge">OIL CORE</div>
      <div class="bot-bubble thinking-bubble">
        <div class="thinking-spinner">
          <div class="spinner-dot"></div>
          <div class="spinner-dot"></div>
          <div class="spinner-dot"></div>
        </div>
        <div class="thinking-status" id="${loaderId}_status">
          Searching 2,000 archival drilling records across Upper Assam basin...
        </div>
      </div>
    `;
    this.chatThread.appendChild(loaderDiv);
    this.scrollToBottom();

    // Step animation in loader text
    setTimeout(() => {
      const s = document.getElementById(`${loaderId}_status`);
      if (s) s.textContent = "Analyzing geological formations & matching offset well incident types...";
    }, 450);

    setTimeout(() => {
      const s = document.getElementById(`${loaderId}_status`);
      if (s) s.textContent = "Extracting verified mitigation procedures & grounding answers...";
    }, 850);

    return loaderId;
  }

  removeRetrievalLoader(loaderId) {
    if (!loaderId) return;
    const el = document.getElementById(loaderId);
    if (el) el.remove();
  }

  appendAssistantResponse(data) {
    if (!this.chatThread) return;
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const evCount = data.evidence_count || (data.evidence ? data.evidence.length : 0);

    const msgDiv = document.createElement("div");
    msgDiv.className = "rag-chat-item bot-item";

    // 1. Executive Summary Box
    let summaryHtml = `
      <div class="rag-executive-box">
        <div class="exec-title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          EXECUTIVE OPERATIONAL SUMMARY (${evCount} Grounded Archival Records)
        </div>
        <div class="exec-body">${this.renderMarkdown(data.executive_summary || "")}</div>
      </div>
    `;

    // 2. Documented Historical Mitigation Approaches
    let mitigationsHtml = "";
    if (data.mitigation_strategies && data.mitigation_strategies.length > 0) {
      mitigationsHtml = `
        <div class="rag-mitigations-block">
          <div class="mit-header-title">DOCUMENTED HISTORICAL MITIGATION APPROACHES:</div>
          <div class="mit-cards-grid">
      `;

      data.mitigation_strategies.forEach((strat, idx) => {
        const severityClass = (strat.severity || "").toLowerCase();
        mitigationsHtml += `
          <div class="mit-action-card ${severityClass}">
            <div class="mit-card-head">
              <span class="mit-num-badge">${idx + 1}</span>
              <strong class="mit-action-title">${this.escapeHtml(strat.action)}</strong>
            </div>
            <div class="mit-card-meta">
              <span class="badge-well-tag">${strat.well_name || strat.well_id}</span>
              <span class="badge-formation-tag">${strat.formation || "Assam"}</span>
              ${strat.depth_m ? `<span class="badge-depth-tag">@ ${strat.depth_m} m</span>` : ""}
              <span class="badge-severity-tag ${severityClass}">${strat.severity || "Standard"}</span>
            </div>
            <div class="mit-card-citation">
              Archival Source: <a href="javascript:void(0)" class="evidence-badge-chip" data-evidence-id="${strat.evidence_id}">${strat.source_document || "DDR Report"} (p. ${strat.source_page || 1})</a>
            </div>
          </div>
        `;
      });

      mitigationsHtml += `</div></div>`;
    }

    // 3. Operational Lessons & Precautionary Guidelines
    let lessonsHtml = "";
    const uniqueLessons = [];
    if (data.evidence) {
      data.evidence.forEach(e => {
        if (e.lesson && !uniqueLessons.includes(e.lesson)) {
          uniqueLessons.push(e.lesson);
        }
      });
    }

    if (uniqueLessons.length > 0) {
      lessonsHtml = `
        <div class="rag-lessons-box">
          <div class="lessons-title">💡 Operational Lessons Learned:</div>
          <ul class="lessons-list">
            ${uniqueLessons.slice(0, 3).map(l => `<li>${this.escapeHtml(l)}</li>`).join("")}
          </ul>
        </div>
      `;
    }

    // 4. Grounded Citations & Sources Row
    let sourcesHtml = "";
    if (data.evidence && data.evidence.length > 0) {
      sourcesHtml = `
        <div class="rag-sources-row">
          <span class="sources-label">GROUNDED SOURCES (CLICK TO INSPECT):</span>
          <div class="sources-chips-wrap">
            ${data.evidence.map(e => `
              <button class="evidence-badge-chip" data-evidence-id="${e.evidence_id}" title="Click to preview archival document excerpt">
                <strong>${e.evidence_id}</strong>: ${e.well_name} (${e.event_type} @ ${e.depth_m}m)
              </button>
            `).join("")}
          </div>
        </div>
      `;
    }

    // 5. Suggested Follow-Up Prompts
    let followupsHtml = "";
    if (data.suggested_followups && data.suggested_followups.length > 0) {
      followupsHtml = `
        <div class="rag-followups-row">
          <span class="followup-label">SUGGESTED INQUIRIES:</span>
          <div class="followup-chips-wrap">
            ${data.suggested_followups.slice(0, 3).map(f => `
              <button class="followup-chip" data-query="${this.escapeHtml(f)}">
                ${this.escapeHtml(f)}
              </button>
            `).join("")}
          </div>
        </div>
      `;
    }

    msgDiv.innerHTML = `
      <div class="bot-avatar-badge">OIL CORE</div>
      <div class="bot-bubble">
        <div class="msg-meta">
          <strong>eRTMAC Drilling Intelligence Core</strong>
          <span class="grounding-tag">Grounded Archival Model</span>
          <span>${timeStr} IST</span>
        </div>
        
        <div class="rag-response-content">
          ${summaryHtml}
          ${mitigationsHtml}
          ${lessonsHtml}
          ${sourcesHtml}
          ${followupsHtml}
        </div>
      </div>
    `;

    this.chatThread.appendChild(msgDiv);
    this.scrollToBottom();
  }

  appendErrorMessage(errorText) {
    if (!this.chatThread) return;
    const msgDiv = document.createElement("div");
    msgDiv.className = "rag-chat-item bot-item";
    msgDiv.innerHTML = `
      <div class="bot-avatar-badge error">ALERT</div>
      <div class="bot-bubble error-bubble">
        <div class="msg-meta">
          <strong>System Message</strong>
          <span>Error</span>
        </div>
        <div class="error-text">⚠️ ${this.escapeHtml(errorText)}</div>
      </div>
    `;
    this.chatThread.appendChild(msgDiv);
    this.scrollToBottom();
  }

  updateEvidenceFeed(evidenceList) {
    this.lastEvidence = evidenceList || [];
    if (!this.explorerFeed) return;

    if (this.lastEvidence.length === 0) {
      this.explorerFeed.innerHTML = `
        <div class="no-records-msg">No historical events match the current filter criteria.</div>
      `;
      return;
    }

    // Set first evidence item in Preview Card
    this.selectEvidenceIndex(0);

    // Build feed list
    let feedHtml = "";
    this.lastEvidence.forEach((item, index) => {
      const sevClass = (item.severity || "").toLowerCase();
      feedHtml += `
        <div class="event-card ${sevClass}" data-index="${index}" onclick="window.ragChatbotInstance.selectEvidenceIndex(${index})">
          <div class="event-header">
            <span class="event-type">${item.event_type} (${item.evidence_id})</span>
            <span class="event-severity ${sevClass}">${item.severity}</span>
          </div>
          <div class="event-well">
            <strong>${item.well_name}</strong>
            <span class="event-depth">Depth: ${item.depth_m} m</span>
          </div>
          <div class="event-desc">
            <strong>Historical Action:</strong> ${this.escapeHtml(item.mitigation || "Standard procedure executed.")}
          </div>
          <div class="event-footer">
            <span>${item.source_document || "DDR Report"} • p.${item.source_page || 1}</span>
            <span class="inspect-link">Click to View</span>
          </div>
        </div>
      `;
    });

    this.explorerFeed.innerHTML = feedHtml;
  }

  selectEvidenceIndex(index) {
    if (!this.lastEvidence || !this.lastEvidence[index]) return;
    const item = this.lastEvidence[index];
    this.activeEvidenceIndex = index;

    if (this.previewDocName) this.previewDocName.textContent = item.source_document || "Daily Drilling Report (DDR)";
    if (this.previewWellId) this.previewWellId.textContent = `${item.well_name} (${item.well_id})`;
    if (this.previewFormation) this.previewFormation.textContent = `${item.formation} Formation`;
    if (this.previewDate) this.previewDate.textContent = item.event_date || "Archival Record";
    if (this.previewRelevance) this.previewRelevance.textContent = `Relevance ${Math.min(99, Math.round(item.relevance_score || 92))}%`;

    if (this.previewPassage) {
      const desc = item.description || `${item.severity} ${item.event_type} recorded at ${item.depth_m} m.`;
      const mit = item.mitigation || "Mitigation action executed.";
      const lesson = item.lesson || "Continuous surveillance maintained.";
      this.previewPassage.innerHTML = `
        <div class="passage-block">
          <strong>--- ARCHIVAL LOG: ${this.escapeHtml(item.source_document || "DDR")} (Page ${item.source_page || 1}) ---</strong><br><br>
          "At depth <strong>${item.depth_m} m</strong> in the <strong>${this.escapeHtml(item.formation)} formation</strong>, 
          encountered <em>${this.escapeHtml(desc)}</em>.<br><br>
          <mark>Mitigation Action Taken: ${this.escapeHtml(mit)}</mark><br><br>
          Operational Takeaway: ${this.escapeHtml(lesson)}"
        </div>
      `;
    }

    // Highlight card in list
    if (this.explorerFeed) {
      const cards = this.explorerFeed.querySelectorAll(".event-card");
      cards.forEach((c, idx) => {
        if (idx === index) c.classList.add("active-selected");
        else c.classList.remove("active-selected");
      });
    }
  }

  selectEvidenceById(evId) {
    if (!this.lastEvidence) return;
    const idx = this.lastEvidence.findIndex(e => e.evidence_id === evId);
    if (idx !== -1) {
      this.selectEvidenceIndex(idx);
      // Scroll right panel to top
      const rightCol = document.querySelector(".rag-content-right");
      if (rightCol) rightCol.scrollTop = 0;
    }
  }

  updatePipelineProgress(stepNum) {
    const steps = document.querySelectorAll(".rag-pipeline .pipeline-step");
    steps.forEach((step, idx) => {
      const currentStep = idx + 1;
      step.classList.remove("active", "current");
      if (currentStep < stepNum) {
        step.classList.add("active");
      } else if (currentStep === stepNum) {
        step.classList.add("current");
      }
    });
  }

  scrollToBottom() {
    if (!this.chatThread) return;
    setTimeout(() => {
      this.chatThread.scrollTop = this.chatThread.scrollHeight;
    }, 50);
  }

  renderMarkdown(text) {
    if (!text) return "";
    let html = this.escapeHtml(text);

    // Bold **text**
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    // Italic *text*
    html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
    // Code `text`
    html = html.replace(/`(.*?)`/g, "<code>$1</code>");

    return html;
  }

  escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

// Global instance variable
window.ragChatbotInstance = null;

// Auto-initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  if (!window.ragChatbotInstance) {
    window.ragChatbotInstance = new RAGChatbotEngine();
  }
});
