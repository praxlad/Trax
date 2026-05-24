import { registerPlugin } from '../app.js';
import { playHourlyChime, playTenMinBip } from '../beeper.js';

registerPlugin('pomodoro', {
  name: 'Pomodoro Focus Timer',
  description: 'Integrates focused intervals (work/break) directly with the precision tracker and ledger.',
  bootstrap(state, api) {
    let container = null;
    let timerInterval = null;
    
    // Internal Pomodoro State
    const pomoState = {
      mode: 'focus', // 'focus', 'short-break', 'long-break'
      timeLeft: 1500, // seconds (25 mins)
      isActive: false,
      completedSessions: 0,
      
      // Customizable Settings
      focusDur: 25, // minutes
      shortBreakDur: 5, // minutes
      longBreakDur: 15, // minutes
      longBreakInterval: 4,
      autoStartNext: true
    };

    // Load custom settings if saved
    const loadSettings = () => {
      const stored = localStorage.getItem('tracks_pomodoro_settings');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          Object.assign(pomoState, parsed);
          // Don't auto-activate on reload
          pomoState.isActive = false;
        } catch (e) {
          console.warn('Failed to load pomodoro settings', e);
        }
      }
      resetTimer();
    };

    const saveSettings = () => {
      localStorage.setItem('tracks_pomodoro_settings', JSON.stringify({
        focusDur: pomoState.focusDur,
        shortBreakDur: pomoState.shortBreakDur,
        longBreakDur: pomoState.longBreakDur,
        longBreakInterval: pomoState.longBreakInterval,
        autoStartNext: pomoState.autoStartNext,
        completedSessions: pomoState.completedSessions
      }));
    };

    const resetTimer = () => {
      stopTimerInterval();
      if (pomoState.mode === 'focus') {
        pomoState.timeLeft = pomoState.focusDur * 60;
      } else if (pomoState.mode === 'short-break') {
        pomoState.timeLeft = pomoState.shortBreakDur * 60;
      } else {
        pomoState.timeLeft = pomoState.longBreakDur * 60;
      }
      pomoState.isActive = false;
      render();
    };

    const stopTimerInterval = () => {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    };

    const playPomoAlarm = () => {
      // Synthesize a beautiful, rising focus chime (electronic chime chord)
      // Play primary hour chime twice
      playHourlyChime();
      setTimeout(() => {
        playHourlyChime();
      }, 300);
      
      api.showToast(`Pomodoro ${pomoState.mode.replace('-', ' ')} cycle completed!`, 'success');
    };

    const startTimer = () => {
      if (pomoState.isActive) return;
      
      pomoState.isActive = true;
      
      // Auto-trigger live tracker integration
      syncWithLiveTracker();
      
      timerInterval = setInterval(() => {
        if (pomoState.timeLeft > 0) {
          pomoState.timeLeft--;
          renderProgressRing();
          renderTimeDisplay();
        } else {
          // Cycle Completed
          playPomoAlarm();
          handleCycleComplete();
        }
      }, 1000);
      
      render();
    };

    const pauseTimer = () => {
      pomoState.isActive = false;
      stopTimerInterval();
      render();
    };

    const syncWithLiveTracker = () => {
      // Find matching categories
      let catId = '';
      let note = '';
      
      if (pomoState.mode === 'focus') {
        catId = state.categories.find(c => c.id === 'deep-work')?.id || state.categories[0]?.id;
        note = `Pomodoro Focus Session #${pomoState.completedSessions + 1}`;
      } else {
        catId = state.categories.find(c => c.id === 'recharge')?.id || state.categories[0]?.id;
        note = `Pomodoro Break (${pomoState.mode.replace('-', ' ')})`;
      }
      
      // Trigger the main live tracker to start tracking
      const trackerToggleBtn = document.getElementById('timer-toggle-btn');
      const liveNotesInput = document.getElementById('live-notes-input');
      
      if (trackerToggleBtn && liveNotesInput) {
        liveNotesInput.value = note;
        
        // Start tracking if not active, or switch category
        if (!state.activeSession) {
          // Simulate clicking to start tracking
          trackerToggleBtn.click();
        }
        
        // Ensure active category matches
        const activePreset = document.querySelector(`#category-presets-list [data-category-id="${catId}"]`);
        if (activePreset) {
          activePreset.click();
        }
      }
    };

    const handleCycleComplete = () => {
      stopTimerInterval();
      pomoState.isActive = false;
      
      // Auto-commit tracked session to ledger
      const stopBtn = document.getElementById('timer-stop-btn');
      if (stopBtn && !stopBtn.disabled) {
        stopBtn.click();
      }
      
      if (pomoState.mode === 'focus') {
        pomoState.completedSessions++;
        
        // Determine next mode: short break or long break
        if (pomoState.completedSessions % pomoState.longBreakInterval === 0) {
          pomoState.mode = 'long-break';
        } else {
          pomoState.mode = 'short-break';
        }
      } else {
        // Break is over -> Back to Focus
        pomoState.mode = 'focus';
      }
      
      saveSettings();
      resetTimer();
      
      if (pomoState.autoStartNext) {
        setTimeout(() => {
          startTimer();
        }, 1000);
      }
    };

    const renderTimeDisplay = () => {
      const displayNode = container?.querySelector('.pomo-timer-val');
      if (displayNode) {
        const mins = String(Math.floor(pomoState.timeLeft / 60)).padStart(2, '0');
        const secs = String(pomoState.timeLeft % 60).padStart(2, '0');
        displayNode.textContent = `${mins}:${secs}`;
      }
    };

    const renderProgressRing = () => {
      const circle = container?.querySelector('.progress-ring-circle');
      if (circle) {
        const total = pomoState.mode === 'focus' ? pomoState.focusDur * 60 : 
                      pomoState.mode === 'short-break' ? pomoState.shortBreakDur * 60 : 
                      pomoState.longBreakDur * 60;
                      
        const ratio = total > 0 ? pomoState.timeLeft / total : 0;
        const radius = 64;
        const circumference = 2 * Math.PI * radius;
        const strokeDashoffset = circumference * (1 - ratio);
        
        circle.style.strokeDasharray = `${circumference} ${circumference}`;
        circle.style.strokeDashoffset = strokeDashoffset;
      }
    };

    const render = () => {
      if (!container) return;
      
      const mins = String(Math.floor(pomoState.timeLeft / 60)).padStart(2, '0');
      const secs = String(pomoState.timeLeft % 60).padStart(2, '0');
      
      // Determine coloring based on mode
      const isFocus = pomoState.mode === 'focus';
      const modeColor = isFocus ? 'var(--accent-cyan)' : 'var(--accent-emerald)';
      const modeText = isFocus ? 'Focus Mode' : pomoState.mode === 'short-break' ? 'Short Break' : 'Long Break';
      
      container.innerHTML = `
        <div class="pomo-container">
          <!-- circular timer progress representation -->
          <div class="pomo-progress-wrapper">
            <svg class="progress-ring" width="160" height="160">
              <circle class="progress-ring-bg" stroke="rgba(255, 255, 255, 0.05)" stroke-width="8" fill="transparent" r="64" cx="80" cy="80" />
              <circle class="progress-ring-circle" stroke="${modeColor}" stroke-width="8" fill="transparent" r="64" cx="80" cy="80" />
            </svg>
            <div class="pomo-timer-display">
              <span class="pomo-timer-val font-mono">${mins}:${secs}</span>
              <span class="pomo-timer-mode" style="color: ${modeColor}">${modeText}</span>
            </div>
          </div>

          <!-- Pomodoro Controls -->
          <div class="pomo-controls">
            <button class="btn btn-primary" id="pomo-play-btn">
              <i data-lucide="${pomoState.isActive ? 'pause' : 'play'}"></i> ${pomoState.isActive ? 'Pause' : 'Start'}
            </button>
            <button class="btn btn-secondary" id="pomo-reset-btn">
              <i data-lucide="rotate-ccw"></i> Reset
            </button>
            <button class="btn btn-secondary btn-icon-only" id="pomo-mode-btn" title="Toggle Mode">
              <i data-lucide="coffee"></i>
            </button>
          </div>

          <!-- Quick Statistics and Cycles Completed -->
          <div class="pomo-stats glass-pill">
            <span>Sessions Complete: <strong class="glow-green font-mono">${pomoState.completedSessions}</strong></span>
          </div>

          <!-- Configuration options expandable panel -->
          <div class="pomo-config">
            <h4>Interval Settings (Minutes)</h4>
            <div class="config-inputs">
              <div class="pomo-form-row">
                <label>Focus</label>
                <input type="number" id="pomo-focus-in" min="1" max="120" value="${pomoState.focusDur}" class="cyber-input font-mono">
              </div>
              <div class="pomo-form-row">
                <label>Short Brk</label>
                <input type="number" id="pomo-short-in" min="1" max="60" value="${pomoState.shortBreakDur}" class="cyber-input font-mono">
              </div>
              <div class="pomo-form-row">
                <label>Long Brk</label>
                <input type="number" id="pomo-long-in" min="1" max="60" value="${pomoState.longBreakDur}" class="cyber-input font-mono">
              </div>
            </div>
            
            <div class="form-group mt-1">
              <label class="toggle-switch">
                <input type="checkbox" id="pomo-auto-start" ${pomoState.autoStartNext ? 'checked' : ''}>
                <span class="slider"></span>
                <span class="toggle-label font-xs">Auto-start Next Cycle</span>
              </label>
            </div>
          </div>
        </div>
      `;
      
      renderProgressRing();
      
      // Bind Pomo Elements
      const playBtn = container.querySelector('#pomo-play-btn');
      const resetBtn = container.querySelector('#pomo-reset-btn');
      const modeBtn = container.querySelector('#pomo-mode-btn');
      const focusIn = container.querySelector('#pomo-focus-in');
      const shortIn = container.querySelector('#pomo-short-in');
      const longIn = container.querySelector('#pomo-long-in');
      const autoCheck = container.querySelector('#pomo-auto-start');
      
      playBtn.addEventListener('click', () => {
        if (pomoState.isActive) {
          pauseTimer();
        } else {
          startTimer();
        }
      });
      
      resetBtn.addEventListener('click', resetTimer);
      
      modeBtn.addEventListener('click', () => {
        if (pomoState.mode === 'focus') {
          pomoState.mode = 'short-break';
        } else if (pomoState.mode === 'short-break') {
          pomoState.mode = 'long-break';
        } else {
          pomoState.mode = 'focus';
        }
        resetTimer();
        api.showToast(`Switched Pomodoro to ${pomoState.mode.replace('-', ' ')} mode.`, 'success');
      });
      
      // Inputs event listeners
      focusIn.addEventListener('change', (e) => {
        pomoState.focusDur = parseInt(e.target.value) || 25;
        saveSettings();
        resetTimer();
      });
      
      shortIn.addEventListener('change', (e) => {
        pomoState.shortBreakDur = parseInt(e.target.value) || 5;
        saveSettings();
        resetTimer();
      });
      
      longIn.addEventListener('change', (e) => {
        pomoState.longBreakDur = parseInt(e.target.value) || 15;
        saveSettings();
        resetTimer();
      });
      
      autoCheck.addEventListener('change', (e) => {
        pomoState.autoStartNext = e.target.checked;
        saveSettings();
      });
      
      if (window.lucide) lucide.createIcons();
    };

    const injectStyles = () => {
      if (document.getElementById('pomodoro-styles')) return;
      const styles = document.createElement('style');
      styles.id = 'pomodoro-styles';
      styles.textContent = `
        .pomo-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .pomo-progress-wrapper {
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
        .pomo-timer-display {
          display: flex;
          flex-direction: column;
          align-items: center;
          z-index: 2;
        }
        .pomo-timer-val {
          font-size: 2.1rem;
          font-weight: 800;
          color: var(--text-primary);
        }
        .pomo-timer-mode {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .pomo-controls {
          display: flex;
          gap: 8px;
          width: 100%;
        }
        .pomo-controls .btn-primary {
          flex-grow: 2;
        }
        .pomo-controls .btn-secondary {
          flex-grow: 1;
        }
        .pomo-stats {
          width: 100%;
          text-align: center;
          font-size: 0.75rem;
          padding: 6px;
        }
        .pomo-config {
          width: 100%;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .pomo-config h4 {
          font-family: var(--font-header);
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--tod-color);
        }
        .config-inputs {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }
        .pomo-form-row {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .pomo-form-row label {
          font-size: 0.65rem;
          color: var(--text-secondary);
        }
        .pomo-form-row input {
          padding: 6px;
          font-size: 0.8rem;
          text-align: center;
        }
        .font-xs {
          font-size: 0.75rem !important;
        }
      `;
      document.head.appendChild(styles);
    };

    return {
      onInit() {
        container = document.getElementById('plugin-pomodoro-root');
        injectStyles();
        loadSettings();
        render();
      },
      onTrackerStop() {
        if (pomoState.isActive) {
          pauseTimer();
          api.showToast('Pomodoro focus session paused in sync with core tracker.', 'success');
        }
      },
      onDestroy() {
        stopTimerInterval();
        if (container) container.innerHTML = '';
        const styles = document.getElementById('pomodoro-styles');
        if (styles) styles.remove();
      }
    };
  }
});
