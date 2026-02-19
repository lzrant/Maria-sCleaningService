const express = require('express');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const STORE_PATH = path.join(__dirname, 'data', 'store.json');
const SESSION_COOKIE = 'session_token';
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;
const sessions = new Map();

app.use(express.json());
app.use(express.static(__dirname));

const inventorySchema = ['name', 'inStock', 'minimum', 'unit'];
const employeeSchema = ['time', 'employee', 'details'];
const bookingSchema = ['date', 'time', 'location', 'notes'];
const clientSchema = ['name'];

function getNowIso() {
  return new Date().toISOString();
}

function getTodayDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value));
}

function parseDateKey(dateKey) {
  const parsed = new Date(`${dateKey}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateKeyFromDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getWeekStartOrToday(rawWeekStart) {
  if (isDateKey(rawWeekStart)) {
    const parsed = parseDateKey(rawWeekStart);
    if (parsed) return dateKeyFromDate(parsed);
  }
  return getTodayDateKey();
}

function requireFields(body, fields) {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return field;
    }
  }
  return null;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function createPasswordRecord(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, passwordHash: hash };
}

function verifyPassword(password, salt, passwordHash) {
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
  const left = Buffer.from(candidate, 'hex');
  const right = Buffer.from(passwordHash, 'hex');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function getCookie(req, name) {
  const cookie = req.headers.cookie;
  if (!cookie) return null;

  const parts = cookie.split(';').map((part) => part.trim());
  for (const part of parts) {
    const [key, ...rest] = part.split('=');
    if (key === name) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

function setSessionCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(
      SESSION_TTL_MS / 1000
    )}`
  );
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function cleanExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= now) {
      sessions.delete(token);
    }
  }
}

function normalizeStore(store) {
  let mutated = false;
  const today = getTodayDateKey();

  if (!Array.isArray(store.inventory)) {
    store.inventory = [];
    mutated = true;
  }

  if (!Array.isArray(store.employeeSchedule)) {
    store.employeeSchedule = [];
    mutated = true;
  }

  store.employeeSchedule = store.employeeSchedule.map((item) => {
    const normalized = { ...item };
    if (!isDateKey(normalized.date)) {
      normalized.date = today;
      mutated = true;
    }
    return normalized;
  });

  if (!store.houseOfficeSchedule || typeof store.houseOfficeSchedule !== 'object') {
    store.houseOfficeSchedule = { houses: [], offices: [] };
    mutated = true;
  }

  for (const type of ['houses', 'offices']) {
    if (!Array.isArray(store.houseOfficeSchedule[type])) {
      store.houseOfficeSchedule[type] = [];
      mutated = true;
      continue;
    }

    store.houseOfficeSchedule[type] = store.houseOfficeSchedule[type].map((item) => {
      const normalized = { ...item };

      if (!isDateKey(normalized.date)) {
        normalized.date = today;
        mutated = true;
      }

      if (!Array.isArray(normalized.assignedEmployees)) {
        normalized.assignedEmployees = [];
        mutated = true;
      }

      if (normalized.clientId === undefined) {
        normalized.clientId = null;
        mutated = true;
      }

      if (normalized.clientName === undefined) {
        normalized.clientName = null;
        mutated = true;
      }

      if (typeof normalized.cleaned !== 'boolean') {
        normalized.cleaned = false;
        mutated = true;
      }

      if (normalized.cleanedAt === undefined) {
        normalized.cleanedAt = null;
        mutated = true;
      }

      return normalized;
    });
  }

  if (!Array.isArray(store.clients)) {
    store.clients = [];
    mutated = true;
  }

  store.clients = store.clients.map((client) => {
    const normalized = { ...client };
    if (!normalized.status) {
      normalized.status = 'active';
      mutated = true;
    }
    if (!normalized.createdAt) {
      normalized.createdAt = getNowIso();
      mutated = true;
    }
    if (normalized.weeklyRate === undefined) {
      normalized.weeklyRate = 120;
      mutated = true;
    }
    return normalized;
  });

  if (!Array.isArray(store.timesheets)) {
    store.timesheets = [];
    mutated = true;
  }

  if (!store.archived || typeof store.archived !== 'object') {
    store.archived = { clients: [], bookings: [] };
    mutated = true;
  }

  if (!Array.isArray(store.archived.clients)) {
    store.archived.clients = [];
    mutated = true;
  }

  if (!Array.isArray(store.archived.bookings)) {
    store.archived.bookings = [];
    mutated = true;
  }

  if (!Array.isArray(store.users)) {
    store.users = [];
    mutated = true;
  }

  if (store.users.length === 0) {
    const adminPass = createPasswordRecord('admin123');
    const employeePass = createPasswordRecord('employee123');

    store.users = [
      {
        id: `user-${crypto.randomUUID()}`,
        username: 'admin',
        name: 'System Admin',
        role: 'admin',
        salt: adminPass.salt,
        passwordHash: adminPass.passwordHash,
        active: true,
        createdAt: getNowIso()
      },
      {
        id: `user-${crypto.randomUUID()}`,
        username: 'employee',
        name: 'Team Employee',
        role: 'employee',
        salt: employeePass.salt,
        passwordHash: employeePass.passwordHash,
        active: true,
        createdAt: getNowIso()
      }
    ];

    mutated = true;
  }

  return { store, mutated };
}

