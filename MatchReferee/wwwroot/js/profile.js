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

    // Wait for authenticated user
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
    let getStorage, ref, uploadBytesResumable, getDownloadURL, listAll, deleteObject;
    try {
        const storageMod = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js');
        getStorage = storageMod.getStorage;
        ref = storageMod.ref;
        uploadBytesResumable = storageMod.uploadBytesResumable;
        getDownloadURL = storageMod.getDownloadURL;
        listAll = storageMod.listAll;
        deleteObject = storageMod.deleteObject;
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

    // DOM elements - declare early
    const fileInput = document.getElementById("profilePictureInput");
    const previewImg = document.getElementById("imagePreview");
    const uploadBtn = document.getElementById("uploadProfilePicBtn");
    const statusEl = document.getElementById("uploadStatus");
    const currentPic = document.getElementById("currentProfilePic");
    const photoLoader = document.getElementById("photoLoader");

    // Safety check for photo elements
    if (!currentPic || !photoLoader) {
        console.error("Current profile pic or loader element not found");
        return;
    }

    // Show current photo if exists - with delay & load detection
    currentPic.classList.add('opacity-0'); // start hidden

    if (user.photoURL) {
        const photoUrl = user.photoURL + '?t=' + Date.now();
        currentPic.src = photoUrl;

        currentPic.onload = () => {
            photoLoader.classList.add('hidden');
            setTimeout(() => {
                currentPic.classList.remove('opacity-0');
                currentPic.classList.add('opacity-100');
            }, 400);
        };

        currentPic.onerror = () => {
            currentPic.src = "/img/default-user.png";
            photoLoader.classList.add('hidden');
            setTimeout(() => {
                currentPic.classList.remove('opacity-0');
                currentPic.classList.add('opacity-100');
            }, 400);
        };
    } else {
        currentPic.src = "/img/default-user.png";
        photoLoader.classList.add('hidden');
        setTimeout(() => {
            currentPic.classList.remove('opacity-0');
            currentPic.classList.add('opacity-100');
        }, 400);
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

    // Upload handler with old photo deletion
    uploadBtn.addEventListener("click", async () => {
        const file = fileInput.files[0];
        if (!file) return;

        uploadBtn.disabled = true;
        statusEl.textContent = "Preparing upload...";
        statusEl.className = "text-muted";

        try {
            const storage = getStorage(window.firebaseApp);
            const ext = file.name.split('.').pop() || 'jpg';
            const userFolderRef = ref(storage, `profile-pictures/${user.uid}`);

            // Delete old photo files
            const folderSnapshot = await listAll(userFolderRef);
            for (const itemRef of folderSnapshot.items) {
                if (itemRef.name.toLowerCase().startsWith("photo.")) {
                    try {
                        await deleteObject(itemRef);
                        console.log(`Deleted old file: ${itemRef.name}`);
                    } catch (deleteErr) {
                        if (deleteErr.code === 'storage/object-not-found') {
                            console.log(`No old file to delete (already gone): ${itemRef.name}`);
                        } else {
                            console.warn(`Failed to delete ${itemRef.name}:`, deleteErr.message);
                        }
                    }
                }
            }

            // Upload new file
            const newFileRef = ref(storage, `profile-pictures/${user.uid}/photo.${ext}`);
            const uploadTask = uploadBytesResumable(newFileRef, file);

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

                    // Notify navbar to update avatar
                    console.log("Upload success - dispatching profilePhotoUpdated event");
                    console.log("New photoURL:", downloadURL);
                    window.dispatchEvent(new CustomEvent('profilePhotoUpdated', {
                        detail: { photoURL: downloadURL }
                    }));
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

// Call on page load
document.addEventListener("DOMContentLoaded", () => {
    window.initProfilePictureUpload?.();
});