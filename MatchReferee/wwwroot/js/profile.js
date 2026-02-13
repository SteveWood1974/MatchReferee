// wwwroot/js/profile.js
// Load with: <script type="module" src="/js/profile.js"></script>

window.initProfilePictureUpload = async function () {
    // Ensure Firebase is initialized
    if (!window.firebaseAuth || !window.firebaseApp) {
        if (typeof window.initFirebase === 'function') {
            await window.initFirebase();
        } else {
            console.error("Firebase init function not found");
            return;
        }
    }

    const auth = window.firebaseAuth;

    // Wait for authenticated user (handles auth state restoration delay)
    const user = await new Promise((resolve) => {
        const unsubscribe = auth.onAuthStateChanged((u) => {
            if (u) {
                unsubscribe();
                resolve(u);
            }
        });
    });

    if (!user) {
        console.warn("No authenticated user after waiting");
        return;
    }

    console.log("Authenticated user loaded:", user.uid);

    // Load Storage functions
    let getStorage, ref, uploadBytesResumable, getDownloadURL;
    try {
        const storageMod = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js');
        getStorage = storageMod.getStorage;
        ref = storageMod.ref;
        uploadBytesResumable = storageMod.uploadBytesResumable;
        getDownloadURL = storageMod.getDownloadURL;
    } catch (err) {
        console.error("Failed to load Firebase Storage:", err);
        return;
    }

    // Load updateProfile
    let updateProfile;
    try {
        const authMod = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
        updateProfile = authMod.updateProfile;
    } catch (err) {
        console.error("Failed to load updateProfile:", err);
        return;
    }

    // DOM elements
    const fileInput = document.getElementById("profilePictureInput");
    const previewImg = document.getElementById("imagePreview");
    const uploadBtn = document.getElementById("uploadProfilePicBtn");
    const statusEl = document.getElementById("uploadStatus");
    const currentPic = document.getElementById("currentProfilePic");

    // Show current photo if exists
    if (user.photoURL) {
        currentPic.src = user.photoURL + '?t=' + Date.now();
    } else {
        currentPic.src = "/img/default-user.png";
    }

    // Preview on file select
    fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) {
            uploadBtn.disabled = true;
            previewImg.classList.add("d-none");
            return;
        }

        if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) {
            statusEl.textContent = file.type.startsWith("image/") ? "File too large (max 2MB)" : "Please select an image file";
            statusEl.className = "text-danger";
            uploadBtn.disabled = true;
            return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
            previewImg.src = ev.target.result;
            previewImg.classList.remove("d-none");
        };
        reader.readAsDataURL(file);

        uploadBtn.disabled = false;
        statusEl.textContent = "";
    });

    // Upload handler
    uploadBtn.addEventListener("click", async () => {
        const file = fileInput.files[0];
        if (!file) return;

        uploadBtn.disabled = true;
        statusEl.textContent = "Uploading...";
        statusEl.className = "text-muted";

        try {
            const storage = getStorage(window.firebaseApp);
            const ext = file.name.split('.').pop() || 'jpg';
            const storageRef = ref(storage, `profile-pictures/${user.uid}/photo.${ext}`);

            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
                    statusEl.textContent = `Uploading... ${progress}%`;
                },
                (error) => {
                    console.error("Upload error:", error);
                    statusEl.textContent = "Upload failed: " + (error.message || "unknown");
                    statusEl.className = "text-danger";
                    uploadBtn.disabled = false;
                },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

                    await updateProfile(user, { photoURL: downloadURL });

                    currentPic.src = downloadURL + '?t=' + Date.now();
                    previewImg.classList.add("d-none");
                    fileInput.value = "";
                    uploadBtn.disabled = true;

                    statusEl.textContent = "Profile picture updated successfully!";
                    statusEl.className = "text-success";
                }
            );
        } catch (err) {
            console.error("Upload setup failed:", err);
            statusEl.textContent = "Error: " + (err.message || "failed to start upload");
            statusEl.className = "text-danger";
            uploadBtn.disabled = false;
        }
    });
};

// Call on page load (safe even if called multiple times)
document.addEventListener("DOMContentLoaded", () => {
    window.initProfilePictureUpload?.();
});