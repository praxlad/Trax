import { registerPlugin } from '../app.js';

registerPlugin('eisenhower', {
  name: 'Eisenhower Priority Matrix',
  description: 'Audits time spent on crisis vs. high-leverage growth. Adds Q1-Q4 priority tagging and interactive 2x2 matrix visualizers.',
  bootstrap(state, api) {
    let panelElement = null;
    let activeDetailQuadrant = 'q2'; // default selected quadrant details

    // Injects priority selector fields into retroactive modal and stopwatch inputs
    const injectPriorityInputs = () => {
      // 1. Live Stopwatch Input
      const liveGroup = document.querySelector('.live-tracker-card .segment-input-group');
      if (liveGroup && !document.getElementById('live-eisenhower-group')) {
        const eisenGroup = document.createElement('div');
        eisenGroup.className = 'form-group flex-1';
        eisenGroup.id = 'live-eisenhower-group';
        eisenGroup.innerHTML = `
          <label>Priority Quadrant</label>
          <select id="live-eisenhower-select" class="cyber-input" style="width: 100%">
            <option value="q2" selected>Q2: Strategic / Important</option>
            <option value="q1">Q1: Urgent & Important</option>
            <option value="q3">Q3: Urgent / Interruptions</option>
            <option value="q4">Q4: Non-Urgent / Leisure</option>
          </select>
        `;
        liveGroup.appendChild(eisenGroup);
      }

      // 2. Retroactive Modal Input
      const modalGroup = document.querySelector('#log-modal .segment-input-group');
      if (modalGroup && !document.getElementById('modal-eisenhower-group')) {
        const eisenGroup = document.createElement('div');
        eisenGroup.className = 'form-group flex-1';
        eisenGroup.id = 'modal-eisenhower-group';
        eisenGroup.innerHTML = `
          <label>Priority Quadrant</label>
          <select id="modal-eisenhower-select" class="cyber-input" style="width: 100%">
            <option value="q2" selected>Q2: Strategic / Important</option>
            <option value="q1">Q1: Urgent & Important</option>
            <option value="q3">Q3: Urgent / Interruptions</option>
            <option value="q4">Q4: Non-Urgent / Leisure</option>
          </select>
        `;
        modalGroup.appendChild(eisenGroup);
      }
    };

    const removePriorityInputs = () => {
      const liveGroup = document.getElementById('live-eisenhower-group');
      if (liveGroup) liveGroup.remove();
      const modalGroup = document.getElementById('modal-eisenhower-group');
      if (modalGroup) modalGroup.remove();
    };

    // Calculate time spent in each quadrant
    const calculateMatrixStats = () => {
      const dayLogs = state.ledger[state.date];
      const stats = { q1: 0, q2: 0, q3: 0, q4: 0, total: 0 };
      const details = { q1: [], q2: [], q3: [], q4: [] };

      if (!dayLogs) return { stats, details };

      // Multi-minute run compilation to summarize list cleanly
      let currentRun = null;
      
      const commitRun = () => {
        if (!currentRun) return;
        const duration = currentRun.end - currentRun.start + 1;
        details[currentRun.quad].push({
          segment: currentRun.segment,
          notes: currentRun.notes,
          categoryId: currentRun.catId,
          start: currentRun.start,
          end: currentRun.end,
          duration
        });
        currentRun = null;
      };

      for (let idx = 0; idx < 1440; idx++) {
        const entry = dayLogs[idx];
        if (entry) {
          stats.total++;
          const q = entry.quadrant || 'q4'; // Default to leisure/Q4 if unclassified
          stats[q]++;

          // Compile runs of identical entries for clean detail view
          const segmentName = entry.segment || '';
          const noteText = entry.notes || '';
          
          if (currentRun && currentRun.quad === q && currentRun.segment === segmentName && currentRun.notes === noteText) {
            currentRun.end = idx;
          } else {
            commitRun();
            currentRun = {
              quad: q,
              segment: segmentName,
              notes: noteText,
              catId: entry.categoryId,
              start: idx,
              end: idx
            };
          }
        } else {
          commitRun();
        }
      }
      commitRun();

      return { stats, details };
    };

    const render = () => {
      if (!panelElement) return;

      const { stats, details } = calculateMatrixStats();
      const q2Ratio = stats.total > 0 ? (stats.q2 / stats.total) * 100 : 0;
      
      // Select visual style based on rating
      let ratingClass = 'glow-red';
      let ratingLabel = 'Reactive';
      if (q2Ratio > 65) {
        ratingClass = 'glow-green';
        ratingLabel = 'Strategic Peak';
      } else if (q2Ratio > 35) {
        ratingClass = 'glow-amber';
        ratingLabel = 'Balanced';
      }

      let detailHtml = '';
      const selectedRunDetails = details[activeDetailQuadrant];
      
      if (selectedRunDetails.length === 0) {
        detailHtml = `
          <div style="font-size:0.7rem; color:var(--text-muted); text-align:center; padding:15px; border:1px dashed var(--border-color); border-radius:8px">
            No activities logged in ${activeDetailQuadrant.toUpperCase()} today.
          </div>
        `;
      } else {
        selectedRunDetails.forEach(run => {
          const cat = state.categories.find(c => c.id === run.categoryId);
          const icon = cat ? cat.icon : '📌';
          const formatTime = (minutes) => {
            const h = String(Math.floor(minutes / 60)).padStart(2, '0');
            const m = String(minutes % 60).padStart(2, '0');
            return `${h}:${m}`;
          };
          detailHtml += `
            <div class="quad-activity-item" style="background:rgba(255,255,255,0.01); border:1px solid var(--border-color); padding:8px 10px; border-radius:8px; display:flex; flex-direction:column; gap:4px">
              <div style="display:flex; justify-content:space-between; font-size:0.65rem; color:var(--text-secondary)">
                <span class="font-mono">${formatTime(run.start)} - ${formatTime(run.end + 1)}</span>
                <span class="font-mono" style="color: ${cat?.color || 'var(--text-muted)'}">${icon} ${run.duration}m</span>
              </div>
              <div style="font-size:0.72rem; font-weight:600; color:var(--text-primary)">
                ${run.segment || 'Generic Session'}
              </div>
              ${run.notes ? `<div style="font-size:0.65rem; color:var(--text-muted); font-style:italic">${run.notes}</div>` : ''}
            </div>
          `;
        });
      }

      panelElement.innerHTML = `
        <div class="panel-header">
          <h2>Eisenhower Matrix</h2>
          <p>Audit strategic growth vs. urgent crisis tasks.</p>
        </div>
        
        <div class="panel-content">
          <!-- Productivity Gauge -->
          <div class="eisen-peak-score glass-pill" style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; margin-bottom:16px">
            <div style="display:flex; flex-direction:column">
              <span style="font-size:0.65rem; color:var(--text-secondary)">Peak Focus Index (Q2)</span>
              <span class="font-mono ${ratingClass}" style="font-size:1.1rem; font-weight:800">${q2Ratio.toFixed(0)}%</span>
            </div>
            <div style="text-align:right">
              <span style="font-size:0.65rem; color:var(--text-secondary)">Focus Archetype</span>
              <div style="font-size:0.75rem; font-weight:700; color:var(--text-primary)">${ratingLabel}</div>
            </div>
          </div>

          <!-- 2x2 Priority Grid -->
          <div class="matrix-grid">
            <!-- Q1: Urgent & Important -->
            <div class="matrix-cell q1-cell ${activeDetailQuadrant === 'q1' ? 'active' : ''}" data-quad="q1">
              <div class="cell-num font-mono">Q1</div>
              <div class="cell-label">Do First</div>
              <div class="cell-desc">Urgent & Important</div>
              <div class="cell-value font-mono">${stats.q1}m</div>
            </div>
            
            <!-- Q2: Important Not Urgent -->
            <div class="matrix-cell q2-cell ${activeDetailQuadrant === 'q2' ? 'active' : ''}" data-quad="q2">
              <div class="cell-num font-mono">Q2</div>
              <div class="cell-label">Deep Focus</div>
              <div class="cell-desc">Strategic Growth</div>
              <div class="cell-value font-mono">${stats.q2}m</div>
            </div>
            
            <!-- Q3: Urgent Not Important -->
            <div class="matrix-cell q3-cell ${activeDetailQuadrant === 'q3' ? 'active' : ''}" data-quad="q3">
              <div class="cell-num font-mono">Q3</div>
              <div class="cell-label">Delegate</div>
              <div class="cell-desc">Interruptions</div>
              <div class="cell-value font-mono">${stats.q3}m</div>
            </div>
            
            <!-- Q4: Neither -->
            <div class="matrix-cell q4-cell ${activeDetailQuadrant === 'q4' ? 'active' : ''}" data-quad="q4">
              <div class="cell-num font-mono">Q4</div>
              <div class="cell-label">Eliminate</div>
              <div class="cell-desc">Leisure & Slacking</div>
              <div class="cell-value font-mono">${stats.q4}m</div>
            </div>
          </div>

          <!-- Selected Quadrant Auditing Logs -->
          <div class="quadrant-details-panel" style="margin-top:20px">
            <h4 style="font-family:var(--font-header); font-size:0.8rem; font-weight:700; color:var(--tod-color); margin-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.03); padding-bottom:4px">
              ${activeDetailQuadrant.toUpperCase()} Session Log Details
            </h4>
            <div class="quad-activities-list" style="display:flex; flex-direction:column; gap:8px">
              ${detailHtml}
            </div>
          </div>
        </div>
      `;

      // Bind Quadrant clicks inside matrix
      const cells = panelElement.querySelectorAll('.matrix-cell');
      cells.forEach(cell => {
        cell.addEventListener('click', () => {
          activeDetailQuadrant = cell.dataset.quad;
          render();
        });
      });
    };

    const injectStyles = () => {
      if (document.getElementById('eisenhower-plugin-styles')) return;
      const styles = document.createElement('style');
      styles.id = 'eisenhower-plugin-styles';
      styles.textContent = `
        .matrix-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr;
          gap: 8px;
          aspect-ratio: 1;
          width: 100%;
        }
        .matrix-cell {
          background: rgba(255, 255, 255, 0.015);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 10px;
          display: flex;
          flex-direction: column;
          cursor: pointer;
          position: relative;
          transition: all 0.2s ease;
        }
        .matrix-cell:hover {
          background: rgba(255, 255, 255, 0.03);
          border-color: var(--text-secondary);
        }
        .matrix-cell.active {
          background: rgba(255, 255, 255, 0.05);
        }
        .q1-cell.active { border-color: #f43f5e; box-shadow: 0 0 10px rgba(244, 63, 94, 0.15); }
        .q2-cell.active { border-color: #8b5cf6; box-shadow: 0 0 10px rgba(139, 92, 246, 0.15); }
        .q3-cell.active { border-color: #64748b; box-shadow: 0 0 10px rgba(100, 116, 139, 0.15); }
        .q4-cell.active { border-color: #10b981; box-shadow: 0 0 10px rgba(16, 185, 129, 0.15); }
        
        .cell-num {
          font-size: 0.65rem;
          color: var(--text-muted);
          position: absolute;
          top: 6px;
          right: 8px;
        }
        .cell-label {
          font-size: 0.75rem;
          font-weight: 700;
          color: var(--text-primary);
          margin-top: 4px;
        }
        .q1-cell .cell-label { color: #f43f5e; }
        .q2-cell .cell-label { color: #8b5cf6; }
        .q3-cell .cell-label { color: #94a3b8; }
        .q4-cell .cell-label { color: #10b981; }

        .cell-desc {
          font-size: 0.58rem;
          color: var(--text-muted);
          margin-top: 1px;
          line-height: 1.2;
        }
        .cell-value {
          margin-top: auto;
          font-size: 1.05rem;
          font-weight: 800;
          text-align: right;
          color: var(--text-primary);
        }
      `;
      document.head.appendChild(styles);
    };

    return {
      onInit() {
        panelElement = api.addSidebarTab('eisenhower', 'Priority Matrix', 'layout-grid', `<div></div>`);
        injectPriorityInputs();
        injectStyles();
        render();
      },
      onLedgerUpdate() {
        render();
      },
      onDestroy() {
        removePriorityInputs();
        api.removeSidebarTab('eisenhower');
        const styles = document.getElementById('eisenhower-plugin-styles');
        if (styles) styles.remove();
      }
    };
  }
});
