// ── Açılış animasyonu (splash) ─────────────────────────────────
(function initSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;
  // ~6.5 sn göster, sonra fade ile kaybolup kaldır
  setTimeout(() => splash.classList.add('hide'), 6500);
  setTimeout(() => splash.remove(), 7700);
})();

// ── Settings ──────────────────────────────────────────────────
const settings = {
  format:      localStorage.getItem('format')      || '24',
  seconds:     localStorage.getItem('seconds')     !== 'false',
  timezone:    localStorage.getItem('timezone')    || 'Europe/Istanbul',
  alwaysTop:   localStorage.getItem('alwaysTop')   !== 'false',
  theme:       localStorage.getItem('theme')       || 'classic',
  showDate:    localStorage.getItem('showDate')    !== 'false',
  opacity:     parseFloat(localStorage.getItem('opacity') || '1'),
  shortcuts:   localStorage.getItem('shortcuts')   !== 'false',
  drift:       localStorage.getItem('drift')       === 'true',
  // Ses ayarları
  volume:      parseFloat(localStorage.getItem('volume')      || '0.6'),
  alarmSound:  localStorage.getItem('alarmSound')  !== 'false',
  fadeAlarm:   localStorage.getItem('fadeAlarm')   !== 'false',
  tickSound:   localStorage.getItem('tickSound')   === 'true',
  // Pomodoro ayarları
  pomoWork:    parseInt(localStorage.getItem('pomoWork')   || '25'),
  pomoShort:   parseInt(localStorage.getItem('pomoShort')  || '5'),
  pomoLong:    parseInt(localStorage.getItem('pomoLong')   || '15'),
  pomoCycles:  parseInt(localStorage.getItem('pomoCycles') || '4'),
};

function saveSetting(key, val) {
  settings[key] = val;
  localStorage.setItem(key, val);
}

// ── Window controls ────────────────────────────────────────────
document.getElementById('btnClose').addEventListener('click', (e) => {
  e.stopPropagation();
  window.electronAPI.closeApp();
});
document.getElementById('btnMinimize').addEventListener('click', (e) => {
  e.stopPropagation();
  window.electronAPI.minimizeApp();
});
document.getElementById('btnMaximize').addEventListener('click', (e) => {
  e.stopPropagation();
  toggleMaximize();
});

// Maximize toggle (hem buton hem kısayol kullanır)
let isMaximized = false;
function toggleMaximize() {
  window.electronAPI.toggleMaximize();
}

window.electronAPI.onWindowState((state) => {
  isMaximized = state === 'maximized';
  document.body.classList.toggle('maximized', isMaximized);
  if (isMaximized) {
    const availH = window.innerHeight - 90;
    const availW = window.innerWidth - 60;
    const zoom = Math.min(availW / 500, availH / 150) * 0.72;
    document.documentElement.style.setProperty('--zoom', zoom);
    // Maksimizede drift devre dışı
    document.body.classList.remove('screensaver');
  }
});

// ── Pencere sürükleme ──────────────────────────────────────────
// Sürükleme native olarak CSS -webkit-app-region: drag ile yapılır
// (titlebar). JS tabanlı sürükleme HiDPI ekranlarda pencereyi büyütüyordu.

// ── Flip card engine ───────────────────────────────────────────
const cards = {
  'hours-tens':   document.getElementById('hours-tens'),
  'hours-ones':   document.getElementById('hours-ones'),
  'minutes-tens': document.getElementById('minutes-tens'),
  'minutes-ones': document.getElementById('minutes-ones'),
  'seconds-tens': document.getElementById('seconds-tens'),
  'seconds-ones': document.getElementById('seconds-ones'),
};

const current = {
  'hours-tens': -1, 'hours-ones': -1,
  'minutes-tens': -1, 'minutes-ones': -1,
  'seconds-tens': -1, 'seconds-ones': -1,
};

function setCardImmediate(card, digit) {
  const s = String(digit);
  card.querySelector('.card-top span').textContent = s;
  card.querySelector('.card-bottom span').textContent = s;
  card.querySelector('.flip-top span').textContent = s;
  card.querySelector('.flip-bottom span').textContent = s;
}

