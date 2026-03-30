import {
  uiModal,
  uiModalTitle,
  uiModalMessage,
  uiModalForm,
  uiModalCancelBtn,
  uiModalConfirmBtn
} from './dom.js';

let activeModalResolver = null;

function createModalField(field) {
  const label = document.createElement('label');
  label.textContent = field.label;

  if (field.type === 'select') {
    const select = document.createElement('select');
    select.name = field.name;
    (field.options || []).forEach((option) => {
      const opt = document.createElement('option');
      opt.value = option.value;
      opt.textContent = option.label;
      if (String(option.value) === String(field.value || '')) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });
    label.appendChild(select);
    return label;
  }

  if (field.type === 'checkbox-group') {
    const group = document.createElement('div');
    group.className = 'ui-checkbox-group';
    (field.options || []).forEach((option) => {
      const optionLabel = document.createElement('label');
      optionLabel.className = 'ui-checkbox-option';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.name = field.name;
      checkbox.value = option.value;
      checkbox.checked = Boolean(option.checked);

      const text = document.createElement('span');
      text.textContent = option.label;

      optionLabel.appendChild(checkbox);
      optionLabel.appendChild(text);
      group.appendChild(optionLabel);
    });

    label.appendChild(group);
    return label;
  }

  const control = field.type === 'textarea' ? document.createElement('textarea') : document.createElement('input');
  control.name = field.name;
  control.value = field.value || '';
  control.placeholder = field.placeholder || '';
  if (field.type && field.type !== 'textarea') {
    control.type = field.type;
  }

  label.appendChild(control);
  return label;
}

function closeModal(result) {
  uiModal.classList.add('hidden');
  uiModalForm.innerHTML = '';
  uiModalForm.onkeydown = null;
  uiModalConfirmBtn.textContent = 'Continue';
  uiModalCancelBtn.textContent = 'Cancel';
  uiModalCancelBtn.classList.remove('hidden');
  document.removeEventListener('keydown', onModalKeydown);

  if (activeModalResolver) {
    activeModalResolver(result);
    activeModalResolver = null;
  }
}

function onModalKeydown(event) {
  if (event.key === 'Escape' && !uiModal.classList.contains('hidden')) {
    closeModal({ confirmed: false, values: {} });
  }
}

export function showModal({
  title,
  message,
  fields = [],
  confirmText = 'Continue',
  cancelText = 'Cancel',
  showCancel = true
}) {
  return new Promise((resolve) => {
    activeModalResolver = resolve;

    uiModalTitle.textContent = title;
    uiModalMessage.textContent = message || '';
    uiModalForm.innerHTML = '';
    fields.forEach((field) => {
      uiModalForm.appendChild(createModalField(field));
    });

    uiModalConfirmBtn.textContent = confirmText;
    uiModalCancelBtn.textContent = cancelText;
    uiModalCancelBtn.classList.toggle('hidden', !showCancel);
    uiModal.classList.remove('hidden');

    uiModalCancelBtn.onclick = () => closeModal({ confirmed: false, values: {} });
    uiModalConfirmBtn.onclick = () => {
      const values = {};
      fields.forEach((field) => {
        if (field.type === 'checkbox-group') {
          const checked = uiModalForm.querySelectorAll(`input[name="${field.name}"]:checked`);
          values[field.name] = Array.from(checked).map((item) => item.value);
          return;
        }

        const input = uiModalForm.elements.namedItem(field.name);
        values[field.name] = input ? String(input.value) : '';
      });
      closeModal({ confirmed: true, values });
    };

    uiModal.onclick = (event) => {
      if (event.target === uiModal) {
        closeModal({ confirmed: false, values: {} });
      }
    };
    uiModalForm.onkeydown = (event) => {
      if (event.key === 'Enter' && !(event.target instanceof HTMLTextAreaElement)) {
        event.preventDefault();
        uiModalConfirmBtn.click();
      }
    };

    document.addEventListener('keydown', onModalKeydown);
    const firstInput = uiModalForm.querySelector('input, textarea, select');
    if (firstInput) {
      firstInput.focus();
      if (firstInput instanceof HTMLInputElement || firstInput instanceof HTMLTextAreaElement) {
        firstInput.select();
      }
    } else {
      uiModalConfirmBtn.focus();
    }
  });
}

export async function uiAlert(message, title = 'Notice') {
  await showModal({
    title,
    message,
    confirmText: 'OK',
    showCancel: false
  });
}

export async function uiConfirm(message, title = 'Confirm') {
  const result = await showModal({
    title,
    message,
    confirmText: 'Yes',
    cancelText: 'No'
  });
  return result.confirmed;
}

export async function uiPrompt(message, defaultValue = '', options = {}) {
  const result = await showModal({
    title: options.title || 'Input Required',
    message,
    confirmText: options.confirmText || 'Save',
    cancelText: options.cancelText || 'Cancel',
    fields: [
      {
        name: 'value',
        label: options.label || 'Value',
        value: defaultValue,
        placeholder: options.placeholder || '',
        type: options.type || 'text'
      }
    ]
  });

  if (!result.confirmed) return null;
  return result.values.value;
}

export async function uiSelect(message, options, defaultValue, config = {}) {
  const result = await showModal({
    title: config.title || 'Select Option',
    message,
    confirmText: config.confirmText || 'Continue',
    cancelText: config.cancelText || 'Cancel',
    fields: [
      {
        name: 'value',
        label: config.label || 'Option',
        type: 'select',
        value: defaultValue,
        options
      }
    ]
  });

  if (!result.confirmed) return null;
  return result.values.value;
}
