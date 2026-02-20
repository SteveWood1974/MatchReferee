// wwwroot/js/common.js
// Core shared logic: navbar, footer, auth state, Firebase init, alerts, etc.
// Top-level blocking IIFE: DOM ready → Firebase → Navbar HTML → Auth UI → Footer

console.log("[common.js] File loaded - timestamp:", Date.now());

// Globals
window.firebaseApp = null;
window.firebaseAuth = null;

// ────────────────────────────────────────────────
// Firebase Initialization (awaited)
// ────────────────────────────────────────────────
async function initFirebase() {
    if (window.firebaseAuth) {
        console.log("[common.js] Firebase already initialized");
        return window.firebaseAuth;
    }

    console.log("[common.js] Starting Firebase init");
    try {
        const resp = await fetch('/api/config/firebase');
        if (!resp.ok) throw new Error(`Config fetch failed: ${resp.status}`);
        const config = await resp.json();

        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
        const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');

        window.firebaseApp = initializeApp(config);
        window.firebaseAuth = getAuth(window.firebaseApp);

        console.log("[common.js] Firebase initialized OK");
        window.dispatchEvent(new Event('firebaseReady'));
        return window.firebaseAuth;
    } catch (err) {
        console.error("[common.js] Firebase init FAILED:", err);
        window.dispatchEvent(new CustomEvent('firebaseError', { detail: err.message || "Unknown error" }));
        throw err;
    }
}

// ────────────────────────────────────────────────
// Sign Out
// ────────────────────────────────────────────────
window.signOut = async function () {
    if (!window.firebaseAuth) {
        console.warn("[common.js] Cannot sign out – Firebase auth not initialized");
        return;
    }
    try {
        await window.firebaseAuth.signOut();
        console.log("[common.js] User signed out successfully");
        location.href = '/';
    } catch (err) {
        console.error("[common.js] Sign out failed:", err);
    }
};

// ────────────────────────────────────────────────
// Header alert helpers (unsaved changes) – unchanged
// ────────────────────────────────────────────────
window.showUnsavedChangesAlert = function () {
    const alert = document.getElementById('header-alert');
    const mainContent = document.getElementById('navbarMainContent');
    if (alert) {
        alert.classList.remove('d-none');
        alert.querySelector('#globalAlertInner').innerHTML = `
            <div class="row g-0 w-100 align-items-center flex-nowrap">
                <!-- Column 1: Icon – fixed width -->
                <div class="col-auto pe-2">
                    <i class="fas fa-exclamation-triangle me-2" style="color: #dd9000; font-size: 1.25rem;"></i>
                </div>
                <!-- Column 2: Message – expands, no wrap, truncates -->
                <div class="col flex-grow-1 overflow-hidden">
                    <span class="d-block text-truncate fw-medium" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        Unsaved changes. Save or discard before leaving this page.
                    </span>
                </div>
                <!-- Column 3: Save button – fixed/minimal width -->
                <div class="col-auto ps-3">
                    <button type="button" class="btn btn-sm btn-outline-secondary text-white me-2" onclick="document.getElementById('profileEditForm')?.dispatchEvent(new Event('submit'));">
                        Save
                    </button>
                </div>
                <!-- Column 4: Ignore button – fixed/minimal width -->
                <div class="col-auto">
                    <button type="button" class="btn btn-sm btn-danger" onclick="window.hideHeaderAlert();">
                        <i class="fa fa-xmark"></i>
                    </button>
                </div>
            </div>
        `;
        console.log("[common.js] Unsaved changes alert SHOWN");
    }
    if (mainContent && alert) {
        const alertHeight = alert.offsetHeight || 50;
        mainContent.style.paddingTop = `${alertHeight}px`;
    }
};

window.hideHeaderAlert = function () {
    const alert = document.getElementById('header-alert');
    const mainContent = document.getElementById('navbarMainContent');
    if (alert) {
        alert.classList.add('d-none');
        alert.querySelector('#globalAlertInner').innerHTML = '';
        console.log("[common.js] Unsaved changes alert HIDDEN");
    }
    if (mainContent) {
        mainContent.style.paddingTop = '0';
    }
};

