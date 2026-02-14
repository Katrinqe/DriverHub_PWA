/* ========================================== */
/* === ONBOARDING.JS - STORY MODE EDITION === */
/* ========================================== */

window.StoryLogic = {
    currentSlide: 0,
    totalSlides: 2,
    autoTimer: null,

    // Startet die Story (wird von AuthLogic gerufen)
    start: function() {
        document.getElementById('story-screen').classList.remove('hidden');
        this.showSlide(0);
        
        // Slide 1: Auto-Weiter nach 5 Sekunden
        this.autoTimer = setTimeout(() => {
            this.nextSlide();
        }, 5000);
    },

    showSlide: function(index) {
        // Bounds Check
        if(index < 0) index = 0;
        if(index >= this.totalSlides) return; // Ende erreicht

        this.currentSlide = index;

        // 1. Alle Slides verstecken
        document.querySelectorAll('.story-slide').forEach(el => el.classList.remove('active'));
        // 2. Aktuellen Slide zeigen
        document.getElementById('slide-' + index).classList.add('active');

        // 3. Dots updaten
        document.querySelectorAll('.story-dot').forEach(d => d.classList.remove('active'));
        document.getElementById('dot-' + index).classList.add('active');

        // Logic pro Slide
        if(index === 1) {
            // Bei Slide 2 (Profil) stoppen wir den Timer, User muss tippen
            if(this.autoTimer) clearTimeout(this.autoTimer);
        }
    },

    nextSlide: function() {
        // Timer killen falls User manuell tippt
        if(this.autoTimer) clearTimeout(this.autoTimer);
        
        if(this.currentSlide < this.totalSlides - 1) {
            this.showSlide(this.currentSlide + 1);
        } else {
            // Wenn wir am Ende sind (z.B. Profil Slide), passiert nichts per Tap.
            // Der User MUSS den Button drücken.
            console.log("End of tap navigation. Use button.");
        }
    },

    prevSlide: function() {
        if(this.autoTimer) clearTimeout(this.autoTimer);
        if(this.currentSlide > 0) {
            this.showSlide(this.currentSlide - 1);
        }
    }
};

// Alte Onboarding Logic integriert in Story
window.OnboardingLogic = {
    currentUser: null,

    // Wird von AuthLogic aufgerufen
    start: function(user) {
        this.currentUser = user;
        // Starte den Story Mode
        StoryLogic.start();
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
                img.classList.remove('hidden');
                placeholder.style.display = 'none';
            }
            reader.readAsDataURL(input.files[0]);
        }
    },

    saveProfile: function() {
        const realName = document.getElementById('ob-realname').value.trim();
        const userName = document.getElementById('ob-username').value.trim();

        if (!realName || !userName) {
            alert("Identity incomplete.");
            return;
        }

        const uid = this.currentUser.uid;
        
        // Simuliertes Speichern (oder echtes Firebase wenn aktiv)
        // Hier in deinem Fall: Echtes Firebase
        const userProfile = {
            uid: uid,
            email: this.currentUser.email,
            realName: realName,
            username: userName,
            onboardingComplete: true, 
            createdAt: new Date().toISOString(),
            cars: [] 
        };

        window.db.collection("users").doc(uid).set(userProfile)
            .then(() => {
                console.log("Profile ready!");
                // Animation raus
                document.getElementById('story-screen').style.opacity = '0';
                setTimeout(() => window.location.reload(), 500);
            })
            .catch((error) => {
                alert("Error: " + error.message);
            });
    }
};
