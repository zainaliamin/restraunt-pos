

// renderer.js - runs in the UI
let menuItems = [];
let selectedCategory = null;

// MULTI-BILL state
let bills = {};               // { '001': { itemId: { item, qty } }, ... }
let activeBillId = '001';     // currently selected bill id (string '001', '002', ...)
let billCounter = 1;          // increments to create new bill ids

const $ = id => document.getElementById(id);

// ---------- Toast System ----------
function showToast(msg, duration = 2500) {
  const div = document.createElement('div');
  div.className = 'toast';
  div.textContent = msg;
  document.body.appendChild(div);
  setTimeout(() => {
    div.classList.add('fade-out');
    setTimeout(() => div.remove(), 300);
  }, duration);
}

// ---------- Confirm Modal ----------
function showConfirm(msg) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-msg">${msg}</div>
        <div class="modal-actions">
          <button id="confirm-yes">Yes</button>
          <button id="confirm-no">No</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#confirm-yes').onclick = () => {
      overlay.remove();
      resolve(true);
    };
    overlay.querySelector('#confirm-no').onclick = () => {
      overlay.remove();
      resolve(false);
    };
  });
}

// load menu from disk
async function init() {
  menuItems = await window.api.loadMenu();
  if (!menuItems || !menuItems.length) menuItems = [];
  renderCategories();

  // default to first category
  const cats = getCategories();
  selectedCategory = cats[0] || null;

  // initialize multi-bill system (start with Bill 001)
  bills = {};
  billCounter = 1;
  activeBillId = String(billCounter).padStart(3, '0'); // '001'
  bills[activeBillId] = {}; // empty bill

  renderBillTabs(); // render top bill tabs (adds the + button)
  renderMenu();
  renderBill();
}

function getCategories() {
  const set = new Set(menuItems.map(i => i.category || "Uncategorized"));
  return Array.from(set);
}

/* ---------- render categories ---------- */
function renderCategories() {
  const bar = $('category-bar');
  bar.innerHTML = '';
  const cats = getCategories();
  cats.forEach(cat => {
    const b = document.createElement('div');
    b.className = 'cat-btn' + (cat === selectedCategory ? ' active' : '');
    b.textContent = cat;
    b.onclick = () => {
      selectedCategory = cat;
      document.querySelectorAll('.cat-btn').forEach(el => el.classList.remove('active'));
      b.classList.add('active');
      $('search').value = '';
      renderMenu();
    };
    bar.appendChild(b);
  });
}

/* ---------- render menu (filtered by category & search) ---------- */
function renderMenu() {
  const grid = $('menu-grid');
  grid.innerHTML = '';

  const q = $('search').value.trim().toLowerCase();

  let filtered;
  if (q) {
    // When searching → search across ALL categories
    filtered = menuItems.filter(it => it.name.toLowerCase().includes(q));
  } else {
    // No search → filter only by selected category
    filtered = menuItems.filter(it => {
      return selectedCategory ? (it.category === selectedCategory) : true;
    });
  }

  if (filtered.length === 0) {
    grid.innerHTML = '<div style="opacity:.6">No items</div>';
    return;
  }

  filtered.forEach(it => {
    const btn = document.createElement('div');
    btn.className = 'menu-btn';
    btn.textContent = `${it.name}\nPKR ${it.price}`;
    btn.title = it.name;
    btn.onclick = () => addToBill(it);
    grid.appendChild(btn);
  });
}

/* ---------- add to bill (adds to the active bill) ---------- */
function addToBill(item) {
  if (!bills[activeBillId]) bills[activeBillId] = {};
  const theBill = bills[activeBillId];
  if (!theBill[item.id]) {
    theBill[item.id] = { item, qty: 0 };
  }
  theBill[item.id].qty++;
  renderBill();
}

