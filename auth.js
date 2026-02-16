/* ========================================== */
/* === AUTH.JS - MANUAL START FLOW (FIXED) === */
/* ========================================== */
/* ========================================== */
/* === START SCREEN LOGIC (MAPBOX & KEYS) === */
/* ========================================== */

window.StartScreenLogic = {
    map: null,
    
    init: function() {
        // Prüfen ob Mapbox geladen ist
        if (!mapboxgl) {
            console.error("Mapbox JS nicht gefunden!");
            return;
        }

        // DEIN API KEY
        mapboxgl.accessToken = 'pk.eyJ1IjoibmlraXRhNzgiLCJhIjoiY21scDkyMG1wMThsaDNxc2duOWJoeHZ0MyJ9.T9e4gicDXQvrv4a2fdcVQw';

        // Karte initialisieren
        this.map = new mapboxgl.Map({
            container: 'background-map',
            style: 'mapbox://styles/mapbox/navigation-night-v1', // Sehr dunkler Style
            center: [10.45, 51.16], // Startet grob über Europa/Deutschland
            zoom: 1.5, // Weit rausgezoomt für Globus
            projection: 'globe', // WICHTIG: Macht es rund (3D)
            interactive: false, // User kann nicht steuern am Anfang
            attributionControl: false
        });

        this.map.on('style.load', () => {
            // Atmosphäre (Glow) hinzufügen
            this.map.setFog({
                'color': 'rgb(10, 10, 20)', // Unterer Himmel
                'high-color': 'rgb(0, 20, 40)', // Oberer Himmel
                'horizon-blend': 0.1, // Atmosphäre dicke
                'space-color': 'rgb(0, 0, 0)', // Weltraum schwarz
                'star-intensity': 0.6 // Sterne
            });

            // Langsame Drehung starten
            this.spinGlobe();
        });
    },

    spinGlobe: function() {
        const secondsPerRevolution = 120; // Geschwindigkeit
        const maxSpinZoom = 5;
        const slowSpinZoom = 3;
        let userInteracting = false;

        const spinEnabled = true;

        const animate = () => {
            if(!this.map) return;
            const zoom = this.map.getZoom();
            if (spinEnabled && !userInteracting && zoom < maxSpinZoom) {
                let distancePerSecond = 360 / secondsPerRevolution;
                if (zoom > slowSpinZoom) {
                    distancePerSecond *= (maxSpinZoom - zoom) / (maxSpinZoom - slowSpinZoom);
                }
                const center = this.map.getCenter();
                center.lng -= distancePerSecond;
                this.map.easeTo({ center, duration: 1000, easing: (n) => n });
            }
            requestAnimationFrame(animate);
        };
        animate();
    },

    // Wird bei DOUBLE TAP aufgerufen
    ignite: function() {
        console.log("Ignition Sequence Started...");
        
        // 1. Sound abspielen (Optional, später)
        // const audio = new Audio('ignition.mp3'); audio.play();

        // 2. Mapbox Effekt: Schnell reinzoomen oder Abdunkeln
        const bg = document.getElementById('background-map');
        bg.classList.add('dimmed');

        // 3. UI Wechseln
        const intro = document.getElementById('ws-intro-layer');
        const keys = document.getElementById('ws-key-layer');

        intro.classList.remove('active');
        intro.classList.add('hidden');

        setTimeout(() => {
            keys.classList.remove('hidden');
            keys.classList.add('active');
        }, 500); // Kurze Verzögerung für Dramatik
    },

    // Zurück zum Globus
    reset: function() {
        const bg = document.getElementById('background-map');
        bg.classList.remove('dimmed');

        const intro = document.getElementById('ws-intro-layer');
        const keys = document.getElementById('ws-key-layer');

        keys.classList.remove('active');
        keys.classList.add('hidden');

        setTimeout(() => {
            intro.classList.remove('hidden');
            intro.classList.add('active');
        }, 500);
    }
};

// Starten, sobald Seite geladen
document.addEventListener('DOMContentLoaded', () => {
    StartScreenLogic.init();
});
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
