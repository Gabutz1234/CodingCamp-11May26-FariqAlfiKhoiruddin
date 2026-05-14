/* ============================================================
   Expense & Budget Visualizer — app.js
   Vanilla JS | LocalStorage | Chart.js
   ============================================================ */

'use strict';

// ── Constants ────────────────────────────────────────────────
const STORAGE_KEY   = 'budget_transactions';
const THEME_KEY     = 'budget_theme';
const LIMIT_KEY     = 'budget_limit';

const CATEGORY_ICONS = {
  Food:      '🍔',
  Transport: '🚌',
  Fun:       '🎉',
};

const CATEGORY_COLORS = {
  Food:      '#f97316',
  Transport: '#3b82f6',
  Fun:       '#a855f7',
};

// ── State ────────────────────────────────────────────────────
let transactions = [];
let spendingLimit = 0;
let chart = null;

// ── DOM References ───────────────────────────────────────────
const txForm        = document.getElementById('txForm');
const itemName      = document.getElementById('itemName');
const itemAmount    = document.getElementById('itemAmount');
const itemCategory  = document.getElementById('itemCategory');
const spendLimitEl  = document.getElementById('spendLimit');
const nameError     = document.getElementById('nameError');
const amountError   = document.getElementById('amountError');
const categoryError = document.getElementById('categoryError');

const balanceAmount = document.getElementById('balanceAmount');
const txCount       = document.getElementById('txCount');
const highestSpend  = document.getElementById('highestSpend');
const limitBanner   = document.getElementById('limitBanner');
const limitDisplay  = document.getElementById('limitDisplay');

const txList        = document.getElementById('txList');
const txEmpty       = document.getElementById('txEmpty');
const sortSelect    = document.getElementById('sortSelect');
const clearAllBtn   = document.getElementById('clearAllBtn');
const themeToggle   = document.getElementById('themeToggle');
const chartEmpty    = document.getElementById('chartEmpty');
const chartLegend   = document.getElementById('chartLegend');

// ── Initialise ───────────────────────────────────────────────
function init() {
  loadFromStorage();
  applyTheme(localStorage.getItem(THEME_KEY) || 'light');
  spendLimitEl.value = spendingLimit > 0 ? spendingLimit : '';
  render();
  bindEvents();
}

// ── Storage ──────────────────────────────────────────────────
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    transactions = raw ? JSON.parse(raw) : [];
  } catch {
    transactions = [];
  }
  spendingLimit = parseFloat(localStorage.getItem(LIMIT_KEY)) || 0;
}

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  localStorage.setItem(LIMIT_KEY, spendingLimit);
}

// ── Event Binding ────────────────────────────────────────────
function bindEvents() {
  txForm.addEventListener('submit', handleAddTransaction);
  sortSelect.addEventListener('change', renderList);
  clearAllBtn.addEventListener('click', handleClearAll);
  themeToggle.addEventListener('click', toggleTheme);
  spendLimitEl.addEventListener('change', handleLimitChange);
}

// ── Add Transaction ──────────────────────────────────────────
function handleAddTransaction(e) {
  e.preventDefault();
  if (!validateForm()) return;

  const tx = {
    id:       crypto.randomUUID(),
    name:     itemName.value.trim(),
    amount:   parseFloat(parseFloat(itemAmount.value).toFixed(2)),
    category: itemCategory.value,
    date:     new Date().toISOString(),
  };

  transactions.unshift(tx);
  saveToStorage();
  render();
  txForm.reset();
  clearErrors();
}

// ── Validation ───────────────────────────────────────────────
function validateForm() {
  clearErrors();
  let valid = true;

  if (!itemName.value.trim()) {
    showError(itemName, nameError, 'Item name is required.');
    valid = false;
  }

  const amt = parseFloat(itemAmount.value);
  if (!itemAmount.value || isNaN(amt) || amt <= 0) {
    showError(itemAmount, amountError, 'Enter a valid amount > 0.');
    valid = false;
  }

  if (!itemCategory.value) {
    showError(itemCategory, categoryError, 'Please select a category.');
    valid = false;
  }

  return valid;
}

function showError(field, errorEl, message) {
  field.classList.add('error');
  errorEl.textContent = message;
}

function clearErrors() {
  [itemName, itemAmount, itemCategory].forEach(f => f.classList.remove('error'));
  [nameError, amountError, categoryError].forEach(e => (e.textContent = ''));
}

// ── Delete Transaction ───────────────────────────────────────
function handleDelete(id) {
  transactions = transactions.filter(tx => tx.id !== id);
  saveToStorage();
  render();
}

// ── Clear All ────────────────────────────────────────────────
function handleClearAll() {
  if (transactions.length === 0) return;
  if (!confirm('Delete all transactions? This cannot be undone.')) return;
  transactions = [];
  saveToStorage();
  render();
}

// ── Spending Limit ───────────────────────────────────────────
function handleLimitChange() {
  const val = parseFloat(spendLimitEl.value);
  spendingLimit = (!isNaN(val) && val > 0) ? val : 0;
  saveToStorage();
  render();
}

// ── Theme ────────────────────────────────────────────────────
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  themeToggle.querySelector('.theme-icon').textContent = theme === 'dark' ? '☀️' : '🌙';
  // Rebuild chart so colours update
  if (chart) {
    updateChart();
  }
}

