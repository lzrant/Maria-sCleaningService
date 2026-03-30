import { employeeTimeline } from '../dom.js';
import { api } from '../api.js';
import { state } from '../state.js';
import { escapeHtml, isAdmin } from '../utils.js';
import { uiAlert, uiPrompt } from '../ui.js';

export function renderEmployeeSchedule() {
  const rows = (state.store.employeeSchedule || []).map(
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

export async function addShift() {
  if (!isAdmin()) return false;

  const date = await uiPrompt('Shift date (YYYY-MM-DD):', state.selectedDateKey, {
    label: 'Date',
    placeholder: 'YYYY-MM-DD'
  });
  if (!date) return false;
  const time = await uiPrompt('Shift time (e.g. 9:00 AM):', '', { label: 'Time' });
  if (!time) return false;
  const employee = await uiPrompt('Employee name(s):', '', { label: 'Employee(s)' });
  if (!employee) return false;
  const details = await uiPrompt('Shift details:', '', { label: 'Details' });
  if (!details) return false;

  try {
    await api('/api/employee-schedule', {
      method: 'POST',
      body: JSON.stringify({ date, time, employee, details })
    });
    return true;
  } catch (error) {
    await uiAlert(error.message);
    return false;
  }
}
