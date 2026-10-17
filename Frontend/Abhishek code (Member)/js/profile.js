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

    if (nameDisplay) nameDisplay.textContent = profile.fullName;
    if (avatarDisplay) avatarDisplay.textContent = (profile.fullName.trim().charAt(0) || "M").toUpperCase();
    if (memberIdDisplay) memberIdDisplay.textContent = profile.memberId || "member-demo";

    if (form) {
        form.addEventListener("submit", function (event) {
            event.preventDefault();
            const updatedProfile = {
                ...profile,
                fullName: fullName.value.trim() || profile.fullName,
                email: email.value.trim() || profile.email,
                phone: phone.value.trim() || profile.phone,
                membership: membership ? membership.value : profile.membership
            };

            LibraryStore.saveProfile(updatedProfile);

            // Update auth session
            const auth = LibraryStore.safeRead("library_auth", {});
            localStorage.setItem("library_auth", JSON.stringify({
                ...auth,
                fullName: updatedProfile.fullName,
                email: updatedProfile.email
            }));

            if (nameDisplay) nameDisplay.textContent = updatedProfile.fullName;
            if (avatarDisplay) avatarDisplay.textContent = updatedProfile.fullName.charAt(0).toUpperCase();

            if (window.updateMemberIdentity) updateMemberIdentity();
            alert("Profile updated successfully!");
        });
    }
});

function changePassword() {
    alert("Password change request feature is simulated. Your account is secured.");
}
