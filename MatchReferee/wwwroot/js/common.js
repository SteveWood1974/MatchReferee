// =============================================================
// wwwroot/js/common.js
// Reusable across all pages
// Load with: <script src="/js/common.js"></script>
// =============================================================

console.log("[common.js] File top loaded - timestamp:", Date.now());

let firebaseApp = null;
let firebaseAuth = null;

console.log("[common.js] Global variables initialized (firebaseApp, firebaseAuth = null)");

// Global sign out - define early so it's always available
window.signOut = function () {
    console.log("[common.js] signOut() called");

    if (!window.firebaseAuth) {
        console.warn("[common.js] Firebase auth not ready - cannot sign out");
        return;
    }

    console.log("[common.js] Signing out via Firebase Auth...");
    window.firebaseAuth.signOut()
        .then(() => {
            console.log("[common.js] Sign out successful - redirecting to /");
            location.href = '/';
        })
        .catch(err => {
            console.error("[common.js] Sign out failed:", err.message || err);
            console.error("[common.js] Stack:", err.stack);
        });
};

console.log("[common.js] window.signOut defined");

/**
 * Initialize Firebase once and expose globally
 */
window.initFirebase = async function () {
    console.log("[common.js] initFirebase() called");

    if (firebaseAuth) {
        console.log("[common.js] Firebase already initialized - returning existing auth");
        return firebaseAuth;
    }

    try {
        console.log("[common.js] Fetching Firebase config from /api/config/firebase...");
        const resp = await fetch('/api/config/firebase');
        if (!resp.ok) {
            throw new Error(`Failed to load Firebase config - status: ${resp.status}`);
        }
        const cfg = await resp.json();
        console.log("[common.js] Firebase config loaded successfully");

        console.log("[common.js] Importing firebase-app.js...");
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
        console.log("[common.js] Importing firebase-auth.js...");
        const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');

        console.log("[common.js] Initializing Firebase app...");
        firebaseApp = initializeApp(cfg);
        console.log("[common.js] Firebase app initialized");

        console.log("[common.js] Getting auth instance...");
        firebaseAuth = getAuth(firebaseApp);
        console.log("[common.js] Firebase auth instance created");

        window.firebaseApp = firebaseApp;
        window.firebaseAuth = firebaseAuth;

        console.log("[common.js] Dispatching firebaseReady event");
        window.dispatchEvent(new Event('firebaseReady'));

        console.log("[common.js] initFirebase completed successfully");
        return firebaseAuth;
    } catch (err) {
        console.error("[common.js] Firebase init failed:", err.message || err);
        console.error("[common.js] Stack:", err.stack);
        throw err;
    }
};

/**
 * Initialize Firebase + run callback when ready
 */
window.initFirebasePage = async function (callback) {
    console.log("[common.js] initFirebasePage() called - callback type:", typeof callback);

    try {
        console.log("[common.js] Calling initFirebase()...");
        await window.initFirebase();
        console.log("[common.js] Firebase ready - executing callback");

        if (typeof callback === 'function') {
            console.log("[common.js] Executing provided callback");
            callback();
        } else {
            console.log("[common.js] No callback provided or not a function");
        }
    } catch (err) {
        console.error("[common.js] initFirebasePage failed:", err.message || err);
        window.showError?.('Failed to initialize app. Please try again.');
    }
};

/**
 * Sets up navbar sign in/profile state + dropdown when logged in
 */
