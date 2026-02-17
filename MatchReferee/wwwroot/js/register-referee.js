// register-referee.js
console.log("[register-referee.js] File top loaded - timestamp:", Date.now());

window.loadNavbar();
console.log("[register-referee.js] loadNavbar() called");

window.loadFooter();
console.log("[register-referee.js] loadFooter() called");

window.setupNavbarAuth?.();
console.log("[register-referee.js] setupNavbarAuth() called (if exists)");

window.initFirebasePage(() => {
    console.log("[register-referee.js] initFirebasePage callback started");

    firebaseAuth.onAuthStateChanged((user) => {
        console.log("[register-referee.js] onAuthStateChanged fired - user:", !!user ? "exists" : "null");
        if (user) {
            console.log("[register-referee.js] User already signed in - UID:", user.uid);
            console.log("[register-referee.js] Redirecting to /secure/landing");
            location.href = '/secure/landing';
        } else {
            console.log("[register-referee.js] No signed-in user detected");
        }
    });

    console.log("[register-referee.js] Looking for register button...");
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
});

// Client-side validation - MOVED UP so it's defined before register()
console.log("[register-referee.js] Setting up form validation");
const form = document.getElementById('form');
const btn = document.getElementById('btn');
const errorEl = document.getElementById('error');
if (!form || !btn || !errorEl) {
    console.error("[register-referee.js] CRITICAL: form, btn or error element missing!");
}

function validateForm() {
    console.log("[validateForm] Running validation - timestamp:", Date.now());
    const firstName = document.getElementById('firstName')?.value.trim() || '';
    const lastName = document.getElementById('lastName')?.value.trim() || '';
    const email = document.getElementById('email')?.value.trim() || '';
    const password = document.getElementById('password')?.value || '';
    const confirmPassword = document.getElementById('confirmPassword')?.value || '';
    console.log("[validateForm] Values:", { firstName, lastName, email, passwordLength: password.length, confirmMatch: password === confirmPassword });
    errorEl.classList.add('d-none');
    errorEl.textContent = '';
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
        errorEl.textContent = 'All fields are required';
        errorEl.classList.remove('d-none');
        btn.disabled = true;
        console.warn("[validateForm] Validation failed: missing fields");
        return false;
    }
    if (password.length < 6) {
        errorEl.textContent = 'Password must be at least 6 characters';
        errorEl.classList.remove('d-none');
        btn.disabled = true;
        console.warn("[validateForm] Validation failed: password too short");
        return false;
    }
    if (password !== confirmPassword) {
        errorEl.textContent = 'Passwords do not match';
        errorEl.classList.remove('d-none');
        btn.disabled = true;
        console.warn("[validateForm] Validation failed: passwords do not match");
        return false;
    }
    btn.disabled = false;
    console.log("[validateForm] Validation PASSED");
    return true;
}

// Attach listeners
if (form) {
    form.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', () => {
            console.log("[input event] Field changed:", input.id || input.name || 'unnamed');
            validateForm();
        });
        input.addEventListener('change', () => {
            console.log("[change event] Field changed:", input.id || input.name || 'unnamed');
            validateForm();
        });
    });
    console.log("[register-referee.js] Validation listeners attached to all inputs");
} else {
    console.error("[register-referee.js] Form element not found - validation listeners NOT attached");
}

// Initial validation
console.log("[register-referee.js] Running initial validation");
validateForm();

// Register function with heavy logging
// Inside register-referee.js — replace the async function register(...)

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

    try {
        // ── Step 1: Loading UI ──
        console.log("[register] Activating loading state on button");
        window.setButtonLoading(document.getElementById('btn'), true);
        errorEl.classList.add('d-none');
        errorEl.textContent = '';

        // ── Step 2: Firebase Auth ──
        console.log("[register] Importing Firebase Auth modules...");
        const { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } =
            await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');

        console.log("[register] Creating user with email/password...");
        const cred = await createUserWithEmailAndPassword(window.firebaseAuth, email, pwd);
        const user = cred.user;
        console.log("[register] Firebase Auth success → UID:", user.uid);

        // ── Step 3: Update display name ──
        console.log("[register] Updating displayName to:", `${firstName} ${lastName}`.trim());
        await updateProfile(user, {
            displayName: `${firstName} ${lastName}`.trim()
        });
        console.log("[register] displayName updated successfully");

        // ── Step 4: Reload to ensure fresh user object ──
        console.log("[register] Reloading user object...");
        await user.reload();
        console.log("[register] User reloaded");

        // ── Step 5: Send verification email ──
        console.log("[register] Sending email verification...");
        await sendEmailVerification(user);
        console.log("[register] Verification email sent successfully");

        // ── Step 6: Get fresh ID token ──
        console.log("[register] Retrieving ID token...");
        const token = await user.getIdToken(/* forceRefresh */ true);  // force refresh for safety
        console.log("[register] ID token acquired (length:", token.length, ")");

        // ── Step 7: Call backend to create profile/DB record ──
        console.log("[register] Sending registration data to backend /api/auth/register...");
        const resp = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // If you later add Authorization header, do it here
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

        const backendData = await resp.json().catch(() => ({})); // optional: parse response if JSON
        console.log("[register] Backend registration SUCCESS:", backendData);

        // ── Only now everything succeeded → show success & redirect ──
        console.log("[register] All steps completed successfully → preparing redirect");
        alert('Registration successful! Check your email to verify your account. Now complete your profile.');

        // Optional: short delay so user sees alert / success state
        await new Promise(resolve => setTimeout(resolve, 800));

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
            userMsg = e.message; // show backend message if available
        }

        window.showError?.(userMsg) || (errorEl.textContent = userMsg, errorEl.classList.remove('d-none'));
    } finally {
        console.log("[register] Cleaning up – resetting button state");
        window.setButtonLoading(document.getElementById('btn'), false);
    }

    console.log("[register] FUNCTION EXITED");
}