async function writeStore(store) {
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
}

async function readStore() {
  const data = await fs.readFile(STORE_PATH, 'utf8');
  const parsed = JSON.parse(data);
  const normalized = normalizeStore(parsed);

  if (normalized.mutated) {
    await writeStore(normalized.store);
  }

  return normalized.store;
}

function findClient(store, clientId) {
  return store.clients.find((client) => client.id === clientId && client.status === 'active') || null;
}

async function attachAuth(req, res, next) {
  cleanExpiredSessions();

  const token = getCookie(req, SESSION_COOKIE);
  if (!token) {
    req.auth = { token: null, user: null };
    return next();
  }

  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(token);
    clearSessionCookie(res);
    req.auth = { token: null, user: null };
    return next();
  }

  try {
    const store = await readStore();
    const user = store.users.find((entry) => entry.id === session.userId && entry.active);
    if (!user) {
      sessions.delete(token);
      clearSessionCookie(res);
      req.auth = { token: null, user: null };
      return next();
    }

    req.auth = {
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
      }
    };

    return next();
  } catch {
    return res.status(500).json({ error: 'Authentication check failed.' });
  }
}

function requireAuth(req, res, next) {
  if (!req.auth?.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  return next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth?.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    if (!roles.includes(req.auth.user.role)) {
      return res.status(403).json({ error: 'Insufficient permission.' });
    }

    return next();
  };
}

app.use(attachAuth);

