const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  loadMenu: () => ipcRenderer.invoke("load-menu"),
  saveMenu: (items) => ipcRenderer.invoke("save-menu", items),
  appendSale: (sale) => ipcRenderer.invoke("append-sale", sale),
  archiveSales: (dateString) => ipcRenderer.invoke("archive-sales", dateString),
  getDataPath: () => ipcRenderer.invoke("get-data-path"),
  listReports: () => ipcRenderer.invoke("read-reports"),
  readReport: (file) => ipcRenderer.invoke("read-report-file", file),

  // Activation
  getMac: () => ipcRenderer.invoke("get-mac"),
  activate: (mac, key) => ipcRenderer.invoke("activate", { mac, key }),
  onShowActivation: (callback) => ipcRenderer.on("show-activation", callback),

  // Printing
  printBill: (bill) => ipcRenderer.send("print-bill", bill),

  // Event listeners
  onShowActivation: (callback) => ipcRenderer.on("show-activation", callback),
  onActivationSuccess: (callback) => ipcRenderer.on("activation-success", callback),
  onActivationFail: (callback) => ipcRenderer.on("activation-fail", callback),
  tryActivate: (key) => ipcRenderer.send("try-activate", key)
});
