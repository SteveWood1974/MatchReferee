// wwwroot/js/common.js
// Core shared logic: navbar, footer, auth state, Firebase init, alerts, etc.

console.log("[common.js] File top loaded - timestamp:", Date.now());

// Global variables
window.firebaseApp = null;
window.firebaseAuth = null;
let firebaseInitPromise = null;
let navbarAuthSetupDone = false;

// ────────────────────────────────────────────────
// Firebase Initialization (single source of truth)
// ────────────────────────────────────────────────
window.initFirebase = async function () {
    if (window.firebaseAuth) {
        console.log("[common.js] Firebase already initialized – returning existing instance");
        return window.firebaseAuth;
    }

    if (firebaseInitPromise) {
        console.log("[common.js] Firebase init already in progress – waiting...");
        return firebaseInitPromise;
    }

    firebaseInitPromise = (async () => {
        try {
            console.log("[common.js] initFirebase started");
            console.log("[common.js] Fetching Firebase config from /api/config/firebase...");

            const response = await fetch('/api/config/firebase');
            if (!response.ok) {
                throw new Error(`Config fetch failed: ${response.status} ${response.statusText}`);
            }
            const config = await response.json();
            console.log("[common.js] Firebase config loaded successfully");

            console.log("[common.js] Importing firebase-app...");
            const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');

            console.log("[common.js] Importing firebase-auth...");
            const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');

            console.log("[common.js] Initializing Firebase app...");
            window.firebaseApp = initializeApp(config);

            console.log("[common.js] Creating auth instance...");
            window.firebaseAuth = getAuth(window.firebaseApp);

            // Optional – only uncomment if you really need browser-language auth emails
            // window.firebaseAuth.useDeviceLanguage();

            console.log("[common.js] Firebase initialized successfully");
            window.dispatchEvent(new Event('firebaseReady'));

            return window.firebaseAuth;
        } catch (err) {
            console.error("[common.js] Firebase initialization FAILED:", err);
            console.error(err.stack);
            window.dispatchEvent(new CustomEvent('firebaseError', { detail: err.message || "Unknown error" }));
            throw err;
        } finally {
            firebaseInitPromise = null;
        }
    })();

    return firebaseInitPromise;
};

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
// Header alert helpers (unsaved changes)
// ────────────────────────────────────────────────
window.showUnsavedChangesAlert = function () {
    const alert = document.getElementById('header-alert');
    const mainContent = document.getElementById('navbarMainContent');

    if (alert) {
        alert.classList.remove('d-none');
        // Fill content (restore your previous 4-column layout)
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

    // Push main content down by the alert's height
    if (mainContent && alert) {
        const alertHeight = alert.offsetHeight || 50; // fallback
        mainContent.style.paddingTop = `${alertHeight}px`;
    }
};

window.hideHeaderAlert = function () {
    const alert = document.getElementById('header-alert');
    const mainContent = document.getElementById('navbarMainContent');

    if (alert) {
        alert.classList.add('d-none');
        alert.querySelector('#globalAlertInner').innerHTML = ''; // clear content
        console.log("[common.js] Unsaved changes alert HIDDEN");
    }

    // Reset padding
    if (mainContent) {
        mainContent.style.paddingTop = '0';
    }
};

// ────────────────────────────────────────────────
// Navbar & Footer loading
// ────────────────────────────────────────────────
window.loadNavbar = async function () {
    console.log("[common.js] loadNavbar() started");
    try {
        const resp = await fetch('/parts/navbar.html');
        if (!resp.ok) throw new Error(`Navbar fetch failed: ${resp.status}`);
        const html = await resp.text();
        document.getElementById('navbar').innerHTML = html;
        console.log("[common.js] Navbar loaded successfully");

        // Only call auth setup AFTER navbar HTML is inserted
        window.setupNavbarAuth();
    } catch (err) {
        console.error("[common.js] Navbar load failed:", err);
    }
};

window.loadFooter = async function () {
    console.log("[common.js] loadFooter() started");
    try {
        const resp = await fetch('/parts/footer.html');
        if (!resp.ok) throw new Error(`Footer fetch failed: ${resp.status}`);
        const html = await resp.text();
        document.getElementById('footer').innerHTML = html;
        console.log("[common.js] Footer loaded");
    } catch (err) {
        console.error("[common.js] Footer load failed:", err);
    }
};

// ────────────────────────────────────────────────
// Navbar auth UI setup – called ONLY ONCE after navbar is loaded
// ────────────────────────────────────────────────
window.setupNavbarAuth = async function () {
    if (navbarAuthSetupDone) {
        console.log("[common.js] Navbar auth already set up – skipping");
        return;
    }

    console.log("[common.js] setupNavbarAuth() executing");

    if (!window.firebaseAuth) {
        console.log("[common.js] Waiting for Firebase in navbar auth setup...");
        try {
            await window.initFirebase();
        } catch (err) {
            console.error("[common.js] Firebase init failed for navbar auth");
            return;
        }
    }

    const signinEl = document.getElementById('navbar-signin');
    const profileEl = document.getElementById('navbar-profile');
    const profilePic = document.getElementById('navbar-profile-pic');

    if (!signinEl || !profileEl || !profilePic) {
        console.warn("[common.js] Navbar auth elements missing – IDs must be: navbar-signin, navbar-profile, navbar-profile-pic");
        return;
    }

    console.log("[common.js] Navbar auth elements found – setting initial state");

    // Initial state: assume logged out
    signinEl.classList.remove('d-none');
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

    // NEW: Listen for profile photo updates
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

    navbarAuthSetupDone = true;
};

// ────────────────────────────────────────────────
// DOM ready – initialize shared features (once)
// ────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    console.log("[common.js] DOMContentLoaded");

    // Save original button texts for loading states (if used elsewhere)
    document.querySelectorAll('button').forEach(btn => {
        btn.dataset.originalText = btn.innerHTML;
    });

    // Load shared components – only here
    window.loadNavbar();
    window.loadFooter();

    // Start Firebase early (non-blocking)
    window.initFirebase().catch(err => {
        console.error("[common.js] Early Firebase init failed:", err);
    });
});