/* ---------- render bill tabs (top right + bill switcher) ---------- */
function renderBillTabs() {
  const container = $('bill-tabs');
  if (!container) return; // guard if HTML not added

  container.innerHTML = '';

  // sort keys so '001','002' order is preserved
  const keys = Object.keys(bills).sort();

  keys.forEach(id => {
    const btn = document.createElement('button');
    btn.id = "btn-" + id;
    btn.className = 'bill-tab' + (id === activeBillId ? ' active' : '');
    btn.textContent = `Bill ${id}`;
    btn.dataset.id = id;
    btn.onclick = () => {
      activeBillId = id;
      renderBillTabs();
      renderBill();
    };
    container.appendChild(btn);
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'bill-tab add-bill';
  addBtn.textContent = '+';
  addBtn.title = 'New bill';
  addBtn.onclick = createNewBill;
  container.appendChild(addBtn);
}

/* ---------- create a new bill ---------- */
function createNewBill() {
  billCounter++;
  const newId = String(billCounter).padStart(3, '0');
  bills[newId] = {};
  activeBillId = newId;
  renderBillTabs();
  renderBill();
}

/* ---------- render bill (left side) - uses activeBillId ---------- */
function renderBill() {
  const tbody = document.querySelector('#bill-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  let total = 0;

  const theBill = bills[activeBillId] || {};

  if (Object.keys(theBill).length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="opacity:.6">No items in this bill</td></tr>';
  } else {
    for (const [id, entry] of Object.entries(theBill)) {
      const tr = document.createElement('tr');

      const tdName = document.createElement('td');
      tdName.textContent = entry.item.name;
      tr.appendChild(tdName);

      const tdQty = document.createElement('td');
      tdQty.innerHTML = `
        <button class="qty-btn" data-id="${id}" data-op="-">-</button>
        <span style="margin:0 8px">${entry.qty}</span>
        <button class="qty-btn" data-id="${id}" data-op="+">+</button>
      `;
      tr.appendChild(tdQty);

      const price = entry.qty * entry.item.price;
      const tdPrice = document.createElement('td');
      tdPrice.textContent = `PKR ${price}`;
      tr.appendChild(tdPrice);

      tbody.appendChild(tr);
      total += price;
    }
  }

  $('bill-total').textContent = `Total: PKR ${total}`;

  document.querySelectorAll('.qty-btn').forEach(b => {
    b.onclick = () => {
      const id = b.dataset.id;
      const op = b.dataset.op;
      if (!bills[activeBillId] || !bills[activeBillId][id]) return;
      if (op === '+') bills[activeBillId][id].qty++;
      else if (op === '-') {
        bills[activeBillId][id].qty--;
        if (bills[activeBillId][id].qty <= 0) delete bills[activeBillId][id];
      }
      renderBill();
    };
  });
}

/* ---------- complete order ---------- */
async function completeOrder() {
  const theBill = bills[activeBillId] || {};
  const items = Object.values(theBill).map(e => ({ name: e.item.name, qty: e.qty, price: e.item.price }));
  if (items.length === 0) {
    showToast('No items in the current bill.');
    return;
  }

  const total = items.reduce((s, i) => s + i.qty * i.price, 0);
  const sale = {
    id: Date.now(),
    billId: activeBillId,
    items,
    total,
    timestamp: new Date().toISOString()
  };

  await window.api.appendSale(sale);

  delete bills[activeBillId];
  const remaining = Object.keys(bills).sort();
  if (remaining.length > 0) {
    activeBillId = remaining[0];
  } else {
    createNewBill();
  }

  renderBillTabs();
  renderBill();

  showToast('Order saved.');
}


let editingItemId = null; // store which item is being edited

/* ---------- Admin: add new menu item ---------- */
async function addMenuItem() {
  const name = $('new-name').value.trim();
  const price = parseInt($('new-price').value, 10);
  const category = $('new-category').value.trim() || 'Uncategorized';
  if (!name || !price) { showToast('Enter name and price'); return; }

  if (editingItemId !== null) {
    // Update existing item
    const item = menuItems.find(i => i.id === editingItemId);
    item.name = name;
    item.price = price;
    item.category = category;
    editingItemId = null;
    $('add-item').textContent = "Add Item";
  } else {
    // Add new item
    const newId = (menuItems.length ? Math.max(...menuItems.map(i => i.id)) : 0) + 1;
    const newItem = { id: newId, name, price, category };
    menuItems.push(newItem);
  }

  await window.api.saveMenu(menuItems);

  // reset form
  $('new-name').value = '';
  $('new-price').value = '';
  $('new-category').value = '';

  renderCategories();
  renderMenu();
  renderAdminList();
}



/* ---------- Admin: list + delete + edit + search newerer ---------- */
function renderAdminList() {
  const cont = $('admin-items');
  cont.innerHTML = '';

  const query = $('admin-search').value.trim().toLowerCase();

  // filter items based on search
  const filteredItems = menuItems.filter(it =>
    it.name.toLowerCase().includes(query) || it.category.toLowerCase().includes(query)
  );

  filteredItems.forEach(it => {
    const d = document.createElement('div');
    d.style = 'display:flex; gap:8px; align-items:center; padding:4px 0;';
    d.innerHTML = `
      <div style="flex:1">${it.name} (${it.category}) - PKR ${it.price}</div>
      <button data-id="${it.id}" class="small edit-btn">Edit</button>
      <button data-id="${it.id}" class="small delete-btn">Delete</button>
    `;
    cont.appendChild(d);
  });

  // Delete buttons
  cont.querySelectorAll('button.delete-btn').forEach(bt => {
    bt.onclick = async () => {
      const id = parseInt(bt.dataset.id, 10);
      if (!(await showConfirm('Delete this item?'))) return;
      menuItems = menuItems.filter(m => m.id !== id);
      await window.api.saveMenu(menuItems);
      renderCategories();
      renderMenu();
      renderAdminList();
    };
  });

  // Edit buttons
cont.querySelectorAll('button.edit-btn').forEach(bt => {
  bt.onclick = () => {
    const id = parseInt(bt.dataset.id, 10);
    const item = menuItems.find(m => m.id === id);
    if (!item) return;
    $('new-name').value = item.name;
    $('new-price').value = item.price;
    $('new-category').value = item.category;

    editingItemId = item.id; // ✅ mark this item for update
    $('add-item').textContent = "Update Item";
  };
});

}

// ---------- Admin search input ----------
$('admin-search').addEventListener('input', () => renderAdminList());



/* ---------- search input handler ---------- */
$('search').addEventListener('input', () => renderMenu());


/* ---------- admin show/hide with password ---------- */
$('open-admin').addEventListener('click', async () => {
  const panel = $('admin-panel');

  // If panel is already visible → just hide it without asking
  if (panel.style.display === 'block') {
    panel.style.display = 'none';
    return;
  }

  // Otherwise → ask for password
  const correctPassword = "1234"; // set your password here
  const input = await showPasswordPrompt("Admin Access");

  if (input === correctPassword) {
    panel.style.display = 'block';
    renderAdminList();
  } else if (input !== null) {
    showToast("Incorrect password!");
  }
});



/* ---------- other buttons ---------- */
$('add-item').addEventListener('click', addMenuItem);
$('complete-order').addEventListener('click', completeOrder);
$('print-bill').addEventListener('click', printBill);

$('clear-bill').addEventListener('click', async () => {
  if (await showConfirm('Clear current bill?')) {
    bills[activeBillId] = {};
    renderBill();
  }
});


$('view-reports').addEventListener('click', async () => {
  const correctPassword = "1234"; // optional: ask admin password before viewing
  const input = await showPasswordPrompt("Enter Admin Password to view reports");

  if (input === correctPassword) {
    // fetch available report files from main process
    const files = await window.api.listReports(); // or readReports()
    showReportsPopup(files); // pass the files to popup
  } else if (input !== null) {
    showToast("Incorrect password!");
  }
});




// ---------- Password Modal ----------
function showPasswordPrompt(msg) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-msg">${msg}</div>
        <input id="admin-pass-input" type="password" placeholder="Enter password" style="margin:8px 0; width:100%; padding:6px" />
        <div class="modal-actions">
          <button id="pass-ok">OK</button>
          <button id="pass-cancel">Cancel</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = overlay.querySelector('#admin-pass-input');
    input.focus();

    overlay.querySelector('#pass-ok').onclick = () => {
      const value = input.value;
      overlay.remove();
      resolve(value);
    };
    overlay.querySelector('#pass-cancel').onclick = () => {
      overlay.remove();
      resolve(null);
    };
  });
}