function flipCard(card, oldDigit, newDigit) {
  const old = String(oldDigit);
  const next = String(newDigit);
  card.querySelector('.card-top span').textContent = next;
  card.querySelector('.card-bottom span').textContent = next;
  card.querySelector('.flip-top span').textContent = old;
  card.querySelector('.flip-bottom span').textContent = next;
  card.classList.remove('flipping');
  void card.offsetWidth;
  card.classList.add('flipping');
  setTimeout(() => {
    card.querySelector('.flip-top span').textContent = next;
    card.classList.remove('flipping');
  }, 460);
}

function updateCards(h, m, s) {
  const values = {
    'hours-tens':   Math.floor(h / 10),
    'hours-ones':   h % 10,
    'minutes-tens': Math.floor(m / 10),
    'minutes-ones': m % 10,
    'seconds-tens': Math.floor(s / 10),
    'seconds-ones': s % 10,
  };
  for (const [id, newVal] of Object.entries(values)) {
    if (current[id] !== newVal) {
      if (current[id] === -1) {
        setCardImmediate(cards[id], newVal);
      } else {
        flipCard(cards[id], current[id], newVal);
      }
      current[id] = newVal;
    }
  }
}

function resetCurrentValues() {
  for (const key of Object.keys(current)) current[key] = -1;
}

// ── Mode management ────────────────────────────────────────────
let currentMode = 'clock';

document.querySelectorAll('.mode-tab[data-mode]').forEach(tab => {
  tab.addEventListener('click', () => {
    const mode = tab.dataset.mode;
    if (mode === currentMode) return;
    switchMode(mode);
  });
});

function switchMode(mode) {
  document.querySelectorAll('.mode-tab[data-mode]').forEach(t => {
    t.classList.toggle('active', t.dataset.mode === mode);
  });
  document.body.classList.remove('mode-clock', 'mode-stopwatch', 'mode-timer', 'mode-pomodoro');
  document.body.classList.add('mode-' + mode);

  // Mod değişiminde UI'ı her zaman görünür yap (gizli kalmışsa kontroller erişilebilir olsun)
  document.body.classList.remove('ui-hidden');

  stopwatchStop();
  timerStop();
  pomodoroStop();

  currentMode = mode;
  resetCurrentValues();

  // Tarih sadece clock modunda görünür
  updateDateVisibility();

  if (mode === 'clock') {
    updateClock();
  } else if (mode === 'stopwatch') {
    updateCards(0, 0, 0);
    resetCurrentValues();
    updateCards(0, 0, 0);
  } else if (mode === 'timer') {
    const th = parseInt(document.getElementById('timerH').value) || 0;
    const tm = parseInt(document.getElementById('timerM').value) || 0;
    const ts = parseInt(document.getElementById('timerS').value) || 0;
    timerRemaining = th * 3600 + tm * 60 + ts;
    showTimerCards();
  } else if (mode === 'pomodoro') {
    pomodoroInit();
  }

  // Panel açıksa yeni modun kartlarına göre yüksekliği güncelle
  if (settingsBar && settingsBar.classList.contains('open') && !isMaximized) {
    setTimeout(() => updateSettingsBarHeight(), 0);
  }
}

// ── Web Audio altyapısı ────────────────────────────────────────
let audioCtx = null;

// AudioContext'i lazy init et (kullanıcı etkileşimi sonrası)
function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// İlk etkileşimde AudioContext'i hazırla
document.addEventListener('click', () => { getAudioCtx(); }, { once: true });
document.addEventListener('keydown', () => { getAudioCtx(); }, { once: true });

/**
 * Tek ton çal
 * @param {Object} opts
 * @param {number} opts.freq      - Frekans (Hz)
 * @param {number} opts.duration  - Süre (saniye)
 * @param {string} [opts.type]    - Dalga tipi: 'sine', 'square', 'triangle', 'sawtooth'
 * @param {number} [opts.volume]  - Ses seviyesi (0-1)
 * @param {number} [opts.fadeIn]  - Yükseklik süresi (saniye), 0 = anında
 * @param {number} [opts.delay]   - Başlama gecikmesi (saniye)
 */
