const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadMenu: () => ipcRenderer.invoke('load-menu'),
  saveMenu: (items) => ipcRenderer.invoke('save-menu', items),
  appendSale: (sale) => ipcRenderer.invoke('append-sale', sale),
  archiveSales: (dateString) => ipcRenderer.invoke('archive-sales', dateString),
  getDataPath: () => ipcRenderer.invoke('get-data-path'),
  listReports: () => ipcRenderer.invoke('read-reports'),
readReport: (file) => ipcRenderer.invoke('read-report-file', file),


  
  // ---------- PRINT ----------
  printBill: (bill) => {
    console.log("Renderer: sending bill to main process", bill);
    ipcRenderer.send('print-bill', bill);
  }
});

