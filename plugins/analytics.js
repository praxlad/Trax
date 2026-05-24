import { registerPlugin } from '../app.js';

registerPlugin('analytics', {
  name: 'Visual Analytics',
  description: 'Renders completeness gauges, comparative 7-day trend barcode grids, and segment tag leaderboards.',
  bootstrap(state, api) {
    let container = null;
    
    // Calculates minutes count and percentages for each category
    const calculateStats = () => {
      const dayLogs = state.ledger[state.date];
      if (!dayLogs) return { totals: {}, totalLogged: 0, percentage: 0 };
      
      const totals = {};
      let totalLogged = 0;
      
      // Initialize categories
      state.categories.forEach(cat => {
        totals[cat.id] = { mins: 0, color: cat.color, name: cat.name, icon: cat.icon };
      });
      
      dayLogs.forEach(entry => {
        if (entry) {
          totalLogged++;
          if (totals[entry.categoryId]) {
            totals[entry.categoryId].mins++;
          } else {
            // Category might have been deleted, group as other
            if (!totals['other']) {
              totals['other'] = { mins: 0, color: '#64748b', name: 'Other / Deleted', icon: '❓' };
            }
            totals['other'].mins++;
          }
        }
      });
      
      const percentage = ((totalLogged / 1440) * 100).toFixed(1);
      
      return { totals, totalLogged, percentage };
    };

    // Calculates logged duration for each custom segment/project
    const calculateSegmentStats = () => {
      const dayLogs = state.ledger[state.date];
      if (!dayLogs) return [];
      
      const segments = {};
      dayLogs.forEach(entry => {
        if (entry && entry.segment) {
          const segName = entry.segment.trim();
          if (segName !== '') {
            if (!segments[segName]) {
              segments[segName] = { name: segName, mins: 0 };
            }
            segments[segName].mins++;
          }
        }
      });
      
      return Object.values(segments).sort((a, b) => b.mins - a.mins);
    };

    const render = () => {
      // 1. Render Landing Page Dashboard Components first
      renderLandingDashboardComponents();
      
      // 2. Render Sidebar tab panel if active
      renderSidebarPanel();
    };

    /**
     * Renders visual completeness rings, category bars, and 7 stacked trends barcodes
     */
    const renderLandingDashboardComponents = () => {
      const { totals, totalLogged, percentage } = calculateStats();
      
      // 1. Day Completeness Ring Gauge
      const landingRing = document.getElementById('landing-completeness-ring');
      const landingVal = document.getElementById('landing-gauge-val');
      if (landingRing && landingVal) {
        const radius = 42;
        const circumference = 2 * Math.PI * radius;
        const ratio = parseFloat(percentage) / 100;
        const strokeDashoffset = circumference * (1 - ratio);
        
        landingRing.style.strokeDasharray = `${circumference} ${circumference}`;
        landingRing.style.strokeDashoffset = strokeDashoffset;
        
        landingVal.textContent = `${Math.round(percentage)}%`;
      }
      
      // 2. Landing Category Bars (Top 3)
      const landingBars = document.getElementById('landing-category-bars');
      if (landingBars) {
        landingBars.innerHTML = '';
        const sortedCats = Object.values(totals).sort((a, b) => b.mins - a.mins).slice(0, 3);
        
        if (totalLogged === 0) {
          landingBars.innerHTML = `
            <div style="font-size: 0.65rem; color: var(--text-muted); text-align: center; padding-top: 15px">
              No logged hours today
            </div>
          `;
        } else {
          sortedCats.forEach(cat => {
            const totalRatio = (cat.mins / 1440) * 100;
            const barRow = document.createElement('div');
            barRow.className = 'breakdown-bar-row';
            barRow.innerHTML = `
              <div class="breakdown-bar-lbl">
                <span style="color: ${cat.color}; font-weight: 600">${cat.icon} ${cat.name.split(' ')[0]}</span>
                <span class="font-mono">${cat.mins}m</span>
              </div>
              <div class="breakdown-bar-track">
                <div class="breakdown-bar-fill" style="width: ${totalRatio}%; background-color: ${cat.color}"></div>
              </div>
            `;
            landingBars.appendChild(barRow);
          });
        }
      }

      // 3. Stacked 7-Day Comparative Barcodes
      const trendsStack = document.getElementById('trends-ribbons-stack-container');
      if (trendsStack) {
        trendsStack.innerHTML = '';
        
        // Collate past 7 dates
        const getPast7Dates = () => {
          const dates = [];
          for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            
            const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
            dates.push({ dateStr, label: weekday });
          }
          return dates;
        };
        
        const past7Days = getPast7Dates();
        past7Days.forEach(day => {
          const row = document.createElement('div');
          row.className = 'trend-ribbon-row';
          
          const dayLabel = document.createElement('div');
          dayLabel.className = 'trend-ribbon-day font-mono';
          dayLabel.textContent = day.label;
          row.appendChild(dayLabel);
          
          const barContainer = document.createElement('div');
          barContainer.className = 'trend-ribbon-bar';
          
          const dayLogs = state.ledger[day.dateStr];
          if (dayLogs) {
            let currentSpan = null;
            for (let idx = 0; idx < 1440; idx++) {
              const entry = dayLogs[idx];
              const catColor = entry ? (state.categories.find(c => c.id === entry.categoryId)?.color || '#64748b') : 'rgba(120, 120, 120, 0.03)';
              
              if (!currentSpan) {
                currentSpan = { color: catColor, width: 1 };
              } else if (currentSpan.color === catColor) {
                currentSpan.width++;
              } else {
                const spanEl = document.createElement('span');
                spanEl.style.flexGrow = currentSpan.width;
                spanEl.style.backgroundColor = currentSpan.color;
                barContainer.appendChild(spanEl);
                currentSpan = { color: catColor, width: 1 };
              }
            }
            if (currentSpan) {
              const spanEl = document.createElement('span');
              spanEl.style.flexGrow = currentSpan.width;
              spanEl.style.backgroundColor = currentSpan.color;
              barContainer.appendChild(spanEl);
            }
          } else {
            const placeholderSpan = document.createElement('span');
            placeholderSpan.style.flexGrow = 1440;
            placeholderSpan.style.backgroundColor = 'rgba(120, 120, 120, 0.03)';
            barContainer.appendChild(placeholderSpan);
          }
          
          row.appendChild(barContainer);
          trendsStack.appendChild(row);
        });
      }
    };

    /**
     * Renders detailed breakdown panel in the right sidebar
     */
    const renderSidebarPanel = () => {
      if (!container) return;
      
      const { totals, totalLogged, percentage } = calculateStats();
      const gapMins = 1440 - totalLogged;
      const segmentStats = calculateSegmentStats();
      
      let html = `
        <div class="analytics-wrapper">
          <!-- 1. Circular Progress Meter -->
          <div class="analytics-circle-container">
            <svg class="progress-ring" width="120" height="120">
              <circle class="progress-ring-bg" stroke="rgba(255, 255, 255, 0.05)" stroke-width="6" fill="transparent" r="48" cx="60" cy="60" />
              <circle id="analytics-ring" class="progress-ring-circle" stroke="var(--tod-color)" stroke-width="6" fill="transparent" r="48" cx="60" cy="60" />
            </svg>
            <div class="circle-inner-text">
              <span class="circle-val font-mono">${percentage}%</span>
              <span class="circle-label">Accounted</span>
            </div>
          </div>
          
          <!-- 2. Interactive Barcode Day Ribbon -->
          <div class="ribbon-title">
            <span>Barcode Timeline Ribbon</span>
            <span class="font-mono" style="font-size: 0.65rem; color: var(--text-secondary)">00:00 - 24:00</span>
          </div>
          <div class="barcode-ribbon-container">
            <div class="barcode-ribbon" id="barcode-ribbon-bar">
              <!-- Barcode timeline blocks -->
            </div>
          </div>

          <!-- 3. Category Stack Breakdown -->
          <div class="category-bars-list">
            <h4>Activity Distribution</h4>
      `;
      
      const sortedCats = Object.values(totals).sort((a, b) => b.mins - a.mins);
      sortedCats.forEach(cat => {
        const catRatio = totalLogged > 0 ? (cat.mins / totalLogged) * 100 : 0;
        const totalRatio = (cat.mins / 1440) * 100;
        
        html += `
          <div class="cat-bar-item">
            <div class="cat-bar-header">
              <span class="cat-bar-name" style="color: ${cat.color}">${cat.icon} ${cat.name}</span>
              <span class="cat-bar-val font-mono">${cat.mins}m (${catRatio.toFixed(0)}%)</span>
            </div>
            <div class="cat-bar-track">
              <div class="cat-bar-fill" style="width: ${totalRatio}%; background-color: ${cat.color}"></div>
            </div>
          </div>
        `;
      });
      
      const gapRatio = (gapMins / 1440) * 100;
      html += `
          <div class="cat-bar-item">
            <div class="cat-bar-header">
              <span class="cat-bar-name glow-amber">⚠️ Gaps / Unallocated</span>
              <span class="cat-bar-val font-mono">${gapMins}m (${((gapMins / 1440) * 100).toFixed(0)}%)</span>
            </div>
            <div class="cat-bar-track">
              <div class="cat-bar-fill" style="width: ${gapRatio}%; background: rgba(120, 120, 120, 0.05); border: 1px dashed var(--border-color)"></div>
            </div>
          </div>
        </div>

        <!-- 4. Project Segments Leaderboard -->
        <div class="segments-leaderboard">
          <h4>Project / Segment Audits</h4>
      `;
      
      if (segmentStats.length === 0) {
        html += `
          <div class="plugin-placeholder" style="padding: 20px 10px; border-style: dashed; border-radius: 8px">
            <p style="font-size: 0.7rem; color: var(--text-secondary)">No custom segments tagged today. Use segments for extreme audits.</p>
          </div>
        `;
      } else {
        segmentStats.forEach(seg => {
          const segRatio = totalLogged > 0 ? (seg.mins / totalLogged) * 100 : 0;
          html += `
            <div class="leaderboard-row">
              <span class="leaderboard-name font-mono">${seg.name}</span>
              <span class="leaderboard-time font-mono">${seg.mins}m (${segRatio.toFixed(0)}%)</span>
            </div>
          `;
        });
      }
      
      html += `
        </div>
      </div>
      `;
      
      container.innerHTML = html;
      
      // Set circular progress ring
      const circle = container.querySelector('#analytics-ring');
      if (circle) {
        const radius = 48;
        const circumference = 2 * Math.PI * radius;
        const ratio = parseFloat(percentage) / 100;
        const strokeDashoffset = circumference * (1 - ratio);
        
        circle.style.strokeDasharray = `${circumference} ${circumference}`;
        circle.style.strokeDashoffset = strokeDashoffset;
      }
      
      // Draw Barcode Ribbon Canvas/HTML Blocks
      drawBarcodeRibbon();
    };

    const drawBarcodeRibbon = () => {
      const ribbon = container?.querySelector('#barcode-ribbon-bar');
      if (!ribbon) return;
      
      ribbon.innerHTML = '';
      const dayLogs = state.ledger[state.date];
      if (!dayLogs) return;
      
      let currentSpan = null;
      for (let idx = 0; idx < 1440; idx++) {
        const entry = dayLogs[idx];
        const catColor = entry ? (state.categories.find(c => c.id === entry.categoryId)?.color || '#64748b') : 'rgba(120, 120, 120, 0.03)';
        
        if (!currentSpan) {
          currentSpan = { color: catColor, width: 1 };
        } else if (currentSpan.color === catColor) {
          currentSpan.width++;
        } else {
          const spanEl = document.createElement('span');
          spanEl.style.flexGrow = currentSpan.width;
          spanEl.style.backgroundColor = currentSpan.color;
          ribbon.appendChild(spanEl);
          
          currentSpan = { color: catColor, width: 1 };
        }
      }
      
      if (currentSpan) {
        const spanEl = document.createElement('span');
        spanEl.style.flexGrow = currentSpan.width;
        spanEl.style.backgroundColor = currentSpan.color;
        ribbon.appendChild(spanEl);
      }
    };

    return {
      onInit() {
        container = document.getElementById('plugin-analytics-root');
        const card = document.querySelector('.landing-analytics-card');
        if (card) card.classList.remove('hidden');
        render();
      },
      onLedgerUpdate() {
        render();
      },
      onTick(date) {
        // Keeps sync if active tracking commits real-time minute blocks
        if (state.activeSession) {
          render();
        }
      },
      onDestroy() {
        const card = document.querySelector('.landing-analytics-card');
        if (card) card.classList.add('hidden');
        
        if (container) container.innerHTML = '';
        
        // Reset Landing dashboard elements to placeholders if disabled
        const landingRing = document.getElementById('landing-completeness-ring');
        const landingVal = document.getElementById('landing-gauge-val');
        if (landingRing && landingVal) {
          landingRing.style.strokeDashoffset = '263.89'; // 0%
          landingVal.textContent = '0%';
        }
        
        const landingBars = document.getElementById('landing-category-bars');
        if (landingBars) landingBars.innerHTML = '';
        
        const trendsStack = document.getElementById('trends-ribbons-stack-container');
        if (trendsStack) {
          trendsStack.innerHTML = `
            <div style="font-size: 0.7rem; color: var(--text-muted); text-align: center; padding: 20px">
              Enable the Visual Analytics module to view multi-day barcode logs
            </div>
          `;
        }
      }
    };
  }
});
