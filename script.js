import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, setDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC2sHZ1MukRHA2dt6aABBQfinA7FH0Sfj4",
  authDomain: "lkkkk-bf0c2.firebaseapp.com",
  projectId: "lkkkk-bf0c2",
  storageBucket: "lkkkk-bf0c2.firebasestorage.app",
  messagingSenderId: "533029601422",
  appId: "1:533029601422:web:659aebe1eeac1f4cdcc9df"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const STORAGE_KEY = 'constructionManagerAppData';
const defaultData = { projects: [], expenses: [], payments: [], debts: [] };

let data = loadData();

const syncDbName = "OfflineSyncDB";
let syncDb;
const request = indexedDB.open(syncDbName, 1);
request.onupgradeneeded = e => {
  syncDb = e.target.result;
  syncDb.createObjectStore("syncQueue", { autoIncrement: true });
};
request.onsuccess = e => {
  syncDb = e.target.result;
  checkAndSync();
};

function addToSyncQueue(operationData) {
  if (!syncDb) return;
  const tx = syncDb.transaction("syncQueue", "readwrite");
  tx.objectStore("syncQueue").add(operationData);
  checkAndSync();
}

async function checkAndSync() {
  if (!navigator.onLine) {
    updateNetworkStatus('offline');
    return;
  }
  updateNetworkStatus('syncing');

  try {
    const tx = syncDb.transaction("syncQueue", "readonly");
    const store = tx.objectStore("syncQueue");
    const allReq = store.getAll();

    allReq.onsuccess = async () => {
      const queue = allReq.result || [];
      const deletedIds = new Set(queue.filter(q => q.action === 'delete').map(q => q.id));

      const snapshot = await getDocs(collection(db, "appData"));
      let serverData = { projects: [], expenses: [], payments: [], debts: [] };
      
      snapshot.forEach(document => {
        serverData[document.id] = document.data().items || [];
      });

      function mergeData(localArr, serverArr) {
        const mergedMap = new Map();
        serverArr.forEach(item => {
          if (!deletedIds.has(item.id)) {
            mergedMap.set(item.id, item);
          }
        });
        localArr.forEach(item => {
          if (!mergedMap.has(item.id)) {
            mergedMap.set(item.id, item);
          } else {
            const localTime = new Date(item.createdAt).getTime();
            const serverTime = new Date(mergedMap.get(item.id).createdAt).getTime();
            if (localTime >= serverTime) {
              mergedMap.set(item.id, item);
            }
          }
        });
        return Array.from(mergedMap.values());
      }

      data.projects = mergeData(data.projects, serverData.projects || []);
      data.expenses = mergeData(data.expenses, serverData.expenses || []);
      data.payments = mergeData(data.payments, serverData.payments || []);
      data.debts = mergeData(data.debts, serverData.debts || []);
      
      persistLocalOnly();

      if (queue.length > 0) {
        await setDoc(doc(db, "appData", "projects"), { items: data.projects });
        await setDoc(doc(db, "appData", "expenses"), { items: data.expenses });
        await setDoc(doc(db, "appData", "payments"), { items: data.payments });
        await setDoc(doc(db, "appData", "debts"), { items: data.debts });
        
        const clearTx = syncDb.transaction("syncQueue", "readwrite");
        clearTx.objectStore("syncQueue").clear();
      }

      updateNetworkStatus('online');
      renderAll();
    };
  } catch (error) {
    console.error("Sync error:", error);
    updateNetworkStatus('online');
  }
}

function updateNetworkStatus(status) {
  const badge = document.getElementById('networkStatus');
  badge.className = 'status-badge ' + status;
  if (status === 'online') badge.innerHTML = '<i class="fa-solid fa-wifi"></i> متصل';
  else if (status === 'offline') badge.innerHTML = '<i class="fa-solid fa-plane-slash"></i> أوفلاين';
  else if (status === 'syncing') badge.innerHTML = '<i class="fa-solid fa-rotate"></i> جاري المزامنة...';
}

window.addEventListener('online', checkAndSync);
window.addEventListener('offline', () => updateNetworkStatus('offline'));

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.log('SW Error:', err));
  });
}

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('installAppBtn').style.display = 'inline-flex';
});

document.getElementById('installAppBtn').addEventListener('click', async () => {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      document.getElementById('installAppBtn').style.display = 'none';
    }
    deferredPrompt = null;
  }
});

function checkPassword() {
  if (sessionStorage.getItem('appUnlocked') !== 'true') {
    document.getElementById('passwordOverlay').style.display = 'flex';
  } else {
    document.getElementById('passwordOverlay').style.display = 'none';
  }
}

document.getElementById('appPasswordBtn').addEventListener('click', () => {
  if (document.getElementById('appPasswordInput').value === '1968') {
    sessionStorage.setItem('appUnlocked', 'true');
    document.getElementById('passwordOverlay').style.display = 'none';
  } else {
    document.getElementById('appPasswordError').style.display = 'block';
  }
});

checkPassword();
updateNetworkStatus(navigator.onLine ? 'online' : 'offline');

const views = document.querySelectorAll('.view');
const navButtons = document.querySelectorAll('.nav-btn');
const modals = document.querySelectorAll('.modal');

