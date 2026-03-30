import { bookingCalendarGrid, calendarMonthLabel, selectedDateLabel, selectedDayBookings } from '../dom.js';
import { api } from '../api.js';
import { state } from '../state.js';
import { askRepeatSettings, buildRepeatDates } from '../booking-helpers.js';
import { createClientRecord, promptForClientDetails } from './clients.js';
import {
  addDays,
  escapeHtml,
  formatDate,
  formatHumanDate,
  formatMonth,
  getActiveClients,
  getAllBookings,
  getAssignableEmployees,
  getBookingsForDate,
  getStartOfWeekMonday,
  isAdmin,
  isDateKey,
  isEmployee,
  parseCommaList,
  parseDateKey,
  toDateKey
} from '../utils.js';
import { showModal, uiAlert, uiPrompt, uiSelect } from '../ui.js';

export function renderBookingCalendar() {
  const year = state.calendarCursor.getFullYear();
  const month = state.calendarCursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = firstOfMonth.getDay();
  const todayKey = toDateKey(new Date());

  calendarMonthLabel.textContent = formatMonth(firstOfMonth);

  const cells = [];

  for (let index = 0; index < firstWeekday; index += 1) {
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
      state.selectedDateKey === dateKey ? 'selected' : '',
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

export function renderSelectedDay() {
  selectedDateLabel.textContent = formatDate(state.selectedDateKey);
  const bookings = getBookingsForDate(state.selectedDateKey);

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

export async function uiSelectEmployees(currentSelection = []) {
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

export async function addBooking() {
  if (!isAdmin()) return false;

  const clientMode = await uiSelect(
    'Choose a client option for this booking.',
    [
      { value: 'existing', label: 'Select existing client' },
      { value: 'new', label: 'Add new client' },
      { value: 'none', label: 'Booking without client' }
    ],
    'existing',
    { label: 'Client option' }
  );
  if (clientMode === null) return false;

  let matchedClient = null;

  if (clientMode === 'existing') {
    const clients = getActiveClients();
    if (!clients.length) {
      await uiAlert('No active clients found. Add a new client first.');
      return false;
    }

    const clientId = await uiSelect(
      'Select a current client.',
      clients
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((client) => ({
          value: client.id,
          label: `${client.name} (${client.type})`
        })),
      clients[0].id,
      { label: 'Client' }
    );
    if (clientId === null) return false;
    matchedClient = clients.find((client) => client.id === clientId) || null;
  }

  if (clientMode === 'new') {
    const clientInput = await promptForClientDetails();
    if (!clientInput) return false;

    try {
      matchedClient = await createClientRecord(clientInput);
    } catch (error) {
      await uiAlert(error.message);
      return false;
    }
  }

  const typeRaw = await uiPrompt(
    `Booking type: house or office?${matchedClient ? ` (auto: ${matchedClient.type})` : ''}`,
    matchedClient ? matchedClient.type : 'house',
    { label: 'Booking type' }
  );
  if (!typeRaw) return false;

  const normalized = typeRaw.toLowerCase().startsWith('o') ? 'offices' : 'houses';
  const date = await uiPrompt('Booking date (YYYY-MM-DD):', state.selectedDateKey, {
    label: 'Date',
    placeholder: 'YYYY-MM-DD'
  });
  if (!date) return false;
  const time = await uiPrompt('Booking time (e.g. 2:30 PM):', '', { label: 'Time' });
  if (!time) return false;
  const location = await uiPrompt('Location:', matchedClient?.address || '', { label: 'Location' });
  if (!location) return false;
  const notes = (await uiPrompt('Notes:', 'Routine', { label: 'Notes' })) || 'Routine';
  const assignedEmployees = parseCommaList(
    await uiPrompt('Assigned employees (comma-separated):', '', {
      label: 'Employees'
    })
  );
  const repeat = await askRepeatSettings();
  if (!repeat) return false;
  const dates = buildRepeatDates(date, repeat.repeatType, repeat.occurrences);

  try {
    for (const repeatDate of dates) {
      await api(`/api/house-office-schedule/${normalized}`, {
        method: 'POST',
        body: JSON.stringify({
          clientId: matchedClient?.id || null,
          clientName: matchedClient?.name || null,
          date: repeatDate,
          time,
          location,
          notes,
          assignedEmployees
        })
      });
    }

    state.selectedDateKey = dates[dates.length - 1] || date;
    return true;
  } catch (error) {
    await uiAlert(error.message);
    return false;
  }
}

function getScheduleRange(period, anchorDateKey) {
  const anchor = parseDateKey(anchorDateKey);
  if (!anchor) return null;

  if (period === 'daily') {
    const start = new Date(anchor);
    const end = new Date(anchor);
    return { start, end, title: `Daily Schedule - ${formatHumanDate(start)}` };
  }

  if (period === 'weekly') {
    const start = getStartOfWeekMonday(anchor);
    const end = addDays(start, 6);
    return {
      start,
      end,
      title: `Weekly Schedule - ${formatHumanDate(start)} to ${formatHumanDate(end)}`
    };
  }

  if (period === 'monthly') {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    return {
      start,
      end,
      title: `Monthly Schedule - ${start.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`
    };
  }

  return null;
}

function renderPrintableScheduleHtml(period, startDate, endDate) {
  const startKey = toDateKey(startDate);
  const endKey = toDateKey(endDate);

  const inRange = getAllBookings()
    .filter((booking) => booking.date >= startKey && booking.date <= endKey)
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

  if (!inRange.length) {
    return '<p>No bookings found for this schedule range.</p>';
  }

  const grouped = new Map();
  inRange.forEach((booking) => {
    const list = grouped.get(booking.date) || [];
    list.push(booking);
    grouped.set(booking.date, list);
  });

  return [...grouped.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([dateKey, bookings]) => {
      const dayTitle = formatHumanDate(parseDateKey(dateKey));
      const rows = bookings
        .map((booking) => {
          const typeLabel = booking.type === 'houses' ? 'House' : 'Office';
          const assigned = (booking.assignedEmployees || []).length ? booking.assignedEmployees.join(', ') : 'Unassigned';
          const dailyHouseEmployees =
            period === 'daily' && booking.type === 'houses'
              ? `<p><strong>Assigned Employees:</strong> ${escapeHtml(assigned)}</p>`
              : '';

          return `
            <article style="border:1px solid #ddd; border-radius:10px; padding:10px; margin-bottom:10px;">
              <p style="margin:0 0 6px;"><strong>${escapeHtml(typeLabel)}</strong> | ${escapeHtml(booking.time)} | ${escapeHtml(
                booking.location
              )}</p>
              <p style="margin:0 0 6px;">Client: ${escapeHtml(booking.clientName || 'N/A')}</p>
              <p style="margin:0 0 6px;">Notes: ${escapeHtml(booking.notes || '-')}</p>
              ${dailyHouseEmployees}
              ${
                !(period === 'daily' && booking.type === 'houses')
                  ? `<p style="margin:0 0 6px;">Assigned: ${escapeHtml(assigned)}</p>`
                  : ''
              }
            </article>
          `;
        })
        .join('');

      return `
        <section style="margin-bottom:20px;">
          <h2 style="margin:0 0 10px; border-bottom:1px solid #ddd; padding-bottom:6px;">${escapeHtml(dayTitle)}</h2>
          ${rows}
        </section>
      `;
    })
    .join('');
}

export async function printSchedule() {
  const period = await uiSelect(
    'Choose schedule print range.',
    [
      { value: 'daily', label: 'Daily schedule' },
      { value: 'weekly', label: 'Weekly schedule' },
      { value: 'monthly', label: 'Monthly schedule' }
    ],
    'daily',
    { label: 'Range' }
  );
  if (!period) return;

  const anchorDateKey = await uiPrompt('Base date for schedule range:', state.selectedDateKey, {
    label: 'Date',
    type: 'date'
  });
  if (!anchorDateKey || !isDateKey(anchorDateKey)) {
    await uiAlert('Please choose a valid date in YYYY-MM-DD format.');
    return;
  }

  const range = getScheduleRange(period, anchorDateKey);
  if (!range) {
    await uiAlert('Unable to create schedule range.');
    return;
  }

  const html = renderPrintableScheduleHtml(period, range.start, range.end);
  const win = window.open('', '_blank');
  if (!win) {
    await uiAlert('Pop-up blocked. Allow pop-ups to print schedules.');
    return;
  }

  win.document.write(`
    <html>
      <head><title>${escapeHtml(range.title)}</title></head>
      <body style="font-family: Arial, sans-serif; padding: 24px;">
        <h1 style="margin-top:0;">${escapeHtml(range.title)}</h1>
        ${html}
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  win.print();
}
