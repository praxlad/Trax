import { registerPlugin } from '../app.js';

registerPlugin('hotkeys', {
  name: 'Quick Hotkeys & Presets',
  description: 'Enables sub-second keyboard shortcuts to instantly swap tasks, pause, or commit without clicking.',
  bootstrap(state, api) {
    let cheatSheet = null;
    
    // Core Keypress Listener
    const handleKeyDown = (e) => {
      // Ignore hotkeys when typing in forms, inputs or textareas
      const activeEl = document.activeElement;
      if (
        activeEl && 
        (activeEl.tagName === 'INPUT' || 
         activeEl.tagName === 'TEXTAREA' || 
         activeEl.isContentEditable)
      ) {
        return;
      }
      
      const key = e.key;
      
      // Keys 1-9: Select Category Preset & instantly track
      if (key >= '1' && key <= '9') {
        const index = parseInt(key) - 1;
        if (index < state.categories.length) {
          e.preventDefault();
          const targetCat = state.categories[index];
          
          // Trigger click on matching preset chip in main interface
          const chips = document.querySelectorAll('#category-presets-list .preset-chip');
          if (chips[index]) {
            chips[index].click();
          }
        }
      }
      
      // Spacebar: Play / Pause live tracker
      if (key === ' ' || key === 'Spacebar') {
        e.preventDefault();
        const toggleBtn = document.getElementById('timer-toggle-btn');
        if (toggleBtn) {
          toggleBtn.click();
        }
      }
      
      // Escape or 's' key: Stop & Commit live tracker
      if (key === 'Escape' || key.toLowerCase() === 's') {
        e.preventDefault();
        const stopBtn = document.getElementById('timer-stop-btn');
        if (stopBtn && !stopBtn.disabled) {
          stopBtn.click();
        }
      }
    };

    // Dynamically inject a gorgeous Hotkey Cheat Sheet helper at the bottom of the Live Command card
    const injectCheatSheetUI = () => {
      const targetCard = document.querySelector('.live-tracker-card');
      if (!targetCard) return;
      
      cheatSheet = document.createElement('div');
      cheatSheet.id = 'hotkey-cheat-sheet';
      cheatSheet.className = 'glass-pill font-mono mt-1';
      cheatSheet.style.width = '100%';
      cheatSheet.style.display = 'flex';
      cheatSheet.style.justifyContent = 'space-between';
      cheatSheet.style.fontSize = '0.7rem';
      cheatSheet.style.color = 'var(--text-secondary)';
      cheatSheet.style.padding = '6px 12px';
      cheatSheet.style.marginTop = '14px';
      cheatSheet.style.border = '1px solid rgba(255, 255, 255, 0.04)';
      
      updateCheatSheetContent();
      targetCard.appendChild(cheatSheet);
    };

    const updateCheatSheetContent = () => {
      if (!cheatSheet) return;
      
      let shortcuts = state.categories.slice(0, 5).map((cat, i) => {
        return `[${i + 1}] ${cat.name.split(' ')[0]}`;
      }).join('  |  ');
      
      cheatSheet.innerHTML = `
        <span>⚡ Shortcuts:  ${shortcuts}</span>
        <span>[Space] Start/Pause  |  [Esc] Save</span>
      `;
    };

    return {
      onInit() {
        document.addEventListener('keydown', handleKeyDown);
        injectCheatSheetUI();
        api.showToast('Keyboard hotkeys activated: Press [1-9] to swap, [Space] to pause, [Esc] to commit.', 'success');
      },
      onLedgerUpdate() {
        updateCheatSheetContent();
      },
      onDestroy() {
        document.removeEventListener('keydown', handleKeyDown);
        if (cheatSheet) cheatSheet.remove();
      }
    };
  }
});
