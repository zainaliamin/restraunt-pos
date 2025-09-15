const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const getPaths = () => {
  const dataPath = app.getPath('userData'); // where our menu.json and sales.json will live
  const menuFile = path.join(dataPath, 'menu.json');
  const salesFile = path.join(dataPath, 'sales.json');
  const reportsDir = path.join(dataPath, 'reports');
  return { dataPath, menuFile, salesFile, reportsDir };
};

function ensureDataFiles() {
  const { dataPath, menuFile, salesFile, reportsDir } = getPaths();
  if (!fs.existsSync(dataPath)) fs.mkdirSync(dataPath, { recursive: true });
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

  // sample menu created once
  const sampleMenu = [
    { id: 1, name: "Cappuccino", price: 500, category: "Coffee" },
    { id: 2, name: "Peach Milk Tea", price: 550, category: "Milk Tea" },
    { id: 3, name: "Fries", price: 250, category: "Starters" }
  ];

  if (!fs.existsSync(menuFile)) {
    fs.writeFileSync(menuFile, JSON.stringify(sampleMenu, null, 2));
  }
  if (!fs.existsSync(salesFile)) {
    fs.writeFileSync(salesFile, JSON.stringify([], null, 2));
  }
}

function createWindow () {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, // safer
      nodeIntegration: false
    }
  });

  win.loadFile('index.html');
  // win.webContents.openDevTools(); // uncomment for debugging
}

app.whenReady().then(() => {
  ensureDataFiles();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

/* ---------- IPC handlers for renderer to read/write files ---------- */
ipcMain.handle('load-menu', async () => {
  const { menuFile } = getPaths();
  return JSON.parse(fs.readFileSync(menuFile));
});

ipcMain.handle('save-menu', async (event, items) => {
  const { menuFile } = getPaths();
  fs.writeFileSync(menuFile, JSON.stringify(items, null, 2));
  return true;
});

ipcMain.handle('append-sale', async (event, sale) => {
  const { salesFile } = getPaths();
  const sales = JSON.parse(fs.readFileSync(salesFile));
  sales.push(sale);
  fs.writeFileSync(salesFile, JSON.stringify(sales, null, 2));
  return true;
});

ipcMain.handle('archive-sales', async (event, dateString) => {
  const { salesFile, reportsDir } = getPaths();
  const sales = JSON.parse(fs.readFileSync(salesFile));
  const outFile = path.join(reportsDir, `${dateString}.json`);
  fs.writeFileSync(outFile, JSON.stringify(sales, null, 2));
  // clear sales.json (start fresh)
  fs.writeFileSync(salesFile, JSON.stringify([], null, 2));
  return { archived: outFile };
});

ipcMain.handle('get-data-path', async () => {
  return getPaths().dataPath;
});
