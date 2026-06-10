/* =========================================================
   共通バリデーション
   - data-required / data-pattern / maxlength を利用して入力チェックを行う。
   - name と id は画面設計書の項目IDと一致させ、DBカラムは data-db-column に保持する。
   ========================================================= */
(() => {
    'use strict';

    const patterns = {
        postal: /^$|^\d{3}-?\d{4}$/,
        phone: /^[0-9-]+$/,
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        url: /^$|^https?:\/\/.+/i
    };

    const getErrorElement = (field) => document.getElementById(`${field.id}-error`);

    const showError = (field, message) => {
        field.setAttribute('aria-invalid', 'true');
        const error = getErrorElement(field);
        if (error) error.textContent = message;
    };

    const clearError = (field) => {
        field.removeAttribute('aria-invalid');
        const error = getErrorElement(field);
        if (error) error.textContent = '';
    };

    const getValue = (field) => field.type === 'checkbox' ? (field.checked ? field.value : '') : field.value.trim();

    const validateField = (field) => {
        const label = field.dataset.label || field.name || 'この項目';
        const value = getValue(field);

        clearError(field);

        if (field.dataset.required === 'true' && !value) {
            showError(field, `${label}を入力してください`);
            return false;
        }

        if (field.dataset.pattern && value && patterns[field.dataset.pattern] && !patterns[field.dataset.pattern].test(value)) {
            showError(field, `${label}の入力形式が正しくありません`);
            return false;
        }

        const maxLength = Number(field.dataset.maxLength || 0);
        if (maxLength > 0 && value.length > maxLength) {
            showError(field, `${label}は${maxLength}文字以内で入力してください`);
            return false;
        }

        if (field.type === 'date' && field.dataset.required === 'true' && value) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const inputDate = new Date(value);
            if (inputDate < today) {
                showError(field, `${label}は本日以降の日付を入力してください`);
                return false;
            }
        }

        return true;
    };

    document.querySelectorAll('form[data-validate="true"]').forEach((form) => {
        const fields = Array.from(form.querySelectorAll('input, select, textarea'));

        fields.forEach((field) => {
            field.addEventListener('blur', () => validateField(field));
            field.addEventListener('input', () => clearError(field));
        });

        form.addEventListener('submit', (event) => {
            const valid = fields.map(validateField).every(Boolean);
            if (!valid) {
                event.preventDefault();
                const firstInvalid = form.querySelector('[aria-invalid="true"]');
                if (firstInvalid) firstInvalid.focus();
            }
        });
    });
})();

/* （元コード末尾の #I-004 への直接参照は、I-004 を持たない画面で
    ReferenceError になり validation.js 全体が停止するため静的モックでは削除。） */
