import { clientsTableBody, invoiceWeekStartInput } from '../dom.js';
import { api } from '../api.js';
import { state } from '../state.js';
import { buildRepeatDates, askRepeatSettings } from '../booking-helpers.js';
import { escapeHtml, getActiveClients, isAdmin, isDateKey, parseCommaList } from '../utils.js';
import { uiAlert, uiPrompt } from '../ui.js';

export function renderClients() {
  if (!isAdmin()) {
    clientsTableBody.innerHTML = '<tr><td colspan="5">Admin access required.</td></tr>';
    return;
  }

  const rows = getActiveClients()
    .filter((client) => {
      if (!state.clientSearchTerm) return true;
      const haystack = `${client.name} ${client.phone || ''} ${client.email || ''} ${client.address || ''}`.toLowerCase();
      return haystack.includes(state.clientSearchTerm);
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

export async function promptForClientDetails() {
  const name = await uiPrompt('Client name:', '', { label: 'Name' });
  if (!name) return null;

  const type = (await uiPrompt('Client type (house/office):', 'house', { label: 'Type' })) || 'house';
  const phone = (await uiPrompt('Phone (optional):', '', { label: 'Phone' })) || '';
  const email = (await uiPrompt('Email (optional):', '', { label: 'Email' })) || '';
  const address = (await uiPrompt('Address (optional):', '', { label: 'Address' })) || '';
  const notes = (await uiPrompt('Notes (optional):', '', { label: 'Notes' })) || '';
  const weeklyRateRaw = (await uiPrompt('Weekly invoice rate for cleaned visits:', '120', { label: 'Weekly rate' })) || '120';
  const weeklyRate = Number(weeklyRateRaw) || 120;

  return { name, type, phone, email, address, notes, weeklyRate };
}

export async function createClientRecord(clientInput) {
  return api('/api/clients', {
    method: 'POST',
    body: JSON.stringify(clientInput)
  });
}

export async function scheduleForClient(client) {
  const shouldSchedule = await uiPrompt('Add booking for this client now? (yes/no)', 'yes', {
    label: 'Answer'
  });
  if (!shouldSchedule || shouldSchedule.toLowerCase() !== 'yes') return false;

  let addedAny = false;
  let keepAdding = true;

  while (keepAdding) {
    const date = await uiPrompt('Booking date (YYYY-MM-DD):', state.selectedDateKey, {
      label: 'Date',
      placeholder: 'YYYY-MM-DD'
    });
    if (!date) return addedAny;
    if (!isDateKey(date)) {
      await uiAlert('Date must be in YYYY-MM-DD format.');
      continue;
    }

    const time = await uiPrompt('Booking time (e.g. 2:30 PM):', '', { label: 'Time' });
    if (!time) return addedAny;
    const location = await uiPrompt('Location:', client.address || '', { label: 'Location' });
    if (!location) return addedAny;
    const notes = (await uiPrompt('Notes:', 'Routine', { label: 'Notes' })) || 'Routine';
    const assignedEmployees = parseCommaList(
      await uiPrompt('Assigned employees (comma-separated):', '', {
        label: 'Employees'
      })
    );
    const repeat = await askRepeatSettings();
    if (!repeat) return addedAny;

    const type = client.type === 'office' ? 'offices' : 'houses';
    const dates = buildRepeatDates(date, repeat.repeatType, repeat.occurrences);

    for (const repeatDate of dates) {
      await api(`/api/house-office-schedule/${type}`, {
        method: 'POST',
        body: JSON.stringify({
          clientId: client.id,
          date: repeatDate,
          time,
          location,
          notes,
          assignedEmployees
        })
      });
    }

    state.selectedDateKey = dates[dates.length - 1] || date;
    addedAny = true;
    const again = await uiPrompt('Add another day/time for this client? (yes/no)', 'no', {
      label: 'Answer'
    });
    keepAdding = Boolean(again && again.toLowerCase() === 'yes');
  }

  return addedAny;
}

export async function addClient() {
  if (!isAdmin()) return false;

  const clientInput = await promptForClientDetails();
  if (!clientInput) return false;

  try {
    const client = await createClientRecord(clientInput);
    await scheduleForClient(client);
    return true;
  } catch (error) {
    await uiAlert(error.message);
    return false;
  }
}

export async function printInvoices() {
  const weekStart = invoiceWeekStartInput.value;
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
