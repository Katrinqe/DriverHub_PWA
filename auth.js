/* ========================================== */
/* === AUTH.JS - MANUAL START FLOW (FIXED) === */
/* ========================================== */

window.AuthLogic = {
    
    init: function() {
        console.log("Welcome Screen active. Waiting for user input.");
    },

    // --- NEU: DIESE FUNKTION HAT GEFEHLT ---
    startRegisterFlow: function() {
        console.log("Starte Register Flow...");
        const user = firebase.auth().currentUser;
        
        if (user) {
            // Fall A: Schon eingeloggt -> Sofort zur Story
            console.log("User bereits da, starte Story Mode...");
            this.launchStoryMode(user);
        } else {
            // Fall B: Nicht eingeloggt -> Erst Google Login, dann Story
            const provider = new firebase.auth.GoogleAuthProvider();
            firebase.auth().signInWithPopup(provider)
                .then((result) => {
                    console.log("Login erfolgreich, weiter zur Story...");
                    this.launchStoryMode(result.user);
                })
                .catch((error) => {
                    alert("Login Fehler: " + error.message);
                });
        }
    },

    // Hilfsfunktion, um den Screen sauber zu wechseln
    launchStoryMode: function(user) {
        // 1. Welcome Screen ausblenden
        const ws = document.getElementById('welcome-screen');
        if(ws) {
            ws.style.transition = "opacity 0.5s ease";
            ws.style.opacity = "0";
            setTimeout(() => ws.remove(), 500);
        }

        // 2. Story starten (Check ob das Script geladen ist)
        if(window.OnboardingLogic) {
            // WICHTIG: Wir übergeben den User an das Onboarding Script
            window.OnboardingLogic.start(user);
        } else {
            console.error("FEHLER: onboarding.js ist nicht geladen!");
            alert("Systemfehler: Onboarding Modul fehlt.");
        }
    },
    // ---------------------------------------

    // Wird vom "LOGIN" Button auf dem Welcome-Screen gerufen
    goToLogin: function() {
        const welcome = document.getElementById('welcome-screen');
        if(welcome) {
            welcome.style.opacity = "0";
            setTimeout(() => welcome.remove(), 500);
        }

        const user = firebase.auth().currentUser;
        if (user) {
            this.hideLoginScreen();
        } else {
            this.showLoginScreen();
        }
        
        this.startAuthListener();
    },

    startAuthListener: function() {
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                this.hideLoginScreen();
            }
        });
    },

    showLoginScreen: function() {
        const screen = document.getElementById('auth-screen');
        if(screen) screen.classList.add('active');
    },

    hideLoginScreen: function() {
        const screen = document.getElementById('auth-screen');
        if(screen) screen.classList.remove('active');
    },

    loginGoogle: function() {
        const provider = new firebase.auth.GoogleAuthProvider();
        firebase.auth().signInWithPopup(provider).then(() => this.hideLoginScreen()).catch(e => alert(e.message));
    },

    toggleEmailMode: function() {
        const mainOpts = document.getElementById('auth-main-options');
        const emailForm = document.getElementById('auth-email-form');
        if(mainOpts.classList.contains('hidden')) {
            mainOpts.classList.remove('hidden'); emailForm.classList.add('hidden');
        } else {
            mainOpts.classList.add('hidden'); emailForm.classList.remove('hidden');
        }
    },

    loginEmail: function() {
        const email = document.getElementById('inp-email').value;
        const pass = document.getElementById('inp-pass').value;
        firebase.auth().signInWithEmailAndPassword(email, pass).catch(e => alert(e.message));
    },

    registerEmail: function() {
        const email = document.getElementById('inp-email').value;
        const pass = document.getElementById('inp-pass').value;
        firebase.auth().createUserWithEmailAndPassword(email, pass).catch(e => alert(e.message));
    }
};

AuthLogic.init();