function playTone({ freq, duration, type = 'sine', volume, fadeIn = 0, delay = 0 }) {
  const ctx = getAudioCtx();
  const vol = (volume !== undefined) ? volume : settings.volume;

  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.type = type;
  osc.frequency.value = freq;

  const startAt = ctx.currentTime + delay;
  const endAt   = startAt + duration;

  if (fadeIn > 0) {
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(vol, startAt + fadeIn);
    // Sonunda kısa fade-out
    gain.gain.setValueAtTime(vol, endAt - 0.05);
    gain.gain.linearRampToValueAtTime(0, endAt);
  } else {
    gain.gain.setValueAtTime(vol, startAt);
    gain.gain.setValueAtTime(vol, endAt - 0.05);
    gain.gain.linearRampToValueAtTime(0, endAt);
  }

  osc.start(startAt);
  osc.stop(endAt);
}

/**
 * Sayaç bitiş alarmı: 4 yükselen bip
 */
function playAlarm() {
  if (!settings.alarmSound) return;
  const freqs    = [440, 550, 660, 880];
  const fade     = settings.fadeAlarm ? 0.12 : 0;
  freqs.forEach((f, i) => {
    playTone({ freq: f, duration: 0.3, type: 'sine', fadeIn: fade, delay: i * 0.35 });
  });
}

/**
 * Kısa tik sesi (saniye değişimi)
 */
function playTick() {
  if (!settings.tickSound) return;
  playTone({ freq: 2000, duration: 0.02, type: 'sine', volume: settings.volume * 0.4 });
}

/**
 * Pomodoro faz geçiş sesi (hafif, iki ton)
 */
function playPomodoroChime() {
  playTone({ freq: 660, duration: 0.25, type: 'sine', delay: 0 });
  playTone({ freq: 880, duration: 0.25, type: 'sine', delay: 0.3 });
}

// ── Clock mode ─────────────────────────────────────────────────
let clockInterval = null;

function getTimeInZone() {
  const tz = settings.timezone;
  if (tz === 'local') {
    const now = new Date();
    return { h: now.getHours(), m: now.getMinutes(), s: now.getSeconds() };
  }
  try {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone: tz,
      hour: 'numeric', minute: 'numeric', second: 'numeric',
      hour12: false,
    }).formatToParts(new Date());
    const get = (t) => parseInt(parts.find(p => p.type === t)?.value || '0');
    return { h: get('hour') % 24, m: get('minute'), s: get('second') };
  } catch {
    const now = new Date();
    return { h: now.getHours(), m: now.getMinutes(), s: now.getSeconds() };
  }
}

// ── Tarih gösterimi ────────────────────────────────────────────
const dateDisplayEl = document.getElementById('dateDisplay');

function updateDateDisplay() {
  if (currentMode !== 'clock') return;
  const tz = settings.timezone === 'local' ? undefined : settings.timezone;
  try {
    const fmt = new Intl.DateTimeFormat('tr-TR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: tz,
    });
    dateDisplayEl.textContent = fmt.format(new Date());
  } catch {
    dateDisplayEl.textContent = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
}

function updateDateVisibility() {
  const visible = settings.showDate && currentMode === 'clock';
  dateDisplayEl.style.display = visible ? '' : 'none';
}

function updateClock() {
  if (currentMode !== 'clock') return;
  let { h, m, s } = getTimeInZone();
  const ampmEl = document.getElementById('ampm');

  if (settings.format === '12') {
    const isPM = h >= 12;
    h = h % 12 || 12;
    ampmEl.textContent = isPM ? 'PM' : 'AM';
  } else {
    ampmEl.textContent = '';
  }
  // Saniye değişiminde tik sesi (seconds gizliyse çalma)
  if (settings.seconds && settings.tickSound) {
    const prevOnes = current['seconds-ones'];
    const newOnes  = s % 10;
    if (prevOnes !== -1 && prevOnes !== newOnes) playTick();
  }
  updateCards(h, m, settings.seconds ? s : 0);
  updateDateDisplay();
}

