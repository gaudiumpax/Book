/*************************
  Book DB with tags, edit popup, colors
  Predefined tags palette 2:
    Math   -> green (#2f9e44)
    Physics-> red   (#d9480f)
    Biology-> olive (#8d6e21)

  Custom tags: deterministic color from name.
  Tags are stored globally and alphabetically sorted.
***************************/

// --- Storage keys
const STORAGE_BOOKS = "books_v1";
const STORAGE_TAGS = "tags_v1";

// --- Predefined tags
const PREDEFINED_TAGS = [
    { name: "Math", color: "#2f9e44" },
    { name: "Physics", color: "#d9480f" },
    { name: "Biology", color: "#8d6e21" }
];

// --- In-memory state
let books = loadBooks();
let tags = loadTags();
let lastSortKey = null;
let sortOrder = 1; // 1 asc, -1 desc

// --- Utilities
function saveBooks() { localStorage.setItem(STORAGE_BOOKS, JSON.stringify(books)); }
function saveTags() { localStorage.setItem(STORAGE_TAGS, JSON.stringify(tags)); }

function loadBooks() {
    try {
        const raw = localStorage.getItem(STORAGE_BOOKS);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.error("Failed to load books:", e);
        return [];
    }
}

function loadTags() {
    try {
        const raw = localStorage.getItem(STORAGE_TAGS);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length) {
                parsed.sort((a,b)=>String(a.name).localeCompare(String(b.name)));
                return parsed;
            }
        }
    } catch (e) {
        console.error("Failed to load tags:", e);
    }
    const base = PREDEFINED_TAGS.slice().sort((a,b)=>a.name.localeCompare(b.name));
    localStorage.setItem(STORAGE_TAGS, JSON.stringify(base));
    return base;
}

// deterministic color generator for custom tags
function colorForTagName(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
    h = Math.abs(h) % 360;
    return `hsl(${h} 70% 45%)`;
}

function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function findTagByName(name) {
    return tags.find(t => t.name === name);
}

function ensureTagExists(name) {
    name = String(name || "").trim();
    if (!name) return null;
    const existing = findTagByName(name);
    if (existing) return existing;
    const t = { name, color: colorForTagName(name) };
    tags.push(t);
    tags.sort((a,b)=>String(a.name).localeCompare(String(b.name)));
    saveTags();
    renderTagControls();
    return t;
}

// --- Rendering helpers ---
function escapeId(s) { return String(s).replace(/[^\w]/g, "_"); }

function renderTagControls() {
    // ensure tags are sorted alphabetically
    tags.sort((a,b)=>String(a.name).localeCompare(String(b.name)));

    // form checkboxes
    const container = document.getElementById("formTagCheckboxes");
    if (container) {
        container.innerHTML = "";
        tags.forEach(t => {
            const id = `form_tag_${escapeId(t.name)}`;
            const label = document.createElement("label");
            label.className = "tag-checkbox nowrap";
            label.innerHTML = `<input type="checkbox" class="formTag" value="${escapeHtml(t.name)}" id="${id}"> 
                <span class="tag-dot" style="background:${t.color}"></span>${escapeHtml(t.name)}`;
            container.appendChild(label);
        });
    }

    // filter tag area with delete buttons and counts
    const fcont = document.getElementById("filterTagContainer");
    if (fcont) {
        fcont.innerHTML = "";
        tags.forEach(t => {
            const count = books.filter(b => (b.tags || []).includes(t.name)).length;
            const wrapper = document.createElement("label");
            wrapper.style.marginRight = "10px";
            wrapper.style.display = "inline-flex";
            wrapper.style.alignItems = "center";
            wrapper.innerHTML = `
                <input type="checkbox" class="filterTag" value="${escapeHtml(t.name)}" onchange="applyFilters()">
                <span class="tag-dot" style="background:${t.color}"></span>
                <span class="small">${escapeHtml(t.name)} (${count})</span>
                <span class="tagDelBtn" title="Delete tag" onclick="deleteTag('${escapeHtml(t.name)}')">&#128465;</span>
            `;
            fcont.appendChild(wrapper);
        });
    }
}

