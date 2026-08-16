document.addEventListener("DOMContentLoaded", function () {
    const profile = window.getMemberProfile ? getMemberProfile() : LibraryStore.getProfile();
    const form = document.getElementById("profileForm");
    const fullName = document.getElementById("fullName");
    const email = document.getElementById("emailAddress");
    const phone = document.getElementById("phoneNumber");
    const membership = document.getElementById("membershipType");

    if (fullName) fullName.value = profile.fullName || "";
    if (email) email.value = profile.email || "";
    if (phone) phone.value = profile.phone || "";
    if (membership) membership.value = profile.membership || "Student Member";

    const nameDisplay = document.getElementById("profileName");
    const avatarDisplay = document.getElementById("largeAvatar");
    const memberIdDisplay = document.getElementById("displayMemberId");
    const errorBox = document.getElementById("profileError");

    if (nameDisplay) nameDisplay.textContent = profile.fullName;
    if (avatarDisplay) avatarDisplay.textContent = (profile.fullName.trim().charAt(0) || "M").toUpperCase();
    if (memberIdDisplay) memberIdDisplay.textContent = profile.memberId || "member-demo";

    function validateEmail(v) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    }
    function validatePhone(v) {
        if (!v) return true;
        // Allow +, spaces, digits, -, ()
        return /^[+\d\s()\-]{7,20}$/.test(v);
    }

    if (form) {
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            if (errorBox) errorBox.textContent = "";

            const newFullName = fullName.value.trim() || profile.fullName;
            const newEmail = (email.value || "").trim();
            const newPhone = (phone.value || "").trim();
            const newMembership = membership ? membership.value : profile.membership;

            if (!newFullName) {
                if (errorBox) errorBox.textContent = "Full name cannot be empty.";
                return;
            }

            if (!validateEmail(newEmail)) {
                if (errorBox) errorBox.textContent = "Please enter a valid email address.";
                return;
            }

            if (!validatePhone(newPhone)) {
                if (errorBox) errorBox.textContent = "Please enter a valid phone number.";
                return;
            }

            const updatedProfile = {
                ...profile,
                fullName: newFullName,
                email: newEmail || profile.email,
                phone: newPhone || profile.phone,
                membership: newMembership || profile.membership
            };

            LibraryStore.saveProfile(updatedProfile);

            // Update auth session safely
            try {
                const auth = LibraryStore.safeRead("library_auth", {});
                localStorage.setItem("library_auth", JSON.stringify({
                    ...auth,
                    fullName: updatedProfile.fullName,
                    email: updatedProfile.email
                }));
            } catch (_) { }

            if (nameDisplay) nameDisplay.textContent = updatedProfile.fullName;
            if (avatarDisplay) avatarDisplay.textContent = updatedProfile.fullName.charAt(0).toUpperCase();

            if (window.updateMemberIdentity) updateMemberIdentity();
            alert("Profile updated successfully!");
        });
    }

    // Bind change password button (replacing inline onclick)
    const changeBtn = document.getElementById('changePasswordBtn');
    if (changeBtn) changeBtn.addEventListener('click', changePassword);
});

function changePassword() {
    alert("Password change request feature is simulated. Your account is secured.");
}
