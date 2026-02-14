/* ========================================== */
/* === ONBOARDING.JS - PROFILE CREATION === */
/* ========================================== */

window.OnboardingLogic = {
    currentUser: null,

    // Wird von auth.js aufgerufen, wenn User neu ist oder Profil fehlt
    start: function(user) {
        console.log("Starting Onboarding for:", user.email);
        this.currentUser = user;
        
        // UI Zeigen
        document.getElementById('auth-screen').classList.remove('active'); // Login weg
        document.getElementById('onboarding-screen').classList.remove('hidden'); // Onboarding her
        
        // Auto-Fill Email als Fallback, falls wir das wollen
        // document.getElementById('ob-realname').value = user.displayName || "";
    },

    triggerAvatarUpload: function() {
        document.getElementById('ob-avatar-input').click();
    },

previewAvatar: function(input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = document.getElementById('ob-avatar-preview');
                const placeholder = document.getElementById('ob-avatar-placeholder');
                
                img.src = e.target.result;
                img.classList.remove('hidden'); // Bild anzeigen
                placeholder.style.display = 'none'; // Icon ausblenden
            }
            reader.readAsDataURL(input.files[0]);
        }
    },

    saveProfile: function() {
        const realName = document.getElementById('ob-realname').value.trim();
        const userName = document.getElementById('ob-username').value.trim();

        if (!realName || !userName) {
            alert("Identity incomplete. Fill all fields.");
            return;
        }

        const uid = this.currentUser.uid;
        
        // Daten für Firestore vorbereiten
        const userProfile = {
            uid: uid,
            email: this.currentUser.email,
            realName: realName,
            username: userName,
            onboardingComplete: true, // WICHTIG: Damit wir beim nächsten Mal wissen: Er ist fertig
            createdAt: new Date().toISOString(),
            cars: [] // Leere Garage anlegen
        };

        // Speichern in "users" Collection
        window.db.collection("users").doc(uid).set(userProfile)
            .then(() => {
                console.log("Profile initialized!");
                this.finishOnboarding();
            })
            .catch((error) => {
                console.error("Error saving profile: ", error);
                alert("Database Error: " + error.message);
            });
    },

    finishOnboarding: function() {
        // Animation raus
        const screen = document.getElementById('onboarding-screen');
        screen.style.transition = "opacity 0.8s ease";
        screen.style.opacity = "0";
        
        setTimeout(() => {
            screen.classList.add('hidden');
            // Hier kommt später der Schritt zum Auto-Setup
            // Für JETZT: Direkt zur App
            // Wir laden die Seite neu oder rufen die Init-Funktionen auf
            window.location.reload(); 
        }, 800);
    }
};
