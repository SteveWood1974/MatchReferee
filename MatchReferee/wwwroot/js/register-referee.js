// register-referee.js
console.log("[register-referee.js] File top loaded - timestamp:", Date.now());

// ────────────────────────────────────────────────
// Wait for Firebase readiness from common.js
// ────────────────────────────────────────────────
async function waitForFirebase() {
    if (window.firebaseAuth) {
        console.log("[register-referee.js] Firebase already ready (from common.js)");
        return window.firebaseAuth;
    }
    console.log("[register-referee.js] Waiting for firebaseReady event from common.js...");
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error("Firebase readiness timeout (15s)"));
        }, 15000);
        const onReady = () => {
            clearTimeout(timeout);
            window.removeEventListener('firebaseReady', onReady);
            window.removeEventListener('firebaseError', onError);
            console.log("[register-referee.js] Firebase ready after wait");
            resolve(window.firebaseAuth);
        };
        const onError = (e) => {
            clearTimeout(timeout);
            window.removeEventListener('firebaseReady', onReady);
            window.removeEventListener('firebaseError', onError);
            console.error("[register-referee.js] Firebase failed:", e.detail);
            reject(new Error("Firebase initialization failed"));
        };
        window.addEventListener('firebaseReady', onReady, { once: true });
        window.addEventListener('firebaseError', onError, { once: true });
    });
}

// ────────────────────────────────────────────────
// Client-side validation
// ────────────────────────────────────────────────
function validateForm() {
    console.log("[validateForm] Running validation - timestamp:", Date.now());
    const firstName = document.getElementById('firstName')?.value.trim() || '';
    const lastName = document.getElementById('lastName')?.value.trim() || '';
    const email = document.getElementById('email')?.value.trim() || '';
    const password = document.getElementById('password')?.value || '';
    const confirmPassword = document.getElementById('confirmPassword')?.value || '';
    console.log("[validateForm] Values:", { firstName, lastName, email, passwordLength: password.length, confirmMatch: password === confirmPassword });
    const errorEl = document.getElementById('error');
    errorEl.classList.add('d-none');
    errorEl.textContent = '';
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
        errorEl.textContent = 'All fields are required';
        errorEl.classList.remove('d-none');
        document.getElementById('btn').disabled = true;
        console.warn("[validateForm] Validation failed: missing fields");
        return false;
    }
    if (password.length < 6) {
        errorEl.textContent = 'Password must be at least 6 characters';
        errorEl.classList.remove('d-none');
        document.getElementById('btn').disabled = true;
        console.warn("[validateForm] Validation failed: password too short");
        return false;
    }
    if (password !== confirmPassword) {
        errorEl.textContent = 'Passwords do not match';
        errorEl.classList.remove('d-none');
        document.getElementById('btn').disabled = true;
        console.warn("[validateForm] Validation failed: passwords do not match");
        return false;
    }
    document.getElementById('btn').disabled = false;
    console.log("[validateForm] Validation PASSED");
    return true;
}

// Attach validation listeners
document.addEventListener("DOMContentLoaded", () => {
    console.log("[register-referee.js] DOMContentLoaded – attaching validation listeners");
    const form = document.getElementById('form');
    if (form) {
        form.querySelectorAll('input').forEach(input => {
            ['input', 'change'].forEach(evt => {
                input.addEventListener(evt, () => {
                    console.log("[input/change event] Field changed:", input.id || input.name || 'unnamed');
                    validateForm();
                });
            });
        });
        console.log("[register-referee.js] Validation listeners attached to all inputs");
    } else {
        console.error("[register-referee.js] Form element not found - validation listeners NOT attached");
    }
    // Initial validation
    console.log("[register-referee.js] Running initial validation");
    validateForm();
});

