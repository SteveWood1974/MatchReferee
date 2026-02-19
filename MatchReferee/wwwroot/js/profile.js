// wwwroot/js/profile.js
// Profile-specific logic: photo upload + profile load/save + unsaved changes
console.log("[profile.js] Loaded – timestamp:", Date.now());

function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

// ────────────────────────────────────────────────
// Lazy-load sendEmailVerification (modular v10+)
// ────────────────────────────────────────────────
let sendEmailVerificationFn = null;

async function getSendEmailVerification() {
    if (!sendEmailVerificationFn) {
        const mod = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
        sendEmailVerificationFn = mod.sendEmailVerification;
        console.log("[profile.js] sendEmailVerification imported (modular)");
    }
    return sendEmailVerificationFn;
}

// ────────────────────────────────────────────────
// Wait for Firebase readiness from common.js
// ────────────────────────────────────────────────
async function waitForFirebase() {
    if (window.firebaseAuth) {
        console.log("[profile.js] Firebase already ready (from common.js)");
        return window.firebaseAuth;
    }
    console.log("[profile.js] Waiting for firebaseReady event from common.js...");
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error("Firebase readiness timeout (15s)"));
        }, 15000);
        const onReady = () => {
            clearTimeout(timeout);
            window.removeEventListener('firebaseReady', onReady);
            window.removeEventListener('firebaseError', onError);
            console.log("[profile.js] Firebase ready after wait");
            resolve(window.firebaseAuth);
        };
        const onError = (e) => {
            clearTimeout(timeout);
            window.removeEventListener('firebaseReady', onReady);
            window.removeEventListener('firebaseError', onError);
            console.error("[profile.js] Firebase failed:", e.detail);
            reject(new Error("Firebase initialization failed"));
        };
        window.addEventListener('firebaseReady', onReady, { once: true });
        window.addEventListener('firebaseError', onError, { once: true });
    });
}

// ────────────────────────────────────────────────
// Profile Picture Upload (unchanged)
// ────────────────────────────────────────────────
window.initProfilePictureUpload = async function () {
    console.log("[profile.js] initProfilePictureUpload started");
    let auth;
    try {
        auth = await waitForFirebase();
    } catch (err) {
        console.error("[profile.js] Photo upload unavailable – Firebase issue:", err);
        const status = document.getElementById("uploadStatus");
        if (status) status.textContent = "Photo upload unavailable";
        return;
    }
    const user = await new Promise(resolve => {
        const unsubscribe = auth.onAuthStateChanged(u => {
            if (u) {
                unsubscribe();
                console.log("[profile.js] Auth user ready:", u.uid);
                resolve(u);
            }
        });
    });
    if (!user) {
        console.warn("[profile.js] No authenticated user – skipping photo upload");
        return;
    }
    let getStorage, ref, uploadBytesResumable, getDownloadURL, listAll, deleteObject;
    try {
        const mod = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js');
        ({ getStorage, ref, uploadBytesResumable, getDownloadURL, listAll, deleteObject } = mod);
    } catch (err) {
        console.error("[profile.js] Failed to load Storage:", err);
        return;
    }
    let updateProfile;
    try {
        const mod = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
        updateProfile = mod.updateProfile;
    } catch (err) {
        console.error("[profile.js] Failed to load updateProfile:", err);
        return;
    }
    const fileInput = document.getElementById("profilePictureInput");
    const statusEl = document.getElementById("uploadStatus");
    const currentPic = document.getElementById("currentProfilePic");
    if (!fileInput || !statusEl || !currentPic) {
        console.warn("[profile.js] Missing photo elements");
        return;
    }
    currentPic.src = user.photoURL ? user.photoURL + '?t=' + Date.now() : "/img/default-user.png";
    fileInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) {
            statusEl.textContent = file.type.startsWith("image/") ? "File too large (max 2MB)" : "Select an image";
            statusEl.className = "text-danger";
            return;
        }
        statusEl.textContent = "Preparing...";
        statusEl.className = "text-muted";
        try {
            const storage = getStorage(window.firebaseApp);
            const ext = file.name.split('.').pop() || 'jpg';
            const folderRef = ref(storage, `profile-pictures/${user.uid}`);
            const snapshot = await listAll(folderRef);
            for (const item of snapshot.items) {
                if (item.name.toLowerCase().startsWith("photo.")) {
                    try { await deleteObject(item); } catch (err) {
                        if (err.code !== 'storage/object-not-found') console.warn("Delete failed:", err);
                    }
                }
            }
            const fileRef = ref(storage, `profile-pictures/${user.uid}/photo.${ext}`);
            const task = uploadBytesResumable(fileRef, file);
            task.on('state_changed',
                snap => {
                    const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
                    statusEl.textContent = `Uploading... ${pct}%`;
                },
                err => {
                    console.error("Upload error:", err);
                    statusEl.textContent = "Upload failed";
                    statusEl.className = "text-danger";
                },
                async () => {
                    const url = await getDownloadURL(task.snapshot.ref);
                    await updateProfile(user, { photoURL: url });
                    currentPic.src = url + '?t=' + Date.now();
                    window.dispatchEvent(new CustomEvent('profilePhotoUpdated', {
                        detail: { photoURL: url }
                    }));
                    statusEl.textContent = "Updated!";
                    statusEl.className = "text-success";
                    fileInput.value = "";
                    console.log("[profile.js] Profile photo updated and event dispatched:", url);
                }
            );
        } catch (err) {
            console.error("Upload failed:", err);
            statusEl.textContent = "Error";
            statusEl.className = "text-danger";
        }
    });
    console.log("[profile.js] Photo upload ready");
};

