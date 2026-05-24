import { 
  initAudio, 
  soundConfig, 
  setVolume, 
  playHourlyChime, 
  playTenMinBip 
} from './beeper.js';

// ==========================================================================
// CORE STATE ENGINE
// ==========================================================================
const DEFAULT_CATEGORIES = [
  { id: 'deep-work', name: 'Deep Work', color: '#6366f1', icon: '🚀' },
  { id: 'recharge', name: 'Recharge / Rest', color: '#10b981', icon: '🌿' },
  { id: 'admin', name: 'Admin / Routine', color: '#64748b', icon: '⚙️' },
  { id: 'leisure', name: 'Leisure / Life', color: '#f43f5e', icon: '🍕' }
];

export const state = {
  date: '', // YYYY-MM-DD
  categories: [],
  segments: [], // Custom segments/projects tags
  ledger: {}, // { 'YYYY-MM-DD': Array(1440) }
  activeSession: null, // { startTime: timestamp, categoryId: string, segment: string, notes: string }
  enabledPlugins: ['analytics', 'docs'],
  soundSettings: {},
  theme: 'dark', // 'dark' or 'light'
  timeZone: 'local',
  use24Hour: false
};

// Plugin Registry
const registeredPlugins = {};
const activePluginInstances = {};

// UI References
let elements = {};

// Timing State
let secondsTicker = null;
let lastHourChecked = -1;
let lastTenMinChecked = -1;

// Drag selection state
let isDragging = false;
let dragStartCellIndex = null;
let dragEndCellIndex = null;

// ==========================================================================
// INITIALIZATION & STORAGE
// ==========================================================================
document.addEventListener('DOMContentLoaded', async () => {
  initUIReferences();
  loadStateFromStorage();
  initTheme();
  initDate();
  renderCategoryPresets();
  renderGrid();
  initEventListeners();
  
  // Load all plugins dynamically to prevent circular dependencies & syntax errors
  await loadAllPluginModules();
  
  startGlobalTimer();
  updateAnalytics();
  
  // Initialize Segments Datalist Autocompletes
  refreshSegmentsDatalist();
  
  // Initialize Speech Dictation
  setupSpeechRecognition(elements.liveMicBtn, elements.notesInput);
  setupSpeechRecognition(elements.modalMicBtn, elements.modalNotesInput);
  
  // Initialize Lucide Icons
  if (window.lucide) lucide.createIcons();
});

async function loadAllPluginModules() {
  const plugins = [
    'gap-auditor.js',
    'pomodoro.js',
    'hotkeys.js',
    'analytics.js',
    'flowtime.js',
    'ultradian.js',
    'desktime.js',
    'eisenhower.js',
    'docs.js'
  ];
  
  for (const p of plugins) {
    try {
      await import(`./plugins/${p}`);
      console.log(`[Trax Registry] Successfully loaded plugin: ${p}`);
    } catch (err) {
      console.error(`[Trax Registry] Failed to load plugin ${p}:`, err);
    }
  }
  loadPlugins();
}

function initUIReferences() {
  elements = {
    currentTime: document.getElementById('current-time-display'),
    currentDate: document.getElementById('current-date-display'),
    completionPercentage: document.getElementById('completion-percentage'),
    datePicker: document.getElementById('date-picker'),
    datePrev: document.getElementById('date-prev-btn'),
    dateNext: document.getElementById('date-next-btn'),
    
    // Theme Switch
    themeToggleBtn: document.getElementById('theme-toggle-btn'),
    themeIcon: document.getElementById('theme-icon'),
    
    // Vector Clock Hand elements
    hourHand: document.getElementById('logo-hour-hand'),
    minHand: document.getElementById('logo-min-hand'),
    secHand: document.getElementById('logo-sec-hand'),
    
    // Live Tracker
    trackerCard: document.querySelector('.live-tracker-card'),
    trackerStatusText: document.getElementById('tracker-status-text'),
    activeCategoryBadge: document.getElementById('active-category-badge'),
    timerDisplay: document.getElementById('live-timer-display'),
    presetsList: document.getElementById('category-presets-list'),
    notesInput: document.getElementById('live-notes-input'),
    timerToggleBtn: document.getElementById('timer-toggle-btn'),
    timerBtnText: document.getElementById('timer-btn-text'),
    timerStopBtn: document.getElementById('timer-stop-btn'),
    
    // Grid
    ledgerGrid: document.getElementById('ledger-grid'),
    gridLegend: document.getElementById('grid-legend-container'),
    statsTotalGaps: document.getElementById('stats-total-gaps'),
    statsTotalLogged: document.getElementById('stats-total-logged'),
    clearDayBtn: document.getElementById('clear-day-btn'),
    
    // Sidebar/Settings
    tabs: document.querySelectorAll('.tab-link'),
    panels: document.querySelectorAll('.tab-panel'),
    pluginsList: document.getElementById('plugins-toggle-list'),
    categoriesList: document.getElementById('settings-categories-list'),
    addCategoryBtn: document.getElementById('add-category-btn'),
    
    // Audio elements
    enableAudio: document.getElementById('settings-enable-audio'),
    volumeSlider: document.getElementById('settings-volume'),
    volumeVal: document.getElementById('volume-val'),
    enableHour: document.getElementById('settings-enable-hour'),
    hourFreq: document.getElementById('settings-hour-freq'),
    hourDur: document.getElementById('settings-hour-dur'),
    testHourBtn: document.getElementById('test-hour-sound'),
    enable10min: document.getElementById('settings-enable-10min'),
    tenMinFreq: document.getElementById('settings-10min-freq'),
    tenMinDur: document.getElementById('settings-10min-dur'),
    test10minBtn: document.getElementById('test-10min-sound'),
    
    // Backup Actions
    exportJsonBtn: document.getElementById('export-json-btn'),
    importJsonFile: document.getElementById('import-json-file'),
    
    // Retroactive modal
    modal: document.getElementById('log-modal'),
    modalTitle: document.querySelector('#log-modal h2'),
    modalTimeText: document.getElementById('modal-time-range-text'),
    modalDurationText: document.getElementById('modal-duration-text'),
    modalCategoryList: document.getElementById('modal-category-select-list'),
    modalNotesInput: document.getElementById('modal-notes-input'),
    modalSaveBtn: document.getElementById('modal-save-btn'),
    modalCancelBtn: document.getElementById('modal-cancel-btn'),
    modalDeleteBtn: document.getElementById('modal-delete-btn'),
    modalCloseBtn: document.getElementById('close-modal-btn'),
    
    toastContainer: document.getElementById('toast-container'),
    installPwaBtn: document.getElementById('install-pwa-btn'),
    
    // Speech & Suggestions
    liveMicBtn: document.getElementById('live-mic-btn'),
    modalMicBtn: document.getElementById('modal-mic-btn'),
    liveSuggestionChips: document.getElementById('live-suggestion-chips'),
    modalSuggestionChips: document.getElementById('modal-suggestion-chips')
  };
}

