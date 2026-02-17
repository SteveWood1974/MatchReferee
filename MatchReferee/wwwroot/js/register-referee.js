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
async function register(role) {
    console.log("[register] ENTERED - role:", role, "timestamp:", Date.now());
    if (!validateForm()) {
        console.warn("[register] Exiting early - validation failed");
        return;
    }
    console.log("[register] Validation passed - collecting form values");
    const firstName = document.getElementById('firstName')?.value.trim() || '';
    const lastName = document.getElementById('lastName')?.value.trim() || '';
    const email = document.getElementById('email')?.value.trim() || '';
    const pwd = document.getElementById('password')?.value || '';
    const error = document.getElementById('error');
    console.log("[register] Collected:", { firstName, lastName, email, pwdLength: pwd.length });
    try {
        console.log("[register] Enabling loading state");
        window.setButtonLoading(document.getElementById('btn'), true);
        console.log("[register] Importing Firebase Auth modules...");
        const { createUserWithEmailAndPassword, sendEmailVerification, updateProfile } =
            await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
        console.log("[register] Calling createUserWithEmailAndPassword...");
        const cred = await createUserWithEmailAndPassword(window.firebaseAuth, email, pwd);
        console.log("[register] Firebase Auth success - UID:", cred.user.uid);
        const user = cred.user;
        console.log("[register] Updating displayName...");
        await updateProfile(user, {
            displayName: `${firstName} ${lastName}`.trim()
        });
        console.log("[register] displayName updated");
        console.log("[register] Reloading user...");
        await user.reload();
        console.log("[register] User reloaded");
        console.log("[register] Sending email verification...");
        await sendEmailVerification(user);
        console.log("[register] Email verification sent");
        console.log("[register] Getting ID token...");
        const token = await user.getIdToken();
        console.log("[register] ID token obtained (length:", token.length, ")");
        console.log("[register] Sending to backend /api/auth/register...");
        const resp = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                IdToken: token,
                FirstName: firstName,
                LastName: lastName,
                Role: role.toLowerCase()
            })
        });
        console.log("[register] Backend response status:", resp.status);
        if (!resp.ok) {
            const errText = await resp.text();
            console.error("[register] Backend failed:", resp.status, errText);
            throw new Error(errText);
        }
        console.log("[register] Backend success");
        alert('Check your email to verify. Now complete your profile.');
        location.href = '/secure/profile';
    } catch (e) {
        console.error("[register] ERROR:", e.code || e.name || 'Unknown', e.message);
        console.error("[register] Stack:", e.stack);
        window.showError(e.message || 'Registration failed');
    } finally {
        console.log("[register] Cleaning up - disabling loading state");
        window.setButtonLoading(document.getElementById('btn'), false);
    }
    console.log("[register] EXITED");
}