const projectsCount = document.getElementById('projectsCount');
const paymentsTotal = document.getElementById('paymentsTotal');
const expensesTotal = document.getElementById('expensesTotal');
const profitTotal = document.getElementById('profitTotal');
const recentActivity = document.getElementById('recentActivity');
const projectsList = document.getElementById('projectsList');
const expensesList = document.getElementById('expensesList');
const paymentsList = document.getElementById('paymentsList');
const debtsList = document.getElementById('debtsList');
const reportProjectSelect = document.getElementById('reportProjectSelect');
const reportCard = document.getElementById('reportCard');
const todayText = document.getElementById('todayText');

const debtsTotal = document.getElementById('debtsTotal');
const debtsLaborTotal = document.getElementById('debtsLaborTotal');
const debtsMaterialsTotal = document.getElementById('debtsMaterialsTotal');
const debtsPaidTotal = document.getElementById('debtsPaidTotal');
const debtsRemainingTotal = document.getElementById('debtsRemainingTotal');

const projectForm = document.getElementById('projectForm');
const expenseForm = document.getElementById('expenseForm');
const paymentForm = document.getElementById('paymentForm');
const debtForm = document.getElementById('debtForm');
const settlementForm = document.getElementById('settlementForm');

const expenseProject = document.getElementById('expenseProject');
const paymentProject = document.getElementById('paymentProject');
const debtProject = document.getElementById('debtProject');
const debtType = document.getElementById('debtType');
const debtItemsContainer = document.getElementById('debtItemsContainer');
const debtItemTemplate = document.getElementById('debtItemTemplate');
const debtEditId = document.getElementById('debtEditId');
const debtModalTitle = document.getElementById('debtModalTitle');

const debtSearchInput = document.getElementById('debtSearchInput');
const debtFilterProject = document.getElementById('debtFilterProject');
const debtFilterType = document.getElementById('debtFilterType');
const debtFilterStatus = document.getElementById('debtFilterStatus');

document.getElementById('expenseDate').valueAsDate = new Date();
document.getElementById('paymentDate').valueAsDate = new Date();
document.getElementById('debtDate').valueAsDate = new Date();
document.getElementById('settlementDate').valueAsDate = new Date();

todayText.textContent = new Date().toLocaleDateString('ar-IQ');

document.querySelectorAll('[data-open-modal]').forEach(btn => {
  btn.addEventListener('click', () => {
    const modalId = btn.dataset.openModal;
    if (modalId === 'debtModal') {
      prepareNewDebtForm();
    } else if (modalId === 'projectModal') {
      projectForm.reset();
      document.getElementById('projectEditId').value = '';
    } else if (modalId === 'expenseModal') {
      expenseForm.reset();
      document.getElementById('expenseEditId').value = '';
      document.getElementById('expenseDate').valueAsDate = new Date();
    } else if (modalId === 'paymentModal') {
      paymentForm.reset();
      document.getElementById('paymentEditId').value = '';
      document.getElementById('paymentDate').valueAsDate = new Date();
    }
    openModal(modalId);
  });
});

document.querySelectorAll('[data-close-modal]').forEach(btn => {
  btn.addEventListener('click', closeAllModals);
});

modals.forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) closeAllModals();
  });
});

navButtons.forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

projectForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const pId = document.getElementById('projectEditId').value;
  const project = {
    id: pId || crypto.randomUUID(),
    name: document.getElementById('projectName').value.trim(),
    type: document.getElementById('projectType').value,
    client: document.getElementById('clientName').value.trim(),
    budget: Number(document.getElementById('projectBudget').value),
    notes: document.getElementById('projectNotes').value.trim(),
    createdAt: new Date().toISOString()
  };

  if (pId) {
    const index = data.projects.findIndex(item => item.id === pId);
    if (index !== -1) data.projects[index] = project;
    showToast('تم تعديل المشروع بنجاح');
  } else {
    data.projects.unshift(project);
    showToast('تم حفظ المشروع بنجاح');
  }

  persist();
  addToSyncQueue({ action: pId ? 'edit' : 'add', type: 'projects', item: project });
  projectForm.reset();
  document.getElementById('projectEditId').value = '';
  closeAllModals();
  renderAll();
  switchView('projects');
});

expenseForm.addEventListener('submit', (e) => {
  e.preventDefault();

  if (!data.projects.length) {
    showToast('أضف مشروع أولاً');
    return;
  }

  const exId = document.getElementById('expenseEditId').value;
  const expense = {
    id: exId || crypto.randomUUID(),
    projectId: expenseProject.value,
    type: document.getElementById('expenseType').value,
    amount: Number(document.getElementById('expenseAmount').value),
    date: document.getElementById('expenseDate').value,
    note: document.getElementById('expenseNote').value.trim(),
    createdAt: new Date().toISOString()
  };

  if (exId) {
    const index = data.expenses.findIndex(item => item.id === exId);
    if (index !== -1) data.expenses[index] = expense;
    showToast('تم تعديل المصروف');
  } else {
    data.expenses.unshift(expense);
    showToast('تم حفظ المصروف');
  }

  persist();
  addToSyncQueue({ action: exId ? 'edit' : 'add', type: 'expenses', item: expense });
  expenseForm.reset();
  document.getElementById('expenseEditId').value = '';
  document.getElementById('expenseDate').valueAsDate = new Date();
  closeAllModals();
  renderAll();
  switchView('expenses');
});

