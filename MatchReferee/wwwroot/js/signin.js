// wwwroot/js/signin.js
// Standalone sign-in and password reset logic

console.log("[signin.js] Loaded – timestamp:", Date.now());

import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

async function waitForFirebaseAuth() {
    if (window.firebaseAuth) {
        console.log("[signin.js] Firebase auth already ready");
        return window.firebaseAuth;
    }

    console.log("[signin.js] Waiting for Firebase auth...");

    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error("Firebase auth timeout after 15 seconds"));
        }, 15000);

        const onReady = () => {
            clearTimeout(timeoutId);
            window.removeEventListener('firebaseReady', onReady);
            window.removeEventListener('firebaseError', onError);
            console.log("[signin.js] Firebase auth ready");
            resolve(window.firebaseAuth);
        };

        const onError = (event) => {
            clearTimeout(timeoutId);
            window.removeEventListener('firebaseReady', onReady);
            window.removeEventListener('firebaseError', onError);
            console.error("[signin.js] Firebase init error:", event.detail);
            reject(new Error("Firebase initialization failed"));
        };

        window.addEventListener('firebaseReady', onReady, { once: true });
        window.addEventListener('firebaseError', onError, { once: true });

        // Trigger initialization if not already started
        window.initFirebase?.().catch(() => { });
    });
}

async function initializeSignIn() {
    try {
        const auth = await waitForFirebaseAuth();

        // Enable sign-in button
        const signinBtn = document.getElementById('signinBtn');
        if (signinBtn) {
            signinBtn.disabled = false;
            signinBtn.textContent = 'Sign In';
            signinBtn.addEventListener('click', signin);
        }

        // Redirect if already signed in
        auth.onAuthStateChanged((user) => {
            if (user) {
                console.log("[signin.js] User already signed in – redirecting");
                location.href = '/secure/landing';
            }
        });

    } catch (err) {
        console.error("[signin.js] Initialization failed:", err);
        const errorEl = document.getElementById('error');
        if (errorEl) {
            errorEl.textContent = "Unable to connect to sign-in service. Please refresh the page.";
            errorEl.classList.remove('d-none');
        }
    }
}

async function signin() {
    const email = document.getElementById('email')?.value.trim();
    const password = document.getElementById('password')?.value;
    const errorEl = document.getElementById('error');

    if (!email || !password) {
        if (errorEl) {
            errorEl.textContent = "Please enter both email and password.";
            errorEl.classList.remove('d-none');
        }
        return;
    }

    try {
        if (errorEl) errorEl.classList.add('d-none');

        const auth = window.firebaseAuth;
        if (!auth) throw new Error("Auth not available");

        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        let redirectPath = '/secure/profile';

        try {
            const token = await user.getIdToken();
            const resp = await fetch('/api/profile', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (resp.ok) {
                const profile = await resp.json();
                if (!profile.ProfileCompleted) {
                    redirectPath = '/secure/profile';
                }
            }
        } catch (profileErr) {
            console.warn("[signin.js] Could not check profile completion:", profileErr);
        }

        console.log("[signin.js] Sign-in successful – redirecting to:", redirectPath);
        location.href = redirectPath;

    } catch (e) {
        let message = 'Login failed. Please check your email and password.';
        if (e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password') {
            message = 'Invalid email or password.';
        } else if (e.code === 'auth/user-disabled') {
            message = 'This account has been disabled.';
        } else if (e.code === 'auth/too-many-requests') {
            message = 'Too many failed attempts. Try again later.';
        } else if (e.code === 'auth/invalid-credential') {
            message = 'Invalid credentials.';
        } else if (e.message) {
            message = e.message;
        }

        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.remove('d-none');
        } else {
            alert(message);
        }
        console.error("[signin.js] Sign-in error:", e);
    }
}

// Forgot Password / Reset Logic
function initResetPassword() {
    const forgotLink = document.getElementById('forgotPassword');
    const resetSection = document.getElementById('resetSection');
    const sendResetBtn = document.getElementById('sendResetBtn');
    const cancelReset = document.getElementById('cancelReset');
    const resetEmailInput = document.getElementById('resetEmail');
    const successEl = document.getElementById('success');
    const errorEl = document.getElementById('error');

    forgotLink?.addEventListener('click', (e) => {
        e.preventDefault();
        resetSection.classList.remove('d-none');
        resetEmailInput.focus();
        resetEmailInput.value = document.getElementById('email')?.value.trim() || '';
    });

    cancelReset?.addEventListener('click', () => {
        resetSection.classList.add('d-none');
        successEl.classList.add('d-none');
        errorEl.classList.add('d-none');
    });

    sendResetBtn?.addEventListener('click', async () => {
        const email = resetEmailInput.value.trim();
        if (!email) {
            errorEl.textContent = 'Please enter your email address.';
            errorEl.classList.remove('d-none');
            return;
        }

        sendResetBtn.disabled = true;
        sendResetBtn.textContent = 'Sending...';
        errorEl.classList.add('d-none');
        successEl.classList.add('d-none');

        try {
            await sendPasswordResetEmail(window.firebaseAuth, email);
            successEl.textContent = 'If your email was recognised, we have sent a password reset email. Check your inbox (and spam/junk).';
            successEl.classList.remove('d-none');
            resetEmailInput.value = '';
            setTimeout(() => resetSection.classList.add('d-none'), 6000);
        } catch (e) {
            let message = 'Failed to send reset email.';
            if (e.code === 'auth/user-not-found') message = 'No account found with that email.';
            else if (e.code === 'auth/invalid-email') message = 'Invalid email address.';
            else if (e.code === 'auth/too-many-requests') message = 'Too many requests – wait a few minutes.';
            else if (e.message) message = e.message;

            errorEl.textContent = message;
            errorEl.classList.remove('d-none');
        } finally {
            sendResetBtn.disabled = false;
            sendResetBtn.textContent = 'Send Reset Email';
        }
    });
}

// Initialize everything when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
    console.log("[signin.js] DOMContentLoaded – initializing");
    initializeSignIn();
    initResetPassword();
});