import { state } from './state.js';

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateKey(dateKey) {
  const parsed = new Date(`${dateKey}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value));
}

export function getMondayDateKey(date = new Date()) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return toDateKey(copy);
}

export function formatDate(dateKey) {
  const parsed = new Date(`${dateKey}T00:00:00`);
  return parsed.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

export function formatMonth(date) {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function formatHumanDate(date) {
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

export function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function addMonths(date, months) {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

export function getStartOfWeekMonday(date) {
  const copy = new Date(date);
  const weekday = copy.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

export function isAdmin() {
  return state.currentUser?.role === 'admin';
}

export function isEmployee() {
  return state.currentUser?.role === 'employee';
}

export function getActiveClients() {
  return (state.store.clients || []).filter((client) => client.status !== 'archived');
}

export function findClientByName(name) {
  const target = String(name || '').trim().toLowerCase();
  if (!target) return null;
  return getActiveClients().find((client) => client.name.toLowerCase() === target) || null;
}

export function parseCommaList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getAllBookings() {
  const houses = (state.store.houseOfficeSchedule?.houses || []).map((item) => ({ ...item, type: 'houses' }));
  const offices = (state.store.houseOfficeSchedule?.offices || []).map((item) => ({ ...item, type: 'offices' }));
  return [...houses, ...offices];
}

export function getBookingsForDate(dateKey) {
  return getAllBookings().filter((item) => item.date === dateKey);
}

export function getAssignableEmployees() {
  return (state.store.employees || [])
    .filter((entry) => entry.role === 'employee')
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}
