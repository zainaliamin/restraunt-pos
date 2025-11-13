//Liscense check before app ready
// main.js
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");

const crypto = require("crypto");

function generateKey(mac) {
  return crypto.createHash("sha256")
    .update(mac + "my-secret-salt")
    .digest("hex")
    .substring(0,16)
    .toUpperCase();
}


let mainWindow;
const licenseFile = path.join(app.getPath("userData"), "license.json");

// check activation status
function isActivated() {
  if (!fs.existsSync(licenseFile)) {
    console.log("License file does not exist:", licenseFile);
    return false;
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(licenseFile, "utf8"));
    console.log("License data:", data);

    // Basic checks
    if (!data.activated || !data.key || !data.mac) {
      console.log("License data incomplete:", { activated: data.activated, hasKey: !!data.key, hasMac: !!data.mac });

      return false;
    }

    // Get current MAC address
    const nets = os.networkInterfaces();
    let currentMac = null;
    for (const name of Object.keys(nets)) {
      if (/vbox|virtual|loopback|docker/i.test(name)) continue;
      for (const net of nets[name]) {
        if (net.family === "IPv4" && !net.internal && net.mac && net.mac !== "00:00:00:00:00:00") {
          currentMac = String(net.mac).toLowerCase();
          break;
        }
      }
      if (currentMac) break;
    }

    console.log("Stored MAC:", data.mac.toLowerCase());
    console.log("Current MAC:", currentMac);

    // Check if MAC addresses match
    if (data.mac.toLowerCase() !== currentMac) {
      console.log("MAC address mismatch - license not valid for this PC");
      return false;
    }

    // Verify that key matches MAC
    const expectedKey = generateKey(data.mac.toLowerCase());
    console.log("Expected key:", expectedKey);
    console.log("Stored key:", data.key);
    
    const isValid = data.key === expectedKey;
    console.log("License valid:", isValid);
    return isValid;

  } catch (err) {
    console.error("License read error:", err);
    return false;
  }
}




const os = require("os");

ipcMain.handle("get-mac", async () => {
    try {
        const nets = os.networkInterfaces();
        for (const name of Object.keys(nets)) {
            if (/vbox|virtual|loopback|docker/i.test(name)) continue;
            for (const net of nets[name]) {
                if (net.family === "IPv4" && !net.internal && net.mac && net.mac !== "00:00:00:00:00:00") {
                    return String(net.mac); // ensure string
                }
            }
        }
        throw new Error("No valid MAC found");
    } catch (err) {
        console.error("MAC fetch error:", err);
        return null;
    }
});



ipcMain.handle("check-license", async () => {
    return isActivated();
});

ipcMain.handle("activate", async (event, { mac, key }) => {
    if (!mac || typeof mac !== 'string') {
        console.error("Invalid MAC received:", mac);
        return { success: false };
    }

    mac = mac.toLowerCase(); // normalize MAC address
    const expected = generateKey(mac);

    console.log("Activation attempt:");
    console.log("MAC from system:", mac);
    console.log("Expected key:", expected);
    console.log("Provided key:", key);
    
    if (key === expected) {
        const licenseData = { 
            activated: true, 
            mac: mac, 
            key: key,
            activatedAt: new Date().toISOString()
        };
        
        try {
            fs.writeFileSync(licenseFile, JSON.stringify(licenseData, null, 2));
            console.log("License saved successfully to:", licenseFile);
            return { success: true };
        } catch (err) {
            console.error("Error saving license:", err);
            return { success: false };
        }
    }

    console.log("Invalid activation key provided");
    return { success: false };
});







//Liscense check before app ready end here


const { PosPrinter } = require("electron-pos-printer");

const getPaths = () => {
  const dataPath = app.getPath('userData'); // where our menu.json and sales.ndjson will live
  const menuFile = path.join(dataPath, 'menu.json');
  const reportsDir = path.join(dataPath, 'reports');
  const settingsFile = path.join(dataPath, 'settings.json');
  return { dataPath, menuFile, reportsDir, settingsFile };
};