/* ---------- print bill ---------- */
function printBill() {
  const theBill = bills[activeBillId] || {};
  const items = Object.values(theBill).map(e => ({
    name: e.item.name,
    qty: e.qty,
    price: e.item.price
  }));
  const total = items.reduce((s, i) => s + i.qty * i.price, 0);
  const bill = { id: activeBillId, items, total };

  window.api.printBill(bill);
}







////////////////////////////////////////////////////

// ---------- REPORTS VIEWER ----------


function displayReportDataInModal(container, filename, data) {
  container.innerHTML = `<h4>${filename}</h4>`;
  if (!data.length) { container.innerHTML += '<div>No sales in this report.</div>'; return; }

  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.innerHTML = `
    <tr>
      <th style="border:1px solid #ccc;padding:4px">Bill ID</th>
      <th style="border:1px solid #ccc;padding:4px">Item</th>
      <th style="border:1px solid #ccc;padding:4px">Qty</th>
      <th style="border:1px solid #ccc;padding:4px">Price</th>
      <th style="border:1px solid #ccc;padding:4px">Total</th>
    </tr>
  `;

  data.forEach(sale => {
    sale.items.forEach(i => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="border:1px solid #ccc;padding:4px">${sale.billId}</td>
        <td style="border:1px solid #ccc;padding:4px">${i.name}</td>
        <td style="border:1px solid #ccc;padding:4px">${i.qty}</td>
        <td style="border:1px solid #ccc;padding:4px">${i.price}</td>
        <td style="border:1px solid #ccc;padding:4px">${i.qty * i.price}</td>
      `;
      table.appendChild(tr);
    });
  });

  container.appendChild(table);
}


function displayReportDataInModal(container, filename, data) {
  container.innerHTML = `<h4>${filename}</h4>`;
  if (!data.length) { container.innerHTML += '<div>No sales in this report.</div>'; return; }

  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.innerHTML = `
    <tr>
      <th style="border:1px solid #ccc;padding:4px">Bill ID</th>
      <th style="border:1px solid #ccc;padding:4px">Item</th>
      <th style="border:1px solid #ccc;padding:4px">Qty</th>
      <th style="border:1px solid #ccc;padding:4px">Price</th>
      <th style="border:1px solid #ccc;padding:4px">Total</th>
    </tr>
  `;

  data.forEach(sale => {
    sale.items.forEach(i => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="border:1px solid #ccc;padding:4px">${sale.billId}</td>
        <td style="border:1px solid #ccc;padding:4px">${i.name}</td>
        <td style="border:1px solid #ccc;padding:4px">${i.qty}</td>
        <td style="border:1px solid #ccc;padding:4px">${i.price}</td>
        <td style="border:1px solid #ccc;padding:4px">${i.qty * i.price}</td>
      `;
      table.appendChild(tr);
    });
  });

  container.appendChild(table);
}