function loadStateFromStorage() {
  const stored = localStorage.getItem('tracks_state');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      state.categories = parsed.categories || DEFAULT_CATEGORIES;
      state.segments = parsed.segments || ['Project Alpha', 'Core Dev', 'Admin Work', 'Self-Care', 'Social'];
      state.ledger = parsed.ledger || {};
      state.activeSession = parsed.activeSession || null;
      state.enabledPlugins = parsed.enabledPlugins || ['analytics', 'docs'];
      state.theme = parsed.theme || 'dark';
      state.timeZone = parsed.timeZone || 'local';
      state.use24Hour = parsed.use24Hour || false;
      
      // Load Audio config
      if (parsed.soundSettings) {
        Object.assign(soundConfig, parsed.soundSettings);
      }
    } catch (e) {
      console.error('Failed to parse state, falling back to defaults', e);
      state.categories = DEFAULT_CATEGORIES;
      state.segments = ['Project Alpha', 'Core Dev', 'Admin Work', 'Self-Care', 'Social'];
    }
  } else {
    state.categories = DEFAULT_CATEGORIES;
    state.segments = ['Project Alpha', 'Core Dev', 'Admin Work', 'Self-Care', 'Social'];
  }
  
  // Sync inputs with sound config & preferences
  syncSettingsUIWithSoundConfig();
  syncTimePreferencesUI();
}

function syncTimePreferencesUI() {
  const tzSelect = document.getElementById('settings-timezone');
  const formatCheck = document.getElementById('settings-time-format');
  if (tzSelect) tzSelect.value = state.timeZone;
  if (formatCheck) formatCheck.checked = state.use24Hour;
}

function syncSettingsUIWithSoundConfig() {
  if (!elements.enableAudio) return;
  
  elements.enableAudio.checked = soundConfig.enabled;
  elements.volumeSlider.value = soundConfig.volume;
  elements.volumeVal.textContent = `${Math.round(soundConfig.volume * 100)}%`;
  elements.enableHour.checked = soundConfig.hourChimeEnabled;
  elements.hourFreq.value = soundConfig.hourFrequency;
  elements.hourDur.value = soundConfig.hourDuration;
  elements.enable10min.checked = soundConfig.tenMinBipEnabled;
  elements.tenMinFreq.value = soundConfig.tenMinFrequency;
  elements.tenMinDur.value = soundConfig.tenMinDuration;
  
  setVolume(soundConfig.volume);
}

function saveStateToStorage() {
  state.soundSettings = { ...soundConfig };
  localStorage.setItem('tracks_state', JSON.stringify(state));
}

// ==========================================================================
// NATIVE TIME ZONE & CLOCK PRESENTATION ADAPTERS (Intl-based, zero lag)
// ==========================================================================
export function getLocalizedTimeParts(date = new Date()) {
  const tz = state.timeZone === 'local' ? undefined : state.timeZone;
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
      timeZone: tz
    });
    const parts = formatter.formatToParts(date);
    return {
      hour: parseInt(parts.find(p => p.type === 'hour').value),
      minute: parseInt(parts.find(p => p.type === 'minute').value),
      second: parseInt(parts.find(p => p.type === 'second').value)
    };
  } catch (err) {
    return {
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds()
    };
  }
}

export function getLocalizedDateString(date = new Date()) {
  const tz = state.timeZone === 'local' ? undefined : state.timeZone;
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: tz
    });
    const parts = formatter.formatToParts(date);
    const y = parts.find(p => p.type === 'year').value;
    const m = parts.find(p => p.type === 'month').value;
    const d = parts.find(p => p.type === 'day').value;
    return `${y}-${m}-${d}`;
  } catch (err) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

export function formatClockTime(hour, minute) {
  const hStr = String(hour).padStart(2, '0');
  const mStr = String(minute).padStart(2, '0');
  if (state.use24Hour) {
    return `${hStr}:${mStr}`;
  } else {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayH = hour % 12 === 0 ? 12 : hour % 12;
    return `${String(displayH).padStart(2, '0')}:${mStr} ${ampm}`;
  }
}

// ==========================================================================
// MINIMAL THEME & TIME-OF-DAY ADAPTIVE ACCENT ENGINE
// ==========================================================================
function initTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  updateThemeIcon();
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', state.theme);
  saveStateToStorage();
  updateThemeIcon();
  showToast(`Switched to ${state.theme} theme`, 'success');
}

function updateThemeIcon() {
  const themeIcon = document.getElementById('theme-icon');
  if (!themeIcon) return;
  
  if (state.theme === 'light') {
    themeIcon.setAttribute('data-lucide', 'moon');
  } else {
    themeIcon.setAttribute('data-lucide', 'sun');
  }
  if (window.lucide) lucide.createIcons();
}

/**
 * Dynamically switches accent colors throughout the day.
 * - Morning (05:00 - 11:59): Amber Golden (#F59E0B)
 * - Afternoon (12:00 - 16:59): Sky Blue (#0EA5E9)
 * - Evening (17:00 - 20:59): Sunset Coral (#F43F5E)
 * - Night (21:00 - 04:59): Midnight Violet (#8B5CF6)
 */
function updateTimeOfDayAccent(now = new Date()) {
  const hour = now.getHours();
  let accentHex = '#0ea5e9'; // DefaultSky Blue
  
  if (hour >= 5 && hour < 12) {
    accentHex = '#f59e0b'; // Morning Amber
  } else if (hour >= 12 && hour < 17) {
    accentHex = '#0ea5e9'; // Afternoon Sky Blue
  } else if (hour >= 17 && hour < 21) {
    accentHex = '#f43f5e'; // Evening Coral
  } else {
    accentHex = '#8b5cf6'; // Night Violet
  }
  
  document.documentElement.style.setProperty('--tod-color', accentHex);
}

/**
 * Animates the 3-Hand dynamic SVG clock logo dial.
 */
