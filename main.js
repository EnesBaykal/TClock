const { app, BrowserWindow, Tray, Menu, ipcMain, screen } = require('electron');
const path = require('path');
const fs   = require('fs');

let mainWindow;
let tray;
const NORMAL_W = 560;
const NORMAL_H = 270;

// Uygulama adını sabitle — görev çubuğu, görev yöneticisi ve bildirimlerde
// "Electron" yerine "TClock" görünsün
app.setName('TClock');
if (process.platform === 'win32') {
  app.setAppUserModelId('com.tclock.app');
}

// Pencere durumu dosyası yolu (app hazır olduktan sonra hesaplanır)
let cfgPath;

// Kayıtlı pencere durumunu oku
function loadWindowState() {
  try {
    if (fs.existsSync(cfgPath)) {
      const data = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      if (data && typeof data.width === 'number') return data;
    }
  } catch {}
  return null;
}

// Pencere durumunu kaydet
function saveWindowState() {
  if (!mainWindow || isManualMax) return;
  try {
    const b = mainWindow.getBounds();
    fs.writeFileSync(cfgPath, JSON.stringify({ x: b.x, y: b.y, width: b.width, height: b.height }));
  } catch {}
}

// isManualMax modül seviyesinde tutulur ki saveWindowState erişebilsin
let isManualMax = false;
// Tam ekrandan çıkınca dönülecek normal pencere boyutu
let prevBounds = null;

// Pencereyi manuel tam ekran yap (görev çubuğu üstünde dahil)
function enterManualMax() {
  if (!mainWindow) return;
  const display = screen.getDisplayMatching(mainWindow.getBounds());
  const { x, y, width, height } = display.bounds;
  mainWindow.setBounds({ x, y, width, height }, true);
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  isManualMax = true;
  mainWindow.webContents.send('window-state', 'maximized');
}

function createWindow() {
  const saved = loadWindowState();

  const winOpts = {
    title: 'TClock',
    width:  saved ? saved.width  : NORMAL_W,
    height: saved ? saved.height : NORMAL_H,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    minWidth: 360,
    minHeight: 240,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  };

  // Kaydedilmiş konum varsa uygula
  if (saved && typeof saved.x === 'number') {
    winOpts.x = saved.x;
    winOpts.y = saved.y;
  }

  mainWindow = new BrowserWindow(winOpts);

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Her açılışta tam ekran başlat; tam ekrandan çıkınca dönülecek normal boyutu sakla
  mainWindow.webContents.once('did-finish-load', () => {
    if (!mainWindow) return;
    const b = mainWindow.getBounds();
    prevBounds = saved ? { x: b.x, y: b.y, width: saved.width, height: saved.height }
                       : null;
    enterManualMax();
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  // Taşıma / boyutlandırma → debounce ile kaydet
  let saveBoundsTimer = null;
  function debouncedSave() {
    clearTimeout(saveBoundsTimer);
    saveBoundsTimer = setTimeout(saveWindowState, 400);
  }
  mainWindow.on('move',   debouncedSave);
  mainWindow.on('resize', debouncedSave);
  mainWindow.on('close',  saveWindowState);

  mainWindow.on('maximize', () => {
    if (mainWindow) mainWindow.webContents.send('window-state', 'maximized');
  });
  mainWindow.on('unmaximize', () => {
    if (mainWindow) mainWindow.webContents.send('window-state', 'normal');
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png');
  try { tray = new Tray(iconPath); } catch { return; }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Her Zaman Üstte',
      type: 'checkbox',
      checked: true,
      click: (item) => { if (mainWindow) mainWindow.setAlwaysOnTop(item.checked); },
    },
    { type: 'separator' },
    { label: 'Kapat', click: () => app.quit() },
  ]);

  tray.setToolTip('TClock');
  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => { if (mainWindow) mainWindow.show(); });
}

app.whenReady().then(() => {
  cfgPath = path.join(app.getPath('userData'), 'window-state.json');
  createWindow();
  createTray();

  ipcMain.on('close-app',    () => app.quit());
  ipcMain.on('minimize-app', () => { if (mainWindow) mainWindow.minimize(); });

  ipcMain.on('toggle-maximize', () => {
    if (!mainWindow) return;
    if (isManualMax) {
      isManualMax = false;
      mainWindow.setAlwaysOnTop(true, 'floating');
      if (prevBounds) {
        mainWindow.setBounds(prevBounds, true);
      } else {
        mainWindow.setSize(NORMAL_W, NORMAL_H, true);
        mainWindow.center();
      }
      mainWindow.webContents.send('window-state', 'normal');
    } else {
      prevBounds = mainWindow.getBounds();
      enterManualMax();
    }
  });

  ipcMain.on('set-size', (_, w, h) => {
    if (mainWindow) mainWindow.setSize(w, h);
  });

  ipcMain.handle('get-bounds', () => mainWindow ? mainWindow.getBounds() : null);
  ipcMain.on('move-window', (_, x, y, w, h) => {
    if (!mainWindow) return;
    // Boyut renderer'da sürükleme başında bir kez yakalanıp sabit gönderilir;
    // her harekette getBounds ile yeniden okumak DPI yuvarlamasıyla pencereyi büyütüyordu.
    const b = mainWindow.getBounds();
    const width  = (typeof w === 'number' && w > 0) ? w : b.width;
    const height = (typeof h === 'number' && h > 0) ? h : b.height;
    mainWindow.setBounds({ x: Math.round(x), y: Math.round(y), width, height });
  });

  // Pencere saydamlığı ayarı
  ipcMain.on('set-opacity', (_, val) => {
    if (mainWindow) mainWindow.setOpacity(val);
  });
});

app.on('window-all-closed', () => app.quit());
app.on('activate', () => { if (!mainWindow) createWindow(); });
