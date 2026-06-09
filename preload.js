const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  closeApp:       () => ipcRenderer.send('close-app'),
  minimizeApp:    () => ipcRenderer.send('minimize-app'),
  toggleMaximize: () => ipcRenderer.send('toggle-maximize'),
  setSize:        (w, h) => ipcRenderer.send('set-size', w, h),
  onWindowState:  (cb) => ipcRenderer.on('window-state', (_e, state) => cb(state)),
  getBounds:      () => ipcRenderer.invoke('get-bounds'),
  moveWindow:     (x, y, w, h) => ipcRenderer.send('move-window', x, y, w, h),
  setOpacity:     (v) => ipcRenderer.send('set-opacity', v),
});