clockInterval = setInterval(() => { if (currentMode === 'clock') updateClock(); }, 1000);
updateClock();

// ── Stopwatch mode ─────────────────────────────────────────────
let swElapsed = 0;
let swStartTime = null;
let swInterval = null;
let swRunning = false;
let lapList = [];   // tur kayıtları

function stopwatchStop() {
  if (swInterval) { clearInterval(swInterval); swInterval = null; }
  swRunning = false;
  updateStopwatchBtn();
}

function updateStopwatchBtn() {
  const btn = document.getElementById('btnStartStop');
  if (swRunning) {
    btn.textContent = 'Duraklat';
    btn.classList.add('running');
  } else {
    btn.textContent = 'Baslat';
    btn.classList.remove('running');
  }
  // Tur butonu: sadece krono çalışırken görünür
  const btnLap = document.getElementById('btnLap');
  btnLap.style.display = (currentMode === 'stopwatch' && swRunning) ? '' : 'none';
}

// Tur (lap) kaydet
function recordLap() {
  if (!swRunning || currentMode !== 'stopwatch') return;
  const totalMs  = swElapsed + (Date.now() - swStartTime);
  const totalSec = Math.floor(totalMs / 1000);
  const cs       = Math.floor((totalMs % 1000) / 10);
  const m        = Math.floor(totalSec / 60);
  const s        = totalSec % 60;
  lapList.push({ m, s, cs });
  renderLapList();
}

function renderLapList() {
  const el = document.getElementById('lapList');
  el.innerHTML = '';
  lapList.forEach((lap, i) => {
    const div = document.createElement('div');
    div.className = 'lap-item';
    const mm = String(lap.m).padStart(2, '0');
    const ss = String(lap.s).padStart(2, '0');
    const cc = String(lap.cs).padStart(2, '0');
    div.textContent = `Tur ${i + 1}  —  ${mm}:${ss}.${cc}`;
    el.appendChild(div);
  });
  // En alta kaydır
  el.scrollTop = el.scrollHeight;
}

document.getElementById('btnLap').addEventListener('click', () => {
  if (currentMode === 'stopwatch') recordLap();
});

function stopwatchTick() {
  const total = Math.floor((swElapsed + (Date.now() - swStartTime)) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  updateCards(h, m, s);
}

document.getElementById('btnStartStop').addEventListener('click', () => {
  if (currentMode === 'stopwatch') {
    if (swRunning) {
      swElapsed += Date.now() - swStartTime;
      stopwatchStop();
    } else {
      swStartTime = Date.now();
      swRunning = true;
      swInterval = setInterval(stopwatchTick, 200);
      updateStopwatchBtn();
      stopwatchTick();
    }
  } else if (currentMode === 'timer') {
    timerToggle();
  } else if (currentMode === 'pomodoro') {
    pomodoroToggle();
  }
});

document.getElementById('btnReset').addEventListener('click', () => {
  if (currentMode === 'stopwatch') {
    stopwatchStop();
    swElapsed = 0;
    swStartTime = null;
    lapList = [];
    renderLapList();
    resetCurrentValues();
    updateCards(0, 0, 0);
  } else if (currentMode === 'pomodoro') {
    pomodoroReset();
  } else if (currentMode === 'timer') {
    timerStop();
    const th = parseInt(document.getElementById('timerH').value) || 0;
    const tm = parseInt(document.getElementById('timerM').value) || 0;
    const ts = parseInt(document.getElementById('timerS').value) || 0;
    timerRemaining = th * 3600 + tm * 60 + ts;
    document.body.classList.add('timer-stopped');
    showTimerCards();
  }
});

// ── Timer mode ─────────────────────────────────────────────────
let timerRemaining = 300;
let timerInterval = null;
let timerRunning = false;

function timerStop() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  timerRunning = false;
  updateTimerBtn();
}

