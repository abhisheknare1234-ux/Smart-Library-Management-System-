const resources = [
    {
        id: "res-1",
        title: "Clean Code Handbook",
        type: "E-Book",
        author: "Robert C. Martin",
        icon: "fa-code",
        pdfUrl: "../assets/sample-clean-code.pdf"
    },
    {
        id: "res-2",
        title: "Web Development Journal",
        type: "Journal",
        author: "Digital Library Press",
        icon: "fa-newspaper",
        pdfUrl: "../assets/sample-journal.pdf"
    },
    {
        id: "res-3",
        title: "Database Systems Research Paper",
        type: "Research",
        author: "Academic Computer Science Review",
        icon: "fa-file-lines",
        pdfUrl: "../assets/sample-research.pdf"
    },
    {
        id: "res-4",
        title: "JavaScript Handbook (Modern ES6+)",
        type: "E-Book",
        author: "David Flanagan",
        icon: "fa-laptop-code",
        pdfUrl: "../assets/sample-js.pdf"
    }
];

let activeFilter = "all";

function loadResources() {
    const container = document.getElementById("digitalResources");
    if (!container) return;

    const filtered = resources.filter(res => {
        if (activeFilter === "all") return true;
        return res.type.toLowerCase().includes(activeFilter.toLowerCase());
    });

    container.innerHTML = filtered.map(resource => `
        <article class="resource-card">
            <div class="resource-cover">
                <i class="fa-solid ${resource.icon}"></i>
            </div>
            <h3>${resource.title}</h3>
            <p>${resource.type} • ${resource.author}</p>
            <button class="read-btn" type="button" onclick="openResource('${resource.title}', '${resource.pdfUrl}')">
                <i class="fa-solid fa-book-open"></i> Open PDF Resource
            </button>
        </article>
    `).join("");
}

function openResource(title, url) {
    // Check if URL exists or open in browser / fallback
    fetch(url, { method: "HEAD" })
        .then(res => {
            if (res.ok) {
                window.open(url, "_blank");
            } else {
                showPdfFallbackModal(title);
            }
        })
        .catch(() => {
            showPdfFallbackModal(title);
        });
}

function showPdfFallbackModal(title) {
    alert(`"${title}" PDF document viewer: The requested digital resource is currently stored in offline library archives. Please contact staff to request direct access.`);
}

document.addEventListener("DOMContentLoaded", () => {
    loadResources();

    document.querySelectorAll(".resource-filters button").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".resource-filters button").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const text = btn.textContent.trim();
            activeFilter = text === "All" ? "all" : text;
            loadResources();
        });
    });
});