function updateLogoClockDials(now = new Date()) {
  if (!elements.hourHand || !elements.minHand || !elements.secHand) return;
  
  const { hour, minute: min, second: sec } = getLocalizedTimeParts(now);
  
  const secDeg = sec * 6; // 360 / 60 = 6
  const minDeg = min * 6 + sec * 0.1; // 360 / 60 = 6 + fraction of second
  const hourDeg = (hour % 12) * 30 + min * 0.5; // 360 / 12 = 30 + fraction of minute
  
  elements.hourHand.style.transform = `rotate(${hourDeg}deg)`;
  elements.minHand.style.transform = `rotate(${minDeg}deg)`;
  elements.secHand.style.transform = `rotate(${secDeg}deg)`;
}

// ==========================================================================
// DATE MANAGER
// ==========================================================================
function initDate() {
  const todayStr = getLocalizedDateString(new Date());
  
  state.date = todayStr;
  elements.datePicker.value = todayStr;
  updateDateDisplay();
  
  ensureLedgerExistsForDate(state.date);
}

function ensureLedgerExistsForDate(dateStr) {
  if (!state.ledger[dateStr]) {
    state.ledger[dateStr] = Array(1440).fill(null);
  }
}

function updateDateDisplay() {
  const d = new Date(state.date);
  const options = { day: 'numeric', month: 'short', year: 'numeric' };
  elements.currentDate.textContent = d.toLocaleDateString('en-US', options);
}

// ==========================================================================
// RENDERERS (GRID & CATEGORIES)
// ==========================================================================
function renderCategoryPresets() {
  elements.presetsList.innerHTML = '';
  elements.gridLegend.innerHTML = '';
  elements.categoriesList.innerHTML = '';
  
  // Standard Legend elements
  elements.gridLegend.innerHTML += `
    <div class="legend-item">
      <div class="legend-color" style="background: rgba(120, 120, 120, 0.08); border: 1px solid var(--border-color)"></div>
      <span>Unallocated</span>
    </div>
  `;
  
  state.categories.forEach(cat => {
    // 1. Live Command Category Presets
    const isActive = state.activeSession && state.activeSession.categoryId === cat.id;
    const preset = document.createElement('button');
    preset.className = `preset-chip ${isActive ? 'active' : ''}`;
    preset.dataset.categoryId = cat.id;
    preset.style.borderColor = cat.color;
    preset.style.color = isActive ? '#FFFFFF' : cat.color;
    preset.style.background = isActive ? cat.color : 'rgba(120,120,120,0.03)';
    preset.innerHTML = `
      <span class="preset-chip-dot" style="background-color: ${cat.color}"></span>
      <span>${cat.icon} ${cat.name}</span>
    `;
    preset.addEventListener('click', () => selectActiveCategory(cat.id));
    elements.presetsList.appendChild(preset);
    
    // 2. Main Grid Legend
    const legend = document.createElement('div');
    legend.className = 'legend-item';
    legend.innerHTML = `
      <div class="legend-color" style="background: ${cat.color}"></div>
      <span>${cat.name}</span>
    `;
    elements.gridLegend.appendChild(legend);

    // 3. Settings Category Config
    const configItem = document.createElement('div');
    configItem.className = 'category-config-item';
    configItem.innerHTML = `
      <div class="color-picker-wrapper">
        <input type="color" value="${cat.color}">
      </div>
      <input type="text" value="${cat.icon} ${cat.name}" class="cyber-input">
      <button class="btn btn-danger btn-xs btn-icon-only remove-cat-btn" title="Delete Category"><i data-lucide="trash-2"></i></button>
    `;
    
    // Config Listeners
    const colorPicker = configItem.querySelector('input[type="color"]');
    const nameInput = configItem.querySelector('input[type="text"]');
    const removeBtn = configItem.querySelector('.remove-cat-btn');
    
    colorPicker.addEventListener('change', (e) => {
      cat.color = e.target.value;
      saveStateToStorage();
      renderCategoryPresets();
      renderGrid();
      triggerEvent('onLedgerUpdate');
    });
    
    nameInput.addEventListener('change', (e) => {
      const val = e.target.value.trim();
      const match = val.match(/^([\uD800-\uDBFF][\uDC00-\uDFFF]|\p{Emoji})?\s*(.*)$/u);
      if (match) {
        cat.icon = match[1] || '📌';
        cat.name = match[2] || val;
      } else {
        cat.name = val;
      }
      saveStateToStorage();
      renderCategoryPresets();
      renderGrid();
    });

    removeBtn.addEventListener('click', () => {
      state.categories = state.categories.filter(c => c.id !== cat.id);
      saveStateToStorage();
      renderCategoryPresets();
      renderGrid();
      showToast(`Category "${cat.name}" deleted.`, 'error');
    });

    elements.categoriesList.appendChild(configItem);
  });
  
  if (window.lucide) lucide.createIcons();
  
  // Render Dynamic Suggestion Chips for the active live category
  const selectedLiveCatId = state.activeSession ? state.activeSession.categoryId : (state.categories[0]?.id || 'deep-work');
  renderSuggestionChips(selectedLiveCatId, 'live-suggestion-chips', elements.notesInput);
}

function renderGrid() {
  elements.ledgerGrid.innerHTML = '';
  ensureLedgerExistsForDate(state.date);
  const dayLogs = state.ledger[state.date];
  
  for (let hour = 0; hour < 24; hour++) {
    const row = document.createElement('div');
    row.className = 'hour-row';
    
    const label = document.createElement('div');
    label.className = 'hour-label';
    if (state.use24Hour) {
      label.textContent = `${String(hour).padStart(2, '0')}:00`;
    } else {
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 === 0 ? 12 : hour % 12;
      label.textContent = `${String(displayHour).padStart(2, '0')} ${ampm}`;
    }
    row.appendChild(label);
    
    const minutesContainer = document.createElement('div');
    minutesContainer.className = 'minutes-container';
    
    for (let min = 0; min < 60; min++) {
      const cellIndex = hour * 60 + min;
      const entry = dayLogs[cellIndex];
      
      const cell = document.createElement('div');
      cell.className = 'minute-cell';
      cell.dataset.index = cellIndex;
      
      if (entry) {
        const cat = state.categories.find(c => c.id === entry.categoryId);
        if (cat) {
          cell.style.backgroundColor = cat.color;
          cell.style.borderColor = cat.color;
        } else {
          cell.style.backgroundColor = '#64748b'; // deleted category default
          cell.style.borderColor = '#64748b';
        }
      } else {
        cell.className += ' unallocated';
      }
      
      // Formatting time tooltip using our helper
      const timeStr = formatClockTime(hour, min);
      
      let tooltip = `${timeStr}`;
      if (entry) {
        const catName = getCategoryName(entry.categoryId);
        tooltip += ` | ${catName}`;
        if (entry.segment) tooltip += ` | Segment: ${entry.segment}`;
        if (entry.notes) tooltip += ` (${entry.notes})`;
        if (entry.quadrant) tooltip += ` [${entry.quadrant.toUpperCase()}]`;
      } else {
        tooltip += ` | Unallocated Gap`;
      }
      cell.title = tooltip;
      
      // Grid Selection Events
      cell.addEventListener('mousedown', handleGridMouseDown);
      cell.addEventListener('mouseenter', handleGridMouseEnter);
      
      minutesContainer.appendChild(cell);
    }
    
    row.appendChild(minutesContainer);
    elements.ledgerGrid.appendChild(row);
  }
}

