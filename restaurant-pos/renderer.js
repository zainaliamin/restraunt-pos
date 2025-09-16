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

/* ---------- end of day ---------- */
async function endDay() {
  const date = new Date();
  const dateString = date.toISOString().slice(0,10);
  const r = await window.api.archiveSales(dateString);
  showToast(`Sales archived to: ${r.archived}`);
}

/* ---------- Admin: add new menu item ---------- */
async function addMenuItem() {
  const name = $('new-name').value.trim();
  const price = parseInt($('new-price').value, 10);
  const category = $('new-category').value.trim() || 'Uncategorized';
  if (!name || !price) { showToast('Enter name and price'); return; }

  const newId = (menuItems.length ? Math.max(...menuItems.map(i=>i.id)) : 0) + 1;
  const newItem = { id: newId, name, price, category };
  menuItems.push(newItem);
  await window.api.saveMenu(menuItems);

  $('new-name').value = '';
  $('new-price').value = '';
  $('new-category').value = '';
  renderCategories();
  renderMenu();
  renderAdminList();
}

/* ---------- Admin: list + delete ---------- */
function renderAdminList() {
  const cont = $('admin-items');
  cont.innerHTML = '';
  menuItems.forEach(it => {
    const d = document.createElement('div');
    d.style = 'display:flex; gap:8px; align-items:center; padding:4px 0;';
    d.innerHTML = `<div style="flex:1">${it.name} (${it.category}) - PKR ${it.price}</div>
                   <button data-id="${it.id}" class="small">Delete</button>`;
    cont.appendChild(d);
  });
  cont.querySelectorAll('button[data-id]').forEach(bt => {
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
}

/* ---------- search input handler ---------- */
$('search').addEventListener('input', () => renderMenu());

/* ---------- admin show/hide ---------- */
$('open-admin').addEventListener('click', () => {
  const panel = $('admin-panel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  renderAdminList();
});

/* ---------- other buttons ---------- */
$('add-item').addEventListener('click', addMenuItem);
$('complete-order').addEventListener('click', completeOrder);
$('clear-bill').addEventListener('click', async () => {
  if (await showConfirm('Clear current bill?')) {
    bills[activeBillId] = {};
    renderBill();
  }
});
$('end-day').addEventListener('click', async () => {
  if (await showConfirm('Archive today sales and clear them?')) endDay();
});

init();