// ────────────────────────────────────────────────
// Profile Page Init (load + save + unsaved changes)
// ────────────────────────────────────────────────
async function initProfilePage() {
    console.log("[profile.js] initProfilePage started");
    const loadingEl = document.getElementById('loading');
    const profileContent = document.getElementById('profileContent');
    const errorEl = document.getElementById('error');
    const form = document.getElementById('profileEditForm');
    if (!loadingEl || !profileContent || !form) {
        console.error("[profile.js] Missing critical elements");
        return;
    }
    let auth;
    try {
        auth = await waitForFirebase();
    } catch (err) {
        console.error("[profile.js] Firebase unavailable:", err);
        errorEl.textContent = "Cannot load profile – connection issue. Try refreshing.";
        errorEl.classList.remove('d-none');
        loadingEl.innerHTML = '<p class="text-danger">Connection error</p>';
        return;
    }
    const { onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            location.href = '/signin';
            return;
        }
        console.log("[profile.js] Authenticated user:", user.uid);
        // Basic user info
        document.getElementById('displayNameHeader').textContent = user.displayName || 'Not set';
        document.getElementById('emailHeader').textContent = user.email;
        document.getElementById('editEmail').value = user.email || '';
        document.getElementById('verified').textContent = user.emailVerified ? 'Verified' : 'Not Verified';
        document.getElementById('verified').className = user.emailVerified ? 'badge brand-green' : 'badge bg-warning';

        // ────────────────────────────────────────────────
        // Email verification resend logic (updated per your request)
        // ────────────────────────────────────────────────
        const resendLink = document.getElementById('resendEmail');
        const verifiedBadge = document.getElementById('verified');

        if (resendLink && verifiedBadge) {
            // Initial visibility
            if (user.emailVerified) {
                resendLink.classList.add('d-none');
                verifiedBadge.textContent = 'Verified';
                verifiedBadge.className = 'badge brand-green';
            } else {
                resendLink.classList.remove('d-none');
                verifiedBadge.textContent = 'Not Verified';
                verifiedBadge.className = 'badge bg-warning';
            }

            // Click handler
            resendLink.addEventListener('click', async (e) => {
                e.preventDefault();

                // Prevent spam clicks (30s cooldown)
                if (resendLink.dataset.disabled === 'true') return;
                resendLink.dataset.disabled = 'true';
                resendLink.style.pointerEvents = 'none';

                try {
                    const sendEmailVerification = await getSendEmailVerification();
                    await sendEmailVerification(user);

                    // Update badge only (no separate span/message)
                    verifiedBadge.textContent = 'Verification Sent';
                    verifiedBadge.className = 'badge bg-info';

                    // Optional: revert badge after 10 seconds (still not verified until user clicks link)
                    setTimeout(() => {
                        if (!user.emailVerified) {
                            verifiedBadge.textContent = 'Not Verified';
                            verifiedBadge.className = 'badge bg-warning';
                        }
                    }, 10000);
                } catch (err) {
                    console.error("[profile.js] Email verification resend failed:", err);
                    document.getElementById('error').textContent =
                        err.code === 'auth/too-many-requests'
                            ? 'Too many requests. Please try again later.'
                            : 'Failed to resend verification email. ' + (err.message || '');
                    document.getElementById('error').classList.remove('d-none');
                } finally {
                    // Re-enable after cooldown
                    setTimeout(() => {
                        resendLink.dataset.disabled = 'false';
                        resendLink.style.pointerEvents = '';
                    }, 30000);
                }
            });
        }

        // ────────────────────────────────────────────────
        // Verification icon logic (unchanged)
        // ────────────────────────────────────────────────
        const emailInput = document.getElementById('editEmail');
        const verificationIcon = document.getElementById('emailVerificationIcon');
        if (emailInput && verificationIcon) {
            emailInput.value = user.email || '';
            if (user.emailVerified) {
                verificationIcon.classList.remove('d-none', 'text-warning');
                verificationIcon.classList.add('text-brand-green');
                verificationIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
            } else {
                verificationIcon.classList.remove('d-none', 'text-brand-green');
                verificationIcon.classList.add('text-warning');
                verificationIcon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
            }
            emailInput.classList.toggle('border-brand-green', user.emailVerified);
            emailInput.classList.toggle('border-warning', !user.emailVerified);
        }

        try {
            const token = await user.getIdToken();
            const resp = await fetch('/api/profile', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!resp.ok) throw new Error(await resp.text());
            const profile = await resp.json();
            document.getElementById('editFirstName').value = profile.firstName || '';
            document.getElementById('editLastName').value = profile.lastName || '';
            document.getElementById('displayNameHeader').textContent = profile.name || user.displayName || 'Not set';
            document.getElementById('editPhone').value = profile.phoneNumber || '';
            document.getElementById('editPostcode').value = profile.postcode || '';
            document.getElementById('editAgeRange').value = profile.ageRange || '';
            document.getElementById('editGender').value = profile.gender || '';
            document.getElementById('editBio').value = profile.bio || '';
            document.getElementById('subscriptionStatus').textContent = profile.subscriptionActive ? 'Active' : 'Inactive';
            document.getElementById('subscriptionStatus').className = profile.subscriptionActive ? 'badge brand-green' : 'badge bg-secondary';
            document.getElementById('joinedDate').textContent = profile.createdAt
                ? new Date(profile.createdAt).toLocaleDateString('en-GB') : '—';
            if (profile.profilePhotoUrl) {
                document.getElementById('currentProfilePic').src = profile.profilePhotoUrl;
            }
            loadingEl.classList.add('d-none');
            profileContent.classList.remove('d-none');

            let formChanged = false;
            let alertTimeout = null;
            const updateAlert = () => {
                if (formChanged) {
                    window.showUnsavedChangesAlert?.();
                    if (alertTimeout) clearTimeout(alertTimeout);
                } else {
                    if (alertTimeout) clearTimeout(alertTimeout);
                    alertTimeout = setTimeout(() => {
                        window.hideHeaderAlert?.();
                        alertTimeout = null;
                    }, 400);
                }
            };
            form.querySelectorAll('input, select, textarea').forEach(el => {
                ['input', 'change'].forEach(evt => {
                    el.addEventListener(evt, () => {
                        formChanged = true;
                        updateAlert();
                    });
                });
            });

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = form.querySelector('button[type="submit"]');
                btn.disabled = true;
                btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Saving...';
                try {
                    const token = await auth.currentUser.getIdToken();
                    const formData = new FormData(form);
                    const resp = await fetch('/api/profile', {
                        method: 'PUT',
                        headers: { 'Authorization': `Bearer ${token}` },
                        body: formData
                    });
                    if (!resp.ok) throw new Error(await resp.text());
                    document.getElementById('success').classList.remove('d-none');
                    document.getElementById('error').classList.add('d-none');
                    formChanged = false;
                    window.hideHeaderAlert?.();
                    setTimeout(() => location.reload(), 1500);
                } catch (err) {
                    console.error("[profile.js] Save error:", err);
                    document.getElementById('error').textContent = err.message || 'Save failed';
                    document.getElementById('error').classList.remove('d-none');
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-save me-2"></i> Save Changes';
                }
            });
        } catch (err) {
            console.error("[profile.js] Profile load failed:", err);
            errorEl.textContent = 'Could not load profile. ' + (err.message || 'Try again.');
            errorEl.classList.remove('d-none');
            loadingEl.innerHTML = '<p class="text-danger">Load error</p>';
        }
    });
}

