/* ========================================== */
/* === AUTH.JS - CLEAN LOGIN LOGIC === */
/* ========================================== */

window.AuthLogic = {
    
    init: function() {
        console.log("Auth System: Checking Status...");
        
        // Der Listener entscheidet jetzt: Login AN oder AUS
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                console.log("AUTH: User ist bereits drin:", user.email);
                // WICHTIG: Wir machen NICHTS. Der Screen ist ja schon unsichtbar.
                // Das verhindert das Aufblitzen komplett.
                
                // Hier könnten wir später den Profil-Check starten
                // checkOnboarding(user);
            } else {
                console.log("AUTH: Niemand eingeloggt. Zeige Login.");
                // Nur wenn wirklich keiner da ist, blenden wir den Screen ein
                this.showLoginScreen();
            }
        });
    },

    // --- SCREEN MANAGEMENT ---
    showLoginScreen: function() {
        const screen = document.getElementById('auth-screen');
        if(screen) {
            // Kleine Verzögerung, damit es weich einfadet (nach dem Splash Screen)
            setTimeout(() => {
                screen.classList.add('active');
            }, 500); 
        }
    },

    hideLoginScreen: function() {
        const screen = document.getElementById('auth-screen');
        if(screen) {
            screen.style.opacity = '0';
            setTimeout(() => {
                screen.classList.remove('active');
                // Style Reset für den nächsten Logout
                screen.style.opacity = ''; 
            }, 500);
        }
    },

    // --- LOGOUT (Hilfsfunktion für später) ---
    logout: function() {
        firebase.auth().signOut().then(() => {
            console.log("Ausgeloggt");
            window.location.reload(); // Einfachste Methode für sauberen Reset
        });
    },

    // --- GOOGLE LOGIN ---
    loginGoogle: function() {
        const provider = new firebase.auth.GoogleAuthProvider();
        firebase.auth().signInWithPopup(provider)
            .then((result) => {
                console.log("Google Login Success");
                this.hideLoginScreen();
            })
            .catch((error) => {
                console.error(error);
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
            .then(() => {
                this.hideLoginScreen();
            })
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
            .then(() => {
                console.log("Account erstellt!");
                this.hideLoginScreen();
            })
            .catch((error) => {
                alert("Fehler beim Erstellen: " + error.message);
            });
    }
};

AuthLogic.init();