function getCategoryName(catId) {
  const cat = state.categories.find(c => c.id === catId);
  return cat ? `${cat.icon} ${cat.name}` : 'Deleted Category';
}

// ==========================================================================
// SELECTION & EDIT DIALOG (MODAL)
// ==========================================================================
function handleGridMouseDown(e) {
  isDragging = true;
  dragStartCellIndex = parseInt(e.currentTarget.dataset.index);
  dragEndCellIndex = dragStartCellIndex;
  
  clearGridSelection();
  e.currentTarget.classList.add('selected');
  
  document.addEventListener('mouseup', handleGridMouseUp);
}

function handleGridMouseEnter(e) {
  if (!isDragging) return;
  dragEndCellIndex = parseInt(e.currentTarget.dataset.index);
  
  updateGridSelectionVisuals();
}

function handleGridMouseUp() {
  isDragging = false;
  document.removeEventListener('mouseup', handleGridMouseUp);
  
  openLogModalForSelection();
}

function clearGridSelection() {
  const cells = elements.ledgerGrid.querySelectorAll('.minute-cell');
  cells.forEach(c => c.classList.remove('selected'));
}

function updateGridSelectionVisuals() {
  const start = Math.min(dragStartCellIndex, dragEndCellIndex);
  const end = Math.max(dragStartCellIndex, dragEndCellIndex);
  
  const cells = elements.ledgerGrid.querySelectorAll('.minute-cell');
  cells.forEach(c => {
    const idx = parseInt(c.dataset.index);
    if (idx >= start && idx <= end) {
      c.classList.add('selected');
    } else {
      c.classList.remove('selected');
    }
  });
}

function openLogModalForSelection() {
  const startIdx = Math.min(dragStartCellIndex, dragEndCellIndex);
  const endIdx = Math.max(dragStartCellIndex, dragEndCellIndex);
  const duration = endIdx - startIdx + 1;
  
  // Format Times
  const formatTime = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return formatClockTime(h, m);
  };
  
  elements.modalTimeText.textContent = `${formatTime(startIdx)} - ${formatTime(endIdx + 1)}`;
  elements.modalDurationText.textContent = `${duration} min${duration > 1 ? 's' : ''}`;
  
  // Render Modal Category Buttons
  elements.modalCategoryList.innerHTML = '';
  let selectedCatId = state.categories[0]?.id || '';
  
  // Pre-fill existing entries if selection is a single cell
  if (duration === 1) {
    const entry = state.ledger[state.date][startIdx];
    if (entry) {
      selectedCatId = entry.categoryId;
      elements.modalNotesInput.value = entry.notes || '';
      document.getElementById('modal-segment-input').value = entry.segment || '';
    } else {
      elements.modalNotesInput.value = '';
      document.getElementById('modal-segment-input').value = '';
    }
  } else {
    elements.modalNotesInput.value = '';
    document.getElementById('modal-segment-input').value = '';
  }
  
  state.categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = `modal-category-btn ${selectedCatId === cat.id ? 'active' : ''}`;
    btn.style.color = cat.color;
    btn.innerHTML = `${cat.icon} ${cat.name}`;
    if (selectedCatId === cat.id) {
      btn.style.backgroundColor = `${cat.color}22`;
      btn.style.borderColor = cat.color;
    }
    
    btn.addEventListener('click', () => {
      selectedCatId = cat.id;
      const allBtns = elements.modalCategoryList.querySelectorAll('.modal-category-btn');
      allBtns.forEach(b => {
        b.classList.remove('active');
        b.style.backgroundColor = '';
        b.style.borderColor = '';
      });
      btn.classList.add('active');
      btn.style.backgroundColor = `${cat.color}22`;
      btn.style.borderColor = cat.color;
      
      // Update dynamic suggested action tags on category swap
      renderSuggestionChips(selectedCatId, 'modal-suggestion-chips', elements.modalNotesInput);
    });
    
    elements.modalCategoryList.appendChild(btn);
  });
  
  // Render Dynamic Suggestion Chips initially on modal open
  renderSuggestionChips(selectedCatId, 'modal-suggestion-chips', elements.modalNotesInput);
  
  elements.modal.classList.remove('hidden');
  
  // Hook save and clear actions
  elements.modalSaveBtn.onclick = () => {
    const segment = document.getElementById('modal-segment-input').value.trim();
    const notes = elements.modalNotesInput.value.trim();
    const eisenhowerSelect = document.getElementById('modal-eisenhower-select');
    const quadrant = eisenhowerSelect ? eisenhowerSelect.value : null;
    logInterval(startIdx, endIdx, selectedCatId, segment, notes, quadrant);
    closeLogModal();
  };
  
  elements.modalDeleteBtn.onclick = () => {
    clearIntervalRange(startIdx, endIdx);
    closeLogModal();
  };
}

function closeLogModal() {
  elements.modal.classList.add('hidden');
  clearGridSelection();
}

// ==========================================================================
// CORE STATE ACTIONS
// ==========================================================================
export function logInterval(startMin, endMin, categoryId, segment = '', notes = '', quadrant = null) {
  ensureLedgerExistsForDate(state.date);
  for (let idx = startMin; idx <= endMin; idx++) {
    state.ledger[state.date][idx] = { categoryId, segment, notes, quadrant };
  }
  saveStateToStorage();
  renderGrid();
  updateAnalytics();
  showToast(`Logged ${endMin - startMin + 1} minutes.`, 'success');
  triggerEvent('onLedgerUpdate');
}

export function clearIntervalRange(startMin, endMin) {
  ensureLedgerExistsForDate(state.date);
  for (let idx = startMin; idx <= endMin; idx++) {
    state.ledger[state.date][idx] = null;
  }
  saveStateToStorage();
  renderGrid();
  updateAnalytics();
  showToast(`Cleared ${endMin - startMin + 1} minutes.`, 'success');
  triggerEvent('onLedgerUpdate');
}