// ── Sorting ──────────────────────────────────────────────────
function getSortedTransactions() {
  const sorted = [...transactions];
  switch (sortSelect.value) {
    case 'date-asc':
      sorted.sort((a, b) => new Date(a.date) - new Date(b.date));
      break;
    case 'date-desc':
      sorted.sort((a, b) => new Date(b.date) - new Date(a.date));
      break;
    case 'amount-desc':
      sorted.sort((a, b) => b.amount - a.amount);
      break;
    case 'amount-asc':
      sorted.sort((a, b) => a.amount - b.amount);
      break;
    case 'category':
      sorted.sort((a, b) => a.category.localeCompare(b.category));
      break;
  }
  return sorted;
}

// ── Totals ───────────────────────────────────────────────────
function getTotal() {
  return transactions.reduce((sum, tx) => sum + tx.amount, 0);
}

function getCategoryTotals() {
  return transactions.reduce((acc, tx) => {
    acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
    return acc;
  }, {});
}

// ── Render (orchestrator) ────────────────────────────────────
function render() {
  renderBalance();
  renderList();
  updateChart();
  renderLimitBanner();
}

// ── Render Balance ───────────────────────────────────────────
function renderBalance() {
  const total = getTotal();
  balanceAmount.textContent = formatCurrency(total);
  txCount.textContent = transactions.length;

  const max = transactions.length > 0
    ? Math.max(...transactions.map(tx => tx.amount))
    : 0;
  highestSpend.textContent = formatCurrency(max);

  // Bump animation
  balanceAmount.classList.remove('bump');
  void balanceAmount.offsetWidth; // reflow
  balanceAmount.classList.add('bump');
  setTimeout(() => balanceAmount.classList.remove('bump'), 200);
}

// ── Render Limit Banner ──────────────────────────────────────
function renderLimitBanner() {
  const total = getTotal();
  if (spendingLimit > 0 && total > spendingLimit) {
    limitDisplay.textContent = formatCurrency(spendingLimit);
    limitBanner.classList.remove('hidden');
  } else {
    limitBanner.classList.add('hidden');
  }
}

// ── Render Transaction List ──────────────────────────────────
function renderList() {
  const sorted = getSortedTransactions();

  if (sorted.length === 0) {
    txList.innerHTML = '';
    txList.appendChild(txEmpty);
    txEmpty.style.display = '';
    return;
  }

  txEmpty.style.display = 'none';

  // Build fragment for performance
  const fragment = document.createDocumentFragment();

  sorted.forEach(tx => {
    const isOver = spendingLimit > 0 && tx.amount > spendingLimit;
    const li = document.createElement('li');
    li.className = 'tx-item' + (isOver ? ' over-limit' : '');
    li.dataset.id = tx.id;

    li.innerHTML = `
      <div class="tx-cat-icon ${escapeHtml(tx.category)}" aria-hidden="true">
        ${CATEGORY_ICONS[tx.category] || '💰'}
      </div>
      <div class="tx-info">
        <div class="tx-name" title="${escapeHtml(tx.name)}">${escapeHtml(tx.name)}</div>
        <div class="tx-meta">
          <span class="tx-category-badge ${escapeHtml(tx.category)}">${escapeHtml(tx.category)}</span>
          <span class="tx-date">${formatDate(tx.date)}</span>
        </div>
      </div>
      <span class="tx-amount${isOver ? ' over-limit-amount' : ''}">${formatCurrency(tx.amount)}</span>
      <button class="btn-icon delete-btn" data-id="${escapeHtml(tx.id)}" aria-label="Delete ${escapeHtml(tx.name)}">✕</button>
    `;

    fragment.appendChild(li);
  });

  txList.innerHTML = '';
  txList.appendChild(fragment);

  // Delegate delete clicks
  txList.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => handleDelete(btn.dataset.id));
  });
}

// ── Chart ────────────────────────────────────────────────────
function updateChart() {
  const totals = getCategoryTotals();
  const labels = Object.keys(totals);
  const data   = Object.values(totals);
  const colors = labels.map(l => CATEGORY_COLORS[l] || '#94a3b8');

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#e0e7ff' : '#374151';

  if (labels.length === 0) {
    chartEmpty.style.display = 'flex';
    if (chart) {
      chart.destroy();
      chart = null;
    }
    chartLegend.innerHTML = '';
    return;
  }

  chartEmpty.style.display = 'none';

  const ctx = document.getElementById('spendingChart').getContext('2d');

  if (chart) {
    chart.data.labels  = labels;
    chart.data.datasets[0].data            = data;
    chart.data.datasets[0].backgroundColor = colors;
    chart.data.datasets[0].borderColor     = isDark ? '#1a1a2e' : '#ffffff';
    chart.options.plugins.legend.labels.color = textColor;
    chart.update();
  } else {
    chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderColor: isDark ? '#1a1a2e' : '#ffffff',
          borderWidth: 3,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '60%',
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label(ctx) {
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct   = ((ctx.parsed / total) * 100).toFixed(1);
                return ` ${formatCurrency(ctx.parsed)} (${pct}%)`;
              },
            },
          },
        },
        animation: {
          duration: 300,
        },
      },
    });
  }

  // Custom legend
  chartLegend.innerHTML = labels.map((label, i) => `
    <div class="legend-item">
      <span class="legend-dot" style="background:${colors[i]}"></span>
      <span>${label}: ${formatCurrency(data[i])}</span>
    </div>
  `).join('');
}

// ── Helpers ──────────────────────────────────────────────────
function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style:    'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value || 0);
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Boot ─────────────────────────────────────────────────────
init();
