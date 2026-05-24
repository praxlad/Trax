import { registerPlugin } from '../app.js';
import { playHourlyChime } from '../beeper.js';

registerPlugin('flowtime', {
  name: 'Flowtime Focus Timer',
  description: 'Flexible focus intervals. Work until exhaustion, then take a proportional break computed on the fly.',
  bootstrap(state, api) {
    let panelElement = null;
    let timerInterval = null;
    
    // Internal state
    const flowState = {
      mode: 'focus', // 'focus' or 'break'
      isActive: false,
      startTime: 0,
      focusDuration: 0, // seconds worked
      breakDurationLeft: 0, // seconds break left
      breakTotal: 0 // total break seconds
    };

    const calculateBreakTime = (workSeconds) => {
      const workMins = Math.floor(workSeconds / 60);
      if (workMins <= 25) return 5 * 60;     // <= 25 mins focus -> 5 mins break
      if (workMins <= 50) return 8 * 60;     // 26 - 50 mins focus -> 8 mins break
      if (workMins <= 90) return 12 * 60;    // 51 - 90 mins focus -> 12 mins break
      return 18 * 60;                        // > 90 mins focus -> 18 mins break
    };

    const startTimer = () => {
      if (flowState.isActive) return;
      flowState.isActive = true;
      
      if (flowState.mode === 'focus') {
        flowState.startTime = Date.now() - (flowState.focusDuration * 1000);
        
        // Seamless Core Integration: Start core stopwatch if not active
        const liveNotesInput = document.getElementById('live-notes-input');
        if (liveNotesInput) {
          liveNotesInput.value = `Flowtime Focus Session`;
          if (!state.activeSession) {
            const toggleBtn = document.getElementById('timer-toggle-btn');
            if (toggleBtn) toggleBtn.click();
          }
          
          // Click Deep Work preset robustly via dataset ID
          const deepWorkPreset = document.querySelector('#category-presets-list [data-category-id="deep-work"]');
          if (deepWorkPreset) deepWorkPreset.click();
        }
      }
      
      timerInterval = setInterval(() => {
        if (flowState.mode === 'focus') {
          flowState.focusDuration = Math.floor((Date.now() - flowState.startTime) / 1000);
          renderTimeDisplay();
        } else {
          if (flowState.breakDurationLeft > 0) {
            flowState.breakDurationLeft--;
            renderProgressRing();
            renderTimeDisplay();
          } else {
            // Break completed
            playChimeAlarm();
            stopTimerInterval();
            flowState.isActive = false;
            flowState.mode = 'focus';
            flowState.focusDuration = 0;
            api.showToast('Break finished! Ready for next focus block.', 'success');
            render();
          }
        }
      }, 1000);
      
      render();
    };

    const pauseTimer = () => {
      flowState.isActive = false;
      stopTimerInterval();
      
      // Pause core live tracker if active
      if (state.activeSession) {
        const toggleBtn = document.getElementById('timer-toggle-btn');
        if (toggleBtn) toggleBtn.click();
      }
      
      render();
    };

    const stopTimerInterval = () => {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    };

    const handleFocusComplete = () => {
      stopTimerInterval();
      flowState.isActive = false;
      
      // Auto-commit core session
      const stopBtn = document.getElementById('timer-stop-btn');
      if (stopBtn && !stopBtn.disabled) {
        stopBtn.click();
      }
      
      // Compute break time
      flowState.breakTotal = calculateBreakTime(flowState.focusDuration);
      flowState.breakDurationLeft = flowState.breakTotal;
      flowState.mode = 'break';
      
      api.showToast(`Focus block completed! Recommended break: ${Math.round(flowState.breakTotal/60)} minutes.`, 'success');
      
      // Seamless Core Integration: Start break session
      const liveNotesInput = document.getElementById('live-notes-input');
      if (liveNotesInput) {
        liveNotesInput.value = `Flowtime Break`;
        const toggleBtn = document.getElementById('timer-toggle-btn');
        if (toggleBtn) toggleBtn.click();
        
        // Click Recharge preset robustly via dataset ID
        const rechargePreset = document.querySelector('#category-presets-list [data-category-id="recharge"]');
        if (rechargePreset) rechargePreset.click();
      }
      
      // Start break timer automatically
      startTimer();
    };

    const resetTimer = () => {
      stopTimerInterval();
      flowState.isActive = false;
      flowState.mode = 'focus';
      flowState.focusDuration = 0;
      flowState.breakDurationLeft = 0;
      
      // Stop and commit core live tracker if active
      const stopBtn = document.getElementById('timer-stop-btn');
      if (stopBtn && !stopBtn.disabled) {
        stopBtn.click();
      }
      
      render();
    };

    const playChimeAlarm = () => {
      playHourlyChime();
      setTimeout(playHourlyChime, 300);
    };

    const renderTimeDisplay = () => {
      if (!panelElement) return;
      const valEl = panelElement.querySelector('.flowtime-timer-val');
      if (!valEl) return;
      
      if (flowState.mode === 'focus') {
        const h = String(Math.floor(flowState.focusDuration / 3600)).padStart(2, '0');
        const m = String(Math.floor((flowState.focusDuration % 3600) / 60)).padStart(2, '0');
        const s = String(flowState.focusDuration % 60).padStart(2, '0');
        valEl.textContent = `${h}:${m}:${s}`;
      } else {
        const m = String(Math.floor(flowState.breakDurationLeft / 60)).padStart(2, '0');
        const s = String(flowState.breakDurationLeft % 60).padStart(2, '0');
        valEl.textContent = `${m}:${s}`;
      }
    };

    const renderProgressRing = () => {
      if (!panelElement) return;
      const circle = panelElement.querySelector('.progress-ring-circle');
      if (circle && flowState.mode === 'break') {
        const ratio = flowState.breakTotal > 0 ? flowState.breakDurationLeft / flowState.breakTotal : 0;
        const radius = 64;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference * (1 - ratio);
        
        circle.style.strokeDasharray = `${circumference} ${circumference}`;
        circle.style.strokeDashoffset = strokeDashoffset;
      }
    };

    const render = () => {
      if (!panelElement) return;
      
      const isFocus = flowState.mode === 'focus';
      const modeColor = isFocus ? '#3b82f6' : 'var(--accent-emerald)';
      const modeText = isFocus ? 'Focus Mode' : 'Break Time';
      
      let timerHtml = '';
      
      if (isFocus) {
        timerHtml = `
          <div class="flowtime-timer-val font-mono">00:00:00</div>
          <div class="flowtime-timer-mode" style="color: ${modeColor}">${modeText}</div>
        `;
      } else {
        timerHtml = `
          <svg class="progress-ring" width="160" height="160">
            <circle class="progress-ring-bg" stroke="rgba(255, 255, 255, 0.05)" stroke-width="8" fill="transparent" r="64" cx="80" cy="80" />
            <circle class="progress-ring-circle" stroke="${modeColor}" stroke-width="8" fill="transparent" r="64" cx="80" cy="80" />
          </svg>
          <div class="pomo-timer-display" style="position: absolute; display: flex; flex-direction: column; align-items: center; z-index: 2">
            <span class="flowtime-timer-val font-mono">00:00</span>
            <span class="flowtime-timer-mode" style="color: ${modeColor}; font-size: 0.75rem; font-weight: 700; text-transform: uppercase">${modeText}</span>
          </div>
        `;
      }

      panelElement.innerHTML = `
        <div class="panel-header">
          <h2>Flowtime Zone</h2>
          <p>Work uninterrupted; rest proportionally when finished.</p>
        </div>
        <div class="panel-content">
          <div class="flowtime-container">
            <div class="flowtime-progress-wrapper flex items-center justify-center relative" style="width: 160px; height: 160px; margin: 0 auto; display: flex; align-items: center; justify-content: center; position: relative">
              ${timerHtml}
            </div>

            <div class="flowtime-controls" style="display: flex; gap: 8px; width: 100%; margin-top: 16px">
              <button class="btn btn-primary" id="flow-toggle-btn" style="flex-grow: 2">
                <i data-lucide="${flowState.isActive ? 'pause' : 'play'}"></i> ${flowState.isActive ? 'Pause' : 'Start'}
              </button>
              ${isFocus ? `
                <button class="btn btn-danger" id="flow-break-btn" style="flex-grow: 1" ${flowState.focusDuration < 10 ? 'disabled' : ''}>
                  <i data-lucide="coffee"></i> Break
                </button>
              ` : ''}
              <button class="btn btn-secondary" id="flow-reset-btn" style="flex-grow: 1">
                <i data-lucide="rotate-ccw"></i> Reset
              </button>
            </div>

            <div class="flowtime-rules glass-pill" style="width:100%; text-align:center; font-size:0.65rem; padding:8px; margin-top:16px; border:1px solid rgba(255,255,255,0.04)">
              <span>Break Rule: $5$m rest per $25$m focus. Maximum focus flow.</span>
            </div>
          </div>
        </div>
      `;

      renderTimeDisplay();
      renderProgressRing();

      // Bind Listeners
      const toggleBtn = panelElement.querySelector('#flow-toggle-btn');
      const breakBtn = panelElement.querySelector('#flow-break-btn');
      const resetBtn = panelElement.querySelector('#flow-reset-btn');

      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
          if (flowState.isActive) pauseTimer();
          else startTimer();
        });
      }

      if (breakBtn) {
        breakBtn.addEventListener('click', handleFocusComplete);
      }

      if (resetBtn) {
        resetBtn.addEventListener('click', resetTimer);
      }

      if (window.lucide) lucide.createIcons();
    };

    const injectStyles = () => {
      if (document.getElementById('flowtime-plugin-styles')) return;
      const styles = document.createElement('style');
      styles.id = 'flowtime-plugin-styles';
      styles.textContent = `
        .flowtime-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .flowtime-timer-val {
          font-size: 2.1rem;
          font-weight: 800;
          color: var(--text-primary);
        }
        .flowtime-timer-mode {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .progress-ring {
          position: absolute;
          transform: rotate(-90deg);
        }
        .progress-ring-circle {
          transition: stroke-dashoffset 0.35s;
          transform-origin: 50% 50%;
        }
      `;
      document.head.appendChild(styles);
    };

    return {
      onInit() {
        panelElement = api.addSidebarTab('flowtime', 'Flowtime', 'coffee', `<div></div>`);
        injectStyles();
        render();
      },
      onTrackerStop() {
        if (flowState.isActive) {
          flowState.isActive = false;
          stopTimerInterval();
          render();
          api.showToast('Flowtime session paused in sync with core tracker.', 'success');
        }
      },
      onDestroy() {
        stopTimerInterval();
        api.removeSidebarTab('flowtime');
        const styles = document.getElementById('flowtime-plugin-styles');
        if (styles) styles.remove();
      }
    };
  }
});
