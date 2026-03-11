import { db } from './firebase-config.js';
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  getDocs
  , orderBy
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js';

const DAYS_COLLECTION = 'trip_days';
const EXPENSES_COLLECTION = 'trip_expenses';

// map of listeners for item snapshots per dayKey
const itemUnsubscribes = new Map();

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function formatTextWithLineBreaks(s) {
  if (!s) return '';
  return escapeHtml(s).replace(/\r?\n/g, '<br/>');
}

// Currency formatters
const formatTWD = (v) => {
  try { return new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 2 }).format(v); }
  catch (e) { return 'NT$' + Number(v).toFixed(2); }
};
const formatJPY = (v) => {
  try { return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(v); }
  catch (e) { return '¥' + Number(v).toFixed(0); }
};

function renderItem(docSnap, dayKey) {
  const id = docSnap.id;
  const data = docSnap.data();
  const time = data.time || '';
  const title = data.title || '';
  const desc = data.description || '';

  return `
    <div class="timeline-item mb-4 position-relative" data-id="${id}" data-day="${dayKey}">
      <div class="timeline-dot"></div>
      <div class="timeline-time">${escapeHtml(time)}</div>
      <div class="flex-fill">
        <div class="card">
          <div class="card-body">
            <h6 class="card-title mb-1">${escapeHtml(title)}</h6>
            <p class="card-text mb-1 small">${formatTextWithLineBreaks(desc)}</p>
            <button class="btn btn-sm btn-outline-secondary card-edit-btn requires-unlocked" data-action="edit" onclick="tripApp.openEditModal('${id}','${dayKey}')" title="編輯"><i class="fas fa-pen"></i></button>
            <button class="btn btn-sm btn-outline-danger card-delete-btn requires-unlocked" data-action="delete" onclick="tripApp.deleteItem('${id}','${dayKey}')" title="刪除"><i class="fas fa-minus"></i></button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderExpenseItem(docSnap) {
  const id = docSnap.id;
  const data = docSnap.data();
  const dt = data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp)) : null;
  const iso = dt ? dt.toLocaleString() : '';
  const amountOriginal = Number(data.amount || 0);
  const currency = data.currency || 'TWD';
  // amountTWD: use stored amountTWD if present, otherwise convert if currency is JPY
  const amountTWD = Number((data.amountTWD != null) ? data.amountTWD : (currency === 'JPY' ? amountOriginal * 0.2 : amountOriginal));
  const payer = data.payer || '';
  const sharers = Array.isArray(data.sharers) ? data.sharers : [];
  const shareCount = sharers.length || 1;
  const perShare = (amountTWD / shareCount) || 0;
  const note = data.note || '';

  return `
    <div class="d-flex align-items-start mb-3 border-bottom pb-2" data-id="${id}">
      <div class="flex-fill">
        <div class="d-flex justify-content-between">
          <div class="d-flex flex-column" style="min-width:0;">
            <div class="fw-semibold">${escapeHtml(payer)}</div>
            <div class="mt-1 small text-truncate">${escapeHtml(note)}</div>
            <div class="mt-2 small text-muted" style="font-size:0.65rem;">${escapeHtml(sharers.join(', '))}</div>
          </div>
            <div class="text-end ms-3">
            <div class="small text-muted">${escapeHtml(iso)}</div>
            <div class="fw-bold">${currency === 'JPY' ? formatJPY(amountOriginal) : formatTWD(amountOriginal)}</div>
            <div class="small text-muted">人均 ${formatTWD(perShare)}</div>
          </div>
        </div>
      </div>
      <div class="ms-2 d-flex flex-column gap-1">
        <button class="btn btn-sm btn-outline-secondary requires-unlocked" data-action="edit" title="編輯" onclick="tripApp.openExpenseModal('${id}')"><i class="fas fa-pen"></i></button>
        <button class="btn btn-sm btn-outline-danger requires-unlocked" data-action="delete" title="刪除" onclick="tripApp.deleteExpense('${id}')"><i class="fas fa-trash"></i></button>
      </div>
    </div>
  `;
}

async function addItem(dayKey, payload) {
  const itemsCol = collection(doc(db, DAYS_COLLECTION, dayKey), 'items');
  await addDoc(itemsCol, Object.assign({}, payload, { createdAt: serverTimestamp() }));
}

async function deleteItem(id, dayKey) {
  if (!confirm('確定要刪除這筆項目？')) return;
  await deleteDoc(doc(db, DAYS_COLLECTION, dayKey, 'items', id));
}

async function addExpense(payload) {
  await addDoc(collection(db, EXPENSES_COLLECTION), Object.assign({}, payload, { createdAt: serverTimestamp() }));
}

async function deleteExpense(id) {
  if (!confirm('確定要刪除此筆花費？')) return;
  await deleteDoc(doc(db, EXPENSES_COLLECTION, id));
}

// Days management
async function addDay(label, key) {
  // if key provided, ensure it is used as doc id; otherwise let Firestore auto-generate
  const payload = { label };
  if (key) {
    await setDoc(doc(db, DAYS_COLLECTION, key), payload);
    return key;
  } else {
    const ref = await addDoc(collection(db, DAYS_COLLECTION), payload);
    return ref.id;
  }
}

async function deleteDay(dayId) {
  if (!confirm('確定要刪除整個日期與該日的所有項目？此操作無法復原')) return;
  // delete items in the subcollection
  const itemsCol = collection(doc(db, DAYS_COLLECTION, dayId), 'items');
  const snaps = await getDocs(itemsCol);
  const deletes = [];
  snaps.forEach(s => deletes.push(deleteDoc(doc(db, DAYS_COLLECTION, dayId, 'items', s.id))));
  await Promise.all(deletes);
  // delete day doc
  await deleteDoc(doc(db, DAYS_COLLECTION, dayId));
}

function ensureItemListener(dayKey) {
  if (itemUnsubscribes.has(dayKey)) return;
  const itemsCol = collection(doc(db, DAYS_COLLECTION, dayKey), 'items');
  const unsub = onSnapshot(itemsCol, snapshot => {
    const container = document.getElementById('timeline-' + dayKey);
    if (!container) return;
    const docs = [];
    snapshot.forEach(docSnap => docs.push(docSnap));
    // Sort items by time (HH:MM). If time missing or equal, fallback to createdAt.
    docs.sort((a, b) => {
      const da = a.data();
      const db = b.data();
      const ta = (da.time || '').trim();
      const tb = (db.time || '').trim();
      // If both have time strings in HH:MM, compare lexicographically (works for 24-hour)
      if (ta && tb) {
        if (ta < tb) return -1;
        if (ta > tb) return 1;
        // equal times -> fallthrough to createdAt
      } else if (ta && !tb) {
        return -1; // items with time come before items without time
      } else if (!ta && tb) {
        return 1;
      }
      // fallback: sort by createdAt timestamp
      const at = da.createdAt;
      const bt = db.createdAt;
      const aval = (at && typeof at.toMillis === 'function') ? at.toMillis() : (at ? at : 0);
      const bval = (bt && typeof bt.toMillis === 'function') ? bt.toMillis() : (bt ? bt : 0);
      return aval - bval;
    });
    let html = '';
    docs.forEach(docSnap => {
      html += renderItem(docSnap, dayKey);
    });
    container.innerHTML = html || '<p class="text-muted">尚無項目</p>';
  });
  itemUnsubscribes.set(dayKey, unsub);
}

function removeItemListener(dayKey) {
  const unsub = itemUnsubscribes.get(dayKey);
  if (unsub) {
    unsub();
    itemUnsubscribes.delete(dayKey);
  }
}

function openAddModal(date) {
  const dateInput = document.getElementById('tripItemDate');
  const titleInput = document.getElementById('tripItemTitle');
  const timeInput = document.getElementById('tripItemTime');
  const descInput = document.getElementById('tripItemDesc');
  const idInput = document.getElementById('tripItemId');
  if (dateInput) dateInput.value = date;
  if (titleInput) titleInput.value = '';
  if (timeInput) timeInput.value = '';
  if (descInput) descInput.value = '';
  if (idInput) idInput.value = '';
  const modalEl = document.getElementById('tripItemModal');
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

async function openEditModal(id, dayKey) {
  try {
    const docRef = doc(db, DAYS_COLLECTION, dayKey, 'items', id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      alert('找不到該項目');
      return;
    }
    const data = snap.data();
    const dateInput = document.getElementById('tripItemDate');
    const titleInput = document.getElementById('tripItemTitle');
    const timeInput = document.getElementById('tripItemTime');
    const descInput = document.getElementById('tripItemDesc');
    const idInput = document.getElementById('tripItemId');
    if (dateInput) dateInput.value = dayKey || '';
    if (titleInput) titleInput.value = data.title || '';
    if (timeInput) timeInput.value = data.time || '';
    if (descInput) descInput.value = data.description || '';
    if (idInput) idInput.value = id;
    const modalEl = document.getElementById('tripItemModal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  } catch (err) {
    console.error(err);
    alert('讀取項目失敗');
  }
}

function bindForm() {
  const form = document.getElementById('tripItemForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('tripItemId').value;
    const date = document.getElementById('tripItemDate').value;
    const title = document.getElementById('tripItemTitle').value.trim();
    const time = document.getElementById('tripItemTime').value.trim();
    const description = document.getElementById('tripItemDesc').value.trim();
    if (!date || !title) {
      alert('請填寫標題與日期');
      return;
    }
    try {
      if (id) {
        // update existing in subcollection
        await updateDoc(doc(db, DAYS_COLLECTION, date, 'items', id), { title, time, description });
      } else {
        await addItem(date, { title, time, description });
      }
      const modalEl = document.getElementById('tripItemModal');
      const modal = bootstrap.Modal.getInstance(modalEl);
      if (modal) modal.hide();
      form.reset();
    } catch (err) {
      console.error(err);
      alert('儲存失敗');
    }
  });
  // Ensure add-day form is bound even if Firestore onSnapshot hasn't fired
  const dayFormEarly = document.getElementById('tripDayForm');
  if (dayFormEarly && !dayFormEarly.__bound) {
    dayFormEarly.__bound = true;
    dayFormEarly.addEventListener('submit', async (e) => {
      e.preventDefault();
      const label = document.getElementById('tripDayLabel').value.trim();
      console.log('tripDayForm submit handler invoked, label=', label);
      try {
        const daysSnap = await getDocs(collection(db, DAYS_COLLECTION));
        let maxOrder = 0;
        daysSnap.forEach(d => {
          const o = d.data().order;
          if (o != null && typeof o === 'number' && o > maxOrder) maxOrder = o;
        });
        const payload = { label, order: maxOrder + 1 };
        await addDoc(collection(db, DAYS_COLLECTION), payload);
        const modalEl = document.getElementById('tripDayModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
        dayFormEarly.reset();
      } catch (err) {
        console.error(err);
        alert('新增日期失敗');
      }
    });
    }
  
  // Expense form binding
  const expenseForm = document.getElementById('expenseForm');
  if (expenseForm && !expenseForm.__bound) {
    expenseForm.__bound = true;
    expenseForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const id = document.getElementById('expenseId').value;
        const dtVal = document.getElementById('expenseDateTime').value;
        const amountVal = Number(document.getElementById('expenseAmount').value);
        const isJPY = document.getElementById('expenseIsJPY') ? !!document.getElementById('expenseIsJPY').checked : false;
        const payer = document.getElementById('expensePayer').value;
        const sharerEls = Array.from(document.querySelectorAll('.expense-sharer'));
        const sharers = sharerEls.filter(chk => chk.checked).map(chk => chk.value);
        const noteVal = (document.getElementById('expenseNote') && document.getElementById('expenseNote').value) ? document.getElementById('expenseNote').value.trim() : '';
        if (!dtVal || !amountVal || !payer || !noteVal) {
          alert('請填寫日期時間、金額、出錢人與內容');
          return;
        }
        const timestamp = new Date(dtVal);
        const currency = isJPY ? 'JPY' : 'TWD';
        const amountTWD = isJPY ? (amountVal * 0.2) : amountVal;
        const payload = { timestamp, amount: amountVal, currency, amountTWD, payer, sharers, note: noteVal };
        if (id) {
          await updateDoc(doc(db, EXPENSES_COLLECTION, id), payload);
        } else {
          await addExpense(payload);
        }
        const modalEl = document.getElementById('expenseModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
        expenseForm.reset();
      } catch (err) {
        console.error(err);
        alert('儲存花費失敗');
      }
    });
  }

}
window.tripApp = {
  openAddModal,
  openEditModal,
  deleteItem: async (id, dayKey) => { await deleteItem(id, dayKey); },
  openAddDayModal: () => {
    const label = document.getElementById('tripDayLabel');
    if (label) label.value = '';
    const modalEl = document.getElementById('tripDayModal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  },
  deleteDay: async (id) => { await deleteDay(id); },
  // Expenses
  openExpenseModal: async (id) => {
    const idInput = document.getElementById('expenseId');
    const dtInput = document.getElementById('expenseDateTime');
    const amountInput = document.getElementById('expenseAmount');
    const payerInput = document.getElementById('expensePayer');
    const sharerEls = Array.from(document.querySelectorAll('.expense-sharer'));
    if (id) {
      try {
        const snap = await getDoc(doc(db, EXPENSES_COLLECTION, id));
        if (!snap.exists()) { alert('找不到該花費'); return; }
        const data = snap.data();
        idInput.value = id;
        if (data.timestamp) {
          const dt = data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
          const pad = n => n.toString().padStart(2,'0');
          const s = `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
          dtInput.value = s;
        }
        amountInput.value = data.amount || '';
        const isJPYBox = document.getElementById('expenseIsJPY');
        if (isJPYBox) isJPYBox.checked = (data.currency === 'JPY');
        const noteInput = document.getElementById('expenseNote');
        if (noteInput) noteInput.value = data.note || '';
        payerInput.value = data.payer || payerInput.value;
        sharerEls.forEach(chk => { chk.checked = (Array.isArray(data.sharers) && data.sharers.includes(chk.value)); });
      } catch (err) { console.error(err); alert('載入花費失敗'); return; }
    } else {
      idInput.value = '';
      const now = new Date();
      const pad = n => n.toString().padStart(2,'0');
      dtInput.value = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
      amountInput.value = '';
      const isJPYBox = document.getElementById('expenseIsJPY');
      if (isJPYBox) isJPYBox.checked = false;
      payerInput.value = 'Wade';
      sharerEls.forEach(chk => chk.checked = true);
      const noteInput = document.getElementById('expenseNote');
      if (noteInput) noteInput.value = '';
    }
    const modalEl = document.getElementById('expenseModal');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();
  },
  deleteExpense: async (id) => { await deleteExpense(id); }
};

