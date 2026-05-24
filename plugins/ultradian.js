import { registerPlugin } from '../app.js';
import { playHourlyChime } from '../beeper.js';

registerPlugin('ultradian', {
  name: 'Ultradian Rhythm Timer',
  description: 'Alight focus with human biological cycles: 90 minutes of high-focus single-tasking followed by 20 minutes recovery.',
  bootstrap(state, api) {
    let panelElement = null;
    let timerInterval = null;

    const ultraState = {
      mode: 'focus', // 'focus' or 'recovery'
      timeLeft: 90 * 60, // 90 minutes in seconds
      isActive: false,
      completedCycles: 0
    };

    const startTimer = () => {
      if (ultraState.isActive) return;
      ultraState.isActive = true;

      // Sync active tracking session
      syncWithCoreTracker();

      timerInterval = setInterval(() => {
        if (ultraState.timeLeft > 0) {
          ultraState.timeLeft--;
          renderProgressRing();
          renderTimeDisplay();
        } else {
          // Cycle finished
          playBeeps();
          stopTimerInterval();
          handleCycleComplete();
        }
      }, 1000);

      render();
    };

    const pauseTimer = () => {
      ultraState.isActive = false;
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

    const resetTimer = () => {
      stopTimerInterval();
      ultraState.isActive = false;
      if (ultraState.mode === 'focus') {
        ultraState.timeLeft = 90 * 60;
      } else {
        ultraState.timeLeft = 20 * 60;
      }
      
      // Stop and commit core live tracker if active
      const stopBtn = document.getElementById('timer-stop-btn');
      if (stopBtn && !stopBtn.disabled) {
        stopBtn.click();
      }
      
      render();
    };

    const playBeeps = () => {
      // Wind-chime sequence
      playHourlyChime();
      setTimeout(playHourlyChime, 350);
      setTimeout(playHourlyChime, 700);
    };

    const handleCycleComplete = () => {
      ultraState.isActive = false;

      // Auto-commit active session
      const stopBtn = document.getElementById('timer-stop-btn');
      if (stopBtn && !stopBtn.disabled) {
        stopBtn.click();
      }

      if (ultraState.mode === 'focus') {
        ultraState.completedCycles++;
        ultraState.mode = 'recovery';
        ultraState.timeLeft = 20 * 60;
        api.showToast('90-Minute Ultradian work block complete! Rest for 20 minutes.', 'success');
      } else {
        ultraState.mode = 'focus';
        ultraState.timeLeft = 90 * 60;
        api.showToast('20-Minute Recovery block complete! Prepare to focus.', 'success');
      }

      resetTimer();
      // Auto-trigger next cycle
      startTimer();
    };

    const syncWithCoreTracker = () => {
      const liveNotesInput = document.getElementById('live-notes-input');
      const toggleBtn = document.getElementById('timer-toggle-btn');
      if (!liveNotesInput || !toggleBtn) return;

      const isFocus = ultraState.mode === 'focus';
      liveNotesInput.value = isFocus ? 'Ultradian Focus' : 'Ultradian Recovery';

      if (!state.activeSession) {
        toggleBtn.click();
      }

      const presetId = isFocus ? 'deep-work' : 'recharge';
      const activePreset = document.querySelector(`#category-presets-list [data-category-id="${presetId}"]`);
      if (activePreset) {
        activePreset.click();
      }
    };

    const renderTimeDisplay = () => {
      if (!panelElement) return;
      const displayNode = panelElement.querySelector('.ultra-timer-val');
      if (displayNode) {
        const h = Math.floor(ultraState.timeLeft / 3600);
        const m = String(Math.floor((ultraState.timeLeft % 3600) / 60)).padStart(2, '0');
        const s = String(ultraState.timeLeft % 60).padStart(2, '0');
        displayNode.textContent = h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
      }
    };

    const renderProgressRing = () => {
      if (!panelElement) return;
      const circle = panelElement.querySelector('.progress-ring-circle');
      if (circle) {
        const total = ultraState.mode === 'focus' ? 90 * 60 : 20 * 60;
        const ratio = total > 0 ? ultraState.timeLeft / total : 0;
        const radius = 64;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference * (1 - ratio);

        circle.style.strokeDasharray = `${circumference} ${circumference}`;
        circle.style.strokeDashoffset = strokeDashoffset;
      }
    };

    const render = () => {
      if (!panelElement) return;

      const mins = String(Math.floor((ultraState.timeLeft % 3600) / 60)).padStart(2, '0');
      const secs = String(ultraState.timeLeft % 60).padStart(2, '0');
      const h = Math.floor(ultraState.timeLeft / 3600);
      const displayTime = h > 0 ? `${h}:${mins}:${secs}` : `${mins}:${secs}`;

      const isFocus = ultraState.mode === 'focus';
      const modeColor = isFocus ? '#f59e0b' : 'var(--accent-emerald)'; // Morning amber vs emerald
      const modeText = isFocus ? 'Focus Block' : 'Recovery Block';

      panelElement.innerHTML = `
        <div class="panel-header">
          <h2>Ultradian Rhythm</h2>
          <p>Align focus with biological energy peaks ($90$m work / $20$m rest).</p>
        </div>
        <div class="panel-content">
          <div class="ultra-container" style="display: flex; flex-direction: column; align-items: center; gap: 16px">
            
            <div class="ultra-progress-wrapper" style="position: relative; width: 160px; height: 160px; display: flex; align-items: center; justify-content: center">
              <svg class="progress-ring" width="160" height="160" style="position: absolute; transform: rotate(-90deg)">
                <circle class="progress-ring-bg" stroke="rgba(255, 255, 255, 0.05)" stroke-width="8" fill="transparent" r="64" cx="80" cy="80" />
                <circle class="progress-ring-circle" stroke="${modeColor}" stroke-width="8" fill="transparent" r="64" cx="80" cy="80" style="transition: stroke-dashoffset 0.35s; transform-origin: 50% 50%" />
              </svg>
              <div class="ultra-timer-display" style="display: flex; flex-direction: column; align-items: center; z-index: 2">
                <span class="ultra-timer-val font-mono" style="font-size: 1.9rem; font-weight: 800; color: var(--text-primary)">${displayTime}</span>
                <span class="ultra-timer-mode" style="color: ${modeColor}; font-size: 0.72rem; font-weight: 700; text-transform: uppercase">${modeText}</span>
              </div>
            </div>

            <div class="ultra-controls" style="display: flex; gap: 8px; width: 100%">
              <button class="btn btn-primary" id="ultra-play-btn" style="flex-grow: 2">
                <i data-lucide="${ultraState.isActive ? 'pause' : 'play'}"></i> ${ultraState.isActive ? 'Pause' : 'Start'}
              </button>
              <button class="btn btn-secondary" id="ultra-reset-btn" style="flex-grow: 1">
                <i data-lucide="rotate-ccw"></i> Reset
              </button>
              <button class="btn btn-secondary btn-icon-only" id="ultra-mode-btn" title="Toggle Mode">
                <i data-lucide="coffee"></i>
              </button>
            </div>

            <div class="ultra-stats glass-pill" style="width: 100%; text-align: center; font-size: 0.72rem; padding: 6px">
              <span>Cycles Completed: <strong class="glow-amber font-mono">${ultraState.completedCycles}</strong></span>
            </div>
          </div>
        </div>
      `;

      renderProgressRing();

      // Bind Listeners
      const playBtn = panelElement.querySelector('#ultra-play-btn');
      const resetBtn = panelElement.querySelector('#ultra-reset-btn');
      const modeBtn = panelElement.querySelector('#ultra-mode-btn');

      if (playBtn) {
        playBtn.addEventListener('click', () => {
          if (ultraState.isActive) pauseTimer();
          else startTimer();
        });
      }

      if (resetBtn) resetBtn.addEventListener('click', resetTimer);

      if (modeBtn) {
        modeBtn.addEventListener('click', () => {
          ultraState.mode = ultraState.mode === 'focus' ? 'recovery' : 'focus';
          resetTimer();
          api.showToast(`Switched to Ultradian ${ultraState.mode} cycle.`, 'success');
        });
      }

      if (window.lucide) lucide.createIcons();
    };

    const injectStyles = () => {
      if (document.getElementById('ultradian-plugin-styles')) return;
      const styles = document.createElement('style');
      styles.id = 'ultradian-plugin-styles';
      styles.textContent = `
        .ultra-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .ultra-progress-wrapper {
          position: relative;
          width: 160px;
          height: 160px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .progress-ring {
          position: absolute;
          transform: rotate(-90deg);
        }
        .progress-ring-circle {
          transition: stroke-dashoffset 0.35s;
          transform-origin: 50% 50%;
        }
        .ultra-timer-display {
          display: flex;
          flex-direction: column;
          align-items: center;
          z-index: 2;
        }
        .ultra-timer-val {
          font-size: 1.9rem;
          font-weight: 800;
          color: var(--text-primary);
        }
        .ultra-timer-mode {
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .ultra-controls {
          display: flex;
          gap: 8px;
          width: 100%;
        }
        .ultra-controls .btn-primary {
          flex-grow: 2;
        }
        .ultra-controls .btn-secondary {
          flex-grow: 1;
        }
        .ultra-stats {
          width: 100%;
          text-align: center;
          font-size: 0.75rem;
          padding: 6px;
        }
        .glow-amber {
          color: #f59e0b;
          text-shadow: 0 0 8px rgba(245, 158, 11, 0.4);
        }
      `;
      document.head.appendChild(styles);
    };

    return {
      onInit() {
        panelElement = api.addSidebarTab('ultradian', 'Ultradian', 'zap', `<div></div>`);
        injectStyles();
        render();
      },
      onTrackerStop() {
        if (ultraState.isActive) {
          ultraState.isActive = false;
          stopTimerInterval();
          render();
          api.showToast('Ultradian rhythm session paused in sync with core tracker.', 'success');
        }
      },
      onDestroy() {
        stopTimerInterval();
        api.removeSidebarTab('ultradian');
        const styles = document.getElementById('ultradian-plugin-styles');
        if (styles) styles.remove();
      }
    };
  }
});
