import { inventoryTableBody } from '../dom.js';
import { api } from '../api.js';
import { state } from '../state.js';
import { escapeHtml, isAdmin } from '../utils.js';
import { uiAlert, uiPrompt } from '../ui.js';

export function renderInventory() {
  if (!isAdmin()) {
    inventoryTableBody.innerHTML = '<tr><td colspan="5">Admin access required.</td></tr>';
    return;
  }

  const rows = (state.store.inventory || []).map((item) => {
    const isHealthyItem = Number(item.inStock) >= Number(item.minimum);
    return `
      <tr>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.inStock)} ${escapeHtml(item.unit)}</td>
        <td>${escapeHtml(item.minimum)} ${escapeHtml(item.unit)}</td>
        <td><span class="pill ${isHealthyItem ? 'pill-ok' : 'pill-warn'}">${isHealthyItem ? 'Healthy' : 'Low'}</span></td>
        <td><button class="link-btn" data-action="delete-inventory" data-id="${escapeHtml(item.id)}">Delete</button></td>
      </tr>
    `;
  });

  inventoryTableBody.innerHTML = rows.length ? rows.join('') : '<tr><td colspan="5">No inventory items yet.</td></tr>';
}

export async function addInventoryItem() {
  if (!isAdmin()) return false;

  const name = await uiPrompt('Item name:', '', { label: 'Item name' });
  if (!name) return false;
  const inStock = await uiPrompt('In stock amount (number):', '', { label: 'In stock', type: 'number' });
  if (inStock === null) return false;
  const minimum = await uiPrompt('Minimum amount (number):', '', { label: 'Minimum', type: 'number' });
  if (minimum === null) return false;
  const unit = (await uiPrompt('Unit (e.g. bottles, units):', 'units', { label: 'Unit' })) || 'units';

  try {
    await api('/api/inventory', {
      method: 'POST',
      body: JSON.stringify({ name, inStock, minimum, unit })
    });
    return true;
  } catch (error) {
    await uiAlert(error.message);
    return false;
  }
}
