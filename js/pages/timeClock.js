import {
  clockDateInput,
  clockEmployeeSelect,
  clockHoursInput,
  clockNotesInput,
  invoiceWeekStartInput,
  timesheetTableBody
} from '../dom.js';
import { api } from '../api.js';
import { state } from '../state.js';
import { escapeHtml, getMondayDateKey, isAdmin, isDateKey } from '../utils.js';
import { uiAlert } from '../ui.js';

export function renderTimesheets() {
  if (!isAdmin()) {
    timesheetTableBody.innerHTML = '';
    return;
  }

  const weekStart = invoiceWeekStartInput.value || getMondayDateKey();
  const start = new Date(`${weekStart}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const entries = (state.store.timesheets || [])
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

export async function submitClockEntry() {
  const employeeId = isAdmin() ? clockEmployeeSelect.value : null;
  const date = clockDateInput.value;
  const hours = Number(clockHoursInput.value);
  const notes = clockNotesInput.value.trim();

  if (isAdmin() && !employeeId) {
    await uiAlert('Please select an employee.');
    return false;
  }

  if (!date || !isDateKey(date)) {
    await uiAlert('Please enter a valid date.');
    return false;
  }

  if (!Number.isFinite(hours) || hours < 0) {
    await uiAlert('Please enter valid hours.');
    return false;
  }

  try {
    await api('/api/employee/clock', {
      method: 'POST',
      body: JSON.stringify({ employeeId, date, hours, notes })
    });

    clockHoursInput.value = '';
    clockNotesInput.value = '';
    return true;
  } catch (error) {
    await uiAlert(error.message);
    return false;
  }
}