function updateTimerBtn() {
  const btn = document.getElementById('btnStartStop');
  if (timerRunning) {
    btn.textContent = 'Duraklat';
    btn.classList.add('running');
  } else {
    btn.textContent = 'Baslat';
    btn.classList.remove('running');
  }
}

function showTimerCards() {
  const r = timerRemaining;
  const h = Math.floor(r / 3600);
  const m = Math.floor((r % 3600) / 60);
  const s = r % 60;
  updateCards(h, m, s);
}

function timerToggle() {
  if (timerRunning) {
    timerStop();
  } else {
    if (document.body.classList.contains('timer-stopped')) {
      const th = parseInt(document.getElementById('timerH').value) || 0;
      const tm = parseInt(document.getElementById('timerM').value) || 0;
      const ts = parseInt(document.getElementById('timerS').value) || 0;
      timerRemaining = th * 3600 + tm * 60 + ts;
      if (timerRemaining <= 0) return;
      document.body.classList.remove('timer-stopped');
      resetCurrentValues();
      showTimerCards();
    }
    if (timerRemaining <= 0) return;
    timerRunning = true;
    updateTimerBtn();
    timerInterval = setInterval(() => {
      timerRemaining--;
      showTimerCards();
      if (timerRemaining <= 0) {
        timerStop();
        document.body.classList.add('timer-stopped');
        flashDone();
      }
    }, 1000);
  }
}

function flashDone() {
  // Bitiş sesi çal
  playAlarm();
  let count = 0;
  const interval = setInterval(() => {
    document.body.style.background = count % 2 === 0 ? '#1a0a0a' : '#000';
    count++;
    if (count >= 6) {
      clearInterval(interval);
      document.body.style.background = '';
    }
  }, 200);
}

// ── Pomodoro modu ──────────────────────────────────────────────
// Fazlar: 'work' | 'short' | 'long'
let pomoPhase     = 'work';   // mevcut faz
let pomoRound     = 1;        // mevcut tur numarası
let pomoRemaining = 0;        // kalan saniye
let pomoRunning   = false;
let pomoInterval  = null;

function pomodoroStop() {
  if (pomoInterval) { clearInterval(pomoInterval); pomoInterval = null; }
  pomoRunning = false;
  updatePomodoroBtn();
}

function pomodoroInit() {
  pomoPhase     = 'work';
  pomoRound     = 1;
  pomoRemaining = settings.pomoWork * 60;
  resetCurrentValues();
  showPomodoroCards();
  updatePomodoroLabel();
  updatePomodoroBtn();
}

function pomodoroReset() {
  pomodoroStop();
  pomodoroInit();
}

function updatePomodoroLabel() {
  const phaseEl = document.getElementById('pomoPhase');
  const roundEl = document.getElementById('pomoRound');
  const labels  = { work: 'Calisma', short: 'Kisa Mola', long: 'Uzun Mola' };
  phaseEl.textContent = labels[pomoPhase] || 'Calisma';
  roundEl.textContent = `Tur ${pomoRound}/${settings.pomoCycles}`;
}

function showPomodoroCards() {
  const m = Math.floor(pomoRemaining / 60);
  const s = pomoRemaining % 60;
  updateCards(0, m, s);
}

function updatePomodoroBtn() {
  const btn = document.getElementById('btnStartStop');
  if (pomoRunning) {
    btn.textContent = 'Duraklat';
    btn.classList.add('running');
  } else {
    btn.textContent = 'Baslat';
    btn.classList.remove('running');
  }
}

