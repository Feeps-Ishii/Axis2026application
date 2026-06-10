/* =========================================================
   統合ポータル画面用JS
   - タブ切り替えとキーワード検索を担当する。
   - サーバ実装後はカード部分をThymeleafの繰り返しに置き換える。
   ========================================================= */
(() => {
    'use strict';

    const switchTab = (targetId) => {
        document.querySelectorAll('[data-tab-panel]').forEach((panel) => {
            panel.classList.toggle('hidden', panel.id !== targetId);
        });
        document.querySelectorAll('[data-tab-button]').forEach((button) => {
            button.setAttribute('aria-selected', String(button.dataset.target === targetId));
        });
    };

    const filterCards = (keyword) => {
        const normalizedKeyword = keyword.trim().toLowerCase();
        document.querySelectorAll('[data-search-card]').forEach((card) => {
            card.classList.toggle('hidden', !card.textContent.toLowerCase().includes(normalizedKeyword));
        });
    };

    document.querySelectorAll('[data-tab-button]').forEach((button) => {
        button.addEventListener('click', () => switchTab(button.dataset.target));
    });
	
	/* 初期表示は感謝メッセージタブを開く */
	switchTab('food-panel');

    const searchInput = document.querySelector('[data-search-input]');
    if (searchInput) searchInput.addEventListener('input', (event) => filterCards(event.target.value));
})();


/* ========================================
 * ヒーロースライダー
 * 数秒ごとにふわっと画像切り替え
 * ======================================== */

const slides = document.querySelectorAll('.hero-slide');

let currentSlide = 0;

/**
 * スライド切り替え処理
 */
function changeSlide() {

    // 現在表示中を非表示
    slides[currentSlide].classList.remove('active');

    // 次へ
    currentSlide++;

    // 最後なら先頭へ戻る
    if (currentSlide >= slides.length) {
        currentSlide = 0;
    }

    // 次スライド表示
    slides[currentSlide].classList.add('active');
}

/* 6秒ごとに切り替え */
setInterval(changeSlide, 6000);

document.addEventListener("DOMContentLoaded", () => {

    const searchInput =
        document.querySelector("[data-search-input]");

    const cards =
        document.querySelectorAll("[data-search-card]");

    if (!searchInput) {
        return;
    }

    searchInput.addEventListener("input", () => {

        const keyword =
            searchInput.value.toLowerCase();

        cards.forEach(card => {

            const text =
                card.textContent.toLowerCase();

            if (text.includes(keyword)) {

                card.style.display = "";

            } else {

                card.style.display = "none";

            }

        });

    });

});

// 感謝メッセージをランダムに1件ずつ表示する
document.addEventListener('DOMContentLoaded', () => {
    const thanksCards = document.querySelectorAll('.thanks-card');

    // 感謝メッセージがない場合は処理しない
    if (thanksCards.length === 0) {
        return;
    }

    let currentIndex = -1;

    function showRandomThanksMessage() {
        // いったん全カードを非表示にする
        thanksCards.forEach((card) => {
            card.classList.remove('is-active');
        });

        let nextIndex;

        // 同じメッセージが連続しにくいようにする
        do {
            nextIndex = Math.floor(Math.random() * thanksCards.length);
        } while (thanksCards.length > 1 && nextIndex === currentIndex);

        currentIndex = nextIndex;
        thanksCards[currentIndex].classList.add('is-active');
    }

    // 最初の1件を表示
    showRandomThanksMessage();

    // 5秒ごとにランダム切り替え
    setInterval(showRandomThanksMessage, 5000);
});
