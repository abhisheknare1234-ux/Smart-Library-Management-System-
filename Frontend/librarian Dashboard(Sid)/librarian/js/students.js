// ==========================================
// LIBRARIAN STUDENTS (MEMBERS) MANAGEMENT
// Powered by Library Hub Backend API (LibAPI)
// ==========================================

const LibAPI = window.LibAPI;
let students = [];
let editStudentId = null;

// Elements
const addStudentButton = document.querySelector(".add-student-btn");
const studentModal = document.getElementById("addStudentModal");
const closeStudentButton = document.getElementById("closeStudentModal");
const cancelStudentButton = document.querySelector(".cancel-btn");
const studentForm = document.getElementById("studentForm");
const searchStudent = document.getElementById("searchStudent");
const tableBody = document.querySelector(".students-table tbody");

// Open Modal
if (addStudentButton) {
    addStudentButton.addEventListener("click", function () {
        studentForm.reset();
        editStudentId = null;
        const idInput = document.getElementById("studentId");
        if (idInput) idInput.disabled = false;
        studentModal.style.display = "flex";
    });
}

// Close Modal
function closeModal() {
    if (studentModal) studentModal.style.display = "none";
}

if (closeStudentButton) closeStudentButton.addEventListener("click", closeModal);
if (cancelStudentButton) cancelStudentButton.addEventListener("click", closeModal);
window.addEventListener("click", function (event) {
    if (event.target === studentModal) closeModal();
});

// Load Students from Real Backend
async function loadStudents() {
    if (!tableBody) return;
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px;">Loading students...</td></tr>`;

    try {
        students = await LibAPI.getStudents();
        renderStudentTable(students);
    } catch (err) {
        console.error("Failed to load students:", err);
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red; padding: 20px;">Failed to load students.</td></tr>`;
    }
}

function renderStudentTable(list) {
    tableBody.innerHTML = "";

    if (!list.length) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 20px; color: #64748b;">No students found.</td></tr>`;
        return;
    }

    list.forEach(function (student) {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td>${student.id}</td>
            <td>${student.name}</td>
            <td>${student.course || student.department || "General"}</td>
            <td>${student.year || student.type || "Student"}</td>
            <td>${student.phone || "-"}</td>
            <td>
                <span class="status ${student.status === 'Active' ? 'active' : 'inactive'}">
                    ${student.status || 'Active'}
                </span>
            </td>
            <td>
                <button class="edit-btn" data-id="${student.id}" title="Edit Student">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="delete-btn" data-id="${student.id}" title="Delete Student">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    // Attach row events
    tableBody.querySelectorAll(".edit-btn").forEach(btn => {
        btn.addEventListener("click", () => editStudent(btn.getAttribute("data-id")));
    });
    tableBody.querySelectorAll(".delete-btn").forEach(btn => {
        btn.addEventListener("click", () => deleteStudent(btn.getAttribute("data-id")));
    });
}

// Edit Student
function editStudent(id) {
    const student = students.find(s => s.id === id);
    if (!student) return;

    editStudentId = id;
    const idInput = document.getElementById("studentId");
    if (idInput) {
        idInput.value = student.id;
        idInput.disabled = true; // Primary key cannot change
    }

    const nameInput = document.getElementById("studentName");
    if (nameInput) nameInput.value = student.name;

    const courseSelect = document.getElementById("studentCourse");
    if (courseSelect) courseSelect.value = student.course || student.department || "";

    const yearSelect = document.getElementById("studentYear");
    if (yearSelect) yearSelect.value = student.year || student.type || "Student";

    const phoneInput = document.getElementById("studentPhone");
    if (phoneInput) phoneInput.value = student.phone || "";

    const emailInput = document.getElementById("studentEmail");
    if (emailInput) emailInput.value = student.email || "";

    studentModal.style.display = "flex";
}

// Save / Update Student
studentForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const id = document.getElementById("studentId")?.value.trim();
    const name = document.getElementById("studentName")?.value.trim();
    const course = document.getElementById("studentCourse")?.value;
    const year = document.getElementById("studentYear")?.value;
    const phone = document.getElementById("studentPhone")?.value.trim();
    const email = document.getElementById("studentEmail")?.value.trim() || `${(id || name || "student").toLowerCase().replace(/[^a-z0-9]/g, "")}@student.lib`;

    if (!name) {
        alert("Please enter student name.");
        return;
    }

    const studentData = { id, name, course, year, phone, email };

    try {
        if (editStudentId === null) {
            // Add new student
            const res = await LibAPI.addStudent(studentData);
            if (!res.success) {
                alert(res.message || "Failed to add student.");
                return;
            }
            alert(`Student added successfully! Default login password is 'member123'.`);
        } else {
            // Update student
            const res = await LibAPI.updateStudent(editStudentId, studentData);
            if (!res.success) {
                alert(res.message || "Failed to update student.");
                return;
            }
            alert("Student updated successfully!");
        }

        closeModal();
        studentForm.reset();
        editStudentId = null;
        await loadStudents();
    } catch (err) {
        console.error("Save student error:", err);
        alert("Error communicating with server.");
    }
});

// Delete Student
async function deleteStudent(id) {
    if (!confirm(`Are you sure you want to delete student ID ${id}?`)) return;

    try {
        const res = await LibAPI.deleteStudent(id);
        if (!res.success) {
            alert(res.message || "Failed to delete student.");
            return;
        }
        alert("Student deleted successfully!");
        await loadStudents();
    } catch (err) {
        console.error("Delete error:", err);
        alert("Failed to delete student.");
    }
}

// Search Filter
if (searchStudent) {
    searchStudent.addEventListener("input", function () {
        const query = searchStudent.value.trim().toLowerCase();
        if (!query) {
            renderStudentTable(students);
            return;
        }
        const filtered = students.filter(s =>
            (s.name && s.name.toLowerCase().includes(query)) ||
            (s.id && s.id.toLowerCase().includes(query)) ||
            (s.course && s.course.toLowerCase().includes(query)) ||
            (s.phone && s.phone.includes(query))
        );
        renderStudentTable(filtered);
    });
}

document.addEventListener("DOMContentLoaded", loadStudents);