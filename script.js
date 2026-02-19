const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');

const authScreen = document.getElementById('auth-screen');
const appShell = document.getElementById('app-shell');
const loginForm = document.getElementById('login-form');
const loginUsername = document.getElementById('login-username');
const loginPassword = document.getElementById('login-password');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const currentUserBadge = document.getElementById('current-user-badge');

const jobsTodayCount = document.getElementById('jobs-today-count');
const teamActiveCount = document.getElementById('team-active-count');
const inventoryHealthCount = document.getElementById('inventory-health-count');
const todayGlanceList = document.getElementById('today-glance-list');

const inventoryTableBody = document.getElementById('inventory-table-body');
const employeesTableBody = document.getElementById('employees-table-body');
const clientsTableBody = document.getElementById('clients-table-body');
const employeeTimeline = document.getElementById('employee-timeline');
const bookingCalendarGrid = document.getElementById('booking-calendar-grid');
const calendarMonthLabel = document.getElementById('calendar-month-label');
const selectedDateLabel = document.getElementById('selected-date-label');
const selectedDayBookings = document.getElementById('selected-day-bookings');
const clientSearchInput = document.getElementById('client-search-input');
const invoiceWeekStartInput = document.getElementById('invoice-week-start');
const printInvoicesBtn = document.getElementById('print-invoices-btn');

const addInventoryBtn = document.getElementById('add-inventory-btn');
const addShiftBtn = document.getElementById('add-shift-btn');
const addBookingBtn = document.getElementById('add-booking-btn');
const prevMonthBtn = document.getElementById('prev-month-btn');
const nextMonthBtn = document.getElementById('next-month-btn');
const addActionFab = document.getElementById('add-client-fab');

const clockForm = document.getElementById('clock-form');
const clockEmployeeSelect = document.getElementById('clock-employee');
const clockDateInput = document.getElementById('clock-date');
const clockHoursInput = document.getElementById('clock-hours');
const clockNotesInput = document.getElementById('clock-notes');
const exportTimesheetsBtn = document.getElementById('export-timesheets-btn');
const timesheetTableBody = document.getElementById('timesheet-table-body');
const uiModal = document.getElementById('ui-modal');
const uiModalTitle = document.getElementById('ui-modal-title');
const uiModalMessage = document.getElementById('ui-modal-message');
const uiModalForm = document.getElementById('ui-modal-form');
const uiModalCancelBtn = document.getElementById('ui-modal-cancel');
const uiModalConfirmBtn = document.getElementById('ui-modal-confirm');

const adminOnlyElements = document.querySelectorAll('.admin-only');
const adminOnlyTabs = document.querySelectorAll('[data-admin-only="true"]');

let store = {
  inventory: [],
  employees: [],
  employeeSchedule: [],
  houseOfficeSchedule: { houses: [], offices: [] },
  clients: [],
  timesheets: []
};

let currentUser = null;
let calendarCursor = new Date();
let selectedDateKey = toDateKey(new Date());
let clientSearchTerm = '';
let activeModalResolver = null;

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value));
}

function getMondayDateKey(date = new Date()) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return toDateKey(copy);
}