function selectActiveCategory(categoryId) {
  if (state.activeSession) {
    state.activeSession.categoryId = categoryId;
    saveStateToStorage();
    renderCategoryPresets();
    updateActiveCategoryUI();
    showToast(`Switched to ${getCategoryName(categoryId)}`, 'success');
  } else {
    // Instantly start tracking this category if not currently tracking
    startLiveTracking(categoryId);
  }
}

function updateActiveCategoryUI() {
  if (state.activeSession) {
    const cat = state.categories.find(c => c.id === state.activeSession.categoryId);
    if (cat) {
      elements.activeCategoryBadge.style.color = cat.color;
      elements.activeCategoryBadge.style.borderColor = cat.color;
      elements.activeCategoryBadge.querySelector('.badge-dot').style.backgroundColor = cat.color;
      elements.activeCategoryBadge.querySelector('.badge-text').textContent = cat.name;
    }
  } else {
    elements.activeCategoryBadge.style.color = '';
    elements.activeCategoryBadge.style.borderColor = '';
    elements.activeCategoryBadge.querySelector('.badge-dot').style.backgroundColor = '';
    elements.activeCategoryBadge.querySelector('.badge-text').textContent = 'Unallocated';
  }
}

// ==========================================================================
// TIMER ENGINE & LIVE TRACKER
// ==========================================================================
function startLiveTracking(categoryId = null) {
  initAudio(); // Resume sound system on interaction
  
  const finalCatId = categoryId || state.categories[0]?.id || 'deep-work';
  const segment = document.getElementById('live-segment-input').value.trim();
  state.activeSession = {
    startTime: Date.now(),
    categoryId: finalCatId,
    segment: segment,
    notes: elements.notesInput.value.trim()
  };
  
  saveStateToStorage();
  elements.trackerCard.classList.add('active');
  elements.trackerStatusText.textContent = 'Recording';
  elements.timerToggleBtn.className = 'btn btn-secondary';
  elements.timerBtnText.textContent = 'Pause';
  
  const toggleIcon = elements.timerToggleBtn.querySelector('i, svg');
  if (toggleIcon) {
    const newIcon = document.createElement('i');
    newIcon.setAttribute('data-lucide', 'pause');
    newIcon.className = 'btn-icon';
    toggleIcon.replaceWith(newIcon);
  }
  
  elements.timerStopBtn.disabled = false;
  
  updateActiveCategoryUI();
  renderCategoryPresets();
  if (window.lucide) lucide.createIcons();
  
  showToast(`Tracking: ${getCategoryName(finalCatId)}`, 'success');
  triggerEvent('onTrackerStart', state.activeSession);
}

function pauseLiveTracking() {
  if (!state.activeSession) return;
  
  // Force log tracked duration up to this point
  stopLiveTrackingAndCommit();
  showToast('Session paused.', 'success');
}

function stopLiveTrackingAndCommit() {
  if (!state.activeSession) return;
  
  const endTime = Date.now();
  const startTime = state.activeSession.startTime;
  const categoryId = state.activeSession.categoryId;
  const segment = document.getElementById('live-segment-input').value.trim() || state.activeSession.segment || '';
  const notes = elements.notesInput.value.trim() || state.activeSession.notes || '';
  
  const eisenhowerSelect = document.getElementById('live-eisenhower-select');
  const quadrant = eisenhowerSelect ? eisenhowerSelect.value : null;
  
  const getMinuteOfDay = (timestamp) => {
    const d = new Date(timestamp);
    const { hour, minute } = getLocalizedTimeParts(d);
    return hour * 60 + minute;
  };
  
  const startMin = getMinuteOfDay(startTime);
  const endMin = getMinuteOfDay(endTime);
  
  // Log inside the ledger if valid
  if (endMin >= startMin) {
    logInterval(startMin, endMin, categoryId, segment, notes, quadrant);
  } else {
    logInterval(startMin, 1439, categoryId, segment, notes, quadrant);
  }
  
  state.activeSession = null;
  saveStateToStorage();
  
  // Reset UI
  elements.trackerCard.classList.remove('active');
  elements.trackerStatusText.textContent = 'Ready to Record';
  elements.timerToggleBtn.className = 'btn btn-primary';
  elements.timerBtnText.textContent = 'Start Tracker';
  
  const toggleIcon = elements.timerToggleBtn.querySelector('i, svg');
  if (toggleIcon) {
    const newIcon = document.createElement('i');
    newIcon.setAttribute('data-lucide', 'play');
    newIcon.className = 'btn-icon';
    toggleIcon.replaceWith(newIcon);
  }
  
  elements.timerStopBtn.disabled = true;
  elements.timerDisplay.textContent = '00:00:00';
  elements.notesInput.value = '';
  document.getElementById('live-segment-input').value = '';
  
  updateActiveCategoryUI();
  renderCategoryPresets();
  if (window.lucide) lucide.createIcons();
  
  triggerEvent('onTrackerStop');
}

function startGlobalTimer() {
  if (secondsTicker) clearInterval(secondsTicker);
  
  // Primary ticker running clocks, timers, beepers, and dynamic clocks
  secondsTicker = setInterval(() => {
    const now = new Date();
    const { hour: curHour, minute: curMin, second: curSec } = getLocalizedTimeParts(now);
    
    // 1. Digital clock in header
    const hStr = String(curHour).padStart(2, '0');
    const mStr = String(curMin).padStart(2, '0');
    const sStr = String(curSec).padStart(2, '0');
    if (state.use24Hour) {
      elements.currentTime.textContent = `${hStr}:${mStr}:${sStr}`;
    } else {
      const ampm = curHour >= 12 ? 'PM' : 'AM';
      const displayH = curHour % 12 === 0 ? 12 : curHour % 12;
      elements.currentTime.textContent = `${String(displayH).padStart(2, '0')}:${mStr}:${sStr} ${ampm}`;
    }
    
    // 2. Vector SVG Clock Hand rotater
    updateLogoClockDials(now);
    
    // 3. Dynamic HSL Time-of-Day Accent Swapper
    updateTimeOfDayAccent(now);
    
    // 4. Active Session timer incrementer
    if (state.activeSession) {
      const elapsedMs = Date.now() - state.activeSession.startTime;
      const hours = String(Math.floor(elapsedMs / 3600000)).padStart(2, '0');
      const minutes = String(Math.floor((elapsedMs % 3600000) / 60000)).padStart(2, '0');
      const seconds = String(Math.floor((elapsedMs % 60000) / 1000)).padStart(2, '0');
      elements.timerDisplay.textContent = `${hours}:${minutes}:${seconds}`;
      
      const getMinuteOfDay = (timestamp) => {
        const d = new Date(timestamp);
        const { hour, minute } = getLocalizedTimeParts(d);
        return hour * 60 + minute;
      };
      const startMin = getMinuteOfDay(state.activeSession.startTime);
      const curMinOfDay = getMinuteOfDay(Date.now());
      if (curMinOfDay >= startMin) {
        ensureLedgerExistsForDate(state.date);
        const segment = document.getElementById('live-segment-input').value.trim() || state.activeSession.segment || '';
        for (let m = startMin; m <= curMinOfDay; m++) {
          state.ledger[state.date][m] = { 
            categoryId: state.activeSession.categoryId, 
            segment: segment,
            notes: elements.notesInput.value.trim() 
          };
        }
        renderGrid();
        updateAnalytics();
      }
    }
    
    // 5. Audio Beepers Trigger check
    if (curSec === 0) {
      // Top of the Hour check
      if (curMin === 0 && curHour !== lastHourChecked) {
        lastHourChecked = curHour;
        playHourlyChime();
        showToast('Hour chime triggered.', 'success');
      }
      
      // 10-Minute cross check
      if (curMin % 10 === 0 && curMin !== 0 && curMin !== lastTenMinChecked) {
        lastTenMinChecked = curMin;
        playTenMinBip();
      }
    }
    
    // Invoke active plugins onTick hooks
    triggerEvent('onTick', now);
  }, 1000);
}

