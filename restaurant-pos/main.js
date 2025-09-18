const { PosPrinter } = require("electron-pos-printer");
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const getPaths = () => {
  const dataPath = app.getPath('userData'); // where our menu.json and sales.ndjson will live
  const menuFile = path.join(dataPath, 'menu.json');
  const reportsDir = path.join(dataPath, 'reports');
  return { dataPath, menuFile, reportsDir };
};

function ensureDataFiles() {
  const { dataPath, menuFile, reportsDir } = getPaths();
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

// ---------- PRINT HANDLER ----------
const net = require("net");

function sendToPrinter(host, port, dataBuffer) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    client.connect(port, host, () => {
      client.write(dataBuffer);
      client.end();
      resolve();
    });
    client.on("error", reject);
  });
}

ipcMain.on("print-bill", async (event, bill) => {
  try {
    console.log("Printing bill:", bill);

    // change this dynamically if you want later
    const printerType = "USB"; // or "WIFI"

    if (printerType === "USB") {
      // -------- USB / Windows Printer ----------
      const options = {
        preview: false,
        width: "300px",
        margin: "0 0 0 0",
        copies: 1,
        printerName: "POS-80C", // replace with your Windows printer name
        silent: true
      };

      const data = [
        { type: "text", value: "My Restaurant", style: "text-align:center; font-weight:bold; font-size:18px;" },
        { type: "text", value: "------------------------------" },
        ...bill.items.map(i => ({
          type: "text",
          value: `${i.qty} x ${i.name} ..... ${i.qty * i.price}`
        })),
        { type: "text", value: "------------------------------" },
        { type: "text", value: `Total: ${bill.total}`, style: "text-align:right; font-size:16px;" },
        { type: "text", value: "\n\n\n" }
      ];

      await PosPrinter.print(data, options);
      console.log("Bill printed via USB successfully.");
    } 
    
    else if (printerType === "WIFI") {
      // -------- WiFi Printer (Port 9100 RAW) ----------
      let content = "";
      content += "\x1B\x40"; // Initialize printer
      content += "\x1B\x61\x01"; // Center align
      content += "My Restaurant\n";
      content += "------------------------------\n";
      content += "\x1B\x61\x00"; // Left align

      bill.items.forEach(i => {
        content += `${i.qty} x ${i.name} ..... ${i.qty * i.price}\n`;
      });

      content += "------------------------------\n";
      content += `Total: ${bill.total}\n`;
      content += "\n\n\n";
      content += "\x1D\x56\x41"; // Cut paper

      const buffer = Buffer.from(content, "utf8");
      await sendToPrinter("192.168.11.110", 9100, buffer); // replace IP + port
      console.log("Bill printed via WiFi successfully.");
    }

  } catch (err) {
    console.error("Print error:", err);
  }
});







ipcMain.handle('save-menu', async (event, items) => {
  const { menuFile } = getPaths();
  fs.writeFileSync(menuFile, JSON.stringify(items, null, 2));
  return true;
});


// ----------- append sale directly into today's report ------------
ipcMain.handle('append-sale', async (event, sale) => {
  const { reportsDir } = getPaths();
  const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local timezone
 // YYYY-MM-DD
  const outFile = path.join(reportsDir, `${today}.json`);

  let sales = [];
  if (fs.existsSync(outFile)) {
    sales = JSON.parse(fs.readFileSync(outFile, 'utf8'));
  }
  sales.push(sale);

  fs.writeFileSync(outFile, JSON.stringify(sales, null, 2));
  return true;
});

// ----------- list all report files ------------
ipcMain.handle('read-reports', async () => {
  const { reportsDir } = getPaths();
  if (!fs.existsSync(reportsDir)) return [];
  return fs.readdirSync(reportsDir).filter(f => f.endsWith('.json'));
});

// ----------- read a single report file ------------
ipcMain.handle('read-report-file', async (event, filename) => {
  const { reportsDir } = getPaths();
  const file = path.join(reportsDir, filename);
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file));
});

// ---------- get data path ----------
ipcMain.handle('get-data-path', async () => {
  return getPaths().dataPath;
});


