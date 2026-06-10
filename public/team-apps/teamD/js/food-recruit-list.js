'use strict';

document.addEventListener('DOMContentLoaded', () => {
    const shokudoSelect = document.getElementById('shokudo-keyword');
    const keywordInput = document.getElementById('keyword');
    const searchButton = document.getElementById('search-button');
    const clearButton = document.getElementById('clear-button');
    const rows = document.querySelectorAll('.data-table tbody tr');

    // 検索結果なしメッセージ
    const noResultMessage = document.getElementById('no-result-message');

    const searchRows = () => {
        const selectedShokudo = shokudoSelect.value.trim().toLowerCase();
        const keyword = keywordInput.value.trim().toLowerCase();

        let visibleCount = 0;

        rows.forEach((row) => {
            const cells = row.querySelectorAll('td');

            if (cells.length < 8) {
                return;
            }

            const shokudoName = cells[1].textContent.trim().toLowerCase();
            const allText = row.textContent.trim().toLowerCase();

            const isShokudoMatch =
                selectedShokudo === '' || shokudoName.includes(selectedShokudo);

            const isKeywordMatch =
                keyword === '' || allText.includes(keyword);

            const isVisible =
                isShokudoMatch && isKeywordMatch;

            row.style.display = isVisible ? '' : 'none';

            if (isVisible) {
                visibleCount++;
            }
        });

        // 0件の場合はメッセージ表示
        if (visibleCount === 0) {
            noResultMessage.style.display = 'block';
        } else {
            noResultMessage.style.display = 'none';
        }
    };

    searchButton.addEventListener('click', searchRows);

    keywordInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            searchRows();
        }
    });

    clearButton.addEventListener('click', () => {
        shokudoSelect.value = '';
        keywordInput.value = '';

        rows.forEach((row) => {
            row.style.display = '';
        });

        noResultMessage.style.display = 'none';
    });
});