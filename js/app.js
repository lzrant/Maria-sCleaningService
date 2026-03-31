import {
  addActionFab,
  addBookingBtn,
  addInventoryBtn,
  addShiftBtn,
  adminOnlyElements,
  adminOnlyTabs,
  appShell,
  authScreen,
  changePasswordBtn,
  clientSearchInput,
  clockDateInput,
  clockForm,
  exportTimesheetsBtn,
  invoiceWeekStartInput,
  loginError,
  loginForm,
  loginPassword,
  loginUsername,
  logoutBtn,
  panels,
  prevMonthBtn,
  nextMonthBtn,
  printInvoicesBtn,
  printScheduleBtn,
  tabs,
  currentUserBadge
} from './dom.js';
import { api } from './api.js';
import { state } from './state.js';
import { addEmployee, renderEmployees } from './pages/employees.js';
import { addClient, printInvoices, renderClients, scheduleForClient } from './pages/clients.js';
import { addInventoryItem, renderInventory } from './pages/inventory.js';
import { addShift, renderEmployeeSchedule } from './pages/employeeSchedule.js';
import { addBooking, printSchedule, renderBookingCalendar, renderSelectedDay, uiSelectEmployees } from './pages/bookings.js';
import { renderHome } from './pages/home.js';
import { renderTimesheets, submitClockEntry } from './pages/timeClock.js';
import { getActiveClients, getAllBookings, getMondayDateKey, isAdmin, toDateKey } from './utils.js';
import { uiAlert, uiConfirm, uiPrompt } from './ui.js';

function switchToApp() {
  authScreen.classList.add('hidden');
  appShell.classList.remove('hidden');
}

function switchToAuth() {
  state.currentUser = null;
  appShell.classList.add('hidden');
  authScreen.classList.remove('hidden');
  addActionFab.classList.add('hidden');
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

function applyRoleAccess() {
  const admin = isAdmin();

  currentUserBadge.textContent = `${state.currentUser.name} (${state.currentUser.role})`;

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
  state.store = await api('/api/data');
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

async function refresh() {
  await fetchStore();

  const allBookings = getAllBookings().sort((a, b) => a.date.localeCompare(b.date));
  if (!allBookings.some((entry) => entry.date === state.selectedDateKey) && allBookings[0]?.date) {
    state.selectedDateKey = allBookings[0].date;
  }

  const parsedSelectedDate = new Date(`${state.selectedDateKey}T00:00:00`);
  if (!Number.isNaN(parsedSelectedDate.getTime())) {
    state.calendarCursor = new Date(parsedSelectedDate.getFullYear(), parsedSelectedDate.getMonth(), 1);
  }

  renderAll();
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

function setupAuthHandlers() {
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginError.textContent = '';

    const username = loginUsername.value.trim();
    const password = loginPassword.value;

    try {
      state.currentUser = await api('/api/auth/login', {
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

  changePasswordBtn.addEventListener('click', async () => {
    if (!state.currentUser) return;

    const currentPassword = await uiPrompt('Enter your current password.', '', {
      label: 'Current password',
      type: 'password'
    });
    if (!currentPassword) return;

    const newPassword = await uiPrompt('Enter a new password.', '', {
      label: 'New password',
      type: 'password'
    });
    if (!newPassword) return;

    const confirmPassword = await uiPrompt('Re-enter the new password.', '', {
      label: 'Confirm password',
      type: 'password'
    });
    if (!confirmPassword) return;

    if (newPassword !== confirmPassword) {
      await uiAlert('New password and confirmation do not match.');
      return;
    }

    try {
      await api('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
      });
      await uiAlert('Password updated successfully.');
    } catch (error) {
      await uiAlert(error.message);
    }
  });
}

function setupToolbarHandlers() {
  addActionFab.addEventListener('click', async () => {
    const activeTabId = document.querySelector('.tab.is-active')?.dataset.tab || 'home';

    let changed = false;
    if (activeTabId === 'employees') changed = await addEmployee();
    if (activeTabId === 'clients') changed = await addClient();
    if (activeTabId === 'inventory') changed = await addInventoryItem();
    if (activeTabId === 'employee-schedule') changed = await addShift();
    if (activeTabId === 'house-office-schedule') changed = await addBooking();

    if (changed) {
      await refresh();
    }
  });

  addInventoryBtn.addEventListener('click', async () => {
    if (await addInventoryItem()) {
      await refresh();
    }
  });

  addShiftBtn.addEventListener('click', async () => {
    if (await addShift()) {
      await refresh();
    }
  });

  addBookingBtn.addEventListener('click', async () => {
    if (await addBooking()) {
      await refresh();
    }
  });

  prevMonthBtn.addEventListener('click', () => {
    state.calendarCursor = new Date(state.calendarCursor.getFullYear(), state.calendarCursor.getMonth() - 1, 1);
    renderBookingCalendar();
  });

  nextMonthBtn.addEventListener('click', () => {
    state.calendarCursor = new Date(state.calendarCursor.getFullYear(), state.calendarCursor.getMonth() + 1, 1);
    renderBookingCalendar();
  });

  clientSearchInput.addEventListener('input', () => {
    state.clientSearchTerm = clientSearchInput.value.trim().toLowerCase();
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

  printScheduleBtn.addEventListener('click', async () => {
    if (!isAdmin()) return;

    try {
      await printSchedule();
    } catch (error) {
      await uiAlert(error.message);
    }
  });

  clockForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (await submitClockEntry()) {
      await refresh();
    }
  });

  exportTimesheetsBtn.addEventListener('click', () => {
    if (!isAdmin()) return;
    const weekStart = invoiceWeekStartInput.value || getMondayDateKey();
    window.location.href = `/api/admin/timesheets/export.csv?weekStart=${encodeURIComponent(weekStart)}`;
  });
}

function setupActionDelegation() {
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
      state.selectedDateKey = date;
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

      if (action === 'delete-employee') {
        const ok = await uiConfirm('Remove this employee? Existing assigned bookings will be unassigned.');
        if (!ok) return;
        await api(`/api/admin/employees/${id}`, { method: 'DELETE' });
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
}

async function bootstrap() {
  setupTabs();
  setupAuthHandlers();
  setupToolbarHandlers();
  setupActionDelegation();

  state.selectedDateKey = toDateKey(new Date());
  clockDateInput.value = state.selectedDateKey;
  invoiceWeekStartInput.value = getMondayDateKey();

  try {
    state.currentUser = await api('/api/auth/me');
    switchToApp();
    applyRoleAccess();
    await refresh();
  } catch {
    switchToAuth();
  }
}

bootstrap();
