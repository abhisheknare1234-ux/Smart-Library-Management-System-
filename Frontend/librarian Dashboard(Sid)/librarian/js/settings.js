// ==========================================
// REAL SETTINGS MANAGEMENT (CONNECTED TO BACKEND API)
// ==========================================

const libraryName = document.getElementById("libraryName");
const libraryAddress = document.getElementById("libraryAddress");
const libraryContact = document.getElementById("libraryContact");
const libraryEmail = document.getElementById("libraryEmail");
const maxBooks = document.getElementById("maxBooks");
const loanDays = document.getElementById("loanDays");
const finePerDay = document.getElementById("finePerDay");
const saveSettings = document.getElementById("saveSettings");
const resetSettings = document.getElementById("resetSettings");
const clearDatabase = document.getElementById("clearDatabase");

// ==========================================
// LOAD SETTINGS FROM BACKEND
// ==========================================
async function loadSettings() {
    try {
        const settings = await LibAPI.getSettings();
        libraryName.value = settings.library_name || "Library Hub";
        libraryAddress.value = settings.library_address || "Central Campus Library, 1st Floor";
        libraryContact.value = settings.library_contact || "+91 98765 43210";
        libraryEmail.value = settings.library_email || "support@libraryhub.edu";
        maxBooks.value = settings.max_books_per_member || 3;
        loanDays.value = settings.loan_days || 14;
        finePerDay.value = settings.fine_per_day || 5;
    } catch (err) {
        console.error("Failed to load settings:", err);
    }
}

// ==========================================
// SAVE SETTINGS TO BACKEND
// ==========================================
saveSettings.addEventListener("click", async function() {
    saveSettings.disabled = true;
    saveSettings.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Saving...`;

    try {
        const payload = {
            library_name: libraryName.value.trim(),
            library_address: libraryAddress.value.trim(),
            library_contact: libraryContact.value.trim(),
            library_email: libraryEmail.value.trim(),
            max_books_per_member: parseInt(maxBooks.value, 10) || 3,
            loan_days: parseInt(loanDays.value, 10) || 14,
            fine_per_day: parseFloat(finePerDay.value) || 5
        };

        const res = await LibAPI.updateSettings(payload);
        if (res.success) {
            alert("Settings saved successfully to the database!");
        } else {
            alert(res.message || "Failed to save settings.");
        }
    } catch (err) {
        console.error("Save error:", err);
        alert("Server error while saving settings.");
    } finally {
        saveSettings.disabled = false;
        saveSettings.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Save Settings`;
    }
});

// ==========================================
// RESTORE DEFAULT SETTINGS
// ==========================================
resetSettings.addEventListener("click", async function() {
    const confirmReset = confirm("Restore default library settings?");
    if (!confirmReset) return;

    resetSettings.disabled = true;
    resetSettings.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Restoring...`;

    try {
        const defaults = {
            library_name: "Library Hub",
            library_address: "Central Campus Library, 1st Floor",
            library_contact: "+91 98765 43210",
            library_email: "support@libraryhub.edu",
            max_books_per_member: 3,
            loan_days: 14,
            fine_per_day: 5
        };

        const res = await LibAPI.updateSettings(defaults);
        if (res.success) {
            await loadSettings();
            alert("Default settings restored successfully.");
        } else {
            alert(res.message || "Failed to restore defaults.");
        }
    } catch (err) {
        console.error("Reset error:", err);
        alert("Server error while restoring defaults.");
    } finally {
        resetSettings.disabled = false;
        resetSettings.innerHTML = `<i class="fa-solid fa-rotate-left"></i> Restore Default`;
    }
});

// ==========================================
// CLEAR DATABASE (ADMIN ONLY WARNING)
// ==========================================
clearDatabase.addEventListener("click", function() {
    alert("Notice: Database purge is restricted to the System Administrator via the Admin Panel Backup & Maintenance section.");
});

// ==========================================
// INITIAL LOAD
// ==========================================
document.addEventListener("DOMContentLoaded", loadSettings);