async function showReportsPopup() {
  const reports = await window.api.listReports();
  if (!reports.length) { showToast("No reports available."); return; }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="width:400px; max-height:70%; overflow:auto;">
      <div class="modal-msg">Reports</div>
      <div id="report-list"></div>
      <div class="modal-actions">
        <button id="close-reports">Close</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const listContainer = overlay.querySelector('#report-list');
  reports.forEach(file => {
    const btn = document.createElement('button');
    btn.textContent = file;
    btn.style.display = "block";
    btn.style.margin = "4px 0";
    btn.onclick = async () => {
      const data = await window.api.readReport(file);
      displayReportDataInModal(listContainer, file, data);
    };
    listContainer.appendChild(btn);
  });

  overlay.querySelector('#close-reports').onclick = () => overlay.remove();
}
function displayReportDataInModal(container, filename, sales) {
  if (!sales.length) {
    container.innerHTML = `<p>No sales found in ${filename}</p>`;
    return;
  }

  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.innerHTML = `
    <thead>
      <tr>
        <th style="border:1px solid #ccc; padding:4px">Bill ID</th>
        <th style="border:1px solid #ccc; padding:4px">Timestamp</th>
        <th style="border:1px solid #ccc; padding:4px">Items</th>
        <th style="border:1px solid #ccc; padding:4px">Total</th>
      </tr>
    </thead>
    <tbody>
      ${sales.map(sale => `
        <tr>
          <td style="border:1px solid #ccc; padding:4px">${sale.billId}</td>
          <td style="border:1px solid #ccc; padding:4px">${new Date(sale.timestamp).toLocaleString()}</td>
          <td style="border:1px solid #ccc; padding:4px">
            ${sale.items.map(i => `${i.qty} x ${i.name} (PKR ${i.price})`).join('<br>')}
          </td>
          <td style="border:1px solid #ccc; padding:4px">PKR ${sale.total}</td>
        </tr>
      `).join('')}
    </tbody>
  `;

  container.innerHTML = `<h4>${filename}</h4>`; // show file name
  container.appendChild(table);
}




init();



////////////////////////////////////////////////////
// ACTIVATION SYSTEM - CLEAN VERSION
////////////////////////////////////////////////////

let currentMac = null;

// Fetch MAC once on app start
window.api.getMac().then(mac => {
    currentMac = mac;
    document.getElementById("mac").textContent = "MAC: " + mac;
});

// Show activation modal when triggered
window.api.onShowActivation(() => {
    const modal = document.getElementById("activationModal");
    modal.style.display = "flex";

    // Display stored MAC
    if (currentMac) {
        document.getElementById("mac").innerText = "MAC: " + currentMac;
    } else {
        window.api.getMac().then(mac => {
            currentMac = mac;
            document.getElementById("mac").innerText = "MAC: " + mac;
        });
    }
});

// Handle activation button click
document.getElementById("activateBtn").addEventListener("click", async () => {
    const btn = document.getElementById("activateBtn");
    btn.disabled = true;

    const key = document.getElementById("activationKey").value.trim().toUpperCase();

    let macRaw = await window.api.getMac();  // may be null
    if (!macRaw || typeof macRaw !== 'string') {
        showToast("MAC address not available", 3000);
        btn.disabled = false;
        return;
    }

    const mac = macRaw.toLowerCase(); // normalize
    const result = await window.api.activate( mac, key );

    if (result.success) {
        showToast("✅ Activated successfully!", 3000);
        document.getElementById("activationModal").style.display = "none";
    } else {
        showToast("❌ Invalid activation key!", 3000);
    }

    btn.disabled = false;
});



// Optional: Close modal when clicking outside
document.getElementById("activationModal").addEventListener("click", (e) => {
    if (e.target.id === "activationModal") {
        e.target.style.display = "none";
    }
});