window.setupNavbarAuth = async function () {
    console.log("[common.js] setupNavbarAuth() called");

    if (!window.firebaseAuth) {
        console.log("[common.js] Firebase auth not ready - initializing...");
        try {
            await window.initFirebase();
            console.log("[common.js] Firebase auth initialized in setupNavbarAuth");
        } catch (err) {
            console.error("[common.js] Failed to initialize Firebase for navbar:", err.message || err);
            return;
        }
    }

    const auth = window.firebaseAuth;
    const signinEl = document.getElementById('signin');
    const profileEl = document.getElementById('profile');
    const profilePic = document.getElementById('navbarProfilePic');

    console.log("[common.js] Navbar elements:", {
        signinEl: !!signinEl,
        profileEl: !!profileEl,
        profilePic: !!profilePic
    });

    if (!signinEl || !profileEl) {
        console.warn("[common.js] Signin or profile element missing in navbar");
        return;
    }

    // CRITICAL: BOTH start hidden and STAY hidden until we know the real state
    signinEl.classList.add('d-none');
    profileEl.classList.add('d-none');
    console.log("[common.js] Signin & profile elements hidden initially");

    // Function to update UI
    const updateUI = (user) => {
        console.log("[common.js] updateUI called - user exists:", !!user, "verified:", user?.emailVerified);

        if (user) {
            console.log("[common.js] User logged in - showing profile dropdown");
            signinEl.classList.add('d-none');
            profileEl.classList.remove('d-none');

            if (profilePic) {
                const photoUrl = user.photoURL || "/img/default-user.png";
                console.log("[common.js] Setting navbar profile pic:", photoUrl);
                profilePic.src = photoUrl;
                profilePic.onerror = () => {
                    console.warn("[common.js] Profile pic load failed - using default");
                    profilePic.src = "/img/default-user.png";
                };
            }
        } else {
            console.log("[common.js] No user - showing Sign In link");
            signinEl.classList.remove('d-none');
            profileEl.classList.add('d-none');
        }
    };

    console.log("[common.js] Waiting for first auth state callback...");
    const firstUser = await new Promise((resolve) => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            console.log("[common.js] First auth callback received - unsubscribing");
            unsubscribe(); // only listen once for initial state
            resolve(user);
        });
    });

    console.log("[common.js] Applying initial auth state");
    updateUI(firstUser);

    console.log("[common.js] Setting up continuous auth listener");
    auth.onAuthStateChanged(updateUI);

    console.log("[common.js] Listening for profilePhotoUpdated event");
    window.addEventListener('profilePhotoUpdated', (e) => {
        console.log("[common.js] profilePhotoUpdated event received", e.detail);

        const tryUpdate = () => {
            const profilePic = document.getElementById('navbarProfilePic');
            if (profilePic && e.detail?.photoURL) {
                const newSrc = e.detail.photoURL + '?t=' + Date.now();
                console.log("[common.js] Updating navbar avatar:", newSrc);
                profilePic.src = newSrc;
            } else {
                console.log("[common.js] Profile pic element or URL missing - retrying in 300ms");
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
    console.log("[common.js] loadNavbar() started - fetching /parts/navbar.html");

    fetch('/parts/navbar.html')
        .then(r => {
            console.log("[common.js] Navbar fetch response:", r.status, r.ok ? "OK" : "Failed");
            if (!r.ok) throw new Error('Navbar load failed: ' + r.status);
            return r.text();
        })
        .then(html => {
            console.log("[common.js] Navbar HTML received - length:", html.length);
            const navbarEl = document.getElementById('navbar');
            if (navbarEl) {
                console.log("[common.js] Inserting navbar HTML");
                navbarEl.innerHTML = html;

                if (typeof window.setupNavbarAuth === 'function') {
                    console.log("[common.js] Calling setupNavbarAuth after insert");
                    window.setupNavbarAuth();
                } else {
                    console.warn("[common.js] setupNavbarAuth not available");
                }
            } else {
                console.error("[common.js] #navbar element not found");
            }
        })
        .catch(err => {
            console.error("[common.js] Navbar load error:", err.message || err);
            const navbarEl = document.getElementById('navbar');
            if (navbarEl) {
                navbarEl.innerHTML = '<p class="text-danger text-center">Navigation error</p>';
            }
        });
};

/**
 * Load footer - SAME PATTERN AS NAVBAR
 */
window.loadFooter = function () {
    console.log("[common.js] loadFooter() started - fetching /parts/footer.html");

    fetch('/parts/footer.html')
        .then(r => {
            console.log("[common.js] Footer fetch response:", r.status, r.ok ? "OK" : "Failed");
            if (!r.ok) throw new Error('Footer load failed');
            return r.text();
        })
        .then(html => {
            console.log("[common.js] Footer HTML received - length:", html.length);
            const footerEl = document.getElementById('footer');
            if (footerEl) {
                console.log("[common.js] Inserting footer HTML");
                footerEl.innerHTML = html;
            } else {
                console.warn("[common.js] #footer element not found");
            }
        })
        .catch(err => {
            console.error("[common.js] Footer load error:", err.message || err);
        });
};

/**
 * Show error
 */
window.showError = function (msg) {
    console.log("[common.js] showError called - message:", msg);

    const errEl = document.getElementById('error');
    if (errEl) {
        errEl.textContent = msg;
        errEl.classList.remove('d-none');
        console.log("[common.js] Error displayed in #error element");
    } else {
        console.warn("[common.js] #error element not found - cannot show message");
    }
};

/**
 * Button loading state
 */
window.setButtonLoading = function (btn, loading = true) {
    console.log("[common.js] setButtonLoading called - loading:", loading, "button:", btn?.id || 'unknown');

    if (!btn) {
        console.warn("[common.js] Button not provided to setButtonLoading");
        return;
    }

    btn.disabled = loading;
    if (loading) {
        btn.textContent = 'Processing...';
        console.log("[common.js] Button set to loading state");
    } else {
        btn.textContent = btn.dataset.originalText || 'Submit';
        console.log("[common.js] Button restored - text:", btn.textContent);
    }
};

// Optional: Save original button text
document.addEventListener('DOMContentLoaded', () => {
    console.log("[common.js] DOMContentLoaded - saving original button texts");
    document.querySelectorAll('button').forEach(btn => {
        if (btn.textContent.trim()) {
            btn.dataset.originalText = btn.textContent.trim();
            console.log("[common.js] Saved original text for button:", btn.id || btn.textContent.trim());
        }
    });
});

/**
 * Reusable Header Alert
 */
// Flag to prevent re-entrant / duplicate calls
let isAlertShowing = false;
window.showHeaderAlert = function (htmlContent, onSaveCallback = null) {
    console.log("[common.js] showHeaderAlert called - timestamp:", Date.now());
    console.log("[common.js] Alert HTML length:", htmlContent?.length || 0);

    const alertEl = document.getElementById('globalHeaderAlert');
    const mainContentEl = document.getElementById('navbarMainContent');
    const innerEl = document.getElementById('globalAlertInner');

    if (!alertEl || !innerEl) {
        console.warn("[common.js] globalHeaderAlert or inner element missing");
        return;
    }

    if (isAlertShowing && innerEl.innerHTML === htmlContent) {
        console.log("[common.js] Alert already showing with same content - skipping");
        return;
    }

    console.log("[common.js] Showing alert - setting isAlertShowing = true");
    isAlertShowing = true;

    console.log("[common.js] Setting inner HTML");
    innerEl.innerHTML = htmlContent;
    alertEl.classList.remove('d-none');
    console.log("[common.js] Alert element shown");

    setTimeout(() => {
        console.log("[common.js] Attaching save listener (delayed)");
        const saveBtn = innerEl.querySelector('.alert-save-btn');
        if (saveBtn && typeof onSaveCallback === 'function') {
            console.log("[common.js] Save button found - attaching click listener");
            const clone = saveBtn.cloneNode(true);
            saveBtn.parentNode.replaceChild(clone, saveBtn);

            clone.addEventListener('click', (e) => {
                console.log("[common.js] Save button clicked - running callback");
                onSaveCallback(e);
            }, { once: true });
        } else {
            console.warn("[common.js] No .alert-save-btn found or no callback");
        }
    }, 50);

    setTimeout(() => {
        if (mainContentEl) {
            const alertHeight = alertEl.offsetHeight || 36;
            console.log("[common.js] Setting main content padding-top:", alertHeight);
            mainContentEl.style.paddingTop = alertHeight + 'px';
        } else {
            console.warn("[common.js] #navbarMainContent not found - no padding adjustment");
        }
    }, 0);
};

window.hideHeaderAlert = function () {
    console.log("[common.js] hideHeaderAlert called");

    const alertEl = document.getElementById('globalHeaderAlert');
    const mainContentEl = document.getElementById('navbarMainContent');

    if (alertEl) {
        console.log("[common.js] Hiding alert");
        alertEl.classList.add('d-none');
        isAlertShowing = false;
    } else {
        console.warn("[common.js] #globalHeaderAlert not found");
    }

    if (mainContentEl) {
        console.log("[common.js] Resetting main content padding-top to 0");
        mainContentEl.style.paddingTop = '0';
    } else {
        console.warn("[common.js] #navbarMainContent not found");
    }
};

// Your unsaved changes trigger
window.showUnsavedChangesAlert = function () {
    console.log("[common.js] showUnsavedChangesAlert called");

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
            <div class="flex-shrink-0 ms-2">
                <button type="button" class="btn-close btn-close-white fs-6"
                        onclick="hideHeaderAlert()" aria-label="Close"></button>
            </div>
        </div>
    `, () => {
        console.log("[common.js] Save Now clicked - dispatching submit");
        const form = document.getElementById('profileEditForm');
        if (form) {
            console.log("[common.js] profileEditForm found - submitting");
            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        } else {
            console.warn("[common.js] profileEditForm not found - cannot submit");
        }
    });
};

console.log("[common.js] Header alert helpers loaded - timestamp:", Date.now());
console.log("[common.js] window.showUnsavedChangesAlert type:", typeof window.showUnsavedChangesAlert);