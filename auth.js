/* ========================================== */
/* === AUTH.JS - LOGIN & SECURITY LOGIC === */
/* ========================================== */

window.AuthLogic = {
    
    init: function() {
        console.log("Auth System: Ready");
        // Wir hören auf den Status, den firebase-init.js bereitstellt
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                console.log("AUTH: User ist eingeloggt:", user.email);
                this.hideLoginScreen();
                
                // HIER SPÄTER: Check Onboarding (Profil komplett?)
                // if (!user.profileComplete) showOnboarding();
                
            } else {
                console.log("AUTH: Niemand eingeloggt. Zeige Login.");
                this.showLoginScreen();
            }
        });
    },

    // --- SCREEN MANAGEMENT ---
    showLoginScreen: function() {
        const screen = document.getElementById('auth-screen');
        if(screen) screen.classList.add('active');
    },

    hideLoginScreen: function() {
        const screen = document.getElementById('auth-screen');
        if(screen) {
            screen.style.opacity = '0';
            setTimeout(() => {
                screen.classList.remove('active');
                // Optional: Sound abspielen oder Begrüßung
            }, 500);
        }
    },

    // --- GOOGLE LOGIN ---
    loginGoogle: function() {
        const provider = new firebase.auth.GoogleAuthProvider();
        firebase.auth().signInWithPopup(provider)
            .then((result) => {
                // Erfolgreich! onAuthStateChanged kümmert sich um den Rest.
                console.log("Google Login Success");
            })
            .catch((error) => {
                alert("Login Error: " + error.message);
            });
    },

    // --- EMAIL LOGIN FLOW ---
    toggleEmailMode: function() {
        const mainOpts = document.getElementById('auth-main-options');
        const emailForm = document.getElementById('auth-email-form');
        
        if(mainOpts.classList.contains('hidden')) {
            mainOpts.classList.remove('hidden');
            emailForm.classList.add('hidden');
        } else {
            mainOpts.classList.add('hidden');
            emailForm.classList.remove('hidden');
        }
    },

    loginEmail: function() {
        const email = document.getElementById('inp-email').value;
        const pass = document.getElementById('inp-pass').value;
        
        if(!email || !pass) { alert("Bitte alles ausfüllen!"); return; }

        firebase.auth().signInWithEmailAndPassword(email, pass)
            .catch((error) => {
                alert("Login fehlgeschlagen: " + error.message);
            });
    },

    registerEmail: function() {
        const email = document.getElementById('inp-email').value;
        const pass = document.getElementById('inp-pass').value;

        if(!email || !pass) { alert("Bitte alles ausfüllen!"); return; }
        if(pass.length < 6) { alert("Passwort zu kurz (min 6 Zeichen)."); return; }

        firebase.auth().createUserWithEmailAndPassword(email, pass)
            .then((userCredential) => {
                console.log("Account erstellt!");
                // Wir könnten hier noch User-Daten in Firestore anlegen
            })
            .catch((error) => {
                alert("Fehler beim Erstellen: " + error.message);
            });
    }
};

// Startet sofort
AuthLogic.init();