// Listen for days collection changes and render tabs/panes
const daysCol = collection(db, DAYS_COLLECTION);
onSnapshot(daysCol, snapshot => {
  const tabs = document.getElementById('tripDaysTabs');
  const tabContent = document.getElementById('tripTabsContent');
  if (!tabs || !tabContent) return;

  // if no days exist yet, show an empty state and do NOT auto-create defaults
  if (snapshot.empty) {
    tabs.innerHTML = '<li class="nav-item w-100"><div class="text-muted w-100 p-2 text-center">尚無日期。請點右側 + 新增日期。</div></li>';
    tabContent.innerHTML = '<div class="p-3 text-muted">尚無日期。請使用右上角的 + 新增日期。</div>';
    // remove any existing item listeners
    Array.from(itemUnsubscribes.keys()).forEach(k => removeItemListener(k));
    return;
  }

  const docs = [];
  snapshot.forEach(d => docs.push(d));
  docs.sort((a, b) => {
    const ao = (a.data().order != null) ? a.data().order : 0;
    const bo = (b.data().order != null) ? b.data().order : 0;
    return ao - bo;
  });

  let firstId = null;
  let tabsHtml = '';
  let panesHtml = '';
  docs.forEach((docSnap) => {
    const id = docSnap.id;
    const data = docSnap.data();
    const label = data.label || id;
    if (firstId === null) firstId = id;
    tabsHtml += `<li class="nav-item d-flex align-items-center" role="presentation" style="flex:1; position:relative;"><button class="nav-link w-100 text-center tab-with-close" id="tab-${id}" data-bs-toggle="tab" data-bs-target="#pane-${id}" type="button" role="tab" aria-controls="pane-${id}" aria-selected="false">${escapeHtml(label)}</button><span class="tab-close requires-unlocked" data-action="delete" title="刪除日期" onclick="tripApp.deleteDay('${id}')">✕</span></li>`;
    panesHtml += `<div class="tab-pane fade" id="pane-${id}" role="tabpanel" aria-labelledby="tab-${id}"><div class="d-flex justify-content-end mb-2"><button class="btn btn-sm btn-primary btn-icon" aria-label="新增項目" onclick="tripApp.openAddModal('${id}')"><i class="fas fa-plus"></i></button></div><div class="timeline mt-3"><div class="timeline-left"><div class="timeline-line"></div></div><div class="timeline-right" id="timeline-${id}"></div></div></div>`;
  });

  tabs.innerHTML = tabsHtml;
  tabContent.innerHTML = panesHtml;

  // activate first tab
  if (firstId) {
    const firstBtn = document.getElementById('tab-' + firstId);
    const firstPane = document.getElementById('pane-' + firstId);
    if (firstBtn && firstPane) {
      firstBtn.classList.add('active');
      firstPane.classList.add('show', 'active');
    }
  }

  // ensure listeners for each day
  snapshot.forEach(docSnap => ensureItemListener(docSnap.id));

  // remove listeners for days that were deleted
  const existingIds = new Set();
  snapshot.forEach(s => existingIds.add(s.id));
  Array.from(itemUnsubscribes.keys()).forEach(k => { if (!existingIds.has(k)) removeItemListener(k); });
});

