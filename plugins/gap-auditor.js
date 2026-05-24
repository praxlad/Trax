import { registerPlugin } from '../app.js';

registerPlugin('gap-auditor', {
  name: 'Gap Auditor',
  description: 'Scans the day for unallocated minute gaps, allowing you to fill them in a single click.',
  bootstrap(state, api) {
    let container = null;
    
    // Format minutes index to clock string
    const formatTime = (minutes) => {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayH = h % 12 === 0 ? 12 : h % 12;
      return `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
    };

    // Scans ledger and returns array of gap intervals { start, end, duration }
    const scanGaps = () => {
      const dayLogs = state.ledger[state.date];
      if (!dayLogs) return [];
      
      const gaps = [];
      let currentGap = null;
      
      for (let idx = 0; idx < 1440; idx++) {
        if (dayLogs[idx] === null) {
          if (!currentGap) {
            currentGap = { start: idx, end: idx };
          } else {
            currentGap.end = idx;
          }
        } else {
          if (currentGap) {
            currentGap.duration = currentGap.end - currentGap.start + 1;
            gaps.push(currentGap);
            currentGap = null;
          }
        }
      }
      
      if (currentGap) {
        currentGap.duration = currentGap.end - currentGap.start + 1;
        gaps.push(currentGap);
      }
      
      return gaps;
    };

    const render = () => {
      if (!container) return;
      
      const gaps = scanGaps();
      
      if (gaps.length === 0) {
        container.innerHTML = `
          <div class="gap-auditor-success">
            <i data-lucide="check-circle" class="success-icon"></i>
            <h3>Flawless Accounting!</h3>
            <p>Every single minute of today is fully accounted for. Great job!</p>
          </div>
        `;
        lucide.createIcons();
        return;
      }
      
      let html = `
        <div class="gap-auditor-summary">
          <span>Found <strong>${gaps.length}</strong> unallocated gaps today.</span>
        </div>
        <div class="gap-list">
      `;
      
      gaps.forEach((gap, index) => {
        html += `
          <div class="gap-item glass-pill" data-start="${gap.start}" data-end="${gap.end}">
            <div class="gap-item-info">
              <span class="gap-time font-mono">${formatTime(gap.start)} - ${formatTime(gap.end + 1)}</span>
              <span class="gap-duration">${gap.duration} min${gap.duration > 1 ? 's' : ''}</span>
            </div>
            
            <!-- Quick Fill Action Pills -->
            <div class="gap-item-presets">
              ${state.categories.map(cat => `
                <button class="gap-fill-btn" data-cat-id="${cat.id}" style="color: ${cat.color}; border-color: ${cat.color}33" title="Log as ${cat.name}">
                  ${cat.icon}
                </button>
              `).join('')}
            </div>
          </div>
        `;
      });
      
      html += `</div>`;
      container.innerHTML = html;
      
      // Hook up listeners
      const items = container.querySelectorAll('.gap-item');
      items.forEach(item => {
        const start = parseInt(item.dataset.start);
        const end = parseInt(item.dataset.end);
        
        // Clicking the time opens the modal with preset range
        item.querySelector('.gap-item-info').addEventListener('click', () => {
          // Trigger grid drag state variables retroactively
          const event = new CustomEvent('openselect', { detail: { start, end } });
          window.dispatchEvent(event);
          
          // Open Modal through main app trigger
          const cells = document.querySelectorAll('.minute-cell');
          cells.forEach(c => {
            const idx = parseInt(c.dataset.index);
            if (idx >= start && idx <= end) c.classList.add('selected');
          });
          
          // We can trigger the modal programmatically by dispatching mouse event simulation or just calling elements
          // But since app.js modal launcher is internal, we can simulate by directly setting states and calling modal.
          const startCell = document.querySelector(`.minute-cell[data-index="${start}"]`);
          if (startCell) {
            // Trigger drag range selection manually
            const mousedown = new MouseEvent('mousedown', { bubbles: true });
            const mouseenter = new MouseEvent('mouseenter', { bubbles: true });
            const mouseup = new MouseEvent('mouseup', { bubbles: true });
            
            startCell.dispatchEvent(mousedown);
            
            const endCell = document.querySelector(`.minute-cell[data-index="${end}"]`);
            if (endCell) {
              endCell.dispatchEvent(mouseenter);
            }
            document.dispatchEvent(mouseup);
          }
        });
        
        // Quick Fill Buttons
        item.querySelectorAll('.gap-fill-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const catId = btn.dataset.catId;
            api.logInterval(start, end, catId, 'Audited retroactively');
          });
        });
      });
      
      lucide.createIcons();
    };

    // Inject Custom Styles for Gap Auditor
    const injectStyles = () => {
      if (document.getElementById('gap-auditor-styles')) return;
      const styles = document.createElement('style');
      styles.id = 'gap-auditor-styles';
      styles.textContent = `
        .gap-auditor-success {
          text-align: center;
          padding: 40px 20px;
          border: 1px dashed var(--border-color);
          background: rgba(120, 120, 120, 0.02);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .success-icon {
          width: 42px;
          height: 42px;
          color: var(--tod-color);
        }
        .gap-auditor-success h3 {
          font-family: var(--font-header);
          font-size: 1.1rem;
          color: var(--text-primary);
        }
        .gap-auditor-success p {
          font-size: 0.8rem;
          color: var(--text-secondary);
          max-width: 250px;
        }
        .gap-auditor-summary {
          font-size: 0.8rem;
          color: var(--text-secondary);
          margin-bottom: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .gap-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 480px;
          overflow-y: auto;
          padding-right: 4px;
        }
        .gap-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-color);
          border-radius: 10px;
          cursor: pointer;
          transition: var(--transition-smooth);
        }
        .gap-item:hover {
          background: rgba(120, 120, 120, 0.05);
          border-color: var(--tod-color);
        }
        .gap-item-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex-grow: 1;
        }
        .gap-time {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-primary);
        }
        .gap-duration {
          font-size: 0.75rem;
          font-weight: 500;
        }
        .gap-item-presets {
          display: flex;
          gap: 4px;
        }
        .gap-fill-btn {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          border: 1px solid;
          background: rgba(255, 255, 255, 0.02);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.85rem;
          transition: var(--transition-smooth);
        }
        .gap-fill-btn:hover {
          background: currentColor;
          color: #05070B !important;
          transform: scale(1.1);
        }
      `;
      document.head.appendChild(styles);
    };

    return {
      onInit() {
        container = document.getElementById('plugin-gap-auditor-root');
        injectStyles();
        render();
      },
      onLedgerUpdate() {
        render();
      },
      onTick(date) {
        // Occasionally refresh in case state date matches current real day
        if (state.date === new Date().toISOString().split('T')[0]) {
          render();
        }
      },
      onDestroy() {
        if (container) container.innerHTML = '';
        const styles = document.getElementById('gap-auditor-styles');
        if (styles) styles.remove();
      }
    };
  }
});