// ────────────────────────────────────────────────
// Navbar loading
// ────────────────────────────────────────────────
async function loadNavbar() {
    try {
        console.log("[common.js] Loading navbar...");
        const resp = await fetch('/parts/navbar.html');
        if (!resp.ok) throw new Error(`Navbar fetch failed: ${resp.status}`);
        const html = await resp.text();
        document.getElementById('navbar').innerHTML = html;
        console.log("[common.js] Navbar loaded successfully");

        // Setup auth UI only after HTML is inserted
        setupNavbarAuth();
    } catch (err) {
        console.error("[common.js] Navbar load failed:", err);
    }
}

// ────────────────────────────────────────────────
// Footer loading
// ────────────────────────────────────────────────
async function loadFooter() {
    try {
        console.log("[common.js] Loading footer...");
        const resp = await fetch('/parts/footer.html');
        if (!resp.ok) throw new Error(`Footer fetch failed: ${resp.status}`);
        const html = await resp.text();
        document.getElementById('footer').innerHTML = html;
        console.log("[common.js] Footer loaded");
    } catch (err) {
        console.error("[common.js] Footer load failed:", err);
    }
}

// ────────────────────────────────────────────────
// Navbar Auth UI Setup
// ────────────────────────────────────────────────
function setupNavbarAuth() {
    console.log("[common.js] setupNavbarAuth executing");

    const signinEl = document.getElementById('navbar-signin');
    const profileEl = document.getElementById('navbar-profile');
    const profilePic = document.getElementById('navbar-profile-pic');

    if (!signinEl || !profileEl || !profilePic) {
        console.error("[common.js] Navbar auth elements missing – IDs must be: navbar-signin, navbar-profile, navbar-profile-pic");
        return;
    }

    if (!window.firebaseAuth) {
        console.error("[common.js] Firebase auth not ready in setupNavbarAuth");
        return;
    }

    // Initial state: hide both until auth resolves
    signinEl.classList.add('d-none');
    profileEl.classList.add('d-none');

    // Auth state listener
    window.firebaseAuth.onAuthStateChanged(user => {
        console.log("[common.js] Auth state changed – user logged in:", !!user);
        if (user) {
            signinEl.classList.add('d-none');
            profileEl.classList.remove('d-none');
            profilePic.src = user.photoURL || "/img/default-user.png";
            profilePic.onerror = () => { profilePic.src = "/img/default-user.png"; };
        } else {
            signinEl.classList.remove('d-none');
            profileEl.classList.add('d-none');
        }
    });

    // NEW: Listen for profile photo updates – preserved unchanged
    window.addEventListener('profilePhotoUpdated', (event) => {
        console.log("[common.js] Received profilePhotoUpdated – new URL:", event.detail.photoURL);
        const profilePic = document.getElementById('navbar-profile-pic');
        if (profilePic) {
            const newSrc = event.detail.photoURL + '?t=' + Date.now();
            profilePic.src = newSrc;
            console.log("[common.js] Navbar profile pic updated to:", newSrc);
        } else {
            console.warn("[common.js] Navbar profile pic not found during photo update");
        }
    });
}

// ────────────────────────────────────────────────
// Top-level blocking startup sequence
// ────────────────────────────────────────────────
(async () => {
    // 1. Wait for DOM ready
    await new Promise(resolve => {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', resolve, { once: true });
        } else {
            resolve();
        }
    });
    console.log("[common.js] DOM ready");

    // 2. Await Firebase init
    try {
        await initFirebase();
        console.log("[common.js] Firebase ready – proceeding to load navbar");
    } catch (err) {
        console.error("[common.js] Firebase init failed – continuing without auth");
    }

    // 3. Await navbar load (includes auth setup after HTML)
    await loadNavbar();

    // 4. Await footer load (no dependency)
    await loadFooter();

    // 5. Initialize all Bootstrap tooltips (runs last, catches dynamic content)
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    [...tooltipTriggerList].map(tooltipTriggerEl =>
        new bootstrap.Tooltip(tooltipTriggerEl)
    );
    console.log("[common.js] Bootstrap tooltips initialized");

})();    