// ────────────────────────────────────────────────
// Horizontal tab scroll with arrow indicators (unchanged)
// ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('profileTabsContainer');
    const leftBtn = document.getElementById('scrollLeft');
    const rightBtn = document.getElementById('scrollRight');
    if (!container || !leftBtn || !rightBtn) return;
    function updateArrows() {
        setTimeout(() => {
            const scrollLeft = container.scrollLeft;
            const atStart = scrollLeft <= 0;
            const atEnd = Math.abs(scrollLeft + container.clientWidth - container.scrollWidth) < 1;
            leftBtn.classList.toggle('d-none', atStart);
            rightBtn.classList.toggle('d-none', atEnd);
        }, 50);
    }
    leftBtn.addEventListener('click', () => container.scrollBy({ left: -120, behavior: 'smooth' }));
    rightBtn.addEventListener('click', () => container.scrollBy({ left: 120, behavior: 'smooth' }));
    container.addEventListener('scroll', updateArrows);
    window.addEventListener('resize', updateArrows);
    document.querySelectorAll('#profileTabs button[data-bs-toggle="tab"]').forEach(tab => {
        tab.addEventListener('shown.bs.tab', updateArrows);
    });
    updateArrows();
    setTimeout(updateArrows, 300);
    setTimeout(updateArrows, 600);
});

// ────────────────────────────────────────────────
// Page startup (unchanged)
// ────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    console.log("[profile.js] DOMContentLoaded");
    document.getElementById('signOutBtn')?.addEventListener('click', () => {
        window.signOut?.();
    });
    window.initProfilePictureUpload?.();
    initProfilePage();
});