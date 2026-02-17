// =============================================================
// wwwroot/js/common.js
// Reusable across all pages
// Load with: <script src="/js/common.js"></script>
// =============================================================

console.log("common.js top loaded"); // Debug: confirm file starts executing

let firebaseApp = null;
let firebaseAuth = null;

// Global sign out - define early so it's always available
window.signOut = function () {
    if (!window.firebaseAuth) {
        console.warn("Firebase auth not ready - cannot sign out");
        return;
    }
    window.firebaseAuth.signOut().then(() => {
        location.href = '/';
    }).catch(err => {
        console.error('Sign out failed:', err);
    });
};

/**
 * Initialize Firebase once and expose globally
 */
window.initFirebase = async function () {
    if (firebaseAuth) return firebaseAuth;

    try {
        const resp = await fetch('/api/config/firebase');
        if (!resp.ok) throw new Error('Failed to load Firebase config');
        const cfg = await resp.json();

        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
        const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');

        firebaseApp = initializeApp(cfg);
        firebaseAuth = getAuth(firebaseApp);

        window.firebaseApp = firebaseApp;
        window.firebaseAuth = firebaseAuth;
        window.dispatchEvent(new Event('firebaseReady'));

        return firebaseAuth;
    } catch (err) {
        console.error('Firebase init failed:', err);
        throw err;
    }
};

/**
 * Initialize Firebase + run callback when ready
 */
window.initFirebasePage = async function (callback) {
    try {
        await window.initFirebase();
        if (typeof callback === 'function') callback();
    } catch (err) {
        window.showError?.('Failed to initialize app. Please try again.');
    }
};

/**
 * Sets up navbar sign in/profile state + dropdown when logged in
 */
window.setupNavbarAuth = async function () {
    if (!window.firebaseAuth) {
        try {
            await window.initFirebase();
        } catch (err) {
            console.error('Failed to initialize Firebase for navbar:', err);
            return;
        }
    }

    const auth = window.firebaseAuth;
    const signinEl = document.getElementById('signin');
    const profileEl = document.getElementById('profile');
    const profilePic = document.getElementById('navbarProfilePic');

    if (!signinEl || !profileEl) {
        console.warn("Signin or profile element missing in navbar");
        return;
    }

    // CRITICAL: BOTH start hidden and STAY hidden until we know the real state
    signinEl.classList.add('d-none');
    profileEl.classList.add('d-none');

    // Function to update UI
    const updateUI = (user) => {
        console.log("updateUI - user exists:", !!user, "verified:", user?.emailVerified);

        if (user) {
            // Logged in (verified or not) → show Account
            signinEl.classList.add('d-none');
            profileEl.classList.remove('d-none');

            if (profilePic) {
                profilePic.src = user.photoURL || "/img/default-user.png";
                profilePic.onerror = () => { profilePic.src = "/img/default-user.png"; };
            }
        } else {
            // Not logged in → show Sign In
            signinEl.classList.remove('d-none');
            profileEl.classList.add('d-none');
        }
    };

    // Wait for the FIRST real auth callback (this ensures we have the final state)
    const firstUser = await new Promise((resolve) => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            unsubscribe(); // only listen once for initial state
            resolve(user);
        });
    });

    // Apply the correct state immediately
    updateUI(firstUser);

    // Keep listening for future changes (login/logout)
    auth.onAuthStateChanged(updateUI);

    // Listen for profile photo updates (dispatched from profile page)
    window.addEventListener('profilePhotoUpdated', (e) => {
        const tryUpdate = () => {
            const profilePic = document.getElementById('navbarProfilePic');
            if (profilePic && e.detail?.photoURL) {
                profilePic.src = e.detail.photoURL + '?t=' + Date.now();
                console.log("Navbar avatar updated");
            } else {
                // Retry once if element not ready
                setTimeout(tryUpdate, 300);
            }
        };
        tryUpdate();
    });
};

/**
 * Load navbar + setup auth
 */
window.loadNavbar = function () {
    fetch('/parts/navbar.html')
        .then(r => {
            if (!r.ok) throw new Error('Navbar load failed');
            return r.text();
        })
        .then(html => {
            const navbarEl = document.getElementById('navbar');
            if (navbarEl) {
                navbarEl.innerHTML = html;
                // IMPORTANT: Call auth setup after navbar is inserted
                if (typeof window.setupNavbarAuth === 'function') {
                    window.setupNavbarAuth();
                }
            }
        })
        .catch(err => {
            const navbarEl = document.getElementById('navbar');
            if (navbarEl) navbarEl.innerHTML = '<p class="text-danger text-center">Navigation error</p>';
            console.error(err);
        });
};

/**
 * Load footer - SAME PATTERN AS NAVBAR
 */
window.loadFooter = function () {
    fetch('/parts/footer.html')
        .then(r => {
            if (!r.ok) throw new Error('Footer load failed');
            return r.text();
        })
        .then(html => {
            const footerEl = document.getElementById('footer');
            if (footerEl) footerEl.innerHTML = html;
        })
        .catch(err => {
            console.error('Footer load failed:', err);
        });
};

