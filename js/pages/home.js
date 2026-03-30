import { inventoryHealthCount, jobsTodayCount, teamActiveCount, todayGlanceList } from '../dom.js';
import { escapeHtml, getAllBookings, getBookingsForDate, toDateKey } from '../utils.js';
import { state } from '../state.js';

export function renderHome() {
  const todayKey = toDateKey(new Date());
  const jobsToday =
    getBookingsForDate(todayKey).length +
    (state.store.employeeSchedule || []).filter((item) => !item.date || item.date === todayKey).length;

  const uniqueEmployees = new Set();
  (state.store.employeeSchedule || []).forEach((item) => {
    String(item.employee)
      .split('+')
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((name) => uniqueEmployees.add(name));
  });

  getAllBookings().forEach((booking) => {
    (booking.assignedEmployees || []).forEach((name) => uniqueEmployees.add(String(name).trim()));
  });

  const healthy = (state.store.inventory || []).filter((item) => Number(item.inStock) >= Number(item.minimum)).length;
  const inventoryTotal = (state.store.inventory || []).length;
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