paymentForm.addEventListener('submit', (e) => {
  e.preventDefault();

  if (!data.projects.length) {
    showToast('أضف مشروع أولاً');
    return;
  }

  const payId = document.getElementById('paymentEditId').value;
  const payment = {
    id: payId || crypto.randomUUID(),
    projectId: paymentProject.value,
    amount: Number(document.getElementById('paymentAmount').value),
    date: document.getElementById('paymentDate').value,
    note: document.getElementById('paymentNote').value.trim(),
    createdAt: new Date().toISOString()
  };

  if (payId) {
    const index = data.payments.findIndex(item => item.id === payId);
    if (index !== -1) data.payments[index] = payment;
    showToast('تم تعديل الدفعة');
  } else {
    data.payments.unshift(payment);
    showToast('تم حفظ الدفعة');
  }

  persist();
  addToSyncQueue({ action: payId ? 'edit' : 'add', type: 'payments', item: payment });
  paymentForm.reset();
  document.getElementById('paymentEditId').value = '';
  document.getElementById('paymentDate').valueAsDate = new Date();
  closeAllModals();
  renderAll();
  switchView('payments');
});

debtForm.addEventListener('submit', (e) => {
  e.preventDefault();

  if (!data.projects.length) {
    showToast('أضف مشروع أولاً');
    return;
  }

  const items = readDebtItems();
  if (!items.length) {
    showToast('أضف عنصر دين واحد على الأقل');
    return;
  }

  const totals = calculateDebtTotals(items);
  const debt = {
    id: debtEditId.value || crypto.randomUUID(),
    projectId: debtProject.value,
    date: document.getElementById('debtDate').value,
    creditorName: document.getElementById('debtCreditorName').value.trim(),
    debtType: debtType.value,
    title: document.getElementById('debtTitle').value.trim(),
    notes: document.getElementById('debtNotes').value.trim(),
    items,
    totalAmount: totals.totalAmount,
    totalPaid: totals.totalPaid,
    totalRemaining: totals.totalRemaining,
    status: getDebtStatus(totals.totalAmount, totals.totalPaid),
    settlements: getExistingSettlements(debtEditId.value),
    createdAt: new Date().toISOString()
  };

  if (debtEditId.value) {
    const index = data.debts.findIndex(item => item.id === debtEditId.value);
    if (index !== -1) data.debts[index] = debt;
    showToast('تم تعديل الدين');
  } else {
    data.debts.unshift(debt);
    showToast('تم حفظ الدين');
  }

  persist();
  addToSyncQueue({ action: 'set', type: 'debts', item: debt });
  closeAllModals();
  renderAll();
  switchView('debts');
});

settlementForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const debtId = document.getElementById('settlementDebtId').value;
  const amount = Number(document.getElementById('settlementAmount').value);
  const date = document.getElementById('settlementDate').value;
  const note = document.getElementById('settlementNote').value.trim();

  const debt = data.debts.find(item => item.id === debtId);
  if (!debt) return;

  debt.settlements = Array.isArray(debt.settlements) ? debt.settlements : [];
  debt.settlements.unshift({
    id: crypto.randomUUID(),
    amount,
    date,
    note,
    createdAt: new Date().toISOString()
  });

  applySettlementToDebt(debt, amount);
  debt.createdAt = new Date().toISOString();
  persist();
  addToSyncQueue({ action: 'set', type: 'debts', item: debt });
  settlementForm.reset();
  document.getElementById('settlementDate').valueAsDate = new Date();
  closeAllModals();
  renderAll();
  showToast('تم حفظ التسديد');
});

document.getElementById('exportBtn').addEventListener('click', exportData);
document.getElementById('importInput').addEventListener('change', importData);
document.getElementById('clearDataBtn').addEventListener('click', clearData);
document.getElementById('addDebtItemBtn').addEventListener('click', () => addDebtItemRow());

debtSearchInput.addEventListener('input', renderDebts);
debtFilterProject.addEventListener('change', renderDebts);
debtFilterType.addEventListener('change', renderDebts);
debtFilterStatus.addEventListener('change', renderDebts);
reportProjectSelect.addEventListener('change', renderReport);
debtType.addEventListener('change', updateDebtItemPlaceholders);

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return structuredClone(defaultData);
    const parsed = JSON.parse(saved);
    return {
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      expenses: Array.isArray(parsed.expenses) ? parsed.expenses : [],
      payments: Array.isArray(parsed.payments) ? parsed.payments : [],
      debts: Array.isArray(parsed.debts) ? parsed.debts : []
    };
  } catch (error) {
    console.error('Load error', error);
    return structuredClone(defaultData);
  }
}

function persistLocalOnly() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function persist() {
  persistLocalOnly();
}

function openModal(id) {
  if ((id === 'expenseModal' || id === 'paymentModal' || id === 'debtModal') && !data.projects.length) {
    showToast('يجب إضافة مشروع أولاً');
    return;
  }
  document.getElementById(id).classList.add('show');
  updateProjectOptions();
}