// Listen for expenses collection changes and render list
const expensesCol = collection(db, EXPENSES_COLLECTION);
try {
  const qExp = query(expensesCol, orderBy('timestamp', 'asc'));
  onSnapshot(qExp, snapshot => {
    const container = document.getElementById('expensesList');
    const summaryEl = document.getElementById('expensesSummary');
    if (!container) return;
    const docs = [];
    snapshot.forEach(s => docs.push(s));
    let html = '';
    docs.forEach(d => { html += renderExpenseItem(d); });
    container.innerHTML = html || '<p class="text-muted">尚無花費紀錄</p>';
    // compute per-person net: paid - owe, and settlement suggestions
    if (summaryEl) {
      const people = ['Wade','Donna','Ken','Sandy'];
      const totals = {};
      people.forEach(p => totals[p] = { paid:0, owe:0, net:0 });
      docs.forEach(d => {
        const data = d.data();
        // use amountTWD if present, otherwise convert JPY to TWD on the fly
        const currency = data.currency || 'TWD';
        const amtOrig = Number(data.amount || 0);
        const amount = Number((data.amountTWD != null) ? data.amountTWD : (currency === 'JPY' ? amtOrig * 0.2 : amtOrig));
        const payer = data.payer || '';
        const sharers = Array.isArray(data.sharers) && data.sharers.length>0 ? data.sharers : people;
        const per = amount / (sharers.length || 1);
        if (people.includes(payer)) totals[payer].paid += amount;
        sharers.forEach(s => { if (people.includes(s)) totals[s].owe += per; });
      });
      people.forEach(p => { totals[p].net = totals[p].paid - totals[p].owe; });
      // build per-person boxes (left) and settlement suggestions (right) in one row
      let leftHtml = '<div class="d-flex gap-3 flex-wrap mb-2">';
      people.forEach(p => {
        const net = totals[p].net;
        const cls = net >= 0 ? 'text-success' : 'text-danger';
        leftHtml += `<div class="border rounded p-2"><div class="small text-muted">${escapeHtml(p)}</div><div class="fw-bold ${cls}">${net >=0 ? '+' : '-'}${formatTWD(Math.abs(net))}</div></div>`;
      });
      leftHtml += '</div>';

      // settlement suggestions (greedy match)
      const creditors = [];
      const debtors = [];
      people.forEach(p => {
        const v = Number((totals[p].net || 0).toFixed(2));
        if (v > 0) creditors.push({ person: p, amount: v });
        else if (v < 0) debtors.push({ person: p, amount: -v }); // store positive owed amount
      });
      creditors.sort((a,b) => b.amount - a.amount);
      debtors.sort((a,b) => b.amount - a.amount);
      const settles = [];
      let i = 0, j = 0;
      while (i < debtors.length && j < creditors.length) {
        const owe = debtors[i];
        const cred = creditors[j];
        const m = Math.min(owe.amount, cred.amount);
        settles.push(`${escapeHtml(owe.person)} → ${escapeHtml(cred.person)}: ${formatTWD(m)}`);
        owe.amount -= m;
        cred.amount -= m;
        if (Math.abs(owe.amount) < 0.005) i++;
        if (Math.abs(cred.amount) < 0.005) j++;
      }

      let rightHtml = '';
      if (settles.length) {
        rightHtml += '<div class="small text-muted mb-1">結算建議：</div>';
        rightHtml += '<ul class="small mb-0">';
        settles.forEach(s => { rightHtml += `<li>${s}</li>`; });
        rightHtml += '</ul>';
      } else {
        rightHtml += '<div class="small text-muted">所有人已平衡</div>';
      }

      // Render per-person summary on its own row, and settlement suggestions on a separate row
      const wrapper = `${leftHtml}<div class="mt-2">${rightHtml}</div>`;
      // add a horizontal divider after the summary to separate from the list below
      summaryEl.innerHTML = wrapper + '<hr class="my-3" />';
    }
  });
} catch (err) {
  console.error('expenses listener setup failed', err);
}

// Ensure forms are bound when DOM is ready (prevents unbound submit causing navigation)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bindForm);
} else {
  bindForm();
}
