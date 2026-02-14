/* ========================================== */
/* === AUTH.JS - MANUAL START FLOW === */
/* ========================================== */

window.AuthLogic = {
    
    init: function() {
        console.log("Welcome Screen active. Waiting for user input.");
        // WICHTIG: Wir hören hier NICHT mehr automatisch auf den User-Status,
        // um den Screen auszublenden. Wir warten auf den Klick.
    },

    // Wird vom "LOGIN" Button auf dem Welcome-Screen gerufen
    goToLogin: function() {
        // 1. Welcome Screen wegblenden
        const welcome = document.getElementById('welcome-screen');
        welcome.style.transition = "opacity 0.5s ease";
        welcome.style.opacity = "0";
        setTimeout(() => welcome.remove(), 500); // Ganz entfernen

        // 2. Jetzt erst prüfen wir: Ist er schon eingeloggt?
        const user = firebase.auth().currentUser;
        
        if (user) {
            // Wenn schon eingeloggt -> Direkt zur App (Login überspringen)
            console.log("Bereits eingeloggt. Skip Login UI.");
            this.hideLoginScreen();
        } else {
            // Wenn nicht -> Zeige den normalen Login Screen (Google/Email)
            this.showLoginScreen();
        }
        
        // Jetzt erst den Listener starten für zukünftige Änderungen
        this.startAuthListener();
    },

    startAuthListener: function() {
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                // Hier später Onboarding Check
                this.hideLoginScreen();
            }
        });
    },

    // --- SCREEN MANAGEMENT (Gleich wie vorher) ---
    showLoginScreen: function() {
        const screen = document.getElementById('auth-screen');
        if(screen) screen.classList.add('active');
    },

    hideLoginScreen: function() {
        const screen = document.getElementById('auth-screen');
        if(screen) {
            screen.classList.remove('active');
        }
    },

    // ... (Rest der Funktionen: loginGoogle, toggleEmailMode, etc. bleiben gleich) ...
    // Einfach den alten Code für loginGoogle, loginEmail, registerEmail hier lassen.
    
    loginGoogle: function() {
        const provider = new firebase.auth.GoogleAuthProvider();
        firebase.auth().signInWithPopup(provider).then(() => this.hideLoginScreen()).catch(e => alert(e.message));
    },
    toggleEmailMode: function() { /* ... alter Code ... */ 
        const mainOpts = document.getElementById('auth-main-options');
        const emailForm = document.getElementById('auth-email-form');
        if(mainOpts.classList.contains('hidden')) {
            mainOpts.classList.remove('hidden'); emailForm.classList.add('hidden');
        } else {
            mainOpts.classList.add('hidden'); emailForm.classList.remove('hidden');
        }
    },
    loginEmail: function() { /* ... alter Code ... */ 
        const email = document.getElementById('inp-email').value;
        const pass = document.getElementById('inp-pass').value;
        firebase.auth().signInWithEmailAndPassword(email, pass).catch(e => alert(e.message));
    },
    registerEmail: function() { /* ... alter Code ... */ 
        const email = document.getElementById('inp-email').value;
        const pass = document.getElementById('inp-pass').value;
        firebase.auth().createUserWithEmailAndPassword(email, pass).catch(e => alert(e.message));
    }
};

AuthLogic.init();
