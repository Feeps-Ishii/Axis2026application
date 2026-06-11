window.addEventListener("load", function() {
    const loading = document.getElementById("loading");
    const mainContent = document.getElementById("main-content");

    setTimeout(function() {
        loading.classList.add("fade-out");

        setTimeout(function() {
            loading.style.display = "none";
            mainContent.classList.add("show");
        }, 1000);

    }, 1200);
});