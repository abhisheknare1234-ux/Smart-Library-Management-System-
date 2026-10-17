// ==========================================================================
// Library Hub — Landing Page Script
// Real Database Stats Fetching & Smooth Interactions
// ==========================================================================

document.addEventListener("DOMContentLoaded", function () {
    // 1. Fetch Real Database Statistics for the Metrics Strip
    fetchPublicStats();

    // 2. Smooth Scrolling for Navigation Links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener("click", function (e) {
            const href = this.getAttribute("href");
            if (href === "#") return;
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        });
    });

    // 3. Highlight Active Nav Link on Scroll
    const sections = document.querySelectorAll("section[id]");
    const navLinks = document.querySelectorAll(".lh-nav-menu .lh-nav-link");

    window.addEventListener("scroll", () => {
        let currentSection = "";
        const scrollPosition = window.pageYOffset + 140;

        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
                currentSection = section.getAttribute("id");
            }
        });

        navLinks.forEach(link => {
            link.classList.remove("active");
            if (link.getAttribute("href") === `#${currentSection}`) {
                link.classList.add("active");
            }
        });
    });
});

async function fetchPublicStats() {
    try {
        const res = await fetch("http://localhost:5000/api/stats/public");
        if (!res.ok) throw new Error("Could not reach public stats API");
        const data = await res.json();

        if (data.success && data.stats) {
            const elBooks = document.getElementById("statTotalBooks");
            const elCopies = document.getElementById("statAvailableCopies");
            const elMembers = document.getElementById("statTotalMembers");

            if (elBooks) elBooks.textContent = Number(data.stats.totalBooks).toLocaleString();
            if (elCopies) elCopies.textContent = Number(data.stats.availableBooks).toLocaleString();
            if (elMembers) elMembers.textContent = Number(data.stats.totalMembers).toLocaleString();
        }
    } catch (err) {
        console.warn("Using default baseline metrics:", err.message);
    }
}
