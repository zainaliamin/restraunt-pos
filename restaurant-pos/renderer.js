// renderer.js - runs in the UI
let menuItems = [];
let selectedCategory = null;
let bill = {}; // { itemId: { item, qty } }

const $ = id => document.getElementById(id);

// load menu from disk
async function init() {
  menuItems = await window.api.loadMenu();
  if (!menuItems || !menuItems.length) menuItems = [];
  renderCategories();
  // default to first category
  const cats = getCategories();
  selectedCategory = cats[0] || null;
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
  // allow category creation visually by admin (admin adds category via new-category field)
}

/* ---------- render menu (filtered by category & search) ---------- */
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


/* ---------- add to bill ---------- */
function addToBill(item) {
  if (!bill[item.id]) {
    bill[item.id] = { item, qty: 0 };
  }
  bill[item.id].qty++;
  renderBill();
}

/* ---------- render bill (left side) ---------- */
function renderBill() {
  const tbody = document.querySelector('#bill-table tbody');
  tbody.innerHTML = '';
  let total = 0;
  for (const [id, entry] of Object.entries(bill)) {
    const tr = document.createElement('tr');

    const tdName = document.createElement('td');
    tdName.textContent = entry.item.name;
    tr.appendChild(tdName);

    const tdQty = document.createElement('td');
    tdQty.innerHTML = `
      <button class="qty-btn" data-id="${id}" data-op="-">-</button>
      <span style="margin:0 8px">${entry.qty}</span>
      <button class="qty-btn" data-id="${id}" data-op="+">+</button>
      <button class="qty-btn" data-id="${id}" data-op="x" style="margin-left:8px;">Remove</button>
    `;
    tr.appendChild(tdQty);

    const price = entry.qty * entry.item.price;
    const tdPrice = document.createElement('td');
    tdPrice.textContent = `PKR ${price}`;
    tr.appendChild(tdPrice);

    tbody.appendChild(tr);
    total += price;
  }

  $('bill-total').textContent = `Total: PKR ${total}`;

  // attach qty buttons handlers
  document.querySelectorAll('.qty-btn').forEach(b => {
    b.onclick = () => {
      const id = b.dataset.id;
      const op = b.dataset.op;
      if (!bill[id]) return;
      if (op === '+') bill[id].qty++;
      else if (op === '-') {
        bill[id].qty = Math.max(0, bill[id].qty - 1);
        if (bill[id].qty === 0) delete bill[id];
      } else if (op === 'x') delete bill[id];
      renderBill();
    };
  });
}

/* ---------- complete order (save to sales.json) ---------- */
async function completeOrder() {
  const items = Object.values(bill).map(e => ({ name: e.item.name, qty: e.qty, price: e.item.price }));
  if (items.length === 0) {
    alert('No items in order.');
    return;
  }
  const total = items.reduce((s,i)=> s + i.qty * i.price, 0);
  const sale = {
    id: Date.now(),
    items,
    total,
    timestamp: new Date().toISOString()
  };

  await window.api.appendSale(sale);
  // clear current bill
  bill = {};
  renderBill();
  alert('Order saved.');
}

/* ---------- end of day (archive today's sales) ---------- */
async function endDay() {
  const date = new Date();
  const dateString = date.toISOString().slice(0,10); // YYYY-MM-DD
  const r = await window.api.archiveSales(dateString);
  alert(`Sales archived to:\n${r.archived}`);
}

/* ---------- Admin: add new menu item ---------- */
async function addMenuItem() {
  const name = $('new-name').value.trim();
  const price = parseInt($('new-price').value, 10);
  const category = $('new-category').value.trim() || 'Uncategorized';
  if (!name || !price) { alert('Enter name and price'); return; }

  const newId = (menuItems.length ? Math.max(...menuItems.map(i=>i.id)) : 0) + 1;
  const newItem = { id: newId, name, price, category };
  menuItems.push(newItem);
  await window.api.saveMenu(menuItems);

  // clear admin inputs & re-render
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
      if (!confirm('Delete this item?')) return;
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
$('clear-bill').addEventListener('click', () => { bill = {}; renderBill(); });
$('end-day').addEventListener('click', () => {
  if (confirm('Archive today sales and clear them?')) endDay();
});

init();
