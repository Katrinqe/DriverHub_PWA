/* PERF.JS - PERFORMANCE HUB LOGIC */

window.PerfLogic = {
    map: null,
    currentMode: 'track', // 'track', 'drag', 'analytics'

    // Init wird beim ersten Laden aufgerufen
    init: function() {
        console.log("PerfLogic Loaded");
        this.setupTabs();
    },

    // Wird aufgerufen, wenn man auf den PERF Tab in der Navbar drückt
    onScreenShow: function() {
        // Map nur laden, wenn noch nicht da (spart Ressourcen)
        if (!this.map) {
            setTimeout(() => this.loadMap(), 100);
        }
    },

    loadMap: function() {
        // Karte initialisieren (Dark Mode Style)
        this.map = L.map('perf-map', {
            zoomControl: false, 
            attributionControl: false
        }).setView([51.1657, 10.4515], 13); // Default Mitte DE

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19
        }).addTo(this.map);
    },

    // Tab-Wechsel (Track / Drag / Analytics)
    setupTabs: function() {
        const tabs = document.querySelectorAll('.psn-item');
        tabs.forEach(tab => {
            tab.onclick = () => {
                // UI Update
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Mode merken
                this.currentMode = tab.innerText.toLowerCase();
                console.log("Switched to Mode:", this.currentMode);
                
                // Hier später Logik zum Inhalt tauschen
            };
        });
    },

    // SIMULATION: Auswahl eines Tracks
    selectTrack: function(trackId) {
        if(!this.map) return;

        // 1. Text anzeigen
        const overlay = document.getElementById('perf-map-overlay-text');
        overlay.classList.remove('hidden');
        overlay.innerText = "LOADING TRACK...";
        overlay.style.animation = 'none';
        overlay.offsetHeight; /* Trigger reflow */
        overlay.style.animation = 'fadeIn 0.5s ease-out';

        // 2. Map Animation (Simulierte Koordinaten für Demo)
        // Später kommen die echten Daten aus dem Track-Objekt
        const start = [49.4521, 11.0767]; // Nürnberg Hbf Gegend
        const end = [49.4600, 11.0800];
        
        // Kameraflug
        this.map.flyTo(start, 14, { duration: 1.5 });

        // Nach Animation: Linie zeichnen & Dots setzen
        setTimeout(() => {
            // Alte Layer löschen (Clean Map)
            this.map.eachLayer((layer) => {
                if (!layer._url) this.map.removeLayer(layer);
            });

            // Start Dot (Grün Pulsierend)
            const startIcon = L.divIcon({ className: 'pulsing-dot-green', iconSize: [15,15] });
            L.marker(start, {icon: startIcon}).addTo(this.map);

            // Ziel Dot (Rot Pulsierend)
            const endIcon = L.divIcon({ className: 'pulsing-dot-red', iconSize: [15,15] });
            L.marker(end, {icon: endIcon}).addTo(this.map);

            // Linie zeichnen
            L.polyline([start, [49.455, 11.078], end], {color: '#ff3b30', weight: 4}).addTo(this.map);

            // Text Update
            overlay.innerText = "START YOUR RACE";

        }, 1600);
    }
};

// Start Init sofort
PerfLogic.init();
