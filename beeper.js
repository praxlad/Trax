/**
 * Chronos Grid - Mindfulness Sound Synthesizer Engine
 * Powered by Web Audio API for offline, customizable, low-latency auditory feedback.
 */

let audioCtx = null;
let masterGainNode = null;

// Default configuration (saved and loaded from app state)
export const soundConfig = {
  enabled: true,
  volume: 0.2, // 0 to 1
  hourChimeEnabled: true,
  hourFrequency: 523.25, // C5 note
  hourDuration: 0.8, // seconds
  tenMinBipEnabled: true,
  tenMinFrequency: 880, // A5 note
  tenMinDuration: 0.15 // seconds
};

/**
 * Initializes the Audio Context on first user interaction.
 * Crucial to bypass browser auto-play restrictions.
 */
export function initAudio() {
  if (audioCtx) return;

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();
    
    // Create master volume controller
    masterGainNode = audioCtx.createGain();
    masterGainNode.gain.setValueAtTime(soundConfig.volume, audioCtx.currentTime);
    masterGainNode.connect(audioCtx.destination);
    
    console.log('[Audio Engine] Web Audio Synthesizer initialized successfully.');
  } catch (error) {
    console.error('[Audio Engine] Failed to initialize Web Audio API:', error);
  }
}

/**
 * Ensures the Audio Context is resumed.
 */
async function resumeAudioContext() {
  initAudio();
  if (audioCtx && audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
}

/**
 * Sets the master synth volume dynamically.
 * @param {number} value - Volume between 0.0 and 1.0
 */
export function setVolume(value) {
  soundConfig.volume = Math.max(0, Math.min(1, value));
  if (masterGainNode && audioCtx) {
    masterGainNode.gain.setValueAtTime(soundConfig.volume, audioCtx.currentTime);
  }
}

/**
 * Core synthesis function. Generates a custom synth note with volume envelope.
 */
function playTone({ frequency, duration, type = 'sine', decayTime = 0.05, customGainCurve = null }) {
  if (!soundConfig.enabled || !audioCtx) return;

  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);

  // Apply volume envelope (attack-decay) to prevent clicking pops
  const now = audioCtx.currentTime;
  gainNode.gain.setValueAtTime(0.0001, now);
  
  if (customGainCurve) {
    customGainCurve(gainNode.gain, now, duration);
  } else {
    // Standard exponential decay envelope
    const peakTime = now + 0.01;
    gainNode.gain.linearRampToValueAtTime(1.0, peakTime); // 10ms attack
    gainNode.gain.setValueAtTime(1.0, peakTime); // Explicit anchor!
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  }

  // Connect nodes
  osc.connect(gainNode);
  gainNode.connect(masterGainNode);

  // Start and stop oscillator
  osc.start(now);
  osc.stop(now + duration);
}

/**
 * Plays a rich, resonance-laden hourly chime (glowing synth chord).
 * Synthesizes a primary frequency and a harmonic fifth for a premium, clean digital chime.
 */
export async function playHourlyChime() {
  await resumeAudioContext();
  if (!soundConfig.enabled || !soundConfig.hourChimeEnabled) return;

  const freq1 = parseFloat(soundConfig.hourFrequency) || 523.25;
  const freq2 = freq1 * 1.5; // Perfect Fifth harmonic
  const duration = parseFloat(soundConfig.hourDuration) || 0.8;

  // Render chime with triangle wave for a softer wind-chime timbre
  playTone({
    frequency: freq1,
    duration: duration,
    type: 'triangle',
    customGainCurve: (gain, now, dur) => {
      const peakTime = now + 0.03;
      gain.linearRampToValueAtTime(0.8, peakTime);
      gain.setValueAtTime(0.8, peakTime); // Anchor peak to bypass silent exponential ramp bugs
      gain.exponentialRampToValueAtTime(0.0001, now + dur);
    }
  });

  // Render upper fifth harmonic slightly quieter with a sine wave for warmth
  playTone({
    frequency: freq2,
    duration: duration * 0.9,
    type: 'sine',
    customGainCurve: (gain, now, dur) => {
      const peakTime = now + 0.05;
      gain.linearRampToValueAtTime(0.4, peakTime);
      gain.setValueAtTime(0.4, peakTime); // Anchor peak to bypass silent exponential ramp bugs
      gain.exponentialRampToValueAtTime(0.0001, now + dur);
    }
  });
}

/**
 * Plays a short electronic bip (two rapid clicks) for 10-minute intervals.
 */
export async function playTenMinBip() {
  await resumeAudioContext();
  if (!soundConfig.enabled || !soundConfig.tenMinBipEnabled) return;

  const freq = parseFloat(soundConfig.tenMinFrequency) || 880;
  const duration = parseFloat(soundConfig.tenMinDuration) || 0.15;

  // First quick beep
  playTone({
    frequency: freq,
    duration: duration * 0.4,
    type: 'sine',
    customGainCurve: (gain, now, dur) => {
      const peakTime = now + 0.005;
      gain.linearRampToValueAtTime(0.8, peakTime);
      gain.setValueAtTime(0.8, peakTime); // Anchor peak to bypass silent exponential ramp bugs
      gain.exponentialRampToValueAtTime(0.0001, now + dur);
    }
  });

  // Second quick beep following 100ms later
  setTimeout(() => {
    if (!soundConfig.enabled || !soundConfig.tenMinBipEnabled) return;
    playTone({
      frequency: freq * 1.2, // slightly higher pitch for second click
      duration: duration * 0.5,
      type: 'sine',
      customGainCurve: (gain, now, dur) => {
        const peakTime = now + 0.005;
        gain.linearRampToValueAtTime(0.8, peakTime);
        gain.setValueAtTime(0.8, peakTime); // Anchor peak to bypass silent exponential ramp bugs
        gain.exponentialRampToValueAtTime(0.0001, now + dur);
      }
    });
  }, 100);
}

// Hook up global initializer to screen touch/clicks
document.addEventListener('click', () => {
  resumeAudioContext().catch(e => console.warn('Could not resume audio:', e));
}, { once: true });
document.addEventListener('keydown', () => {
  resumeAudioContext().catch(e => console.warn('Could not resume audio:', e));
}, { once: true });
document.addEventListener('touchstart', () => {
  resumeAudioContext().catch(e => console.warn('Could not resume audio:', e));
}, { once: true });