function closeAllModals() {
  modals.forEach(modal => modal.classList.remove('show'));
}

function switchView(viewId) {
  views.forEach(view => view.classList.toggle('active', view.id === viewId));
  navButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.view === viewId));
}

function formatMoney(value) {
  return new Intl.NumberFormat('ar-IQ').format(Number(value || 0)) + ' د.ع';
}

function getProjectName(id) {
  const project = data.projects.find(p => p.id === id);
  return project ? project.name : 'مشروع غير معروف';
}

function projectPaymentsTotal(projectId) {
  return data.payments
    .filter(item => item.projectId === projectId)
    .reduce((sum, item) => sum + item.amount, 0);
}

function projectExpensesTotal(projectId) {
  return data.expenses
    .filter(item => item.projectId === projectId)
    .reduce((sum, item) => sum + item.amount, 0);
}

function projectDebtsTotal(projectId) {
  return data.debts
    .filter(item => item.projectId === projectId)
    .reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
}

function projectDebtsPaidTotal(projectId) {
  return data.debts
    .filter(item => item.projectId === projectId)
    .reduce((sum, item) => sum + Number(item.totalPaid || 0), 0);
}

function projectDebtsRemainingTotal(projectId) {
  return data.debts
    .filter(item => item.projectId === projectId)
    .reduce((sum, item) => sum + Number(item.totalRemaining || 0), 0);
}

function deleteProject(id) {
  if (!confirm('هل تريد حذف هذا المشروع وكل ما يتعلق به؟')) return;

  data.projects = data.projects.filter(project => project.id !== id);
  data.expenses = data.expenses.filter(item => item.projectId !== id);
  data.payments = data.payments.filter(item => item.projectId !== id);
  data.debts = data.debts.filter(item => item.projectId !== id);
  persist();
  addToSyncQueue({ action: 'delete', type: 'projects', id: id });
  renderAll();
  showToast('تم حذف المشروع');
}

function deleteExpense(id) {
  if (!confirm('حذف هذا المصروف؟')) return;
  data.expenses = data.expenses.filter(item => item.id !== id);
  persist();
  addToSyncQueue({ action: 'delete', type: 'expenses', id: id });
  renderAll();
  showToast('تم حذف المصروف');
}

function deletePayment(id) {
  if (!confirm('حذف هذه الدفعة؟')) return;
  data.payments = data.payments.filter(item => item.id !== id);
  persist();
  addToSyncQueue({ action: 'delete', type: 'payments', id: id });
  renderAll();
  showToast('تم حذف الدفعة');
}

function deleteDebt(id) {
  if (!confirm('حذف هذا الدين؟')) return;
  data.debts = data.debts.filter(item => item.id !== id);
  persist();
  addToSyncQueue({ action: 'delete', type: 'debts', id: id });
  renderAll();
  showToast('تم حذف الدين');
}

function renderDashboard() {
  const totalPayments = data.payments.reduce((sum, item) => sum + item.amount, 0);
  const totalExpenses = data.expenses.reduce((sum, item) => sum + item.amount, 0);
  const totalProfit = totalPayments - totalExpenses;

  projectsCount.textContent = data.projects.length;
  paymentsTotal.textContent = formatMoney(totalPayments);
  expensesTotal.textContent = formatMoney(totalExpenses);
  profitTotal.textContent = formatMoney(totalProfit);

  const activities = [
    ...data.payments.map(item => ({
      type: 'دفعة',
      amount: item.amount,
      date: item.date,
      projectId: item.projectId,
      createdAt: item.createdAt
    })),
    ...data.expenses.map(item => ({
      type: 'مصروف',
      amount: item.amount,
      date: item.date,
      projectId: item.projectId,
      createdAt: item.createdAt
    })),
    ...data.debts.map(item => ({
      type: 'دين',
      amount: item.totalAmount,
      date: item.date,
      projectId: item.projectId,
      createdAt: item.createdAt
    }))
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);

  if (!activities.length) {
    recentActivity.className = 'list-wrap empty-state';
    recentActivity.textContent = 'لا توجد عمليات بعد';
    return;
  }

  recentActivity.className = 'list-wrap';
  recentActivity.innerHTML = activities.map(item => `
    <div class="activity-item">
      <div>
        <strong>${item.type}</strong>
        <div class="muted">${getProjectName(item.projectId)}</div>
      </div>
      <div>
        <strong>${formatMoney(item.amount)}</strong>
        <div class="muted">${item.date || ''}</div>
      </div>
    </div>
  `).join('');
}

