import { clockEmployeeSelect, employeesTableBody } from '../dom.js';
import { api } from '../api.js';
import { state } from '../state.js';
import { escapeHtml, isAdmin } from '../utils.js';
import { uiAlert, uiPrompt } from '../ui.js';

export function renderEmployees() {
  if (!isAdmin()) {
    employeesTableBody.innerHTML = '<tr><td colspan="4">Admin access required.</td></tr>';
    if (clockEmployeeSelect) {
      clockEmployeeSelect.innerHTML = '';
    }
    return;
  }

  const employees = (state.store.employees || []).filter((entry) => entry.role === 'employee');
  const rows = employees.map(
    (entry) => `
      <tr>
        <td>${escapeHtml(entry.name)}</td>
        <td>${escapeHtml(entry.username)}</td>
        <td>${entry.active ? '<span class="pill pill-ok">Active</span>' : '<span class="pill pill-warn">Inactive</span>'}</td>
        <td><button class="link-btn" data-action="delete-employee" data-id="${escapeHtml(entry.id)}">Delete</button></td>
      </tr>
    `
  );

  employeesTableBody.innerHTML = rows.length
    ? rows.join('')
    : '<tr><td colspan="4">No employees found.</td></tr>';

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

export async function addEmployee() {
  if (!isAdmin()) return false;

  const name = await uiPrompt('Employee full name:', '', { label: 'Full name' });
  if (!name) return false;
  const username = await uiPrompt('Username for login:', '', { label: 'Username' });
  if (!username) return false;
  const password = await uiPrompt('Temporary password:', '', { label: 'Temporary password', type: 'password' });
  if (!password) return false;

  try {
    await api('/api/admin/employees', {
      method: 'POST',
      body: JSON.stringify({ name, username, password })
    });
    return true;
  } catch (error) {
    await uiAlert(error.message);
    return false;
  }
}