// ==========================================================================
// ANALYTICS & STATS CALCULATOR
// ==========================================================================
function updateAnalytics() {
  ensureLedgerExistsForDate(state.date);
  const dayLogs = state.ledger[state.date];
  
  let loggedMins = 0;
  let gapMins = 0;
  
  dayLogs.forEach(entry => {
    if (entry) loggedMins++;
    else gapMins++;
  });
  
  const completion = ((loggedMins / 1440) * 100).toFixed(1);
  elements.completionPercentage.textContent = `${completion}%`;
  
  elements.statsTotalGaps.textContent = `${gapMins} min${gapMins !== 1 ? 's' : ''}`;
  elements.statsTotalLogged.textContent = `${loggedMins} min${loggedMins !== 1 ? 's' : ''}`;
}

// ==========================================================================
// INTERACTIVE EVENT HANDLERS
// ==========================================================================
function initEventListeners() {
  // Theme Toggle click listener
  elements.themeToggleBtn.addEventListener('click', toggleTheme);

  // Navigation Tabs (Event Delegation)
  const navContainer = document.querySelector('.sidebar-tabs');
  if (navContainer) {
    navContainer.addEventListener('click', (e) => {
      const tab = e.target.closest('.tab-link');
      if (!tab) return;
      
      const allTabs = navContainer.querySelectorAll('.tab-link');
      const allPanels = document.querySelectorAll('.tab-panel');
      
      allTabs.forEach(t => t.classList.remove('active'));
      allPanels.forEach(p => p.classList.remove('active'));
      
      tab.classList.add('active');
      const targetPanel = document.getElementById(tab.dataset.tab);
      if (targetPanel) targetPanel.classList.add('active');
    });
  }
  
  // Date Navigation
  elements.datePicker.addEventListener('change', (e) => {
    state.date = e.target.value;
    updateDateDisplay();
    renderGrid();
    updateAnalytics();
    triggerEvent('onLedgerUpdate');
  });

  elements.datePrev.addEventListener('click', () => adjustDate(-1));
  elements.dateNext.addEventListener('click', () => adjustDate(1));
  
  function adjustDate(daysOffset) {
    const d = new Date(state.date);
    d.setDate(d.getDate() + daysOffset);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    state.date = `${year}-${month}-${day}`;
    elements.datePicker.value = state.date;
    updateDateDisplay();
    renderGrid();
    updateAnalytics();
    triggerEvent('onLedgerUpdate');
  }

  // Live Timer buttons
  elements.timerToggleBtn.addEventListener('click', () => {
    if (state.activeSession) {
      pauseLiveTracking();
    } else {
      startLiveTracking();
    }
  });
  
  elements.timerStopBtn.addEventListener('click', () => {
    stopLiveTrackingAndCommit();
    showToast('Session logged successfully.', 'success');
  });

  elements.clearDayBtn.addEventListener('click', () => {
    if (confirm('Clear the entire ledger for today?')) {
      state.ledger[state.date] = Array(1440).fill(null);
      saveStateToStorage();
      renderGrid();
      updateAnalytics();
      showToast('Ledger cleared.', 'success');
      triggerEvent('onLedgerUpdate');
    }
  });

  // Modal Cancel/Close buttons
  elements.modalCancelBtn.addEventListener('click', closeLogModal);
  elements.modalCloseBtn.addEventListener('click', closeLogModal);
  
  // Sound controls
  elements.enableAudio.addEventListener('change', (e) => {
    soundConfig.enabled = e.target.checked;
    saveStateToStorage();
  });
  
  elements.volumeSlider.addEventListener('input', (e) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    elements.volumeVal.textContent = `${Math.round(vol * 100)}%`;
  });
  
  elements.volumeSlider.addEventListener('change', () => {
    saveStateToStorage();
  });

  elements.enableHour.addEventListener('change', (e) => {
    soundConfig.hourChimeEnabled = e.target.checked;
    saveStateToStorage();
  });

  elements.hourFreq.addEventListener('change', (e) => {
    soundConfig.hourFrequency = parseFloat(e.target.value);
    saveStateToStorage();
  });

  elements.hourDur.addEventListener('change', (e) => {
    soundConfig.hourDuration = parseFloat(e.target.value);
    saveStateToStorage();
  });

  elements.enable10min.addEventListener('change', (e) => {
    soundConfig.tenMinBipEnabled = e.target.checked;
    saveStateToStorage();
  });

  elements.tenMinFreq.addEventListener('change', (e) => {
    soundConfig.tenMinFrequency = parseFloat(e.target.value);
    saveStateToStorage();
  });

  elements.tenMinDur.addEventListener('change', (e) => {
    soundConfig.tenMinDuration = parseFloat(e.target.value);
    saveStateToStorage();
  });

  // Time Zone & Format Customization Listeners
  const tzSelect = document.getElementById('settings-timezone');
  if (tzSelect) {
    tzSelect.addEventListener('change', (e) => {
      state.timeZone = e.target.value;
      saveStateToStorage();
      
      // Update date representation & full ledger grids in alignment with the chosen timezone
      initDate();
      renderGrid();
      updateAnalytics();
      triggerEvent('onLedgerUpdate');
      showToast(`Timezone aligned to: ${state.timeZone === 'local' ? 'Browser Time' : state.timeZone}`, 'success');
    });
  }

  const formatCheck = document.getElementById('settings-time-format');
  if (formatCheck) {
    formatCheck.addEventListener('change', (e) => {
      state.use24Hour = e.target.checked;
      saveStateToStorage();
      
      // Re-draw grids & analytics elements
      renderGrid();
      updateAnalytics();
      triggerEvent('onLedgerUpdate');
      showToast(`Clock format switched to ${state.use24Hour ? '24-Hour' : '12-Hour'}`, 'success');
    });
  }

  // Test beep listeners
  elements.testHourBtn.addEventListener('click', () => {
    initAudio();
    playHourlyChime();
  });

  elements.test10minBtn.addEventListener('click', () => {
    initAudio();
    playTenMinBip();
  });

  // Category dynamic adding
  elements.addCategoryBtn.addEventListener('click', () => {
    const id = `custom-${Date.now()}`;
    const newCat = {
      id,
      name: `Custom Activity`,
      color: '#a855f7',
      icon: '📌'
    };
    state.categories.push(newCat);
    saveStateToStorage();
    renderCategoryPresets();
    showToast('Category added.', 'success');
  });

  // Custom Segment / Project dynamic adding
  const addSegmentBtn = document.getElementById('add-segment-btn');
  const newSegmentIn = document.getElementById('new-segment-input');
  if (addSegmentBtn && newSegmentIn) {
    addSegmentBtn.addEventListener('click', () => {
      const val = newSegmentIn.value.trim();
      if (val && !state.segments.includes(val)) {
        state.segments.push(val);
        saveStateToStorage();
        refreshSegmentsDatalist();
        newSegmentIn.value = '';
        showToast(`Segment "${val}" added.`, 'success');
      } else if (state.segments.includes(val)) {
        showToast('Segment already exists.', 'error');
      }
    });
  }

  // Backup Import/Export
  elements.exportJsonBtn.addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `tracks-backup-${state.date}.json`);
    dlAnchorElem.click();
    showToast('Logs exported.', 'success');
  });

  elements.importJsonFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target.result);
        if (parsed.categories && parsed.ledger) {
          state.categories = parsed.categories;
          state.ledger = parsed.ledger;
          if (parsed.enabledPlugins) state.enabledPlugins = parsed.enabledPlugins;
          state.theme = parsed.theme || 'dark';
          saveStateToStorage();
          initTheme();
          renderCategoryPresets();
          renderGrid();
          updateAnalytics();
          syncSettingsUIWithSoundConfig();
          showToast('Backup restored successfully.', 'success');
          triggerEvent('onLedgerUpdate');
        } else {
          showToast('Invalid JSON structure.', 'error');
        }
      } catch (err) {
        showToast('Failed to parse backup.', 'error');
      }
    };
    reader.readAsText(file);
  });

  // PWA installer hook
  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    elements.installPwaBtn.classList.remove('hidden');
  });

  elements.installPwaBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        elements.installPwaBtn.classList.add('hidden');
      }
      deferredPrompt = null;
    }
  });
}