function pomodoroNextPhase() {
  // Sonraki faza geç, faz geçiş sesi çal
  playPomodoroChime();

  if (pomoPhase === 'work') {
    if (pomoRound % settings.pomoCycles === 0) {
      // Uzun mola
      pomoPhase     = 'long';
      pomoRemaining = settings.pomoLong * 60;
    } else {
      // Kısa mola
      pomoPhase     = 'short';
      pomoRemaining = settings.pomoShort * 60;
    }
  } else {
    // Mola bitti, çalışmaya dön
    if (pomoPhase === 'short') {
      pomoRound++;
    } else {
      // Uzun mola bitti → yeni döngü
      pomoRound++;
      // Döngüyü sıfırlama: tüm döngüler bitti mi?
      if (pomoRound > settings.pomoCycles) pomoRound = 1;
    }
    pomoPhase     = 'work';
    pomoRemaining = settings.pomoWork * 60;
  }

  resetCurrentValues();
  showPomodoroCards();
  updatePomodoroLabel();
  // Sonraki faz otomatik başlar
  pomoRunning = true;
  updatePomodoroBtn();
}

function pomodoroTick() {
  if (!pomoRunning) return;
  pomoRemaining--;
  showPomodoroCards();
  if (pomoRemaining <= 0) {
    // Interval'i durdur, sonraki fazı ayarla, yeni interval başlat
    clearInterval(pomoInterval);
    pomoInterval = null;
    pomodoroNextPhase();
    // Yeni faz zaten pomoRunning=true yaptı, yeni interval başlat
    pomoInterval = setInterval(pomodoroTick, 1000);
  }
}

function pomodoroToggle() {
  if (pomoRunning) {
    pomodoroStop();
  } else {
    if (pomoRemaining <= 0) pomodoroInit();
    pomoRunning = true;
    updatePomodoroBtn();
    pomoInterval = setInterval(pomodoroTick, 1000);
  }
}

// ── Settings bar (alt panel) ───────────────────────────────────
const settingsBar = document.getElementById('settingsBar');
let settingsBaseHeight = null;

const DEFAULTS = {
  format: '24', seconds: true, timezone: 'Europe/Istanbul',
  alwaysTop: true, theme: 'classic', showDate: true, opacity: 1,
  shortcuts: true, drift: false,
  volume: 0.6, alarmSound: true, fadeAlarm: true, tickSound: false,
  pomoWork: 25, pomoShort: 5, pomoLong: 15, pomoCycles: 4,
};

function updateSettingsBarHeight() {
  if (!settingsBar.classList.contains('open')) return;
  window.electronAPI.getBounds().then(b => {
    const panelH = settingsBar.scrollHeight + 16;
    window.electronAPI.setSize(b.width, (settingsBaseHeight || b.height) + panelH);
  });
}

function toggleSettingsBar() {
  const isOpen = settingsBar.classList.toggle('open');
  document.getElementById('btnSettings').classList.toggle('active', isOpen);
  if (isMaximized) return;
  if (isOpen) {
    window.electronAPI.getBounds().then(b => {
      settingsBaseHeight = b.height;
      const panelH = settingsBar.scrollHeight + 16;
      window.electronAPI.setSize(b.width, b.height + panelH);
    });
  } else {
    if (settingsBaseHeight !== null) {
      window.electronAPI.getBounds().then(b => {
        window.electronAPI.setSize(b.width, settingsBaseHeight);
        settingsBaseHeight = null;
      });
    }
  }
}

document.getElementById('btnSettings').addEventListener('click', toggleSettingsBar);

// ── applySettings: tüm ayarları UI + body'e uygula ────────────
function applySettings() {
  // Format
  document.getElementById('fmt24').classList.toggle('active', settings.format === '24');
  document.getElementById('fmt12').classList.toggle('active', settings.format === '12');

  // Saniyeler
  document.getElementById('chkSeconds').checked = settings.seconds;
  document.body.classList.toggle('hide-seconds', !settings.seconds);

  // Saat dilimi
  const sel = document.getElementById('selTimezone');
  sel.value = settings.timezone;
  if (!sel.value) sel.value = 'local';

  // Her zaman üstte
  document.getElementById('chkAlwaysOnTop').checked = settings.alwaysTop;

  // Tema
  document.getElementById('selTheme').value = settings.theme;
  document.body.setAttribute('data-theme', settings.theme);

  // Tarih
  document.getElementById('chkDate').checked = settings.showDate;
  updateDateVisibility();

  // Saydamlık
  const rng = document.getElementById('rngOpacity');
  rng.value = settings.opacity;
  window.electronAPI.setOpacity(settings.opacity);

  // Kısayollar
  document.getElementById('chkShortcuts').checked = settings.shortcuts;

  // Drift
  document.getElementById('chkDrift').checked = settings.drift;
  if (!settings.drift) {
    document.body.classList.remove('screensaver');
    resetDriftTimer();
  }

  // Ses
  document.getElementById('rngVolume').value     = settings.volume;
  document.getElementById('chkAlarmSound').checked = settings.alarmSound;
  document.getElementById('chkFadeAlarm').checked  = settings.fadeAlarm;
  document.getElementById('chkTick').checked       = settings.tickSound;

  // Pomodoro ayarları
  document.getElementById('inpPomoWork').value   = settings.pomoWork;
  document.getElementById('inpPomoShort').value  = settings.pomoShort;
  document.getElementById('inpPomoLong').value   = settings.pomoLong;
  document.getElementById('inpPomoCycles').value = settings.pomoCycles;
}