/**
 * Toggle Affiliation Number field (register.html)
 * Runs on DOMContentLoaded
 */
window.toggleAffiliationField = function () {
    const userType = document.getElementById('userType');
    const affGroup = document.getElementById('affiliationGroup');
    const affInput = document.getElementById('affiliation');

    if (!userType || !affGroup || !affInput) return;

    const toggle = () => {
        if (userType.value === 'Referee') {
            affGroup.classList.remove('d-none');
            affInput.required = true;
        } else {
            affGroup.classList.add('d-none');
            affInput.required = false;
            affInput.value = '';
        }
    };

    toggle();
    userType.addEventListener('change', toggle);
};

// Auto-run when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.toggleAffiliationField();
});

/**
 * Show error
 */
window.showError = function (msg) {
    const errEl = document.getElementById('error');
    if (errEl) {
        errEl.textContent = msg;
        errEl.classList.remove('d-none');
    }
};

/**
 * Button loading state
 */
window.setButtonLoading = function (btn, loading = true) {
    if (!btn) return;
    btn.disabled = loading;
    btn.textContent = loading ? 'Processing...' : btn.dataset.originalText || 'Submit';
};

// Optional: Save original button text
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('button').forEach(btn => {
        if (btn.textContent.trim()) {
            btn.dataset.originalText = btn.textContent.trim();
        }
    });
});

/**
 * Reusable Header Alert
 */
// Flag to prevent re-entrant / duplicate calls
let isAlertShowing = false;

window.showHeaderAlert = function (htmlContent, onSaveCallback = null) {
    const alertEl = document.getElementById('globalHeaderAlert');
    const mainContentEl = document.getElementById('navbarMainContent');
    const innerEl = document.getElementById('globalAlertInner');

    if (!alertEl || !innerEl) {
        console.warn('globalHeaderAlert not found');
        return;
    }

    // Skip if already showing the same content (prevents overwrite)
    if (isAlertShowing && innerEl.innerHTML === htmlContent) {
        console.log('Alert already showing with same content - skipping');
        return;
    }

    isAlertShowing = true;

    innerEl.innerHTML = htmlContent;
    alertEl.classList.remove('d-none');

    // Re-attach listener safely after content set
    setTimeout(() => {
        const saveBtn = innerEl.querySelector('.alert-save-btn');
        if (saveBtn && typeof onSaveCallback === 'function') {
            console.log('Attaching click listener NOW');

            // Remove old listeners to avoid accumulation (if any)
            const clone = saveBtn.cloneNode(true);
            saveBtn.parentNode.replaceChild(clone, saveBtn);

            // Attach fresh one
            clone.addEventListener('click', (e) => {
                console.log('Save button clicked - executing callback');
                onSaveCallback(e);
                // Optional: hide alert after save attempt
                // hideHeaderAlert();
            }, { once: true });
        } else {
            console.warn('No save button or callback');
        }
    }, 50);

    // Padding
    setTimeout(() => {
        if (mainContentEl) {
            const alertHeight = alertEl.offsetHeight || 36;
            mainContentEl.style.paddingTop = alertHeight + 'px';
        }
    }, 0);
};

window.hideHeaderAlert = function () {
    const alertEl = document.getElementById('globalHeaderAlert');
    const mainContentEl = document.getElementById('navbarMainContent');

    if (alertEl) {
        alertEl.classList.add('d-none');
        isAlertShowing = false;
    }
    if (mainContentEl) mainContentEl.style.paddingTop = '0';
};

// Your unsaved changes trigger - same as before but now protected
window.showUnsavedChangesAlert = function () {
    window.showHeaderAlert(`
        <div class="d-flex align-items-center w-100 gap-3 flex-nowrap">
            <!-- Icon -->
            <div class="flex-shrink-0">
                <i class="fas fa-exclamation-triangle text-warning fs-6"></i>
            </div>

            <!-- Message -->
            <div class="flex-grow-1 text-truncate">
                <span class="fw-medium fs-6">Unsaved changes</span>
            </div>

            <!-- Action button -->
            <div class="flex-shrink-0">
                <button type="button" class="btn btn-link text-white p-0 text-decoration-underline alert-save-btn fs-6">
                    Save Now
                </button>
            </div>

            <!-- Small separation + Close button -->
            <div class="flex-shrink-0 ms-2">  <!-- ← ms-2 adds ~0.5rem margin-start (left in LTR) -->
                <button type="button" class="btn-close btn-close-white fs-6"
                        onclick="hideHeaderAlert()" aria-label="Close"></button>
            </div>
        </div>
    `, () => {
        console.log('Dispatching submit on first click');
        const form = document.getElementById('profileEditForm');
        if (form) {
            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        } else {
            console.warn('profileEditForm not found');
        }
    });
};


console.log("Header alert helpers loaded"); // Debug: MUST appear in console if this code ran
console.log("window.showUnsavedChangesAlert type:", typeof window.showUnsavedChangesAlert); // Should say "function"