// ==========================================================================
// NOTIFICATIONS (TOASTS)
// ==========================================================================
export function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'toast-error' : ''}`;
  
  let icon = 'check';
  if (type === 'error') icon = 'alert-triangle';
  
  toast.innerHTML = `
    <i data-lucide="${icon}"></i>
    <span>${message}</span>
  `;
  
  elements.toastContainer.appendChild(toast);
  if (window.lucide) lucide.createIcons();
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.2s ease';
    setTimeout(() => toast.remove(), 200);
  }, 2500);
}

// ==========================================================================
// EXTENSIBLE PLUGIN FRAMEWORK
// ==========================================================================
export function registerPlugin(id, descriptor) {
  registeredPlugins[id] = descriptor;
}

function loadPlugins() {
  elements.pluginsList.innerHTML = '';
  
  Object.keys(registeredPlugins).forEach(id => {
    const plugin = registeredPlugins[id];
    const isEnabled = state.enabledPlugins.includes(id);
    
    const card = document.createElement('div');
    card.className = 'plugin-card';
    card.innerHTML = `
      <div class="plugin-checkbox-wrapper">
        <label class="toggle-switch">
          <input type="checkbox" data-plugin-id="${id}" ${isEnabled ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      </div>
      <div class="plugin-info">
        <h4>${plugin.name}</h4>
        <p>${plugin.description}</p>
      </div>
    `;
    
    const checkbox = card.querySelector('input');
    checkbox.addEventListener('change', (e) => {
      togglePluginState(id, e.target.checked);
    });
    
    elements.pluginsList.appendChild(card);
    
    if (isEnabled) {
      enablePluginInstance(id);
    }
  });
}

function togglePluginState(id, makeActive) {
  if (makeActive) {
    if (!state.enabledPlugins.includes(id)) {
      state.enabledPlugins.push(id);
    }
    enablePluginInstance(id);
    showToast(`Enabled: ${registeredPlugins[id].name}`, 'success');
  } else {
    state.enabledPlugins = state.enabledPlugins.filter(pId => pId !== id);
    disablePluginInstance(id);
    showToast(`Disabled: ${registeredPlugins[id].name}`, 'error');
  }
  saveStateToStorage();
}

function enablePluginInstance(id) {
  const descriptor = registeredPlugins[id];
  if (!descriptor) return;
  
  try {
    const instance = descriptor.bootstrap(state, {
      logInterval,
      clearIntervalRange,
      showToast,
      getCategoryName,
      addSidebarTab(tabId, label, iconName, panelHtml) {
        const nav = document.querySelector('.sidebar-tabs');
        if (nav && !document.getElementById(`tab-btn-${tabId}`)) {
          const btn = document.createElement('button');
          btn.className = 'tab-link';
          btn.dataset.tab = `tab-${tabId}`;
          btn.id = `tab-btn-${tabId}`;
          btn.innerHTML = `<i data-lucide="${iconName}"></i> ${label}`;
          nav.appendChild(btn);
        }
        
        const panelsContainer = document.querySelector('.sidebar-panels-container');
        if (panelsContainer && !document.getElementById(`tab-${tabId}`)) {
          const panel = document.createElement('div');
          panel.className = 'tab-panel glass-card';
          panel.id = `tab-${tabId}`;
          panel.innerHTML = panelHtml;
          panelsContainer.appendChild(panel);
        }
        
        if (window.lucide) {
          lucide.createIcons();
        }
        
        return document.getElementById(`tab-${tabId}`);
      },
      removeSidebarTab(tabId) {
        const btn = document.getElementById(`tab-btn-${tabId}`);
        const panel = document.getElementById(`tab-${tabId}`);
        
        if (btn && btn.classList.contains('active')) {
          const modulesTab = document.querySelector('.sidebar-tabs [data-tab="tab-plugins"]');
          if (modulesTab) {
            modulesTab.click();
          }
        }
        
        if (btn) btn.remove();
        if (panel) panel.remove();
      }
    });
    
    activePluginInstances[id] = instance;
    
    if (instance.onInit) {
      instance.onInit();
    }
  } catch (err) {
    console.error(`Error enabling plugin ${id}:`, err);
  }
}

function disablePluginInstance(id) {
  const instance = activePluginInstances[id];
  if (!instance) return;
  
  try {
    if (instance.onDestroy) {
      instance.onDestroy();
    }
  } catch (err) {
    console.error(`Error destroying plugin ${id}:`, err);
  }
  
  delete activePluginInstances[id];
  
  const placeholderNode = document.querySelector(`#plugin-${id}-root`);
  if (placeholderNode) {
    placeholderNode.innerHTML = `
      <div class="plugin-placeholder">
        <i data-lucide="blocks" class="placeholder-icon"></i>
        <p>Enable the ${registeredPlugins[id].name} module.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  }
}

function triggerEvent(eventName, ...args) {
  Object.keys(activePluginInstances).forEach(id => {
    const instance = activePluginInstances[id];
    if (instance && typeof instance[eventName] === 'function') {
      try {
        instance[eventName](...args);
      } catch (err) {
        console.error(`Error running plugin event ${id}.${eventName}:`, err);
      }
    }
  });
}

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      console.log('[PWA] Service Worker active:', reg.scope);
    }).catch(err => {
      console.warn('[PWA] Service Worker failed:', err);
    });
  });
}

// ==========================================================================
// DYNAMIC CHIPS & VOICE SPEECH TRANSCRIPTION HELPERS
// ==========================================================================
const SUGGESTIONS_MAP = {
  'deep-work': ['Coding', 'Debugging', 'Researching', 'Writing Docs', 'Reviewing PRs', 'System Design'],
  'recharge': ['Walking', 'Meditation', 'Power Nap', 'Coffee Break', 'Stretching', 'Offline Break'],
  'admin': ['Email/Slack', 'Daily Standup', 'Weekly Sync', 'Filing Expenses', 'Planning Tasks', 'Reviewing Logs'],
  'leisure': ['Social Media', 'Lunch/Dinner', 'Gym Workout', 'Gaming', 'Reading Book', 'Watching Video']
};

/**
 * Renders sleek suggested activity pills based on the active category.
 */
function renderSuggestionChips(categoryId, targetContainerId, inputElement) {
  const container = document.getElementById(targetContainerId);
  if (!container || !inputElement) return;
  
  container.innerHTML = '';
  
  // Lookup suggestions (fallback to generic tags if custom category is chosen)
  const keywords = SUGGESTIONS_MAP[categoryId] || ['Planning', 'Admin Task', 'Focused Work', 'Resting', 'Bio-break'];
  
  keywords.forEach(keyword => {
    const chip = document.createElement('span');
    chip.className = 'suggestion-chip';
    chip.textContent = keyword;
    
    chip.addEventListener('click', () => {
      inputElement.value = keyword;
      inputElement.dispatchEvent(new Event('input')); // trigger listeners
      inputElement.focus();
    });
    
    container.appendChild(chip);
  });
}

/**
 * Configures browser SpeechRecognition API for hands-free local notes logging.
 */
function setupSpeechRecognition(micBtnElement, inputFieldElement) {
  if (!micBtnElement || !inputFieldElement) return;
  
  const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognitionClass) {
    micBtnElement.style.opacity = '0.35';
    micBtnElement.title = 'Speech recognition not supported on this browser';
    return;
  }
  
  let recognition = new SpeechRecognitionClass();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';
  
  let isListening = false;
  
  micBtnElement.addEventListener('click', (e) => {
    e.preventDefault();
    initAudio(); // ensure AudioContext is active
    
    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  });
  
  recognition.onstart = () => {
    isListening = true;
    micBtnElement.classList.add('recording');
    showToast('Voice dictation active... Speak now!', 'success');
  };
  
  recognition.onend = () => {
    isListening = false;
    micBtnElement.classList.remove('recording');
  };
  
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    if (transcript) {
      // Prefill voice text into input field
      inputFieldElement.value = transcript;
      inputFieldElement.dispatchEvent(new Event('input'));
      showToast('Speech transcribed successfully!', 'success');
    }
  };
  
  recognition.onerror = (event) => {
    console.warn('[Speech Engine] Recognition error:', event.error);
    isListening = false;
    micBtnElement.classList.remove('recording');
    if (event.error === 'not-allowed') {
      showToast('Microphone access denied. Check browser permissions.', 'error');
    } else {
      showToast(`Voice capture failed: ${event.error}`, 'error');
    }
  };
}

/**
 * Refreshes segment datalists and settings config list for extreme project tracking.
 */
export function refreshSegmentsDatalist() {
  const datalist = document.getElementById('custom-segments-datalist');
  const settingsList = document.getElementById('settings-segments-list');
  if (!datalist) return;
  
  // 1. Populate Datalist Autocompletes
  datalist.innerHTML = '';
  state.segments.forEach(seg => {
    const opt = document.createElement('option');
    opt.value = seg;
    datalist.appendChild(opt);
  });
  
  // 2. Populate Settings Segment Management List
  if (settingsList) {
    settingsList.innerHTML = '';
    state.segments.forEach(seg => {
      const item = document.createElement('div');
      item.className = 'category-config-item';
      item.innerHTML = `
        <input type="text" value="${seg}" class="cyber-input flex-1" readonly style="cursor: default">
        <button class="btn btn-danger btn-xs btn-icon-only remove-seg-btn" title="Delete Segment"><i data-lucide="trash-2"></i></button>
      `;
      
      const removeBtn = item.querySelector('.remove-seg-btn');
      removeBtn.addEventListener('click', () => {
        state.segments = state.segments.filter(s => s !== seg);
        saveStateToStorage();
        refreshSegmentsDatalist();
        showToast(`Segment "${seg}" deleted.`, 'error');
      });
      
      settingsList.appendChild(item);
    });
    if (window.lucide) lucide.createIcons();
  }
}

