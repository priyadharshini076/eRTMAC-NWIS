import os
import re

html_path = r'c:\Users\priya\SIH\eRTMAC-NWIS\frontend\index.html'

with open(html_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add CSS link
css_link = '  <link rel="stylesheet" href="css/rag-bot.css">\n'
if css_link not in content:
    content = content.replace('  <link rel="stylesheet" href="css/style.css">', '  <link rel="stylesheet" href="css/style.css">\n' + css_link)

# Add nav item
nav_item = """
          <!-- RAG Bot Item -->
          <a href="#ragbot" class="nav-item" id="navRagBot" title="RAG Bot">
            <div class="nav-item-left">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 14.93V17a1 1 0 0 1-2 0v-.07A8 8 0 0 1 4.07 11H5a1 1 0 0 1 0-2h-.93A8 8 0 0 1 11 4.07V5a1 1 0 0 1 2 0v-.93A8 8 0 0 1 19.93 9H19a1 1 0 0 1 0 2h.93A8 8 0 0 1 13 16.93z"/>
              </svg>
              <span>RAG Bot</span>
            </div>
          </a>
"""
if 'id="navRagBot"' not in content:
    content = content.replace('id="navCorrelation" title="Multi-Well Stratigraphic &amp; Hazard Correlation">', 'id="navCorrelation" title="Multi-Well Stratigraphic &amp; Hazard Correlation">')
    # Let's just insert it after the navCorrelation block
    correlation_end = content.find('</a>', content.find('id="navCorrelation"')) + 4
    content = content[:correlation_end] + nav_item + content[correlation_end:]

# Add page structure
page_html = """
      <!-- =======================================================
           PAGE: RAG BOT (Knowledge Repository)
           ======================================================= -->
      <section class="page-view hidden" id="pageRagBot">
        <div class="rag-container">
          <!-- Header -->
          <div class="rag-header">
            <div class="rag-header-left">
              <div class="rag-badge">GEOLOGICAL & DRILLING INFORMATION CORE (GDIC)</div>
              <h2>Drilling Knowledge Repository</h2>
              <p>Search historical drilling events, lessons learned, operational challenges, and mitigation measures grounded across upper Assam basin borehole datasets.</p>
            </div>
            <div class="rag-header-right">
              <div class="sync-status">Knowledge Base Synced <br><span>Last updated: 30 Sep 2026, 11:30 IST</span></div>
              <button class="rag-btn outline"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> Knowledge Sources <span class="badge">18 DBs</span></button>
            </div>
          </div>

          <!-- KPI Cards -->
          <div class="rag-kpi-grid">
            <div class="rag-card stat-card">
              <div class="stat-title">KNOWLEDGE DOCUMENTS</div>
              <div class="stat-value">2,480 <span class="stat-sub">Verified Records</span></div>
              <div class="stat-footer">DDR, SQWR, Well Summaries <span class="trend">+12 this wk</span></div>
            </div>
            <div class="rag-card stat-card green">
              <div class="stat-title">DRILLING EVENTS</div>
              <div class="stat-value">8,642 <span class="stat-sub">Incidents & Ops</span></div>
              <div class="stat-footer">Categorized & Vector Indexed <span class="trend">100% Embedded</span></div>
            </div>
            <div class="rag-card stat-card yellow">
              <div class="stat-title">LESSONS LEARNED</div>
              <div class="stat-value">426 <span class="stat-sub">Field Syntheses</span></div>
              <div class="stat-footer">Peer-reviewed Field entries <span class="trend">Validated</span></div>
            </div>
            <div class="rag-card stat-card blue">
              <div class="stat-title">INDEXED WELLS</div>
              <div class="stat-value">184 <span class="stat-sub">Active & Historic</span></div>
              <div class="stat-footer">Assam-Arakan Basin & Offsets <span class="trend">Digboi / Moran</span></div>
            </div>
          </div>

          <!-- RAG Pipeline -->
          <div class="rag-pipeline">
            <div class="pipeline-label">RAG TRACK PIPELINE:</div>
            <div class="pipeline-step active">1. Query Input</div>
            <div class="pipeline-arrow">></div>
            <div class="pipeline-step active">2. Dense & BM25 Retrieval</div>
            <div class="pipeline-arrow">></div>
            <div class="pipeline-step current">3. Relevant Docs (18 hits)</div>
            <div class="pipeline-arrow">></div>
            <div class="pipeline-step">4. Event Extraction</div>
            <div class="pipeline-arrow">></div>
            <div class="pipeline-step">5. Context Synthesis</div>
          </div>

          <!-- Search Section -->
          <div class="rag-search-section">
            <div class="search-top">
              <div class="search-engine-badge">NEURAL QUERY ENGINE V6.2</div>
              <div class="search-engine-sub">Hybrid Dense Vector (768-D) + BM25 Precision</div>
              <div class="search-ready">184 Boreholes Ready | Assam-Arakan Index: 100%</div>
            </div>
            <div class="search-bar">
              <div class="search-context-tag">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                CONTEXT<br><strong>Assam Basin</strong>
              </div>
              <input type="text" class="search-input" value="What mitigation measures were used for mud losses in the Tipam formation?">
              <button class="search-clear">x</button>
              <button class="search-submit">Query Knowledge Base <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg></button>
            </div>
            <div class="search-filters">
              <span class="filter-label">MODE:</span>
              <span class="filter-pill active">Semantic + Hybrid BM25</span>
              <span class="filter-pill">Formation: Tipam / Barail</span>
              <span class="filter-pill">2018-2023 DDRs</span>
              <span class="filter-pill">DGH Validated Only</span>
              <span class="filter-latency">Avg Latency: 142ms</span>
            </div>
            <div class="search-suggestions">
              <span class="suggestion-label">FREQUENT INQUIRIES:</span>
              <span class="suggestion-pill warning">Stuck-pipe events in Barail</span>
              <span class="suggestion-pill info">Mud-loss mitigation measures</span>
              <span class="suggestion-pill">Wells with similar challenges</span>
              <span class="suggestion-pill">Lessons from high NPT wells</span>
            </div>
          </div>

          <!-- Main Content Split -->
          <div class="rag-main-split">
            <!-- Left Column -->
            <div class="rag-content-left">
              <div class="content-header">
                <h3>RAG Analysis & Synthesis</h3>
                <div class="subtitle">Verified deterministic retrieval over Digboi Basin archival corpus</div>
                <div class="header-badge">Generated from 18 retrieved records • Grounded in Well Data</div>
              </div>
              
              <div class="chat-bubble">
                <div class="chat-meta"><strong>Rakesh Sharma</strong> (Dr. Supr. / Drilling Eng.) <span>Today, 14:14 IST</span></div>
                <div class="chat-text">"What mitigation measures were previously used for mud losses around 3,500 m in the Tipam formation?"</div>
              </div>

              <div class="tabs-row">
                <div class="tab active">HISTORICAL EVIDENCE</div>
                <div class="tab">Retrieved Records: 18</div>
                <div class="tab">AI Synthesis</div>
              </div>

              <div class="executive-finding">
                <div class="finding-title">EXECUTIVE FINDING</div>
                <div class="finding-text">
                  Historical records show repeated mud-loss events between approximately <strong>3,400-3,700 m</strong>, primarily associated with the <strong>Tipam sandstone formation</strong> across Upper Assam basin wells. Losses are attributed to low pore-pressure sand stringers compounded by natural macro-fracturing near the regional thrust fault zones.
                </div>
              </div>

              <div class="approaches-section">
                <div class="approaches-title">3 DOCUMENTED HISTORICAL MITIGATION APPROACHES:</div>
                
                <div class="approach-card">
                  <div class="approach-header">
                    <span class="number badge-blue">1</span>
                    <h4>Mud Weight Window Adjustment</h4>
                    <span class="well-tag blue">Well NHRK-98 (B04)</span>
                  </div>
                  <p>Adjusted mud weight within the historical operating window: reduced from <strong>1.32 SG to 1.25 SG</strong> to avoid exceeding the formation fracture gradient (1.38 SG equivalent) while maintaining 25 psi hydrostatic overbalance for gas safety.</p>
                </div>

                <div class="approach-card">
                  <div class="approach-header">
                    <span class="number badge-green">2</span>
                    <h4>Engineered LCM Pill Deployment</h4>
                    <span class="well-tag green">Well NHRK-76 (B04)</span>
                  </div>
                  <p>Loss-circulation material (<strong>LCM pills: 35 ppb medium calcium carbonate & fibrous cellulosic blend</strong>) introduced during active dynamic losses, followed by a controlled 2-hour soak before resuming rotary agitation.</p>
                </div>

                <div class="approach-card">
                  <div class="approach-header">
                    <span class="number badge-yellow">3</span>
                    <h4>Hydraulics & ECD Throttling</h4>
                    <span class="well-tag yellow">Tipam M-I 104</span>
                  </div>
                  <p>Pumping parameters and Equivalent Circulating Density (ECD) systematically managed by lowering mud pump discharge from <strong>420 GPM to 340 GPM</strong>, diminishing annular pressure surges across thief beds.</p>
                </div>

                <div class="corroboration-box">
                  <div class="corr-text">Corroborated across 4 historical offset boreholes:</div>
                  <div class="corr-tags">
                    <span class="corr-tag">NHRK-98</span>
                    <span class="corr-tag">NHRK-76</span>
                    <span class="corr-tag">NHRK-65</span>
                    <span class="corr-tag">NHRK-X7</span>
                  </div>
                  <div class="corr-badge">High Correlation [R² 0.81]</div>
                </div>

                <div class="reference-sources">
                  <div class="ref-title">RETRIEVED REFERENCE SOURCES (CLICK TO PREVIEW DOCUMENT):</div>
                  <div class="ref-tags">
                    <span class="ref-tag blue">Well NHRK-98 - DDR #44</span>
                    <span class="ref-tag green">Well NHRK-76 - DDR #61</span>
                    <span class="ref-tag yellow">Tipam Formation - Lessons FLL-108</span>
                    <span class="ref-tag purple">Operational Event Record #ML-334</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Right Column -->
            <div class="rag-content-right">
              <div class="preview-card">
                <div class="preview-header">
                  <h3>Active Source Preview</h3>
                  <span class="relevance-badge">Relevance 94%</span>
                </div>
                <div class="preview-meta">
                  <div class="meta-col">
                    <div class="meta-label">Document:</div>
                    <div class="meta-val">Daily Drilling Report (DDR) #61</div>
                    <div class="meta-label">Target Formation:</div>
                    <div class="meta-val">Tipam Sandstone</div>
                  </div>
                  <div class="meta-col">
                    <div class="meta-label">Well Identifier:</div>
                    <div class="meta-val">OIL-AS-NHRK-98</div>
                    <div class="meta-label">Archival Date:</div>
                    <div class="meta-val">16 Aug 2021</div>
                  </div>
                </div>
                <div class="extracted-passage">
                  <div class="passage-title">EXTRACTED GROUNDING PASSAGE (BM25 + SEMANTIC VECTOR RANK #1)</div>
                  <div class="passage-text">
                    --- LOG SNIPPET: NHRK-98_DDR_61.PDF (PAGE 2, SEC 4.1) ---<br><br>
                    "At 3,420 m TVD, static losses observed at 45 bbl/hr while penetrating fractured Tipam interval. Operations suspended rotary drilling. <mark>Mixed and pumped 40 bbl high-viscosity LCM pill (medium calcium carbonate @ 30 ppb + fibrous nut plug).</mark> Waited 2 hrs for soak. Resumed drilling with ECD lowered by 0.05 SG. Full returns regained without subsequent loss recurrence."
                  </div>
                </div>
                <button class="btn-full-doc">Open Full Document (PDF)</button>
              </div>

              <div class="explorer-card">
                <div class="explorer-header">
                  <h3>Knowledge Explorer</h3>
                  <span>18 Matches Filtered</span>
                </div>
                <div class="explorer-filters">
                  <select><option>Well: All (184)</option></select>
                  <select><option>Formation: Tipam</option></select>
                  <select><option>Event: Mud Loss</option></select>
                  <select><option>Year: 2018-2024</option></select>
                </div>

                <div class="event-card red">
                  <div class="event-header">
                    <span class="event-type">MUD LOSS EVENT</span>
                    <span class="event-npt">NPT: 11 hrs</span>
                  </div>
                  <div class="event-well">Well NHRK-98 <span class="event-depth">Depth: 3,420 m</span></div>
                  <div class="event-desc"><strong>Challenge:</strong> Severe dynamic mud loss while penetrating fractured Tipam interval.</div>
                  <div class="event-desc"><strong>Historical Mitigation:</strong> Loss-circulation material (30 ppb CaCO3 + fiber) with reduced flow rate.</div>
                  <div class="event-footer">DDR #61 • OIL-AS-NHRK-98 <a href="#">View Source</a></div>
                </div>

                <div class="event-card yellow">
                  <div class="event-header">
                    <span class="event-type">STUCK PIPE EVENT</span>
                    <span class="event-npt">NPT: 16 hrs</span>
                  </div>
                  <div class="event-well">Well NHRK-78 <span class="event-depth">Depth: 4,050 m</span></div>
                  <div class="event-desc"><strong>Challenge:</strong> Differential sticking during drilling in Barail shale-sand sequence.</div>
                  <div class="event-desc"><strong>Historical Mitigation:</strong> Back-off procedure, oil-based spotting fluid, and circulation optimization.</div>
                  <div class="event-footer">DDR #41 • OIL-AS-NHRK-78 <a href="#">View Source</a></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
"""

if 'id="pageRagBot"' not in content:
    content = content.replace('      <section class="page-view hidden" id="pageMap">', page_html + '\n      <section class="page-view hidden" id="pageMap">')

with open(html_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