function renderProjects() {
  if (!data.projects.length) {
    projectsList.innerHTML = '<div class="empty-state glass">لا توجد مشاريع مضافة حاليًا</div>';
    return;
  }

  projectsList.innerHTML = data.projects.map(project => {
    const income = projectPaymentsTotal(project.id);
    const expense = projectExpensesTotal(project.id);
    const net = income - expense;

    return `
      <article class="project-card glass">
        <div class="card-top">
          <div>
            <h3>${project.name}</h3>
            <div class="muted">الزبون: ${project.client}</div>
          </div>
          <span class="tag">${project.type}</span>
        </div>

        <div class="inline-stats">
          <div class="mini-box">
            <span>المبلغ الكلي</span>
            <strong>${formatMoney(project.budget)}</strong>
          </div>
          <div class="mini-box">
            <span>الداخل</span>
            <strong>${formatMoney(income)}</strong>
          </div>
          <div class="mini-box">
            <span>الخارج</span>
            <strong>${formatMoney(expense)}</strong>
          </div>
          <div class="mini-box">
            <span>الصافي</span>
            <strong>${formatMoney(net)}</strong>
          </div>
        </div>

        <div class="card-actions">
          <button class="small-btn" onclick="openProjectReport('${project.id}')">عرض التقرير</button>
          <div style="display:flex; gap:10px;">
            <button class="small-btn" onclick="editProject('${project.id}')">تعديل</button>
            <button class="small-btn danger" onclick="deleteProject('${project.id}')">حذف</button>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function renderExpenses() {
  if (!data.expenses.length) {
    expensesList.innerHTML = '<div class="empty-state glass">لا توجد مصاريف مسجلة</div>';
    return;
  }

  expensesList.innerHTML = data.expenses.map(item => `
    <article class="record-card glass">
      <div class="record-meta">
        <div>
          <h3>${item.type}</h3>
          <div class="muted">${getProjectName(item.projectId)}</div>
        </div>
        <span class="tag">${item.date}</span>
      </div>
      <p>${item.note || 'بدون ملاحظة'}</p>
      <div class="card-actions">
        <strong>${formatMoney(item.amount)}</strong>
        <div style="display:flex; gap:10px;">
          <button class="small-btn" onclick="editExpense('${item.id}')">تعديل</button>
          <button class="small-btn danger" onclick="deleteExpense('${item.id}')">حذف</button>
        </div>
      </div>
    </article>
  `).join('');
}

function renderPayments() {
  if (!data.payments.length) {
    paymentsList.innerHTML = '<div class="empty-state glass">لا توجد دفعات مسجلة</div>';
    return;
  }

  paymentsList.innerHTML = data.payments.map(item => `
    <article class="record-card glass">
      <div class="record-meta">
        <div>
          <h3>دفعة مستلمة</h3>
          <div class="muted">${getProjectName(item.projectId)}</div>
        </div>
        <span class="tag">${item.date}</span>
      </div>
      <p>${item.note || 'بدون ملاحظة'}</p>
      <div class="card-actions">
        <strong>${formatMoney(item.amount)}</strong>
        <div style="display:flex; gap:10px;">
          <button class="small-btn" onclick="editPayment('${item.id}')">تعديل</button>
          <button class="small-btn danger" onclick="deletePayment('${item.id}')">حذف</button>
        </div>
      </div>
    </article>
  `).join('');
}

function renderDebtsSummary() {
  const total = data.debts.reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
  const labor = data.debts
    .filter(item => item.debtType === 'أجور عمل')
    .reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
  const materials = data.debts
    .filter(item => item.debtType === 'مواد')
    .reduce((sum, item) => sum + Number(item.totalAmount || 0), 0);
  const paid = data.debts.reduce((sum, item) => sum + Number(item.totalPaid || 0), 0);
  const remaining = data.debts.reduce((sum, item) => sum + Number(item.totalRemaining || 0), 0);

  debtsTotal.textContent = formatMoney(total);
  debtsLaborTotal.textContent = formatMoney(labor);
  debtsMaterialsTotal.textContent = formatMoney(materials);
  debtsPaidTotal.textContent = formatMoney(paid);
  debtsRemainingTotal.textContent = formatMoney(remaining);
}

function renderDebts() {
  renderDebtsSummary();

  if (!data.debts.length) {
    debtsList.innerHTML = '<div class="empty-state glass">لا توجد ديون مسجلة</div>';
    return;
  }

  const search = debtSearchInput.value.trim().toLowerCase();
  const filterProject = debtFilterProject.value;
  const filterType = debtFilterType.value;
  const filterStatus = debtFilterStatus.value;

  const filtered = data.debts.filter(item => {
    const haystack = [
      getProjectName(item.projectId),
      item.creditorName,
      item.debtType,
      item.title,
      ...(Array.isArray(item.items) ? item.items.map(sub => `${sub.name} ${sub.role} ${sub.note || ''}`) : [])
    ].join(' ').toLowerCase();

    const matchesSearch = !search || haystack.includes(search);
    const matchesProject = !filterProject || item.projectId === filterProject;
    const matchesType = !filterType || item.debtType === filterType;
    const matchesStatus = !filterStatus || item.status === filterStatus;

    return matchesSearch && matchesProject && matchesType && matchesStatus;
  });

  if (!filtered.length) {
    debtsList.innerHTML = '<div class="empty-state glass">لا توجد نتائج مطابقة</div>';
    return;
  }

  debtsList.innerHTML = filtered.map(item => {
    const statusClass = item.status === 'غير مسدد'
      ? 'status-unpaid'
      : item.status === 'مسدد جزئيًا'
        ? 'status-partial'
        : 'status-paid';

    const itemsHtml = (item.items || []).map(sub => `
      <div class="debt-card-item">
        <div class="debt-card-topline">
          <strong>${sub.name || '-'}</strong>
          <span class="tag">${sub.role || '-'}</span>
        </div>
        <div class="debt-summary-line">
          <div class="mini-box"><span>الكمية / الأيام</span><strong>${sub.quantity || 0}</strong></div>
          <div class="mini-box"><span>السعر / الأجر</span><strong>${formatMoney(sub.price || 0)}</strong></div>
          <div class="mini-box"><span>المبلغ</span><strong>${formatMoney(sub.total || 0)}</strong></div>
          <div class="mini-box"><span>المتبقي</span><strong>${formatMoney(sub.remaining || 0)}</strong></div>
        </div>
        <div class="muted">${sub.note || 'بدون ملاحظة'}</div>
      </div>
    `).join('');

    return `
      <article class="record-card glass">
        <div class="debt-card-head">
          <div>
            <h3>${item.title}</h3>
            <div class="muted">${getProjectName(item.projectId)} - ${item.creditorName}</div>
          </div>
          <div class="debt-card-topline">
            <span class="tag">${item.debtType}</span>
            <span class="status-badge ${statusClass}">${item.status}</span>
          </div>
        </div>

        <div class="debt-card-details">
          <div class="debt-summary-line">
            <div class="mini-box"><span>المبلغ الكلي</span><strong>${formatMoney(item.totalAmount)}</strong></div>
            <div class="mini-box"><span>المدفوع</span><strong>${formatMoney(item.totalPaid)}</strong></div>
            <div class="mini-box"><span>المتبقي</span><strong>${formatMoney(item.totalRemaining)}</strong></div>
            <div class="mini-box"><span>التاريخ</span><strong>${item.date || '-'}</strong></div>
          </div>
          <div class="muted">${item.notes || 'بدون ملاحظات'}</div>
          <div class="debt-card-items">${itemsHtml}</div>
        </div>

        <div class="card-actions">
          <button class="small-btn" onclick="editDebt('${item.id}')">تعديل</button>
          <button class="small-btn" onclick="openSettlementModal('${item.id}')">تسديد دفعة</button>
          <button class="small-btn danger" onclick="deleteDebt('${item.id}')">حذف</button>
        </div>
      </article>
    `;
  }).join('');
}

function updateProjectOptions() {
  const options = data.projects.map(project => `<option value="${project.id}">${project.name}</option>`).join('');
  expenseProject.innerHTML = options;
  paymentProject.innerHTML = options;
  debtProject.innerHTML = options;

  reportProjectSelect.innerHTML = data.projects.length
    ? data.projects.map(project => `<option value="${project.id}">${project.name}</option>`).join('')
    : '<option value="">لا توجد مشاريع</option>';

  debtFilterProject.innerHTML = data.projects.length
    ? `<option value="">الكل</option>${data.projects.map(project => `<option value="${project.id}">${project.name}</option>`).join('')}`
    : '<option value="">الكل</option>';
}

function renderReport() {
  updateProjectOptions();

  if (!data.projects.length) {
    reportCard.innerHTML = '<div class="empty-state">أضف مشروعًا حتى يظهر التقرير</div>';
    return;
  }

  const projectId = reportProjectSelect.value || data.projects[0].id;
  reportProjectSelect.value = projectId;

  const project = data.projects.find(item => item.id === projectId);
  const income = projectPaymentsTotal(projectId);
  const expense = projectExpensesTotal(projectId);
  const net = income - expense;
  const remaining = (project.budget || 0) - income;
  const debtsAmount = projectDebtsTotal(projectId);
  const debtsPaid = projectDebtsPaidTotal(projectId);
  const debtsRemaining = projectDebtsRemainingTotal(projectId);

  reportCard.innerHTML = `
    <div class="report-box">
      <h3>${project.name}</h3>
      <p class="muted">الزبون: ${project.client} | النوع: ${project.type}</p>
    </div>
    <div class="report-box"><strong>المبلغ الكلي:</strong> ${formatMoney(project.budget)}</div>
    <div class="report-box"><strong>إجمالي الدفعات:</strong> ${formatMoney(income)}</div>
    <div class="report-box"><strong>إجمالي المصاريف:</strong> ${formatMoney(expense)}</div>
    <div class="report-box"><strong>صافي الربح:</strong> ${formatMoney(net)}</div>
    <div class="report-box"><strong>المتبقي من الزبون:</strong> ${formatMoney(remaining)}</div>
    <div class="report-box"><strong>إجمالي ديون المشروع:</strong> ${formatMoney(debtsAmount)}</div>
    <div class="report-box"><strong>المسدد من ديون المشروع:</strong> ${formatMoney(debtsPaid)}</div>
    <div class="report-box"><strong>المتبقي من ديون المشروع:</strong> ${formatMoney(debtsRemaining)}</div>
    <div class="report-box"><strong>الملاحظات:</strong> ${project.notes || 'لا توجد ملاحظات'}</div>
  `;
}

function openProjectReport(projectId) {
  switchView('reports');
  updateProjectOptions();
  reportProjectSelect.value = projectId;
  renderReport();
}

function prepareNewDebtForm() {
  debtForm.reset();
  debtEditId.value = '';
  debtModalTitle.textContent = 'إضافة دين';
  debtItemsContainer.innerHTML = '';
  document.getElementById('debtDate').valueAsDate = new Date();
  addDebtItemRow();
  updateDebtTotalsDisplay();
  updateDebtItemPlaceholders();
}

function addDebtItemRow(item = {}) {
  const fragment = debtItemTemplate.content.cloneNode(true);
  const row = fragment.querySelector('.debt-item-row');

  const nameInput = row.querySelector('.debt-item-name');
  const roleInput = row.querySelector('.debt-item-role');
  const quantityInput = row.querySelector('.debt-item-quantity');
  const priceInput = row.querySelector('.debt-item-price');
  const paidInput = row.querySelector('.debt-item-paid');
  const noteInput = row.querySelector('.debt-item-note');
  const totalText = row.querySelector('.debt-item-total-text');
  const remainingText = row.querySelector('.debt-item-remaining-text');
  const removeBtn = row.querySelector('.remove-debt-item-btn');

  nameInput.value = item.name || '';
  roleInput.value = item.role || '';
  quantityInput.value = item.quantity ?? 1;
  priceInput.value = item.price ?? 0;
  paidInput.value = item.paid ?? 0;
  noteInput.value = item.note || '';

  function refreshRow() {
    const quantity = Number(quantityInput.value || 0);
    const price = Number(priceInput.value || 0);
    const paid = Number(paidInput.value || 0);
    const total = quantity * price;
    const remaining = Math.max(total - paid, 0);

    row.dataset.total = total;
    row.dataset.remaining = remaining;
    totalText.textContent = formatMoney(total);
    remainingText.textContent = formatMoney(remaining);
    updateDebtTotalsDisplay();
  }

  [quantityInput, priceInput, paidInput].forEach(input => {
    input.addEventListener('input', refreshRow);
  });

  removeBtn.addEventListener('click', () => {
    row.remove();
    if (!debtItemsContainer.children.length) addDebtItemRow();
    updateDebtTotalsDisplay();
  });

  debtItemsContainer.appendChild(row);
  refreshRow();
  updateDebtItemPlaceholders();
}

function updateDebtItemPlaceholders() {
  const typeValue = debtType.value;
  debtItemsContainer.querySelectorAll('.debt-item-row').forEach(row => {
    const nameInput = row.querySelector('.debt-item-name');
    const roleInput = row.querySelector('.debt-item-role');
    const quantityLabel = row.querySelectorAll('.field span')[2];
    const priceLabel = row.querySelectorAll('.field span')[3];

    if (typeValue === 'أجور عمل') {
      nameInput.placeholder = 'اسم العامل أو الشخص';
      roleInput.placeholder = 'فني أو عامل أو معلم';
      quantityLabel.textContent = 'عدد الأيام';
      priceLabel.textContent = 'الأجر اليومي';
    } else if (typeValue === 'مواد') {
      nameInput.placeholder = 'اسم المادة';
      roleInput.placeholder = 'الوحدة مثل متر أو قطعة';
      quantityLabel.textContent = 'الكمية';
      priceLabel.textContent = 'السعر';
    } else {
      nameInput.placeholder = 'الاسم أو المادة';
      roleInput.placeholder = 'الصفة أو الوحدة';
      quantityLabel.textContent = 'الكمية / الأيام';
      priceLabel.textContent = 'السعر / الأجر';
    }
  });
}

function readDebtItems() {
  return [...debtItemsContainer.querySelectorAll('.debt-item-row')].map(row => {
    const name = row.querySelector('.debt-item-name').value.trim();
    const role = row.querySelector('.debt-item-role').value.trim();
    const quantity = Number(row.querySelector('.debt-item-quantity').value || 0);
    const price = Number(row.querySelector('.debt-item-price').value || 0);
    const paid = Number(row.querySelector('.debt-item-paid').value || 0);
    const note = row.querySelector('.debt-item-note').value.trim();
    const total = quantity * price;
    const remaining = Math.max(total - paid, 0);

    return { name, role, quantity, price, total, paid, remaining, note };
  }).filter(item => item.name || item.role || item.quantity || item.price || item.paid || item.note);
}

function calculateDebtTotals(items) {
  const totalAmount = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const totalPaid = items.reduce((sum, item) => sum + Number(item.paid || 0), 0);
  const totalRemaining = items.reduce((sum, item) => sum + Number(item.remaining || 0), 0);
  return { totalAmount, totalPaid, totalRemaining };
}

function updateDebtTotalsDisplay() {
  const totals = calculateDebtTotals(readDebtItems());
  document.getElementById('debtTotalAmount').textContent = formatMoney(totals.totalAmount);
  document.getElementById('debtTotalPaid').textContent = formatMoney(totals.totalPaid);
  document.getElementById('debtTotalRemaining').textContent = formatMoney(totals.totalRemaining);
}

function getDebtStatus(totalAmount, totalPaid) {
  if (Number(totalPaid) <= 0) return 'غير مسدد';
  if (Number(totalPaid) >= Number(totalAmount)) return 'مسدد بالكامل';
  return 'مسدد جزئيًا';
}

function getExistingSettlements(id) {
  if (!id) return [];
  const debt = data.debts.find(item => item.id === id);
  return debt && Array.isArray(debt.settlements) ? debt.settlements : [];
}

function editDebt(id) {
  const debt = data.debts.find(item => item.id === id);
  if (!debt) return;

  updateProjectOptions();
  debtEditId.value = debt.id;
  debtModalTitle.textContent = 'تعديل دين';
  document.getElementById('debtDate').value = debt.date || '';
  document.getElementById('debtCreditorName').value = debt.creditorName || '';
  debtType.value = debt.debtType || 'أجور عمل';
  document.getElementById('debtTitle').value = debt.title || '';
  document.getElementById('debtNotes').value = debt.notes || '';
  debtProject.value = debt.projectId || '';

  debtItemsContainer.innerHTML = '';
  (debt.items || []).forEach(item => addDebtItemRow(item));
  if (!debtItemsContainer.children.length) addDebtItemRow();

  updateDebtTotalsDisplay();
  updateDebtItemPlaceholders();
  openModal('debtModal');
}

function openSettlementModal(id) {
  const debt = data.debts.find(item => item.id === id);
  if (!debt) return;
  document.getElementById('settlementDebtId').value = id;
  document.getElementById('settlementAmount').value = debt.totalRemaining || 0;
  document.getElementById('settlementDate').valueAsDate = new Date();
  document.getElementById('settlementNote').value = '';
  openModal('settlementModal');
}

function applySettlementToDebt(debt, amount) {
  let remainingToApply = Number(amount || 0);

  debt.items = (debt.items || []).map(item => {
    const currentRemaining = Math.max(Number(item.total || 0) - Number(item.paid || 0), 0);
    if (remainingToApply <= 0 || currentRemaining <= 0) return item;

    const applied = Math.min(currentRemaining, remainingToApply);
    const nextPaid = Number(item.paid || 0) + applied;
    const nextRemaining = Math.max(Number(item.total || 0) - nextPaid, 0);

    remainingToApply -= applied;

    return {
      ...item,
      paid: nextPaid,
      remaining: nextRemaining
    };
  });

  const totals = calculateDebtTotals(debt.items);
  debt.totalAmount = totals.totalAmount;
  debt.totalPaid = totals.totalPaid;
  debt.totalRemaining = totals.totalRemaining;
  debt.status = getDebtStatus(debt.totalAmount, debt.totalPaid);
}

function exportData() {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'construction-backup.json';
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('تم تصدير النسخة الاحتياطية');
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      data = {
        projects: Array.isArray(imported.projects) ? imported.projects : [],
        expenses: Array.isArray(imported.expenses) ? imported.expenses : [],
        payments: Array.isArray(imported.payments) ? imported.payments : [],
        debts: Array.isArray(imported.debts) ? imported.debts : []
      };
      persist();
      addToSyncQueue({ action: 'full_sync', data: data });
      renderAll();
      showToast('تم استيراد البيانات بنجاح');
    } catch (error) {
      console.error(error);
      showToast('ملف غير صالح');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

function clearData() {
  if (!confirm('هل أنت متأكد من حذف جميع البيانات؟')) return;
  data = structuredClone(defaultData);
  persist();
  addToSyncQueue({ action: 'full_sync', data: data });
  renderAll();
  showToast('تم حذف جميع البيانات');
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2200);
}

function renderAll() {
  updateProjectOptions();
  renderDashboard();
  renderProjects();
  renderExpenses();
  renderPayments();
  renderDebts();
  renderReport();
}

window.deleteProject = deleteProject;
window.deleteExpense = deleteExpense;
window.deletePayment = deletePayment;
window.deleteDebt = deleteDebt;
window.openProjectReport = openProjectReport;
window.editDebt = editDebt;
window.openSettlementModal = openSettlementModal;

window.editProject = function(id) {
  const project = data.projects.find(item => item.id === id);
  if (!project) return;
  document.getElementById('projectEditId').value = project.id;
  document.getElementById('projectName').value = project.name;
  document.getElementById('projectType').value = project.type;
  document.getElementById('clientName').value = project.client;
  document.getElementById('projectBudget').value = project.budget;
  document.getElementById('projectNotes').value = project.notes;
  openModal('projectModal');
};

window.editExpense = function(id) {
  const expense = data.expenses.find(item => item.id === id);
  if (!expense) return;
  updateProjectOptions();
  document.getElementById('expenseEditId').value = expense.id;
  document.getElementById('expenseProject').value = expense.projectId;
  document.getElementById('expenseType').value = expense.type;
  document.getElementById('expenseAmount').value = expense.amount;
  document.getElementById('expenseDate').value = expense.date;
  document.getElementById('expenseNote').value = expense.note;
  openModal('expenseModal');
};

window.editPayment = function(id) {
  const payment = data.payments.find(item => item.id === id);
  if (!payment) return;
  updateProjectOptions();
  document.getElementById('paymentEditId').value = payment.id;
  document.getElementById('paymentProject').value = payment.projectId;
  document.getElementById('paymentAmount').value = payment.amount;
  document.getElementById('paymentDate').value = payment.date;
  document.getElementById('paymentNote').value = payment.note;
  openModal('paymentModal');
};

prepareNewDebtForm();
renderAll();