app.post('/api/auth/login', async (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required.' });
  }

  try {
    const store = await readStore();
    const user = store.users.find((entry) => entry.username === username && entry.active);

    if (!user || !verifyPassword(password, user.salt, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = crypto.randomUUID();
    sessions.set(token, { userId: user.id, expiresAt: Date.now() + SESSION_TTL_MS });
    setSessionCookie(res, token);

    return res.json({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role
    });
  } catch {
    return res.status(500).json({ error: 'Unable to login.' });
  }
});

app.get('/api/auth/me', (req, res) => {
  if (!req.auth?.user) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
  return res.json(req.auth.user);
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.auth?.token;
  if (token) {
    sessions.delete(token);
  }
  clearSessionCookie(res);
  return res.status(204).send();
});

app.get('/api/data', requireRole('admin', 'employee'), async (req, res) => {
  try {
    const store = await readStore();
    const employees =
      req.auth.user.role === 'admin'
        ? store.users
            .filter((user) => user.role === 'employee')
            .map((user) => ({
              id: user.id,
              username: user.username,
              name: user.name,
              role: user.role,
              active: Boolean(user.active)
            }))
        : [];

    res.json({
      inventory: store.inventory,
      employees,
      employeeSchedule: store.employeeSchedule,
      houseOfficeSchedule: store.houseOfficeSchedule,
      clients: store.clients,
      archived: store.archived,
      timesheets: req.auth.user.role === 'admin' ? store.timesheets : []
    });
  } catch {
    res.status(500).json({ error: 'Unable to load data store.' });
  }
});

app.post('/api/admin/employees', requireRole('admin'), async (req, res) => {
  const name = String(req.body.name || '').trim();
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');

  if (!name || !username || !password) {
    return res.status(400).json({ error: 'name, username, and password are required.' });
  }

  try {
    const store = await readStore();
    const exists = store.users.some((user) => user.username.toLowerCase() === username.toLowerCase());
    if (exists) {
      return res.status(400).json({ error: 'Username already exists.' });
    }

    const pass = createPasswordRecord(password);
    const employee = {
      id: `user-${crypto.randomUUID()}`,
      username,
      name,
      role: 'employee',
      salt: pass.salt,
      passwordHash: pass.passwordHash,
      active: true,
      createdAt: getNowIso()
    };

    store.users.push(employee);
    await writeStore(store);

    res.status(201).json({
      id: employee.id,
      username: employee.username,
      name: employee.name,
      role: employee.role,
      active: employee.active
    });
  } catch {
    res.status(500).json({ error: 'Unable to create employee.' });
  }
});

app.get('/api/clients', requireRole('admin'), async (req, res) => {
  try {
    const store = await readStore();
    const q = String(req.query.search || '').trim().toLowerCase();

    const activeClients = store.clients.filter((client) => client.status === 'active');
    const filtered = q
      ? activeClients.filter((client) => {
          const haystack = `${client.name} ${client.phone || ''} ${client.email || ''} ${client.address || ''}`.toLowerCase();
          return haystack.includes(q);
        })
      : activeClients;

    res.json(filtered);
  } catch {
    res.status(500).json({ error: 'Unable to load clients.' });
  }
});

app.post('/api/clients', requireRole('admin'), async (req, res) => {
  const missing = requireFields(req.body, clientSchema);
  if (missing) {
    return res.status(400).json({ error: `Missing field: ${missing}` });
  }

  try {
    const store = await readStore();
    const client = {
      id: `client-${crypto.randomUUID()}`,
      name: String(req.body.name).trim(),
      type: String(req.body.type || 'house').trim().toLowerCase().startsWith('o') ? 'office' : 'house',
      phone: String(req.body.phone || '').trim(),
      email: String(req.body.email || '').trim(),
      address: String(req.body.address || '').trim(),
      notes: String(req.body.notes || '').trim(),
      weeklyRate: toNumber(req.body.weeklyRate, 120),
      status: 'active',
      createdAt: getNowIso()
    };

    store.clients.push(client);
    await writeStore(store);
    res.status(201).json(client);
  } catch {
    res.status(500).json({ error: 'Unable to create client.' });
  }
});

app.delete('/api/clients/:id', requireRole('admin'), async (req, res) => {
  try {
    const store = await readStore();
    const clientIndex = store.clients.findIndex((client) => client.id === req.params.id && client.status === 'active');

    if (clientIndex === -1) {
      return res.status(404).json({ error: 'Client not found.' });
    }

    const client = store.clients[clientIndex];
    const archivedAt = getNowIso();

    client.status = 'archived';
    client.archivedAt = archivedAt;

    store.archived.clients.push({ ...client, archiveReason: 'client_deleted' });

    for (const type of ['houses', 'offices']) {
      const keep = [];
      for (const booking of store.houseOfficeSchedule[type]) {
        if (booking.clientId === client.id) {
          store.archived.bookings.push({
            ...booking,
            type,
            archivedAt,
            archiveReason: 'client_deleted'
          });
        } else {
          keep.push(booking);
        }
      }
      store.houseOfficeSchedule[type] = keep;
    }

    await writeStore(store);
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Unable to delete client.' });
  }
});

app.post('/api/inventory', requireRole('admin'), async (req, res) => {
  const missing = requireFields(req.body, inventorySchema);
  if (missing) {
    return res.status(400).json({ error: `Missing field: ${missing}` });
  }

  try {
    const store = await readStore();
    const item = {
      id: `inv-${crypto.randomUUID()}`,
      name: String(req.body.name).trim(),
      inStock: toNumber(req.body.inStock),
      minimum: toNumber(req.body.minimum),
      unit: String(req.body.unit).trim()
    };

    store.inventory.push(item);
    await writeStore(store);
    res.status(201).json(item);
  } catch {
    res.status(500).json({ error: 'Unable to create inventory item.' });
  }
});

app.delete('/api/inventory/:id', requireRole('admin'), async (req, res) => {
  try {
    const store = await readStore();
    const before = store.inventory.length;
    store.inventory = store.inventory.filter((item) => item.id !== req.params.id);

    if (store.inventory.length === before) {
      return res.status(404).json({ error: 'Inventory item not found.' });
    }

    await writeStore(store);
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Unable to delete inventory item.' });
  }
});

app.post('/api/employee-schedule', requireRole('admin'), async (req, res) => {
  const missing = requireFields(req.body, employeeSchema);
  if (missing) {
    return res.status(400).json({ error: `Missing field: ${missing}` });
  }

  try {
    const store = await readStore();
    const shift = {
      id: `emp-${crypto.randomUUID()}`,
      date: isDateKey(req.body.date) ? String(req.body.date) : getTodayDateKey(),
      time: String(req.body.time).trim(),
      employee: String(req.body.employee).trim(),
      details: String(req.body.details).trim()
    };

    store.employeeSchedule.push(shift);
    await writeStore(store);
    res.status(201).json(shift);
  } catch {
    res.status(500).json({ error: 'Unable to create employee schedule item.' });
  }
});

app.delete('/api/employee-schedule/:id', requireRole('admin'), async (req, res) => {
  try {
    const store = await readStore();
    const before = store.employeeSchedule.length;
    store.employeeSchedule = store.employeeSchedule.filter((item) => item.id !== req.params.id);

    if (store.employeeSchedule.length === before) {
      return res.status(404).json({ error: 'Employee schedule item not found.' });
    }

    await writeStore(store);
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Unable to delete employee schedule item.' });
  }
});

app.post('/api/house-office-schedule/:type', requireRole('admin'), async (req, res) => {
  const { type } = req.params;
  if (type !== 'houses' && type !== 'offices') {
    return res.status(400).json({ error: 'type must be either houses or offices.' });
  }

  const missing = requireFields(req.body, bookingSchema);
  if (missing) {
    return res.status(400).json({ error: `Missing field: ${missing}` });
  }

  if (!isDateKey(req.body.date)) {
    return res.status(400).json({ error: 'date must be in YYYY-MM-DD format.' });
  }

  try {
    const store = await readStore();

    let client = null;
    if (req.body.clientId) {
      client = findClient(store, String(req.body.clientId));
      if (!client) {
        return res.status(400).json({ error: 'clientId does not reference an active client.' });
      }
    }

    const entry = {
      id: `${type === 'houses' ? 'house' : 'office'}-${crypto.randomUUID()}`,
      clientId: client ? client.id : null,
      clientName: client ? client.name : String(req.body.clientName || '').trim() || null,
      date: String(req.body.date).trim(),
      time: String(req.body.time).trim(),
      location: String(req.body.location).trim(),
      notes: String(req.body.notes).trim(),
      assignedEmployees: toStringArray(req.body.assignedEmployees),
      cleaned: Boolean(req.body.cleaned),
      cleanedAt: req.body.cleaned ? getNowIso() : null
    };

    store.houseOfficeSchedule[type].push(entry);
    await writeStore(store);
    res.status(201).json(entry);
  } catch {
    res.status(500).json({ error: 'Unable to create booking item.' });
  }
});

app.patch('/api/house-office-schedule/:type/:id/assignment', requireRole('admin'), async (req, res) => {
  const { type, id } = req.params;
  if (type !== 'houses' && type !== 'offices') {
    return res.status(400).json({ error: 'type must be either houses or offices.' });
  }

  try {
    const store = await readStore();
    const booking = store.houseOfficeSchedule[type].find((item) => item.id === id);

    if (!booking) {
      return res.status(404).json({ error: 'Booking item not found.' });
    }

    booking.assignedEmployees = toStringArray(req.body.assignedEmployees);
    await writeStore(store);
    res.json(booking);
  } catch {
    res.status(500).json({ error: 'Unable to assign employees.' });
  }
});

app.patch('/api/house-office-schedule/:type/:id/cleaned', requireRole('admin', 'employee'), async (req, res) => {
  const { type, id } = req.params;
  if (type !== 'houses' && type !== 'offices') {
    return res.status(400).json({ error: 'type must be either houses or offices.' });
  }

  try {
    const store = await readStore();
    const booking = store.houseOfficeSchedule[type].find((item) => item.id === id);

    if (!booking) {
      return res.status(404).json({ error: 'Booking item not found.' });
    }

    booking.cleaned = Boolean(req.body.cleaned);
    booking.cleanedAt = booking.cleaned ? getNowIso() : null;
    await writeStore(store);
    res.json(booking);
  } catch {
    res.status(500).json({ error: 'Unable to update cleaning status.' });
  }
});

app.delete('/api/house-office-schedule/:type/:id', requireRole('admin'), async (req, res) => {
  const { type, id } = req.params;
  if (type !== 'houses' && type !== 'offices') {
    return res.status(400).json({ error: 'type must be either houses or offices.' });
  }

  try {
    const store = await readStore();
    const before = store.houseOfficeSchedule[type].length;
    store.houseOfficeSchedule[type] = store.houseOfficeSchedule[type].filter((item) => item.id !== id);

    if (store.houseOfficeSchedule[type].length === before) {
      return res.status(404).json({ error: 'Booking item not found.' });
    }

    await writeStore(store);
    res.status(204).send();
  } catch {
    res.status(500).json({ error: 'Unable to delete booking item.' });
  }
});

app.post('/api/employee/clock', requireRole('admin'), async (req, res) => {
  const employeeId = String(req.body.employeeId || '').trim();
  const date = String(req.body.date || '').trim();
  const hours = toNumber(req.body.hours, NaN);

  if (!employeeId) {
    return res.status(400).json({ error: 'employeeId is required.' });
  }

  if (!isDateKey(date)) {
    return res.status(400).json({ error: 'date must be in YYYY-MM-DD format.' });
  }

  if (!Number.isFinite(hours) || hours < 0) {
    return res.status(400).json({ error: 'hours must be a valid non-negative number.' });
  }

  try {
    const store = await readStore();
    const employee = store.users.find((user) => user.id === employeeId && user.role === 'employee' && user.active);
    if (!employee) {
      return res.status(400).json({ error: 'employeeId does not reference an active employee.' });
    }

    const entry = {
      id: `time-${crypto.randomUUID()}`,
      userId: employee.id,
      employeeName: employee.name,
      date,
      hours,
      notes: String(req.body.notes || '').trim(),
      clockedAt: getNowIso()
    };

    store.timesheets.push(entry);
    await writeStore(store);
    res.status(201).json(entry);
  } catch {
    res.status(500).json({ error: 'Unable to clock hours.' });
  }
});

app.get('/api/admin/timesheets', requireRole('admin'), async (req, res) => {
  try {
    const store = await readStore();
    const weekStart = getWeekStartOrToday(req.query.weekStart);
    const start = parseDateKey(weekStart);
    const end = addDays(start, 6);

    const items = store.timesheets.filter((item) => {
      const day = parseDateKey(item.date);
      return day && day >= start && day <= end;
    });

    res.json({ weekStart, weekEnd: dateKeyFromDate(end), items });
  } catch {
    res.status(500).json({ error: 'Unable to load timesheets.' });
  }
});

app.get('/api/admin/timesheets/export.csv', requireRole('admin'), async (req, res) => {
  try {
    const store = await readStore();
    const weekStart = getWeekStartOrToday(req.query.weekStart);
    const start = parseDateKey(weekStart);
    const end = addDays(start, 6);

    const items = store.timesheets
      .filter((item) => {
        const day = parseDateKey(item.date);
        return day && day >= start && day <= end;
      })
      .sort((a, b) => `${a.date} ${a.employeeName}`.localeCompare(`${b.date} ${b.employeeName}`));

    const rows = [['Employee', 'Date', 'Hours', 'Notes', 'Clocked At']];
    for (const item of items) {
      rows.push([item.employeeName, item.date, String(item.hours), item.notes || '', item.clockedAt]);
    }

    const csv = rows
      .map((row) =>
        row
          .map((field) => {
            const value = String(field || '');
            const escaped = value.replaceAll('"', '""');
            return `"${escaped}"`;
          })
          .join(',')
      )
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="timesheets-${weekStart}.csv"`);
    res.send(csv);
  } catch {
    res.status(500).json({ error: 'Unable to export timesheets.' });
  }
});

app.get('/api/admin/invoices', requireRole('admin'), async (req, res) => {
  try {
    const store = await readStore();
    const weekStart = getWeekStartOrToday(req.query.weekStart);
    const start = parseDateKey(weekStart);
    const end = addDays(start, 6);

    const grouped = new Map();

    for (const booking of store.houseOfficeSchedule.houses) {
      const day = parseDateKey(booking.date);
      if (!day || day < start || day > end || !booking.cleaned) {
        continue;
      }

      const client = booking.clientId
        ? store.clients.find((entry) => entry.id === booking.clientId) || null
        : null;

      const groupKey = booking.clientId || `manual:${booking.clientName || booking.location}`;
      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          clientId: booking.clientId || null,
          clientName: booking.clientName || client?.name || booking.location,
          weekStart,
          weekEnd: dateKeyFromDate(end),
          lineItems: [],
          totalAmount: 0
        });
      }

      const invoice = grouped.get(groupKey);
      const amount = Number(booking.invoiceAmount || client?.weeklyRate || 120);
      invoice.lineItems.push({
        date: booking.date,
        time: booking.time,
        location: booking.location,
        notes: booking.notes,
        amount
      });
      invoice.totalAmount += amount;
    }

    const invoices = [...grouped.values()].sort((a, b) => a.clientName.localeCompare(b.clientName));
    res.json({ weekStart, weekEnd: dateKeyFromDate(end), invoices });
  } catch {
    res.status(500).json({ error: 'Unable to build invoices.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
