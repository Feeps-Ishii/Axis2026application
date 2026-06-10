document.addEventListener("DOMContentLoaded", () => {

    const keyword = document.getElementById("keyword");
    if (!keyword) return;

    keyword.addEventListener("keyup", () => {

        const searchWord = keyword.value.toLowerCase();
        const rows = document.querySelectorAll("tbody tr");

        rows.forEach(row => {

            const text = row.textContent.toLowerCase();

            if (text.includes(searchWord)) {
                row.style.display = "";
            } else {
                row.style.display = "none";
            }
        });
    });
});