function renderTable(list) {
    const tbody = document.getElementById("bookTable");
    tbody.innerHTML = "";
    list.forEach((book, idx) => {
        const btags = Array.isArray(book.tags) ? book.tags.slice().sort((a,b)=>String(a).localeCompare(String(b))) : [];

        const tr = document.createElement("tr");

        const titleCell = `<td><a href="${escapeHtml(book.link || '#')}" target="_blank" rel="noopener noreferrer">${escapeHtml(book.title)}</a></td>`;
        const authorCell = `<td>${escapeHtml(book.author)}</td>`;
        const yearCell = `<td>${escapeHtml(book.year)}</td>`;

        const tagHtml = btags.map(n => {
            const tag = findTagByName(n) || { name: n, color: colorForTagName(n) };
            return `<span class="tag-pill"><span class="tag-dot" style="background:${tag.color}"></span><span class="small">${escapeHtml(tag.name)}</span></span>`;
        }).join("");

        const tagCell = `<td>${tagHtml}</td>`;

        const realIndex = books.indexOf(book);
        const actionCell = `<td class="nowrap">
            <button onclick="openForm('edit', ${realIndex})">Edit</button>
            <button onclick="deleteBook(${realIndex})" style="margin-left:6px;">Delete</button>
        </td>`;

        tr.innerHTML = titleCell + authorCell + yearCell + tagCell + actionCell;
        tbody.appendChild(tr);
    });
}

// --- Filters, search, sorting ---
function updateDropdowns() {
    const authorSel = document.getElementById("authorFilter");
    const yearSel = document.getElementById("yearFilter");
    if (!authorSel || !yearSel) return;

    const authors = new Set();
    const years = new Set();
    books.forEach(b => {
        if (b.author) authors.add(b.author);
        if (b.year !== undefined && b.year !== null && b.year !== "") years.add(String(b.year));
    });

    const oldAuthor = authorSel.value;
    authorSel.innerHTML = `<option value="">All Authors</option>`;
    [...authors].sort().forEach(a => {
        const opt = document.createElement("option"); opt.value = a; opt.textContent = a;
        authorSel.appendChild(opt);
    });
    if ([...authors].includes(oldAuthor)) authorSel.value = oldAuthor;

    const oldYear = yearSel.value;
    yearSel.innerHTML = `<option value="">All Years</option>`;
    [...years].sort().forEach(y => {
        const opt = document.createElement("option"); opt.value = y; opt.textContent = y;
        yearSel.appendChild(opt);
    });
    if ([...years].includes(oldYear)) yearSel.value = oldYear;
}

function applyFilters() {
    const q = (document.getElementById("searchInput").value || "").toLowerCase().trim();
    const selectedAuthor = document.getElementById("authorFilter").value;
    const selectedYear = document.getElementById("yearFilter").value;
    const selectedTags = Array.from(document.querySelectorAll(".filterTag:checked")).map(e => e.value);

    const filtered = books.filter(b => {
        const title = (b.title || "").toString().toLowerCase();
        const author = (b.author || "").toString().toLowerCase();
        const tagsLower = (b.tags || []).map(t=>t.toString().toLowerCase()).join(" ");

        const textMatch = !q || title.includes(q) || author.includes(q) || tagsLower.includes(q);
        const authorMatch = !selectedAuthor || b.author === selectedAuthor;
        const yearMatch = !selectedYear || String(b.year) === selectedYear;
        const tagsMatch = (selectedTags.length === 0) || selectedTags.every(t => (b.tags || []).includes(t));

        return textMatch && authorMatch && yearMatch && tagsMatch;
    });

    renderTable(filtered);
}

function sortBy(key) {
    if (lastSortKey === key) sortOrder = -sortOrder;
    else { lastSortKey = key; sortOrder = 1; }

    books.sort((a,b)=> {
        const A = (a[key] ?? "").toString().toLowerCase();
        const B = (b[key] ?? "").toString().toLowerCase();
        if (A < B) return -1 * sortOrder;
        if (A > B) return 1 * sortOrder;
        return 0;
    });
    saveBooks();
    applyFilters();
}

// --- Book CRUD & Form handling ---
function openForm(mode, index = -1) {
    const modal = document.getElementById("formModal");
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden", "false");
    document.getElementById("editingIndex").value = index;

    renderTagControls();

    if (mode === "add") {
        document.getElementById("formTitle").textContent = "Add Book";
        document.getElementById("f_title").value = "";
        document.getElementById("f_author").value = "";
        document.getElementById("f_year").value = "";
        document.getElementById("f_link").value = "";
        document.getElementById("deleteBtn").style.display = "none";
        document.querySelectorAll(".formTag").forEach(cb => cb.checked = false);
    } else {
        const book = books[index];
        if (!book) { alert("Book not found."); closeForm(); return; }
        document.getElementById("formTitle").textContent = "Edit Book";
        document.getElementById("f_title").value = book.title || "";
        document.getElementById("f_author").value = book.author || "";
        document.getElementById("f_year").value = book.year || "";
        document.getElementById("f_link").value = book.link || "";
        document.getElementById("deleteBtn").style.display = "inline-block";
        document.querySelectorAll(".formTag").forEach(cb => {
            cb.checked = (book.tags || []).includes(cb.value);
        });
    }
    setTimeout(()=>document.getElementById("f_title").focus(),50);
}

