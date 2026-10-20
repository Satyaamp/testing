import { apiRequest, showToast } from './api.js';

let userPatches = [];
let patchesLoaded = false;
let patchCategories = [];

// Ensure #patchPickerModal DOM is dynamically present in any page
export function ensurePatchPickerDOM() {
  let modal = document.getElementById('patchPickerModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'patchPickerModal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
      <div class="modal-content glass-card" style="max-width: 440px; width: 92%; max-height: 80vh; padding: 18px 20px;">
        <div class="modal-pull-handle"></div>
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 12px; margin-bottom: 14px;">
          <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 6px;">
            <span style="color: #38bdf8;">⚡</span> My Patches
          </h3>
          <div style="display: flex; align-items: center; gap: 10px;">
            <button type="button" onclick="location.href='patches'" 
              style="background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.25); color: #38bdf8; font-size: 0.78rem; font-weight: 600; cursor: pointer; padding: 4px 10px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; transition: all 0.2s;" 
              title="Open Patches Manager Page">
              ⚙️ Manage
            </button>
            <button type="button" onclick="closePatchPickerModal()" 
              style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: white; width: 28px; height: 28px; border-radius: 50%; font-size: 1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" 
              title="Close">&times;</button>
          </div>
        </div>
        <div id="patchPickerList" class="patch-picker-list"></div>
      </div>
    `;
    document.body.appendChild(modal);
  }
}

// Load user's patches from /api/patches
export async function loadUserPatches(forceRefresh = false) {
  if (patchesLoaded && !forceRefresh) {
    renderPatchPickerList();
    renderPatchCards();
    updatePatchBadge();
    return userPatches;
  }
  try {
    const res = await apiRequest('/patches', 'GET', null, { skipLoader: true });
    userPatches = (res && res.data) ? res.data : [];
    patchesLoaded = true;
    renderPatchPickerList();
    renderPatchCards();
    updatePatchBadge();
    return userPatches;
  } catch (err) {
    console.warn('Failed to load patches:', err);
    return [];
  }
}

// Open Patch Picker Modal (invoked by clicking "⚡ My Patches" hyperlink)
export async function openPatchPickerModal() {
  ensurePatchPickerDOM();
  const modal = document.getElementById('patchPickerModal');
  if (!modal) return;

  await loadUserPatches();
  renderPatchPickerList();
  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');
}

// Close Patch Picker Modal
export function closePatchPickerModal() {
  const modal = document.getElementById('patchPickerModal');
  if (modal) {
    modal.classList.add('hidden');
    const expenseModal = document.getElementById('expenseModal');
    if (!expenseModal || expenseModal.classList.contains('hidden')) {
      document.body.classList.remove('modal-open');
    }
  }
}

// Open Manage modal from the picker modal
export function openPatchManagerFromPicker(tab = 'list') {
  closePatchPickerModal();
  if (window.location.pathname.includes('patches')) {
    focusPatchForm?.();
  } else {
    // Open central patches.html page
    location.href = 'patches';
  }
}

// Helper to animate a single data stream orb from startCoord to a target DOM input element
function streamDataToField({ text, icon, startX, startY, targetEl, delayMs, durationMs, orbClass, onArrival }) {
  setTimeout(() => {
    if (!targetEl) {
      if (onArrival) onArrival();
      return;
    }

    const rect = targetEl.getBoundingClientRect();
    const destX = rect.left + rect.width / 2;
    const destY = rect.top + rect.height / 2;

    const orb = document.createElement('div');
    orb.className = `patch-stream-orb ${orbClass || ''}`;
    orb.innerHTML = `<span>${icon || '⚡'}</span> <span>${escapeHtml(text)}</span>`;
    orb.style.left = `${startX}px`;
    orb.style.top = `${startY}px`;
    orb.style.transitionDuration = `${durationMs / 1000}s`;
    document.body.appendChild(orb);

    // Trigger flight on next frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        orb.style.left = `${destX}px`;
        orb.style.top = `${destY}px`;
        orb.style.transform = 'translate(-50%, -50%) scale(1.06)';
      });
    });

    // On arrival
    setTimeout(() => {
      // Impact ripple ring
      const ring = document.createElement('div');
      ring.className = 'patch-impact-ring';
      ring.style.left = `${destX}px`;
      ring.style.top = `${destY}px`;
      document.body.appendChild(ring);
      setTimeout(() => ring.remove(), 550);

      // Dissolve orb
      orb.classList.add('arrived');
      setTimeout(() => orb.remove(), 260);

      // Execute field update & glow
      if (onArrival) onArrival();

      targetEl.classList.remove('field-patch-glow');
      void targetEl.offsetWidth;
      targetEl.classList.add('field-patch-glow');
      setTimeout(() => targetEl.classList.remove('field-patch-glow'), 1000);
    }, durationMs);
  }, delayMs);
}

// Apply patch data to the active expense form with multi-second sequential flow animation
export function applyPatchWithAnimation(patchId, itemElement) {
  const patch = userPatches.find(p => p._id === patchId);
  if (!patch) return;

  // Visual press on clicked item
  if (itemElement) {
    itemElement.classList.add('active');
  }

  // Determine starting coordinates from clicked row
  let startX = window.innerWidth / 2;
  let startY = window.innerHeight / 2;
  if (itemElement) {
    const rect = itemElement.getBoundingClientRect();
    startX = rect.left + rect.width / 2;
    startY = rect.top + rect.height / 2;
  }

  // Target inputs in the active expense modal
  const amtInput = document.getElementById('expenseAmount');
  const catInput = document.getElementById('expenseCategory');
  const descInput = document.getElementById('expenseDesc');

  // Smoothly fade out picker modal so active expense modal underneath is visible
  const pickerModal = document.getElementById('patchPickerModal');
  const modalContent = pickerModal?.querySelector('.modal-content');
  if (modalContent) {
    modalContent.classList.add('patch-picker-fadeout');
  }

  // 1. Amount Stream (starts at 60ms, flies to Amount input over 650ms -> lands at 710ms)
  streamDataToField({
    text: `₹${patch.amount}`,
    icon: '⚡',
    startX: startX,
    startY: startY,
    targetEl: amtInput,
    delayMs: 60,
    durationMs: 650,
    orbClass: '',
    onArrival: () => {
      if (amtInput) {
        amtInput.value = patch.amount;
        amtInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  });

  // Close picker modal after smooth fade (260ms), leaving the expense modal in clear view
  setTimeout(() => {
    closePatchPickerModal();
    if (modalContent) modalContent.classList.remove('patch-picker-fadeout');
  }, 260);

  // 2. Category Stream (starts at 800ms, glides down into Category dropdown over 550ms -> lands at 1350ms)
  const catSpawnX = amtInput ? amtInput.getBoundingClientRect().left + 80 : startX;
  const catSpawnY = amtInput ? amtInput.getBoundingClientRect().top - 30 : startY;
  streamDataToField({
    text: patch.category,
    icon: '🏷️',
    startX: catSpawnX,
    startY: catSpawnY,
    targetEl: catInput,
    delayMs: 800,
    durationMs: 550,
    orbClass: 'category-orb',
    onArrival: () => {
      if (catInput) {
        catInput.value = patch.category;
        catInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  });

  // 3. Description Stream (starts at 1450ms, glides down into Description input over 550ms -> lands at 2000ms)
  const descText = patch.description || patch.name;
  if (descInput && descText) {
    const descSpawnX = catInput ? catInput.getBoundingClientRect().left + 80 : startX;
    const descSpawnY = catInput ? catInput.getBoundingClientRect().top - 30 : startY;
    streamDataToField({
      text: descText,
      icon: '📝',
      startX: descSpawnX,
      startY: descSpawnY,
      targetEl: descInput,
      delayMs: 1450,
      durationMs: 550,
      orbClass: 'desc-orb',
      onArrival: () => {
        descInput.value = descText;
        descInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  }

  // 4. Save Button Tactile Invitation Breathing Pulse (at 2150ms)
  setTimeout(() => {
    const saveBtn = document.querySelector('#expenseModal button[onclick="addExpense()"]') ||
      document.getElementById('saveExpenseBtn');
    if (saveBtn) {
      saveBtn.classList.remove('btn-save-patch-pulse');
      void saveBtn.offsetWidth;
      saveBtn.classList.add('btn-save-patch-pulse');
      setTimeout(() => saveBtn.classList.remove('btn-save-patch-pulse'), 2500);
    }
    showToast(`Click Save to confirm.`, 'info');
  }, 2150);
}

// Render the list of patches in the picker modal
export function renderPatchPickerList() {
  const container = document.getElementById('patchPickerList');
  if (!container) return;

  if (!userPatches || userPatches.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 28px 12px; color: #94a3b8;">
        <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 12px;">No patches yet.</p>
        <button type="button" class="patch-btn-save" style="margin: 0 auto; display: inline-flex;" onclick="openPatchManagerFromPicker('form')">
          + Add Patch
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = userPatches.map(p => {
    const showDesc = p.description && p.description.trim() && p.description.trim().toLowerCase() !== p.name.trim().toLowerCase();
    return `
      <div class="patch-picker-item" onclick="applyPatchWithAnimation('${p._id}', this)" title="Load ${escapeHtml(p.name)}">
        <div class="patch-picker-item-left">
          <span class="patch-picker-name">${escapeHtml(p.name)}</span>
          <div class="patch-picker-meta">
            <span class="patch-picker-cat">${escapeHtml(p.category)}</span>
            ${showDesc ? `<span class="patch-picker-desc">• ${escapeHtml(p.description)}</span>` : ''}
          </div>
        </div>
        <div class="patch-picker-item-right">
          <span class="patch-picker-amt">₹${p.amount}</span>
          <span class="patch-picker-arrow">→</span>
        </div>
      </div>
    `;
  }).join('');
}

// Load categories into #patchCategorySelect
export async function loadPatchCategories() {
  const select = document.getElementById('patchCategorySelect');
  if (!select) return;

  try {
    let res;
    try {
      res = await apiRequest('/categories');
    } catch {
      res = await apiRequest('/expenses/categories');
    }
    patchCategories = (res && res.data) ? res.data : [];

    select.innerHTML = '<option value="" disabled selected>Select Category</option>';
    patchCategories.forEach(c => {
      const name = typeof c === 'string' ? c : c.name;
      const icon = (typeof c === 'object' && c.icon) ? `${c.icon} ` : '';
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = `${icon}${name}`;
      select.appendChild(opt);
    });
  } catch (err) {
    console.warn('Failed to load categories for patch manager:', err);
  }
}

// Open Patch Manager Modal (or redirect to central patches page)
export function openPatchManager(defaultTab = 'list') {
  const modal = document.getElementById('patchModal');
  if (!modal) {
    location.href = 'patches';
    return;
  }

  loadPatchCategories();
  switchPatchTab(defaultTab);
  renderPatchCards();
  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');
}

// Close Patch Manager Modal
export function closePatchManager() {
  const modal = document.getElementById('patchModal');
  if (modal) {
    modal.classList.add('hidden');
    const expenseModal = document.getElementById('expenseModal');
    if (!expenseModal || expenseModal.classList.contains('hidden')) {
      document.body.classList.remove('modal-open');
    }
    cancelPatchEdit();
  }
}

// Switch between 'list' and 'form' tabs
export function switchPatchTab(tab) {
  const listTab = document.getElementById('patchTabList');
  const formTab = document.getElementById('patchTabForm');
  const listBtn = document.getElementById('patchTabListBtn');
  const formBtn = document.getElementById('patchTabFormBtn');

  if (tab === 'list') {
    if (listTab) listTab.style.display = 'block';
    if (formTab) formTab.style.display = 'none';
    if (listBtn) listBtn.classList.add('active');
    if (formBtn) formBtn.classList.remove('active');
  } else {
    if (listTab) listTab.style.display = 'none';
    if (formTab) formTab.style.display = 'block';
    if (listBtn) listBtn.classList.remove('active');
    if (formBtn) formBtn.classList.add('active');
  }
}

// Update count badge
function updatePatchBadge() {
  const badge = document.getElementById('patchCountBadge');
  if (badge) badge.innerText = userPatches.length;
}

// Render cards inside Manage Modal
export function renderPatchCards() {
  const container = document.getElementById('patchCardsList');
  if (!container) return;

  updatePatchBadge();

  if (!userPatches || userPatches.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 28px 12px; color: #94a3b8;">
        <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 12px;">No patches yet.</p>
        <button type="button" class="patch-btn-save" style="margin: 0 auto; display: inline-flex;" onclick="switchPatchTab('form')">
          + Add Patch
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = userPatches.map(p => {
    const showDesc = p.description && p.description.trim() && p.description.trim().toLowerCase() !== p.name.trim().toLowerCase();
    return `
    <div class="patch-card">
      <div class="patch-card-info">
        <div class="patch-card-title">
          <span>${escapeHtml(p.name)}</span>
          <span class="patch-card-cat-badge">${escapeHtml(p.category)}</span>
        </div>
        ${showDesc ? `<div class="patch-card-meta"><span>${escapeHtml(p.description)}</span></div>` : ''}
      </div>
      <div class="patch-card-actions">
        <span class="patch-card-amt">₹${p.amount}</span>
        <button type="button" class="btn-icon-small" onclick="editPatch('${p._id}')" title="Edit Patch">✎</button>
        <button type="button" class="btn-icon-small delete" onclick="deletePatch('${p._id}')" title="Delete Patch">✕</button>
      </div>
    </div>
  `;
  }).join('');
}

// Submit Create or Edit Patch
export async function submitPatchForm() {
  const editId = document.getElementById('patchEditId')?.value;
  const nameInput = document.getElementById('patchNameInput');
  const amtInput = document.getElementById('patchAmountInput');
  const catInput = document.getElementById('patchCategorySelect');
  const descInput = document.getElementById('patchDescInput');
  const submitBtn = document.getElementById('patchFormSubmitBtn');

  const name = nameInput?.value.trim();
  const amount = parseFloat(amtInput?.value);
  const category = catInput?.value;
  const description = descInput?.value.trim() || '';

  if (!name || isNaN(amount) || amount <= 0 || !category) {
    showToast('Name, positive amount, and category are required', 'warning');
    return;
  }

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = editId ? 'Updating...' : 'Saving...';
    }

    if (editId) {
      await apiRequest(`/patches/${editId}`, 'PUT', { name, amount, category, description });
      showToast('Patch updated successfully', 'success');
    } else {
      await apiRequest('/patches', 'POST', { name, amount, category, description });
      showToast('Patch created successfully', 'success');
    }

    cancelPatchEdit();
    await loadUserPatches(true);
    switchPatchTab('list');
  } catch (err) {
    showToast(err.message || 'Failed to save patch', 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = editId ? 'Update Patch' : 'Save Patch';
    }
  }
}

// Edit Patch
export function editPatch(id) {
  const patch = userPatches.find(p => p._id === id);
  if (!patch) return;

  const idInput = document.getElementById('patchEditId');
  const nameInput = document.getElementById('patchNameInput');
  const amtInput = document.getElementById('patchAmountInput');
  const catInput = document.getElementById('patchCategorySelect');
  const descInput = document.getElementById('patchDescInput');
  const submitBtn = document.getElementById('patchFormSubmitBtn');

  if (idInput) idInput.value = patch._id;
  if (nameInput) nameInput.value = patch.name;
  if (amtInput) amtInput.value = patch.amount;
  if (catInput) catInput.value = patch.category;
  if (descInput) descInput.value = patch.description || '';
  if (submitBtn) submitBtn.innerText = 'Update Patch';

  switchPatchTab('form');
}

// Cancel / Reset Form
export function cancelPatchEdit() {
  const form = document.getElementById('patchForm');
  if (form) form.reset();
  const idInput = document.getElementById('patchEditId');
  if (idInput) idInput.value = '';
  const submitBtn = document.getElementById('patchFormSubmitBtn');
  if (submitBtn) submitBtn.innerText = 'Save Patch';
}

// Delete Patch
export async function deletePatch(id) {
  if (!confirm('Are you sure you want to delete this patch?')) return;
  try {
    await apiRequest(`/patches/${id}`, 'DELETE');
    showToast('Patch deleted', 'success');
    await loadUserPatches(true);
  } catch (err) {
    showToast(err.message || 'Failed to delete patch', 'error');
  }
}

// Helper: When user toggles "Save as Patch", prompt for patch name
export function handleSaveAsPatchToggle(checkbox) {
  if (!checkbox) return;
  const nameWrapper = document.getElementById('savePatchNameWrapper');
  const nameInput = document.getElementById('savePatchCustomName');

  if (checkbox.checked) {
    const descVal = document.getElementById('expenseDesc')?.value?.trim();
    const catVal = document.getElementById('expenseCategory')?.value?.trim();
    const defaultSuggestion = descVal || catVal || '';

    const entered = window.prompt('Enter patch name:', defaultSuggestion);
    if (entered === null) {
      // User pressed Cancel on prompt -> do not check the checkbox
      checkbox.checked = false;
      delete checkbox.dataset.patchName;
      if (nameWrapper) nameWrapper.style.display = 'none';
      if (nameInput) nameInput.value = '';
      return;
    }

    const finalName = (entered.trim() || defaultSuggestion || 'My Patch').slice(0, 50);
    checkbox.dataset.patchName = finalName;
    if (nameInput) nameInput.value = finalName;
    if (nameWrapper) nameWrapper.style.display = 'block';
  } else {
    // Unchecked
    delete checkbox.dataset.patchName;
    if (nameWrapper) nameWrapper.style.display = 'none';
    if (nameInput) nameInput.value = '';
  }
}

// Helper: Save current expense as patch if checkbox is checked
export async function saveCurrentAsPatch(name, amount, category, description) {
  try {
    const patchName = (name || description || category || 'My Patch').trim().slice(0, 50);
    await apiRequest('/patches', 'POST', {
      name: patchName,
      amount: Number(amount),
      category: category,
      description: description || ''
    }, { skipLoader: true });
    await loadUserPatches(true);
  } catch (err) {
    console.warn('Could not auto-save patch:', err);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Attach all to window for easy inline HTML access
window.ensurePatchPickerDOM = ensurePatchPickerDOM;
window.openPatchPickerModal = openPatchPickerModal;
window.closePatchPickerModal = closePatchPickerModal;
window.openPatchManagerFromPicker = openPatchManagerFromPicker;
window.applyPatchWithAnimation = applyPatchWithAnimation;
window.openPatchManager = openPatchManager;
window.closePatchManager = closePatchManager;
window.switchPatchTab = switchPatchTab;
window.submitPatchForm = submitPatchForm;
window.editPatch = editPatch;
window.cancelPatchEdit = cancelPatchEdit;
window.deletePatch = deletePatch;
window.loadUserPatches = loadUserPatches;
window.renderPatchPickerList = renderPatchPickerList;
window.saveCurrentAsPatch = saveCurrentAsPatch;
window.handleSaveAsPatchToggle = handleSaveAsPatchToggle;

// Initialize on script load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    ensurePatchPickerDOM();
    if (window.location.pathname.includes('patches')) {
      loadUserPatches();
    }
  });
} else {
  ensurePatchPickerDOM();
  if (window.location.pathname.includes('patches')) {
    loadUserPatches();
  }
}
