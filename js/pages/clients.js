import { clientsTableBody, invoiceWeekStartInput } from '../dom.js';
import { api } from '../api.js';
import { state } from '../state.js';
import { buildRepeatDates, promptForBookingDetails } from '../booking-helpers.js';
import { escapeHtml, getActiveClients, isAdmin } from '../utils.js';
import { showModal, uiAlert, uiConfirm } from '../ui.js';

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
  const result = await showModal({
    title: 'Add New Client',
    message: 'Enter the client details once, then choose whether to schedule them.',
    confirmText: 'Save Client',
    fields: [
      { name: 'name', label: 'Client name', type: 'text', required: true },
      {
        name: 'type',
        label: 'Client type',
        type: 'select',
        value: 'house',
        required: true,
        options: [
          { value: 'house', label: 'House' },
          { value: 'office', label: 'Office' }
        ]
      },
      { name: 'phone', label: 'Phone', type: 'tel' },
      { name: 'email', label: 'Email', type: 'email' },
      { name: 'address', label: 'Address', type: 'text' },
      { name: 'notes', label: 'Notes', type: 'textarea' },
      {
        name: 'weeklyRate',
        label: 'Weekly invoice rate',
        type: 'number',
        value: '120',
        min: '0',
        step: '0.01',
        required: true
      }
    ]
  });

  if (!result.confirmed) return null;

  const name = result.values.name.trim();
  if (!name) {
    await uiAlert('Client name is required.');
    return promptForClientDetails();
  }

  const weeklyRate = Number(result.values.weeklyRate) || 120;
  return {
    name,
    type: result.values.type,
    phone: result.values.phone.trim(),
    email: result.values.email.trim(),
    address: result.values.address.trim(),
    notes: result.values.notes.trim(),
    weeklyRate
  };
}

export async function createClientRecord(clientInput) {
  return api('/api/clients', {
    method: 'POST',
    body: JSON.stringify(clientInput)
  });
}

export async function scheduleForClient(client) {
  const shouldSchedule = await uiConfirm('Add a booking for this client now?', 'Schedule Client');
  if (!shouldSchedule) return false;

  let addedAny = false;
  let keepAdding = true;

  while (keepAdding) {
    const details = await promptForBookingDetails({
      title: 'Schedule Client',
      message: `Create a ${client.type} booking for ${client.name}.`,
      defaultDate: state.selectedDateKey,
      defaultType: client.type === 'office' ? 'offices' : 'houses',
      defaultLocation: client.address || '',
      showType: false
    });
    if (!details) return addedAny;

    const type = client.type === 'office' ? 'offices' : 'houses';
    const dates = buildRepeatDates(details.date, details.repeat.repeatType, details.repeat.occurrences);

    for (const repeatDate of dates) {
      await api(`/api/house-office-schedule/${type}`, {
        method: 'POST',
        body: JSON.stringify({
          clientId: client.id,
          date: repeatDate,
          time: details.time,
          location: details.location,
          notes: details.notes,
          assignedEmployees: details.assignedEmployees
        })
      });
    }

    state.selectedDateKey = dates[dates.length - 1] || details.date;
    addedAny = true;
    keepAdding = await uiConfirm('Add another day or time for this client?', 'Schedule Another Booking');
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