function closeForm() {
    const modal = document.getElementById("formModal");
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
    document.getElementById("editingIndex").value = "-1";
    document.getElementById("newTagInput").value = "";
}

function saveForm() {
    const idx = parseInt(document.getElementById("editingIndex").value, 10);
    const title = (document.getElementById("f_title").value || "").trim();
    const author = (document.getElementById("f_author").value || "").trim();
    const yearVal = document.getElementById("f_year").value;
    const year = yearVal === "" ? "" : (isNaN(Number(yearVal)) ? yearVal : Number(yearVal));
    const link = (document.getElementById("f_link").value || "").trim();
    const checked = Array.from(document.querySelectorAll(".formTag:checked")).map(ch => ch.value);

    if (!title || !author) return alert("Please provide at least Title and Author.");

    const uniqueTags = Array.from(new Set(checked)).map(t => t);
    uniqueTags.forEach(t => ensureTagExists(t));
    uniqueTags.sort((a,b)=>a.localeCompare(b));

    const bookObj = { title, author, year, link, tags: uniqueTags };

    if (idx >= 0 && idx < books.length) {
        books[idx] = bookObj;
    } else {
        books.push(bookObj);
    }
    saveBooks();
    updateDropdowns();
    renderAll();
    closeForm();
}

function deleteFromForm() {
    const idx = parseInt(document.getElementById("editingIndex").value, 10);
    if (idx >= 0 && idx < books.length) {
        if (!confirm("Delete this book?")) return;
        books.splice(idx, 1);
        saveBooks();
        updateDropdowns();
        renderAll();
        closeForm();
    }
}

function deleteBook(index) {
    if (!confirm("Delete this book?")) return;
    books.splice(index, 1);
    saveBooks();
    updateDropdowns();
    renderAll();
}

// --- Delete tag globally ---
function deleteTag(tagName) {
    const tagObj = findTagByName(tagName);
    if (!tagObj) return;

    const usedCount = books.filter(b => (b.tags || []).includes(tagName)).length;
    let msg = `Delete tag "${tagName}"?`;
    if (usedCount > 0) msg = `Tag "${tagName}" is used in ${usedCount} book(s). Delete anyway?`;

    if (!confirm(msg)) return;

    // remove from books
    books.forEach(b => {
        if (b.tags) b.tags = b.tags.filter(t => t !== tagName);
    });
    saveBooks();

    // remove from tags list
    tags = tags.filter(t => t.name !== tagName);
    saveTags();

    renderAll();
}

// --- Import / Export ---
function exportBackup() {
    const data = JSON.stringify({ books, tags }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "books_tags_backup.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

function importBackup(event) {
    const fileInput = event.target;
    const file = fileInput.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        try {
            const parsed = JSON.parse(reader.result);
            if (parsed.books && Array.isArray(parsed.books)) books = parsed.books;
            if (parsed.tags && Array.isArray(parsed.tags)) {
                tags = parsed.tags.map(t=>{
                    if (typeof t === "string") return { name: t, color: colorForTagName(t) };
                    return { name: t.name, color: t.color || colorForTagName(t.name) };
                }).sort((a,b)=>a.name.localeCompare(b.name));
            }
            saveBooks();
            saveTags();
            renderAll();
            alert("Import successful.");
        } catch (e) {
            console.error(e);
            alert("Invalid JSON file.");
        } finally {
            // Reset input so same file can be re-selected
            fileInput.value = "";
        }
    };
    reader.readAsText(file);
}

// --- Add custom tag from input (global) ---
function addCustomTagFromInput() {
    const val = (document.getElementById("newTagInput").value || "").trim();
    if (!val) return;
    const t = ensureTagExists(val);
    if (t) {
        setTimeout(()=> {
            const cb = document.querySelector(`.formTag[value="${escapeHtml(t.name)}"]`);
            if (cb) cb.checked = true;
        }, 50);
        document.getElementById("newTagInput").value = "";
    }
}

// --- Initialization ---
function renderAll() {
    renderTagControls();
    updateDropdowns();
    applyFilters();
}

function init() {
    PREDEFINED_TAGS.forEach(pt => {
        if (!findTagByName(pt.name)) tags.push(pt);
    });
    tags.sort((a,b)=>String(a.name).localeCompare(String(b.name)));
    saveTags();
    renderAll();
}

init();

// close modal when clicking outside the card
document.getElementById("formModal").addEventListener("click", (e)=>{
    if (e.target === document.getElementById("formModal")) closeForm();
});