function formatDate(dateKey) {
  const parsed = new Date(`${dateKey}T00:00:00`);
  return parsed.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatMonth(date) {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function isAdmin() {
  return currentUser?.role === 'admin';
}

function isEmployee() {
  return currentUser?.role === 'employee';
}

function getActiveClients() {
  return (store.clients || []).filter((client) => client.status !== 'archived');
}

function findClientByName(name) {
  const target = String(name || '').trim().toLowerCase();
  if (!target) return null;
  return getActiveClients().find((client) => client.name.toLowerCase() === target) || null;
}

function parseCommaList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function createModalField(field) {
  const label = document.createElement('label');
  label.textContent = field.label;

  if (field.type === 'checkbox-group') {
    const group = document.createElement('div');
    group.className = 'ui-checkbox-group';
    (field.options || []).forEach((option) => {
      const optionLabel = document.createElement('label');
      optionLabel.className = 'ui-checkbox-option';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = field.name;
      checkbox.value = option.value;
      checkbox.checked = Boolean(option.checked);

      const text = document.createElement('span');
      text.textContent = option.label;

      optionLabel.appendChild(checkbox);
      optionLabel.appendChild(text);
      group.appendChild(optionLabel);
    });

    label.appendChild(group);
    return label;
  }

  const control = field.type === 'textarea' ? document.createElement('textarea') : document.createElement('input');
  control.name = field.name;
  control.value = field.value || '';
  control.placeholder = field.placeholder || '';
  if (field.type && field.type !== 'textarea') {
    control.type = field.type;
  }

  label.appendChild(control);
  return label;
}

function closeModal(result) {
  uiModal.classList.add('hidden');
  uiModalForm.innerHTML = '';
  uiModalForm.onkeydown = null;
  uiModalConfirmBtn.textContent = 'Continue';
  uiModalCancelBtn.textContent = 'Cancel';
  uiModalCancelBtn.classList.remove('hidden');
  document.removeEventListener('keydown', onModalKeydown);

  if (activeModalResolver) {
    activeModalResolver(result);
    activeModalResolver = null;
  }
}

function onModalKeydown(event) {
  if (event.key === 'Escape' && !uiModal.classList.contains('hidden')) {
    closeModal({ confirmed: false, values: {} });
  }
}

function showModal({
  title,
  message,
  fields = [],
  confirmText = 'Continue',
  cancelText = 'Cancel',
  showCancel = true
}) {
  return new Promise((resolve) => {
    activeModalResolver = resolve;

    uiModalTitle.textContent = title;
    uiModalMessage.textContent = message || '';
    uiModalForm.innerHTML = '';
    fields.forEach((field) => {
      uiModalForm.appendChild(createModalField(field));
    });

    uiModalConfirmBtn.textContent = confirmText;
    uiModalCancelBtn.textContent = cancelText;
    uiModalCancelBtn.classList.toggle('hidden', !showCancel);
    uiModal.classList.remove('hidden');

    uiModalCancelBtn.onclick = () => closeModal({ confirmed: false, values: {} });
    uiModalConfirmBtn.onclick = () => {
      const values = {};
      fields.forEach((field) => {
        if (field.type === 'checkbox-group') {
          const checked = uiModalForm.querySelectorAll(`input[name="${field.name}"]:checked`);
          values[field.name] = Array.from(checked).map((item) => item.value);
          return;
        }

        const input = uiModalForm.elements.namedItem(field.name);
        values[field.name] = input ? String(input.value) : '';
      });
      closeModal({ confirmed: true, values });
    };

    uiModal.onclick = (event) => {
      if (event.target === uiModal) {
        closeModal({ confirmed: false, values: {} });
      }
    };
    uiModalForm.onkeydown = (event) => {
      if (event.key === 'Enter' && !(event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault();
        uiModalConfirmBtn.click();
      }
    };

    document.addEventListener('keydown', onModalKeydown);
    const firstInput = uiModalForm.querySelector('input, textarea, select');
    if (firstInput) {
      firstInput.focus();
      if (firstInput instanceof HTMLInputElement || firstInput instanceof HTMLTextAreaElement) {
        firstInput.select();
      }
    } else {
      uiModalConfirmBtn.focus();
    }
  });
}

async function uiAlert(message, title = 'Notice') {
  await showModal({
    title,
    message,
    confirmText: 'OK',
    showCancel: false
  });
}

async function uiConfirm(message, title = 'Confirm') {
  const result = await showModal({
    title,
    message,
    confirmText: 'Yes',
    cancelText: 'No'
  });
  return result.confirmed;
}

async function uiPrompt(message, defaultValue = '', options = {}) {
  const result = await showModal({
    title: options.title || 'Input Required',
    message,
    confirmText: options.confirmText || 'Save',
    cancelText: options.cancelText || 'Cancel',
    fields: [
      {
        name: 'value',
        label: options.label || 'Value',
        value: defaultValue,
        placeholder: options.placeholder || '',
        type: options.type || 'text'
      }
    ]
  });

  if (!result.confirmed) return null;
  return result.values.value;
}

function getAssignableEmployees() {
  return (store.employees || [])
    .filter((entry) => entry.role === 'employee')
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

async function uiSelectEmployees(currentSelection = []) {
  const employees = getAssignableEmployees();
  if (!employees.length) {
    await uiAlert('No active employees available to assign.');
    return null;
  }

  const selectedNames = new Set((currentSelection || []).map((name) => String(name)));
  const result = await showModal({
    title: 'Assign Employees',
    message: 'Select one or more employees for this cleaning.',
    confirmText: 'Save Assignment',
    fields: [
      {
        name: 'employees',
        label: 'Employees',
        type: 'checkbox-group',
        options: employees.map((employee) => ({
          value: employee.name,
          label: employee.name,
          checked: selectedNames.has(employee.name)
        }))
      }
    ]
  });

  if (!result.confirmed) return null;
  return result.values.employees || [];
}

function getAllBookings() {
  const houses = (store.houseOfficeSchedule?.houses || []).map((item) => ({ ...item, type: 'houses' }));
  const offices = (store.houseOfficeSchedule?.offices || []).map((item) => ({ ...item, type: 'offices' }));
  return [...houses, ...offices];
}

function getBookingsForDate(dateKey) {
  return getAllBookings().filter((item) => item.date === dateKey);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  if (response.status === 401 && !path.startsWith('/api/auth')) {
    switchToAuth();
    throw new Error('Your session has expired. Please sign in again.');
  }

  if (!response.ok) {
    let errorMessage = 'Request failed';
    try {
      const payload = await response.json();
      errorMessage = payload.error || errorMessage;
    } catch {
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return null;
}

function switchToApp() {
  authScreen.classList.add('hidden');
  appShell.classList.remove('hidden');
}

function switchToAuth() {
  currentUser = null;
  appShell.classList.add('hidden');
  authScreen.classList.remove('hidden');
  addActionFab.classList.add('hidden');
}

function applyRoleAccess() {
  const admin = isAdmin();

  currentUserBadge.textContent = `${currentUser.name} (${currentUser.role})`;

  adminOnlyElements.forEach((element) => {
    element.classList.toggle('hidden', !admin);
  });

  adminOnlyTabs.forEach((tab) => {
    tab.classList.toggle('hidden', !admin);
  });

  addActionFab.classList.toggle('hidden', !admin);
  addInventoryBtn.classList.toggle('hidden', !admin);
  addShiftBtn.classList.toggle('hidden', !admin);
  addBookingBtn.classList.toggle('hidden', !admin);

  const activeTab = document.querySelector('.tab.is-active');
  if (activeTab?.classList.contains('hidden')) {
    document.querySelector('.tab[data-tab="home"]')?.click();
  }

  updateFabForActiveTab();
}

async function fetchStore() {
  store = await api('/api/data');
}

function renderHome() {
  const todayKey = toDateKey(new Date());
  const jobsToday =
    getBookingsForDate(todayKey).length +
    (store.employeeSchedule || []).filter((item) => !item.date || item.date === todayKey).length;

  const uniqueEmployees = new Set();
  (store.employeeSchedule || []).forEach((item) => {
    String(item.employee)
      .split('+')
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((name) => uniqueEmployees.add(name));
  });

  getAllBookings().forEach((booking) => {
    (booking.assignedEmployees || []).forEach((name) => uniqueEmployees.add(String(name).trim()));
  });

  const healthy = (store.inventory || []).filter((item) => Number(item.inStock) >= Number(item.minimum)).length;
  const inventoryTotal = (store.inventory || []).length;
  const healthyPercent = inventoryTotal ? Math.round((healthy / inventoryTotal) * 100) : 0;

  jobsTodayCount.textContent = String(jobsToday);
  teamActiveCount.textContent = String(uniqueEmployees.size);
  inventoryHealthCount.textContent = `${healthyPercent}%`;

  const glance = getAllBookings()
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
    .slice(0, 4)
    .map((item) => `${item.date} ${item.time} - ${item.location}${item.clientName ? ` (${item.clientName})` : ''}`);

  todayGlanceList.innerHTML = glance.length
    ? glance.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
    : '<li>No jobs scheduled yet.</li>';
}

function renderInventory() {
  if (!isAdmin()) {
    inventoryTableBody.innerHTML = '<tr><td colspan="5">Admin access required.</td></tr>';
    return;
  }

  const rows = (store.inventory || []).map((item) => {
    const isHealthyItem = Number(item.inStock) >= Number(item.minimum);
    return `
      <tr>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.inStock)} ${escapeHtml(item.unit)}</td>
        <td>${escapeHtml(item.minimum)} ${escapeHtml(item.unit)}</td>
        <td><span class="pill ${isHealthyItem ? 'pill-ok' : 'pill-warn'}">${isHealthyItem ? 'Healthy' : 'Low'}</span></td>
        <td><button class="link-btn" data-action="delete-inventory" data-id="${escapeHtml(item.id)}">Delete</button></td>
      </tr>
    `;
  });

  inventoryTableBody.innerHTML = rows.length ? rows.join('') : '<tr><td colspan="5">No inventory items yet.</td></tr>';
}

function renderEmployees() {
  if (!isAdmin()) {
    employeesTableBody.innerHTML = '<tr><td colspan="3">Admin access required.</td></tr>';
    if (clockEmployeeSelect) {
      clockEmployeeSelect.innerHTML = '';
    }
    return;
  }

  const employees = (store.employees || []).filter((entry) => entry.role === 'employee');
  const rows = employees.map(
    (entry) => `
      <tr>
        <td>${escapeHtml(entry.name)}</td>
        <td>${escapeHtml(entry.username)}</td>
        <td>${entry.active ? '<span class="pill pill-ok">Active</span>' : '<span class="pill pill-warn">Inactive</span>'}</td>
      </tr>
    `
  );

  employeesTableBody.innerHTML = rows.length
    ? rows.join('')
    : '<tr><td colspan="3">No employees found.</td></tr>';

  if (clockEmployeeSelect) {
    const currentSelection = clockEmployeeSelect.value;
    const options = employees
      .map((entry) => `<option value="${escapeHtml(entry.id)}">${escapeHtml(entry.name)} (${escapeHtml(entry.username)})</option>`)
      .join('');
    clockEmployeeSelect.innerHTML = options;
    if (currentSelection && employees.some((entry) => entry.id === currentSelection)) {
      clockEmployeeSelect.value = currentSelection;
    }
  }
}

function renderClients() {
  if (!isAdmin()) {
    clientsTableBody.innerHTML = '<tr><td colspan="5">Admin access required.</td></tr>';
    return;
  }

  const rows = getActiveClients()
    .filter((client) => {
      if (!clientSearchTerm) return true;
      const haystack = `${client.name} ${client.phone || ''} ${client.email || ''} ${client.address || ''}`.toLowerCase();
      return haystack.includes(clientSearchTerm);
    })
    .map(
      (client) => `
        <tr>
          <td>${escapeHtml(client.name)}</td>
          <td>${escapeHtml(client.type)}</td>
          <td>${escapeHtml(client.phone || '-')}</td>
          <td>${escapeHtml(client.address || '-')}</td>
          <td>
            <button class="link-btn" data-action="schedule-client" data-id="${escapeHtml(client.id)}">Schedule</button>
            <button class="link-btn" data-action="delete-client" data-id="${escapeHtml(client.id)}">Delete</button>
          </td>
        </tr>
      `
    );

  clientsTableBody.innerHTML = rows.length ? rows.join('') : '<tr><td colspan="5">No matching clients found.</td></tr>';
}

function renderEmployeeSchedule() {
  const rows = (store.employeeSchedule || []).map(
    (item) => `
      <div class="timeline-row">
        <span class="time">${escapeHtml(item.date)} ${escapeHtml(item.time)}</span>
        <div>
          <strong>${escapeHtml(item.employee)}</strong>
          <p>${escapeHtml(item.details)}</p>
          ${isAdmin() ? `<button class="link-btn" data-action="delete-shift" data-id="${escapeHtml(item.id)}">Delete</button>` : ''}
        </div>
      </div>
    `
  );

  employeeTimeline.innerHTML = rows.length ? rows.join('') : '<p>No employee shifts scheduled yet.</p>';
}

function renderBookingCalendar() {
  const year = calendarCursor.getFullYear();
  const month = calendarCursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = firstOfMonth.getDay();
  const todayKey = toDateKey(new Date());

  calendarMonthLabel.textContent = formatMonth(firstOfMonth);

  const cells = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push('<div class="calendar-cell calendar-cell-empty"></div>');
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const dateKey = toDateKey(date);
    const bookings = getBookingsForDate(dateKey);
    const houseCount = bookings.filter((item) => item.type === 'houses').length;
    const officeCount = bookings.filter((item) => item.type === 'offices').length;

    const badges = [
      houseCount ? `<span class="day-badge day-badge-house">H ${houseCount}</span>` : '',
      officeCount ? `<span class="day-badge day-badge-office">O ${officeCount}</span>` : ''
    ]
      .filter(Boolean)
      .join('');

    const classes = [
      'calendar-cell',
      bookings.length ? 'has-bookings' : '',
      selectedDateKey === dateKey ? 'selected' : '',
      todayKey === dateKey ? 'today' : ''
    ]
      .filter(Boolean)
      .join(' ');

    cells.push(`
      <button class="${classes}" data-action="select-day" data-date="${dateKey}" type="button">
        <span class="day-number">${day}</span>
        <span class="day-badges">${badges}</span>
      </button>
    `);
  }

  bookingCalendarGrid.innerHTML = cells.join('');
}

function renderSelectedDay() {
  selectedDateLabel.textContent = formatDate(selectedDateKey);
  const bookings = getBookingsForDate(selectedDateKey);

  selectedDayBookings.innerHTML = bookings.length
    ? bookings
        .map((item) => {
          const cleanedTag = item.cleaned ? '<strong>Cleaned</strong>' : 'Pending';
          const employeeTag = (item.assignedEmployees || []).length
            ? `<small>Assigned: ${escapeHtml(item.assignedEmployees.join(', '))}</small>`
            : '<small>Assigned: none</small>';

          return `
            <li>
              <span>
                <strong>${item.type === 'houses' ? 'House' : 'Office'}</strong>
                ${escapeHtml(item.time)} - ${escapeHtml(item.location)}
                ${item.clientName ? `<em>(${escapeHtml(item.clientName)})</em>` : ''}
                ${item.notes ? ` - ${escapeHtml(item.notes)}` : ''}
                <br/>${cleanedTag}<br/>${employeeTag}
              </span>
              <span>
                ${isAdmin() ? `<button class="link-btn" data-action="assign-booking" data-type="${item.type}" data-id="${escapeHtml(item.id)}">Assign</button>` : ''}
                ${(isAdmin() || isEmployee()) ? `<button class="link-btn" data-action="toggle-cleaned" data-type="${item.type}" data-id="${escapeHtml(item.id)}" data-cleaned="${item.cleaned ? 'true' : 'false'}">${item.cleaned ? 'Undo' : 'Mark Cleaned'}</button>` : ''}
                ${isAdmin() ? `<button class="link-btn" data-action="delete-booking" data-type="${item.type}" data-id="${escapeHtml(item.id)}">Delete</button>` : ''}
              </span>
            </li>
          `;
        })
        .join('')
    : '<li>No bookings on this day.</li>';
}

function renderTimesheets() {
  if (!isAdmin()) {
    timesheetTableBody.innerHTML = '';
    return;
  }

  const weekStart = invoiceWeekStartInput.value || getMondayDateKey();
  const start = new Date(`${weekStart}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const entries = (store.timesheets || [])
    .filter((item) => {
      const day = new Date(`${item.date}T00:00:00`);
      return day >= start && day <= end;
    })
    .sort((a, b) => `${a.date} ${a.employeeName}`.localeCompare(`${b.date} ${b.employeeName}`));

  const rows = entries.map(
    (item) => `
      <tr>
        <td>${escapeHtml(item.employeeName)}</td>
        <td>${escapeHtml(item.date)}</td>
        <td>${escapeHtml(item.hours)}</td>
        <td>${escapeHtml(item.notes || '')}</td>
        <td>${escapeHtml(item.clockedAt || '')}</td>
      </tr>
    `
  );

  timesheetTableBody.innerHTML = rows.length ? rows.join('') : '<tr><td colspan="5">No hours logged this week.</td></tr>';
}

function renderAll() {
  renderHome();
  renderInventory();
  renderEmployees();
  renderClients();
  renderEmployeeSchedule();
  renderBookingCalendar();
  renderSelectedDay();
  renderTimesheets();
}

async function scheduleForClient(client) {
  const shouldSchedule = await uiPrompt('Add booking for this client now? (yes/no)', 'yes', {
    label: 'Answer'
  });
  if (!shouldSchedule || shouldSchedule.toLowerCase() !== 'yes') return;

  let keepAdding = true;

  while (keepAdding) {
    const date = await uiPrompt('Booking date (YYYY-MM-DD):', selectedDateKey, {
      label: 'Date',
      placeholder: 'YYYY-MM-DD'
    });
    if (!date) return;
    if (!isDateKey(date)) {
      await uiAlert('Date must be in YYYY-MM-DD format.');
      continue;
    }

    const time = await uiPrompt('Booking time (e.g. 2:30 PM):', '', { label: 'Time' });
    if (!time) return;
    const location = await uiPrompt('Location:', client.address || '', { label: 'Location' });
    if (!location) return;
    const notes = (await uiPrompt('Notes:', 'Routine', { label: 'Notes' })) || 'Routine';
    const assignedEmployees = parseCommaList(
      await uiPrompt('Assigned employees (comma-separated):', '', {
        label: 'Employees'
      })
    );

    const type = client.type === 'office' ? 'offices' : 'houses';

    await api(`/api/house-office-schedule/${type}`, {
      method: 'POST',
      body: JSON.stringify({
        clientId: client.id,
        date,
        time,
        location,
        notes,
        assignedEmployees
      })
    });

    selectedDateKey = date;
    const again = await uiPrompt('Add another day/time for this client? (yes/no)', 'no', {
      label: 'Answer'
    });
    keepAdding = !!again && again.toLowerCase() === 'yes';
  }
}

async function addClient() {
  if (!isAdmin()) return;

  const name = await uiPrompt('Client name:', '', { label: 'Name' });
  if (!name) return;

  const type = (await uiPrompt('Client type (house/office):', 'house', { label: 'Type' })) || 'house';
  const phone = (await uiPrompt('Phone (optional):', '', { label: 'Phone' })) || '';
  const email = (await uiPrompt('Email (optional):', '', { label: 'Email' })) || '';
  const address = (await uiPrompt('Address (optional):', '', { label: 'Address' })) || '';
  const notes = (await uiPrompt('Notes (optional):', '', { label: 'Notes' })) || '';
  const weeklyRateRaw = (await uiPrompt('Weekly invoice rate for cleaned visits:', '120', { label: 'Weekly rate' })) || '120';
  const weeklyRate = Number(weeklyRateRaw) || 120;

  try {
    const client = await api('/api/clients', {
      method: 'POST',
      body: JSON.stringify({ name, type, phone, email, address, notes, weeklyRate })
    });

    await scheduleForClient(client);
    await refresh();
  } catch (error) {
    await uiAlert(error.message);
  }
}

async function addInventoryItem() {
  if (!isAdmin()) return;

  const name = await uiPrompt('Item name:', '', { label: 'Item name' });
  if (!name) return;
  const inStock = await uiPrompt('In stock amount (number):', '', { label: 'In stock', type: 'number' });
  if (inStock === null) return;
  const minimum = await uiPrompt('Minimum amount (number):', '', { label: 'Minimum', type: 'number' });
  if (minimum === null) return;
  const unit = (await uiPrompt('Unit (e.g. bottles, units):', 'units', { label: 'Unit' })) || 'units';

  try {
    await api('/api/inventory', {
      method: 'POST',
      body: JSON.stringify({ name, inStock, minimum, unit })
    });
    await refresh();
  } catch (error) {
    await uiAlert(error.message);
  }
}

async function addShift() {
  if (!isAdmin()) return;

  const date = await uiPrompt('Shift date (YYYY-MM-DD):', selectedDateKey, {
    label: 'Date',
    placeholder: 'YYYY-MM-DD'
  });
  if (!date) return;
  const time = await uiPrompt('Shift time (e.g. 9:00 AM):', '', { label: 'Time' });
  if (!time) return;
  const employee = await uiPrompt('Employee name(s):', '', { label: 'Employee(s)' });
  if (!employee) return;
  const details = await uiPrompt('Shift details:', '', { label: 'Details' });
  if (!details) return;

  try {
    await api('/api/employee-schedule', {
      method: 'POST',
      body: JSON.stringify({ date, time, employee, details })
    });
    await refresh();
  } catch (error) {
    await uiAlert(error.message);
  }
}

async function addBooking() {
  if (!isAdmin()) return;

  const clientName = await uiPrompt('Client name (optional, exact match):', '', {
    label: 'Client name'
  });
  const matchedClient = findClientByName(clientName);

  const typeRaw = await uiPrompt(
    `Booking type: house or office?${matchedClient ? ` (auto: ${matchedClient.type})` : ''}`,
    matchedClient ? matchedClient.type : 'house',
    { label: 'Booking type' }
  );
  if (!typeRaw) return;

  const normalized = typeRaw.toLowerCase().startsWith('o') ? 'offices' : 'houses';
  const date = await uiPrompt('Booking date (YYYY-MM-DD):', selectedDateKey, {
    label: 'Date',
    placeholder: 'YYYY-MM-DD'
  });
  if (!date) return;
  const time = await uiPrompt('Booking time (e.g. 2:30 PM):', '', { label: 'Time' });
  if (!time) return;
  const location = await uiPrompt('Location:', matchedClient?.address || '', { label: 'Location' });
  if (!location) return;
  const notes = (await uiPrompt('Notes:', 'Routine', { label: 'Notes' })) || 'Routine';
  const assignedEmployees = parseCommaList(
    await uiPrompt('Assigned employees (comma-separated):', '', {
      label: 'Employees'
    })
  );

  try {
    await api(`/api/house-office-schedule/${normalized}`, {
      method: 'POST',
      body: JSON.stringify({
        clientId: matchedClient?.id || null,
        clientName: matchedClient?.name || null,
        date,
        time,
        location,
        notes,
        assignedEmployees
      })
    });

    selectedDateKey = date;
    await refresh();
  } catch (error) {
    await uiAlert(error.message);
  }
}

async function addEmployee() {
  if (!isAdmin()) return;

  const name = await uiPrompt('Employee full name:', '', { label: 'Full name' });
  if (!name) return;
  const username = await uiPrompt('Username for login:', '', { label: 'Username' });
  if (!username) return;
  const password = await uiPrompt('Temporary password:', '', { label: 'Temporary password', type: 'password' });
  if (!password) return;

  try {
    await api('/api/admin/employees', {
      method: 'POST',
      body: JSON.stringify({ name, username, password })
    });
    await refresh();
  } catch (error) {
    await uiAlert(error.message);
  }
}

function updateFabForActiveTab() {
  if (!isAdmin()) {
    addActionFab.classList.add('hidden');
    return;
  }

  const activeTabId = document.querySelector('.tab.is-active')?.dataset.tab || 'home';
  const configByTab = {
    employees: { label: 'Add New Employee', ariaLabel: 'Add new employee' },
    clients: { label: 'Add New Client', ariaLabel: 'Add new client' },
    inventory: { label: 'Add Item', ariaLabel: 'Add inventory item' },
    'employee-schedule': { label: 'Assign Shift', ariaLabel: 'Assign employee shift' },
    'house-office-schedule': { label: 'Add Booking', ariaLabel: 'Add booking' }
  };

  const config = configByTab[activeTabId];
  if (!config) {
    addActionFab.classList.add('hidden');
    return;
  }

  addActionFab.classList.remove('hidden');
  addActionFab.textContent = config.label;
  addActionFab.setAttribute('aria-label', config.ariaLabel);
}

function setupTabs() {
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      if (tab.classList.contains('hidden')) return;
      const target = tab.dataset.tab;

      tabs.forEach((item) => item.classList.remove('is-active'));
      panels.forEach((panel) => panel.classList.remove('is-active'));

      tab.classList.add('is-active');
      document.getElementById(target)?.classList.add('is-active');
      updateFabForActiveTab();
    });
  });
}

async function refresh() {
  await fetchStore();

  const allBookings = getAllBookings().sort((a, b) => a.date.localeCompare(b.date));
  if (!allBookings.some((entry) => entry.date === selectedDateKey) && allBookings[0]?.date) {
    selectedDateKey = allBookings[0].date;
  }

  const parsedSelectedDate = new Date(`${selectedDateKey}T00:00:00`);
  if (!Number.isNaN(parsedSelectedDate.getTime())) {
    calendarCursor = new Date(parsedSelectedDate.getFullYear(), parsedSelectedDate.getMonth(), 1);
  }

  renderAll();
}

async function printInvoices() {
  const weekStart = invoiceWeekStartInput.value || getMondayDateKey();
  const payload = await api(`/api/admin/invoices?weekStart=${encodeURIComponent(weekStart)}`);

  if (!payload.invoices.length) {
    await uiAlert('No cleaned house bookings found for the selected week.');
    return;
  }

  const html = payload.invoices
    .map((invoice) => {
      const lineRows = invoice.lineItems
        .map(
          (item) => `
            <tr>
              <td>${escapeHtml(item.date)}</td>
              <td>${escapeHtml(item.time)}</td>
              <td>${escapeHtml(item.location)}</td>
              <td>$${Number(item.amount).toFixed(2)}</td>
            </tr>
          `
        )
        .join('');

      return `
        <section style="margin-bottom:22px; page-break-inside: avoid;">
          <h2 style="margin:0 0 8px;">Invoice - ${escapeHtml(invoice.clientName)}</h2>
          <p style="margin:0 0 8px;">Week: ${escapeHtml(invoice.weekStart)} to ${escapeHtml(invoice.weekEnd)}</p>
          <table border="1" cellspacing="0" cellpadding="6" style="width:100%; border-collapse: collapse;">
            <thead><tr><th>Date</th><th>Time</th><th>Location</th><th>Amount</th></tr></thead>
            <tbody>${lineRows}</tbody>
          </table>
          <p style="text-align:right; font-weight:700;">Total: $${Number(invoice.totalAmount).toFixed(2)}</p>
        </section>
      `;
    })
    .join('');

  const win = window.open('', '_blank');
  if (!win) {
    await uiAlert('Pop-up blocked. Allow pop-ups to print invoices.');
    return;
  }

  win.document.write(`
    <html>
      <head><title>Weekly Invoices</title></head>
      <body style="font-family: Arial, sans-serif; padding: 24px;">${html}</body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.textContent = '';

  const username = loginUsername.value.trim();
  const password = loginPassword.value;

  try {
    currentUser = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    switchToApp();
    applyRoleAccess();
    await refresh();
  } catch (error) {
    loginError.textContent = error.message;
  }
});

logoutBtn.addEventListener('click', async () => {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } catch {
    // no-op
  }
  switchToAuth();
});

addActionFab.addEventListener('click', async () => {
  const activeTabId = document.querySelector('.tab.is-active')?.dataset.tab || 'home';

  if (activeTabId === 'employees') {
    await addEmployee();
    return;
  }
  if (activeTabId === 'clients') {
    await addClient();
    return;
  }
  if (activeTabId === 'inventory') {
    await addInventoryItem();
    return;
  }
  if (activeTabId === 'employee-schedule') {
    await addShift();
    return;
  }
  if (activeTabId === 'house-office-schedule') {
    await addBooking();
  }
});

addInventoryBtn.addEventListener('click', async () => {
  await addInventoryItem();
});

addShiftBtn.addEventListener('click', async () => {
  await addShift();
});

addBookingBtn.addEventListener('click', async () => {
  await addBooking();
});

prevMonthBtn.addEventListener('click', () => {
  calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1);
  renderBookingCalendar();
});

nextMonthBtn.addEventListener('click', () => {
  calendarCursor = new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1);
  renderBookingCalendar();
});

clientSearchInput.addEventListener('input', () => {
  clientSearchTerm = clientSearchInput.value.trim().toLowerCase();
  renderClients();
});

invoiceWeekStartInput.addEventListener('change', () => {
  renderTimesheets();
});

printInvoicesBtn.addEventListener('click', async () => {
  if (!isAdmin()) return;

  try {
    await printInvoices();
  } catch (error) {
    await uiAlert(error.message);
  }
});

clockForm.addEventListener('submit', async (event) => {
  if (!isAdmin()) return;
  event.preventDefault();
  const employeeId = clockEmployeeSelect.value;
  const date = clockDateInput.value;
  const hours = Number(clockHoursInput.value);
  const notes = clockNotesInput.value.trim();

  if (!employeeId) {
    await uiAlert('Please select an employee.');
    return;
  }

  if (!date || !isDateKey(date)) {
    await uiAlert('Please enter a valid date.');
    return;
  }

  if (!Number.isFinite(hours) || hours < 0) {
    await uiAlert('Please enter valid hours.');
    return;
  }

  try {
    await api('/api/employee/clock', {
      method: 'POST',
      body: JSON.stringify({ employeeId, date, hours, notes })
    });

    clockHoursInput.value = '';
    clockNotesInput.value = '';
    await refresh();
  } catch (error) {
    await uiAlert(error.message);
  }
});

exportTimesheetsBtn.addEventListener('click', () => {
  if (!isAdmin()) return;
  const weekStart = invoiceWeekStartInput.value || getMondayDateKey();
  window.location.href = `/api/admin/timesheets/export.csv?weekStart=${encodeURIComponent(weekStart)}`;
});

document.addEventListener('click', async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const actionElement = target.closest('[data-action]');
  if (!(actionElement instanceof HTMLElement)) return;

  const action = actionElement.dataset.action;
  const id = actionElement.dataset.id;

  if (action === 'select-day') {
    const date = actionElement.dataset.date;
    if (!date) return;
    selectedDateKey = date;
    renderBookingCalendar();
    renderSelectedDay();
    return;
  }

  if (!action || !id) return;

  try {
    if (action === 'delete-inventory') {
      await api(`/api/inventory/${id}`, { method: 'DELETE' });
    }

    if (action === 'delete-shift') {
      await api(`/api/employee-schedule/${id}`, { method: 'DELETE' });
    }

    if (action === 'delete-booking') {
      const type = actionElement.dataset.type;
      if (!type) return;
      await api(`/api/house-office-schedule/${type}/${id}`, { method: 'DELETE' });
    }

    if (action === 'assign-booking') {
      const type = actionElement.dataset.type;
      if (!type) return;
      const booking = getAllBookings().find((entry) => entry.id === id && entry.type === type);
      const selectedEmployees = await uiSelectEmployees(booking?.assignedEmployees || []);
      if (selectedEmployees === null) return;

      await api(`/api/house-office-schedule/${type}/${id}/assignment`, {
        method: 'PATCH',
        body: JSON.stringify({ assignedEmployees: selectedEmployees })
      });
    }

    if (action === 'toggle-cleaned') {
      const type = actionElement.dataset.type;
      const cleanedNow = actionElement.dataset.cleaned === 'true';
      if (!type) return;

      await api(`/api/house-office-schedule/${type}/${id}/cleaned`, {
        method: 'PATCH',
        body: JSON.stringify({ cleaned: !cleanedNow })
      });
    }

    if (action === 'delete-client') {
      const ok = await uiConfirm('Delete this client? Related calendar bookings will be archived.');
      if (!ok) return;
      await api(`/api/clients/${id}`, { method: 'DELETE' });
    }

    if (action === 'schedule-client') {
      const client = getActiveClients().find((entry) => entry.id === id);
      if (!client) throw new Error('Client not found.');
      await scheduleForClient(client);
    }

    await refresh();
  } catch (error) {
    await uiAlert(error.message);
  }
});

async function bootstrap() {
  setupTabs();

  clockDateInput.value = toDateKey(new Date());
  invoiceWeekStartInput.value = getMondayDateKey();

  try {
    currentUser = await api('/api/auth/me');
    switchToApp();
    applyRoleAccess();
    await refresh();
  } catch {
    switchToAuth();
  }
}

bootstrap();
