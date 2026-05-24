import { registerPlugin } from '../app.js';

registerPlugin('docs', {
  name: 'Interactive Guide',
  description: 'Learn how to use Tracks effectively to audit every single minute and stay highly productive.',
  bootstrap(state, api) {
    let panelElement = null;

    const renderDocs = () => {
      return `
        <div class="docs-container">
          <div class="docs-section">
            <h3><i data-lucide="compass"></i> Quick Start</h3>
            <p><strong>Tracks</strong> is a local-first, zero-lag precision auditing tool. You have 1,440 minutes in a day—use them intentionally.</p>
            <ul>
              <li><strong>Live Tracking</strong>: Select an activity preset and click <strong>Start Tracker</strong>. Your minutes will be counted in real time.</li>
              <li><strong>Retroactive Audits</strong>: Drag across slots in the <strong>1,440 Ledger grid</strong> to record what you did. Perfect for capturing past hours.</li>
            </ul>
          </div>

          <div class="docs-section">
            <h3><i data-lucide="mic"></i> Zero-Friction Notes</h3>
            <p>Minimize typing to maintain your focus:</p>
            <ul>
              <li><strong>Voice Dictation</strong>: Click the microphone icon inside any notes field. Speak naturally, and your browser will transcribe your voice locally.</li>
              <li><strong>Dynamic Activity Chips</strong>: Click the suggested activity pills underneath notes inputs to pre-fill common tasks in one tap. Suggestions shift dynamically based on your category!</li>
            </ul>
          </div>

          <div class="docs-section">
            <h3><i data-lucide="timer"></i> Mastering Focus Zones</h3>
            <p>Enable different Focus Timers in the <strong>Module Center</strong> to optimize your routine:</p>
            <ul>
              <li><strong>Pomodoro Focus</strong>: The classic $25$ minutes of work and $5$ minutes break. Best for breaking procrastination.</li>
              <li><strong>Flowtime focus</strong>: Track your session until your energy naturally declines. Click stop, and the app suggests a proportional break ($5$m rest per $25$m work).</li>
              <li><strong>Ultradian Rhythm</strong>: Work in $90$-minute high-focus blocks aligned with natural biological peaks, followed by $20$-minute recovery breaks.</li>
              <li><strong>DeskTime $52/17$</strong>: Precise $52$ minutes of focus and $17$ minutes rest. Scientifically proven for high-performance desk work.</li>
            </ul>
          </div>

          <div class="docs-section">
            <h3><i data-lucide="grid"></i> The Eisenhower Matrix</h3>
            <p>Enable this plugin to tag your logs with quadrants:</p>
            <ul>
              <li><strong>Q1: Urgent & Important</strong> (Crisis, deadlines).</li>
              <li><strong>Q2: Important, Not Urgent</strong> (Deep work, growth, learning).</li>
              <li><strong>Q3: Urgent, Not Important</strong> (Interruptions, minor emails).</li>
              <li><strong>Q4: Neither</strong> (Leisure, rest, distraction).</li>
              <li><em>Check your Eisenhower Matrix tab to see your Peak Productivity Score based on Q2 deep work!</em></li>
            </ul>
          </div>

          <div class="docs-section">
            <h3><i data-lucide="keyboard"></i> Hotkeys Cheat Sheet</h3>
            <p>When the <strong>Quick Hotkeys</strong> plugin is enabled:</p>
            <ul>
              <li>Press <strong>[1] - [9]</strong> to instantly start tracking a category.</li>
              <li>Press <strong>[Spacebar]</strong> to Pause/Play the live stopwatch.</li>
              <li>Press <strong>[Escape]</strong> or <strong>[s]</strong> to stop and commit the session.</li>
            </ul>
          </div>
        </div>
      `;
    };

    const injectStyles = () => {
      if (document.getElementById('docs-plugin-styles')) return;
      const styles = document.createElement('style');
      styles.id = 'docs-plugin-styles';
      styles.textContent = `
        .docs-container {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding-bottom: 20px;
        }
        .docs-section {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 14px;
        }
        .docs-section h3 {
          font-family: var(--font-header);
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--tod-color);
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          border-bottom: 1px solid rgba(255,255,255,0.03);
          padding-bottom: 4px;
        }
        .docs-section h3 i {
          width: 14px;
          height: 14px;
        }
        .docs-section p {
          font-size: 0.72rem;
          color: var(--text-secondary);
          line-height: 1.4;
          margin-bottom: 8px;
        }
        .docs-section ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .docs-section li {
          font-size: 0.7rem;
          color: var(--text-muted);
          line-height: 1.4;
          position: relative;
          padding-left: 12px;
        }
        .docs-section li::before {
          content: "•";
          position: absolute;
          left: 0;
          color: var(--tod-color);
          font-weight: bold;
        }
      `;
      document.head.appendChild(styles);
    };

    return {
      onInit() {
        // Dynamically inject sidebar tab
        panelElement = api.addSidebarTab('docs', 'Guide', 'book-open', renderDocs());
        injectStyles();
      },
      onDestroy() {
        api.removeSidebarTab('docs');
        const styles = document.getElementById('docs-plugin-styles');
        if (styles) styles.remove();
      }
    };
  }
});