// ── Ayar olay dinleyicileri ────────────────────────────────────
document.getElementById('fmt24').addEventListener('click', () => {
  saveSetting('format', '24');
  document.getElementById('fmt24').classList.add('active');
  document.getElementById('fmt12').classList.remove('active');
  resetCurrentValues();
  if (currentMode === 'clock') updateClock();
});

document.getElementById('fmt12').addEventListener('click', () => {
  saveSetting('format', '12');
  document.getElementById('fmt12').classList.add('active');
  document.getElementById('fmt24').classList.remove('active');
  resetCurrentValues();
  if (currentMode === 'clock') updateClock();
});

document.getElementById('chkSeconds').addEventListener('change', (e) => {
  saveSetting('seconds', e.target.checked);
  document.body.classList.toggle('hide-seconds', !e.target.checked);
  if (currentMode === 'clock') {
    resetCurrentValues();
    updateClock();
  }
});

document.getElementById('selTimezone').addEventListener('change', (e) => {
  saveSetting('timezone', e.target.value);
  resetCurrentValues();
  if (currentMode === 'clock') updateClock();
});

document.getElementById('chkAlwaysOnTop').addEventListener('change', (e) => {
  saveSetting('alwaysTop', e.target.checked);
});

// Tema değişimi
document.getElementById('selTheme').addEventListener('change', (e) => {
  saveSetting('theme', e.target.value);
  document.body.setAttribute('data-theme', e.target.value);
});

// Tarih toggle
document.getElementById('chkDate').addEventListener('change', (e) => {
  saveSetting('showDate', e.target.checked);
  updateDateVisibility();
});

// Saydamlık range
document.getElementById('rngOpacity').addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  saveSetting('opacity', val);
  window.electronAPI.setOpacity(val);
});

// Kısayollar toggle
document.getElementById('chkShortcuts').addEventListener('change', (e) => {
  saveSetting('shortcuts', e.target.checked);
});

// Drift toggle
document.getElementById('chkDrift').addEventListener('change', (e) => {
  saveSetting('drift', e.target.checked);
  if (!e.target.checked) {
    document.body.classList.remove('screensaver');
    resetDriftTimer();
  } else {
    resetDriftTimer();
  }
});

// ── Ses ayarı dinleyicileri ────────────────────────────────────
document.getElementById('rngVolume').addEventListener('input', (e) => {
  saveSetting('volume', parseFloat(e.target.value));
});

document.getElementById('chkAlarmSound').addEventListener('change', (e) => {
  saveSetting('alarmSound', e.target.checked);
});

document.getElementById('chkFadeAlarm').addEventListener('change', (e) => {
  saveSetting('fadeAlarm', e.target.checked);
});

document.getElementById('chkTick').addEventListener('change', (e) => {
  saveSetting('tickSound', e.target.checked);
});

// ── Pomodoro ayarı dinleyicileri ───────────────────────────────
document.getElementById('inpPomoWork').addEventListener('change', (e) => {
  saveSetting('pomoWork', parseInt(e.target.value) || 25);
  if (currentMode === 'pomodoro' && !pomoRunning) pomodoroInit();
});

