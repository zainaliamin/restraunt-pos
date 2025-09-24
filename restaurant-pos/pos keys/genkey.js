// genKey.js
const crypto = require("crypto");
const readlineSync = require("readline-sync");

// --- CONFIG (must match your POS app) ---
const SECRET = "my-secret-salt"; // keep same as in your app

function generateKey(mac) {
  return crypto
    .createHash("sha256")
    .update(mac + SECRET)
    .digest("hex")
    .substring(0, 16) // shorter key
    .toUpperCase();
}

// ---- MAIN PROGRAM ----
const macInput = readlineSync.question("Enter client MAC address: ");

// normalize: lowercase, keep colons
const mac = macInput.toLowerCase();


const key = generateKey(mac);

console.log("\n✅ Generated Activation Key:");
console.log(key);
