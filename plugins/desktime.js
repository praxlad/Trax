import { registerPlugin } from '../app.js';
import { playHourlyChime } from '../beeper.js';

registerPlugin('desktime', {
  name: 'DeskTime 52/17 Rule',
  description: 'Boost focus with the scientific 52/17 rule: 52 minutes intense single-task focus, 17 minutes complete offline rest.',
  bootstrap(state, api) {
    let panelElement = null;
    let timerInterval = null;

    const deskState = {
      mode: 'focus', // 'focus' or 'rest'
      timeLeft: 52 * 60, // 52 minutes in seconds
      isActive: false,
      completedSessions: 0
    };

    const startTimer = () => {
      if (deskState.isActive) return;
      deskState.isActive = true;

      // Sync active tracking session
      syncWithCoreTracker();

      timerInterval = setInterval(() => {
        if (deskState.timeLeft > 0) {
          deskState.timeLeft--;
          renderProgressRing();
          renderTimeDisplay();
        } else {
          // Session complete
          playBeeps();
          stopTimerInterval();
          handleSessionComplete();
        }
      }, 1000);

      render();
    };

    const pauseTimer = () => {
      deskState.isActive = false;
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
      deskState.isActive = false;
      if (deskState.mode === 'focus') {
        deskState.timeLeft = 52 * 60;
      } else {
        deskState.timeLeft = 17 * 60;
      }
      
      // Stop and commit core live tracker if active
      const stopBtn = document.getElementById('timer-stop-btn');
      if (stopBtn && !stopBtn.disabled) {
        stopBtn.click();
      }
      
      render();
    };

    const playBeeps = () => {
      playHourlyChime();
      setTimeout(playHourlyChime, 300);
    };

    const handleSessionComplete = () => {
      deskState.isActive = false;

      // Auto-commit active session
      const stopBtn = document.getElementById('timer-stop-btn');
      if (stopBtn && !stopBtn.disabled) {
        stopBtn.click();
      }

      if (deskState.mode === 'focus') {
        deskState.completedSessions++;
        deskState.mode = 'rest';
        deskState.timeLeft = 17 * 60;
        api.showToast('52-Minute Focus block complete! Take a 17-minute rest.', 'success');
      } else {
        deskState.mode = 'focus';
        deskState.timeLeft = 52 * 60;
        api.showToast('17-Minute Rest complete! Get ready to focus.', 'success');
      }

      resetTimer();
      // Auto-trigger next block
      startTimer();
    };

    const syncWithCoreTracker = () => {
      const liveNotesInput = document.getElementById('live-notes-input');
      const toggleBtn = document.getElementById('timer-toggle-btn');
      if (!liveNotesInput || !toggleBtn) return;

      const isFocus = deskState.mode === 'focus';
      liveNotesInput.value = isFocus ? 'DeskTime 52/17 Focus' : 'DeskTime 52/17 Rest';

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
      const displayNode = panelElement.querySelector('.desk-timer-val');
      if (displayNode) {
        const m = String(Math.floor(deskState.timeLeft / 60)).padStart(2, '0');
        const s = String(deskState.timeLeft % 60).padStart(2, '0');
        displayNode.textContent = `${m}:${s}`;
      }
    };

    const renderProgressRing = () => {
      if (!panelElement) return;
      const circle = panelElement.querySelector('.progress-ring-circle');
      if (circle) {
        const total = deskState.mode === 'focus' ? 52 * 60 : 17 * 60;
        const ratio = total > 0 ? deskState.timeLeft / total : 0;
        const radius = 64;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference * (1 - ratio);

        circle.style.strokeDasharray = `${circumference} ${circumference}`;
        circle.style.strokeDashoffset = strokeDashoffset;
      }
    };

    const render = () => {
      if (!panelElement) return;

      const mins = String(Math.floor(deskState.timeLeft / 60)).padStart(2, '0');
      const secs = String(deskState.timeLeft % 60).padStart(2, '0');
      const displayTime = `${mins}:${secs}`;

      const isFocus = deskState.mode === 'focus';
      const modeColor = isFocus ? '#0ea5e9' : 'var(--accent-emerald)'; // Sky blue vs emerald
      const modeText = isFocus ? 'Focus Rule' : 'Rest Rule';

      panelElement.innerHTML = `
        <div class="panel-header">
          <h2>DeskTime 52/17</h2>
          <p>Scientific high-performance method: $52$m intense work, $17$m rest.</p>
        </div>
        <div class="panel-content">
          <div class="desk-container" style="display: flex; flex-direction: column; align-items: center; gap: 16px">
            
            <div class="desk-progress-wrapper" style="position: relative; width: 160px; height: 160px; display: flex; align-items: center; justify-content: center">
              <svg class="progress-ring" width="160" height="160" style="position: absolute; transform: rotate(-90deg)">
                <circle class="progress-ring-bg" stroke="rgba(255, 255, 255, 0.05)" stroke-width="8" fill="transparent" r="64" cx="80" cy="80" />
                <circle class="progress-ring-circle" stroke="${modeColor}" stroke-width="8" fill="transparent" r="64" cx="80" cy="80" style="transition: stroke-dashoffset 0.35s; transform-origin: 50% 50%" />
              </svg>
              <div class="desk-timer-display" style="display: flex; flex-direction: column; align-items: center; z-index: 2">
                <span class="desk-timer-val font-mono" style="font-size: 2.1rem; font-weight: 800; color: var(--text-primary)">${displayTime}</span>
                <span class="desk-timer-mode" style="color: ${modeColor}; font-size: 0.75rem; font-weight: 700; text-transform: uppercase">${modeText}</span>
              </div>
            </div>

            <div class="desk-controls" style="display: flex; gap: 8px; width: 100%">
              <button class="btn btn-primary" id="desk-play-btn" style="flex-grow: 2">
                <i data-lucide="${deskState.isActive ? 'pause' : 'play'}"></i> ${deskState.isActive ? 'Pause' : 'Start'}
              </button>
              <button class="btn btn-secondary" id="desk-reset-btn" style="flex-grow: 1">
                <i data-lucide="rotate-ccw"></i> Reset
              </button>
              <button class="btn btn-secondary btn-icon-only" id="desk-mode-btn" title="Toggle Mode">
                <i data-lucide="coffee"></i>
              </button>
            </div>

            <div class="desk-stats glass-pill" style="width: 100%; text-align: center; font-size: 0.72rem; padding: 6px">
              <span>Cycles Completed: <strong class="glow-blue font-mono">${deskState.completedSessions}</strong></span>
            </div>
          </div>
        </div>
      `;

      renderProgressRing();

      // Bind Listeners
      const playBtn = panelElement.querySelector('#desk-play-btn');
      const resetBtn = panelElement.querySelector('#desk-reset-btn');
      const modeBtn = panelElement.querySelector('#desk-mode-btn');

      if (playBtn) {
        playBtn.addEventListener('click', () => {
          if (deskState.isActive) pauseTimer();
          else startTimer();
        });
      }

      if (resetBtn) resetBtn.addEventListener('click', resetTimer);

      if (modeBtn) {
        modeBtn.addEventListener('click', () => {
          deskState.mode = deskState.mode === 'focus' ? 'rest' : 'focus';
          resetTimer();
          api.showToast(`Switched to DeskTime ${deskState.mode} cycle.`, 'success');
        });
      }

      if (window.lucide) lucide.createIcons();
    };

    const injectStyles = () => {
      if (document.getElementById('desktime-plugin-styles')) return;
      const styles = document.createElement('style');
      styles.id = 'desktime-plugin-styles';
      styles.textContent = `
        .desk-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .desk-progress-wrapper {
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
        .desk-timer-display {
          display: flex;
          flex-direction: column;
          align-items: center;
          z-index: 2;
        }
        .desk-timer-val {
          font-size: 2.1rem;
          font-weight: 800;
          color: var(--text-primary);
        }
        .desk-timer-mode {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .desk-controls {
          display: flex;
          gap: 8px;
          width: 100%;
        }
        .desk-controls .btn-primary {
          flex-grow: 2;
        }
        .desk-controls .btn-secondary {
          flex-grow: 1;
        }
        .desk-stats {
          width: 100%;
          text-align: center;
          font-size: 0.75rem;
          padding: 6px;
        }
        .glow-blue {
          color: #0ea5e9;
          text-shadow: 0 0 8px rgba(14, 165, 233, 0.4);
        }
      `;
      document.head.appendChild(styles);
    };

    return {
      onInit() {
        panelElement = api.addSidebarTab('desktime', '52/17 Rule', 'clock', `<div></div>`);
        injectStyles();
        render();
      },
      onTrackerStop() {
        if (deskState.isActive) {
          deskState.isActive = false;
          stopTimerInterval();
          render();
          api.showToast('DeskTime 52/17 session paused in sync with core tracker.', 'success');
        }
      },
      onDestroy() {
        stopTimerInterval();
        api.removeSidebarTab('desktime');
        const styles = document.getElementById('desktime-plugin-styles');
        if (styles) styles.remove();
      }
    };
  }
});