document.getElementById('inpPomoShort').addEventListener('change', (e) => {
  saveSetting('pomoShort', parseInt(e.target.value) || 5);
});

document.getElementById('inpPomoLong').addEventListener('change', (e) => {
  saveSetting('pomoLong', parseInt(e.target.value) || 15);
});

document.getElementById('inpPomoCycles').addEventListener('change', (e) => {
  saveSetting('pomoCycles', parseInt(e.target.value) || 4);
  if (currentMode === 'pomodoro') updatePomodoroLabel();
});

applySettings();

document.getElementById('btnResetDefaults').addEventListener('click', () => {
  Object.keys(DEFAULTS).forEach(k => {
    settings[k] = DEFAULTS[k];
    localStorage.setItem(k, DEFAULTS[k]);
  });
  applySettings();
  resetCurrentValues();
  if (currentMode === 'clock') updateClock();
  else if (currentMode === 'pomodoro') pomodoroInit();
});

// ── Ekran koruyucu (drift / burn-in önleme) ────────────────────
let driftTimer = null;
const DRIFT_IDLE_MS = 60000; // 60 saniye hareketsizlik

function resetDriftTimer() {
  clearTimeout(driftTimer);
  if (document.body.classList.contains('screensaver')) {
    document.body.classList.remove('screensaver');
  }
  if (settings.drift && !isMaximized) {
    driftTimer = setTimeout(() => {
      document.body.classList.add('screensaver');
    }, DRIFT_IDLE_MS);
  }
}

// Fare hareketi: drift sıfırlama + cursor gösterme tek handler'da birleştirildi
document.addEventListener('mousemove', onMouseMove);
document.addEventListener('mousedown', onMouseActivity);

// ── Klavye kısayolları ─────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  // Kısayollar kapalıysa atla
  if (!settings.shortcuts) return;
  // Input/select odaklandıysa atla
  const tag = document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'SELECT') return;

  switch (e.key) {
    case ' ':
      // Sadece stopwatch/timer modunda çalış
      if (currentMode === 'stopwatch' || currentMode === 'timer') {
        e.preventDefault();
        document.getElementById('btnStartStop').click();
      }
      break;

    case 'f':
    case 'F':
      // Tam ekran toggle
      toggleMaximize();
      break;

    case 'Escape':
      if (isMaximized) {
        toggleMaximize();
      } else if (settingsBar.classList.contains('open')) {
        toggleSettingsBar();
      }
      break;

    case 'r':
    case 'R':
      // Stopwatch/timer sıfırla
      if (currentMode === 'stopwatch' || currentMode === 'timer') {
        document.getElementById('btnReset').click();
      }
      break;

    case 'h':
    case 'H':
      // UI gizle/göster
      document.body.classList.toggle('ui-hidden');
      break;
  }
});

// ── Auto-hide UI on click ──────────────────────────────────────
document.addEventListener('click', (e) => {
  // UI elemanlarına + kontrollere tıklansa ignore et
  if (e.target.closest('button, input, select, .titlebar, .settings-bar, .controls, .timer-input')) return;
  // Sayaç kurulum modunda (süre ayarlanıyor) tıklama UI'ı gizlemesin
  if (currentMode === 'timer' && document.body.classList.contains('timer-stopped')) return;
  // Toggle UI
  document.body.classList.toggle('ui-hidden');
});

// ── Hide cursor when idle ──────────────────────────────────────
let cursorTimer = null;

function showCursor() {
  document.body.classList.remove('cursor-hidden');
  clearTimeout(cursorTimer);
  cursorTimer = setTimeout(() => {
    document.body.classList.add('cursor-hidden');
  }, 2500);
}

// Mousemove handler: cursor göster + drift sıfırla
function onMouseMove() {
  showCursor();
  if (settings.drift) resetDriftTimer();
}

// Mousedown handler: cursor göster + drift sıfırla
function onMouseActivity() {
  showCursor();
  if (settings.drift) resetDriftTimer();
}

showCursor();