// ────────────────────────────────────────────────
// Register function with heavy logging
// ────────────────────────────────────────────────
async function register(role) {
    console.log("[register] ENTERED - role:", role, "timestamp:", Date.now());
    if (!validateForm()) {
        console.warn("[register] Exiting early - validation failed");
        return;
    }

    const firstName = document.getElementById('firstName')?.value.trim() || '';
    const lastName = document.getElementById('lastName')?.value.trim() || '';
    const email = document.getElementById('email')?.value.trim() || '';
    const pwd = document.getElementById('password')?.value || '';
    const errorEl = document.getElementById('error');

    console.log("[register] Collected form data:", { firstName, lastName, email, pwdLength: pwd.length });

    const btn = document.getElementById('btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Registering...';
    errorEl.classList.add('d-none');
    errorEl.textContent = '';

    try {
        // Step 1: Create Firebase user
        console.log("[register] Creating user with email/password...");
        const { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
        const cred = await createUserWithEmailAndPassword(window.firebaseAuth, email, pwd);
        const user = cred.user;
        console.log("[register] Firebase Auth success → UID:", user.uid);

        // Step 2: Get ID token
        console.log("[register] Retrieving ID token...");
        const token = await user.getIdToken(true);
        console.log("[register] ID token acquired");

        // Step 3: Create profile in backend (critical – early)
        console.log("[register] Sending registration data to backend /api/auth/register...");
        const resp = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                IdToken: token,
                FirstName: firstName,
                LastName: lastName,
                Role: role.toLowerCase()
            })
        });

        console.log("[register] Backend responded with status:", resp.status);
        if (!resp.ok) {
            const errText = await resp.text();
            console.error("[register] Backend registration FAILED:", resp.status, errText);
            throw new Error(`Backend error: ${resp.status} - ${errText || 'No details provided'}`);
        }

        const backendData = await resp.json().catch(() => ({}));
        console.log("[register] Backend full response:", backendData);

        // Optional: loose success check (200 + message contains 'success')
        if (backendData.message?.toLowerCase().includes('success')) {
            console.log("[register] Backend confirmed success");
        } else {
            console.warn("[register] Backend returned 200 but no success confirmation in message");
        }

        // Step 4: Update display name
        console.log("[register] Updating displayName...");
        await updateProfile(user, { displayName: `${firstName} ${lastName}`.trim() });
        console.log("[register] displayName updated");

        // Step 5: Send verification email
        console.log("[register] Sending email verification...");
        await sendEmailVerification(user);
        console.log("[register] Verification email sent");

        // Success: delay for DB consistency, then redirect
        console.log("[register] All steps completed – waiting 1.5s for DB commit");
        await new Promise(resolve => setTimeout(resolve, 1500));

        alert('Registration successful! Check your email to verify your account. Now complete your profile.');
        console.log("[register] Redirecting to /secure/profile");
        location.href = '/secure/profile';
    } catch (e) {
        console.error("[register] REGISTRATION FAILED:", e.code || e.name || 'Unknown error', e.message);
        console.error("[register] Full error stack:", e.stack);
        let userMsg = 'Registration failed. Please try again.';
        if (e.code === 'auth/email-already-in-use') {
            userMsg = 'This email is already registered. Please sign in or use a different email.';
        } else if (e.code === 'auth/weak-password') {
            userMsg = 'Password is too weak. Use at least 6 characters with variety.';
        } else if (e.message?.includes('Backend error')) {
            userMsg = e.message;
        }
        if (errorEl) {
            errorEl.textContent = userMsg;
            errorEl.classList.remove('d-none');
        }
    } finally {
        console.log("[register] Cleaning up – resetting button state");
        btn.disabled = false;
        btn.innerHTML = 'Register';
    }
    console.log("[register] FUNCTION EXITED");
}

// ────────────────────────────────────────────────
// Page startup
// ────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
    console.log("[register-referee.js] DOMContentLoaded");

    // Wait for Firebase readiness (from common.js)
    try {
        await waitForFirebase();
        console.log("[register-referee.js] Firebase ready – attaching button");
    } catch (err) {
        console.error("[register-referee.js] Firebase unavailable – button disabled");
        const btn = document.getElementById('btn');
        if (btn) btn.disabled = true;
        return;
    }

    // Redirect if already signed in
    window.firebaseAuth.onAuthStateChanged((user) => {
        if (user) {
            console.log("[register-referee.js] User already signed in – redirecting to /secure/landing");
            //location.href = '/secure/landing';
        }
    });

    // Enable button if valid
    const btn = document.getElementById('btn');
    if (btn) {
        console.log("[register-referee.js] Register button found - enabling");
        btn.disabled = false;
        btn.onclick = () => {
            console.log("[register-referee.js] Register button clicked - calling register('Referee')");
            register('Referee');
        };
    } else {
        console.error("[register-referee.js] Register button (#btn) NOT found!");
    }

    // Initial validation
    validateForm();
});