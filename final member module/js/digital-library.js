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

    container.innerHTML = '';
    const frag = document.createDocumentFragment();

    filtered.forEach(resource => {
        const article = document.createElement('article');
        article.className = 'resource-card';

        const cover = document.createElement('div');
        cover.className = 'resource-cover';
        const icon = document.createElement('i');
        icon.className = 'fa-solid ' + (resource.icon || 'fa-file');
        cover.appendChild(icon);

        const h3 = document.createElement('h3');
        h3.textContent = resource.title || 'Untitled';

        const p = document.createElement('p');
        p.textContent = `${resource.type} • ${resource.author}`;

        const btn = document.createElement('button');
        btn.className = 'read-btn';
        btn.type = 'button';
        const btnIcon = document.createElement('i');
        btnIcon.className = 'fa-solid fa-book-open';
        btn.appendChild(btnIcon);
        btn.appendChild(document.createTextNode(' Open PDF Resource'));
        btn.addEventListener('click', () => openResource(resource.title, resource.pdfUrl));

        article.appendChild(cover);
        article.appendChild(h3);
        article.appendChild(p);
        article.appendChild(btn);

        frag.appendChild(article);
    });

    container.appendChild(frag);
}

function openResource(title, url) {
    // In local file contexts HEAD requests frequently fail. Try opening directly first,
    // fallback to a user-friendly message if blocked.
    try {
        const w = window.open(url, "_blank");
        if (!w || (typeof w.closed !== 'undefined' && w.closed)) {
            // Popup blocked or failed - show fallback message
            showPdfFallbackModal(title);
        }
    } catch (e) {
        // If direct open fails, give a descriptive fallback
        showPdfFallbackModal(title);
    }
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