function ensureDataFiles() {
  const { dataPath, menuFile, reportsDir, settingsFile } = getPaths();
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

  // default settings
  const defaultSettings = {
    printerType: "WIFI",
    printerIP: "192.168.11.110",
    printerPort: 9100,
    printerName: "POS-80C",
    adminPassword: "1234",
    restaurantName: "Pizza Junction",
    currency: "PKR"
  };

  if (!fs.existsSync(settingsFile)) {
    fs.writeFileSync(settingsFile, JSON.stringify(defaultSettings, null, 2));
  }
}

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });


  mainWindow.loadFile('index.html');

  mainWindow.webContents.once("did-finish-load", () => {
    if (!isActivated()) {
      mainWindow.webContents.send("show-activation");
    }
  });

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
  try {
    const { menuFile } = getPaths();
    return JSON.parse(fs.readFileSync(menuFile));
  } catch (error) {
    console.error('Error loading menu:', error);
    return [];
  }
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

    // Load settings for printer configuration
    const { settingsFile } = getPaths();
    let settings = {
      printerType: "WIFI",
      printerIP: "192.168.11.110",
      printerPort: 9100,
      printerName: "POS-80C",
      restaurantName: "Pizza Junction"
    };
    
    if (fs.existsSync(settingsFile)) {
      try {
        settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
      } catch (err) {
        console.error('Error loading settings:', err);
      }
    }

    if (settings.printerType === "USB") {
      // -------- USB / Windows Printer ----------
      const options = {
        preview: false,
        width: "300px",
        margin: "0 0 0 0",
        copies: 1,
        printerName: settings.printerName,
        silent: true
      };

      const data = [
        { type: "text", value: settings.restaurantName, style: "text-align:center; font-weight:bold; font-size:18px;" },
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
    
    else if (settings.printerType === "WIFI") {
      // -------- WiFi Printer (Port 9100 RAW) ----------
      let content = "";
      content += "\x1B\x40"; // Initialize printer
      content += "\x1B\x61\x01"; // Center align
      content += settings.restaurantName + "\n";
      content += "\x1B\x61\x00"; // Left align
      content += "------------------------------\n";

      bill.items.forEach(i => {
        content += `${i.qty} x ${i.name} ..... ${i.qty * i.price}\n`;
      });


       content += "------------------------------\n";
  content += `Total: ${bill.total}\n`;
  content += "\n\n\n";  
   
    content += "\n\n\n";       // feed
  content += "\x1D\x56\x00"; // Full cut

      const buffer = Buffer.from(content, "utf8");
      await sendToPrinter(settings.printerIP, settings.printerPort, buffer);
      console.log("Bill printed via WiFi successfully.");
    }

  } catch (err) {
    console.error("Print error:", err);
  }
});








ipcMain.handle('save-menu', async (event, items) => {
  try {
    const { menuFile } = getPaths();
    fs.writeFileSync(menuFile, JSON.stringify(items, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving menu:', error);
    return false;
  }
});



// ----------- append sale directly into today's report ------------
ipcMain.handle('append-sale', async (event, sale) => {
  try {
    const { reportsDir } = getPaths();
    const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local timezone
    const outFile = path.join(reportsDir, `${today}.json`);

    let sales = [];
    if (fs.existsSync(outFile)) {
      sales = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    }
    sales.push(sale);

    fs.writeFileSync(outFile, JSON.stringify(sales, null, 2));
    return true;
  } catch (error) {
    console.error('Error appending sale:', error);
    return false;
  }
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


// ---------- Settings handlers ----------
ipcMain.handle('load-settings', async () => {
  try {
    const { settingsFile } = getPaths();
    if (!fs.existsSync(settingsFile)) {
      // Return default settings if file doesn't exist
      return {
        printerType: "WIFI",
        printerIP: "192.168.11.110",
        printerPort: 9100,
        printerName: "POS-80C",
        adminPassword: "1234",
        restaurantName: "Pizza Junction",
        currency: "PKR"
      };
    }
    return JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
  } catch (error) {
    console.error('Error loading settings:', error);
    return null;
  }
});


ipcMain.handle('save-settings', async (event, settings) => {
  try {
    const { settingsFile } = getPaths();
    fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving settings:', error);
    return false;
  }
});



