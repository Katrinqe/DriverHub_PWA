/* ========================================== */
/* === FIREBASE INIT - THE CLOUD CONNECTION === */
/* ========================================== */

const firebaseConfig = {
  apiKey: "AIzaSyD5pKzbwiM4NRGGyFV1uWIS6dZG30u8ueg",
  authDomain: "driverhub-5a567.firebaseapp.com",
  projectId: "driverhub-5a567",
  storageBucket: "driverhub-5a567.firebasestorage.app",
  messagingSenderId: "977759380742",
  appId: "1:977759380742:web:cc6c0bf4123492aaf62a87",
  measurementId: "G-QWC0ZFBVFT"
};

// 1. Firebase starten
firebase.initializeApp(firebaseConfig);

// 2. Werkzeuge global verfügbar machen
window.auth = firebase.auth();
window.db = firebase.firestore();

// 3. Login-Status Überwacher (Der Türsteher)
window.auth.onAuthStateChanged((user) => {
    if (user) {
        console.log("CLOUD: Verbunden als", user.email);
        // Hier schalten wir später das Login-Overlay aus
        // checkOnboarding(user);
    } else {
        console.log("CLOUD: Kein User eingeloggt.");
        // Hier schalten wir später das Login-Overlay ein
    }
});

console.log("Firebase System: ONLINE");
