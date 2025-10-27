// =============================================================
//  wwwroot/js/common.js
//  Reusable across all pages
//  Load with: <script src="/js/common.js"></script>
// =============================================================

let firebaseApp = null;
let firebaseAuth = null;

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
 * Sets up navbar sign in/profile state
 */
window.setupNavbarAuth = function () {
    if (!window.firebaseAuth) return;

    const auth = window.firebaseAuth;
    const signin = document.getElementById('signin');
    const profile = document.getElementById('profile');
    const nameEl = document.getElementById('userName');

    if (!signin || !profile || !nameEl) return;

    auth.onAuthStateChanged(user => {
        if (user && user.emailVerified) {
            profile.classList.remove('d-none');
            signin.classList.add('d-none');
            nameEl.textContent = user.displayName || user.email.split('@')[0];
        } else {
            signin.classList.remove('d-none');
            profile.classList.add('d-none');
        }
    });

    // Global sign out function
    window.signOut = () => auth.signOut().then(() => location.href = '/');
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
            if (navbarEl) navbarEl.innerHTML = html;
            // Call auth setup after navbar is inserted
            if (typeof window.setupNavbarAuth === 'function') {
                window.setupNavbarAuth();
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

