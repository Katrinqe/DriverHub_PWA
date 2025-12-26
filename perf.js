/* PERF.JS - LOGIC CORE V1 (CLEAN START) */

window.PerfLogic = {
    map: null,
    tracks: JSON.parse(localStorage.getItem('driverhub_tracks') || '[]'), // Echte Daten laden
    isCreating: false,
    tempTrackPoints: [], // Hier speichern wir die Pins während des Erstellens
    
    // Icons (Vorladen)
    icons: {
        start: L.divIcon({ className: 'dummy', html: '<div class="pulsing-dot-green"></div>', iconSize: [20,20] }),
        finish: L.divIcon({ className: 'dummy', html: '<div class="pulsing-dot-red"></div>', iconSize: [20,20] }),
        point: L.divIcon({ className: 'dummy', html: '<div style="width:10px;height:10px;background:white;border-radius:50%;"></div>', iconSize: [10,10] })
    },

    init: function() {
        console.log("PerfLogic Init - Clean Mode");
        this.renderTrackList();
        this.updateStats();
    },

    onScreenShow: function() {
        if (!this.map) {
            this.loadMap();
        } else {
            setTimeout(() => { this.map.invalidateSize(); }, 200);
        }
    },

    loadMap: function() {
        this.map = L.map('perf-map', {
            zoomControl: false, attributionControl: false
        }).setView([51.1657, 10.4515], 6); // Deutschland Weit raus

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19
        }).addTo(this.map);

        // Klick-Handler für Map (nur wenn Creator aktiv ist)
        this.map.on('click', (e) => {
            if(this.isCreating) {
                this.addTrackPoint(e.latlng);
            }
        });
        
        // Versuchen zum User zu springen
        if(navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(pos => {
                this.map.setView([pos.coords.latitude, pos.coords.longitude], 15);
            });
        }
    },

    // === TRACK CREATOR LOGIC ===
    
    openTrackCreator: function() {
        this.isCreating = true;
        this.tempTrackPoints = [];
        
        // UI Update: Overlay Text ändern
        const overlay = document.getElementById('perf-map-overlay-text');
        overlay.classList.remove('hidden');
        overlay.innerText = "TAP MAP TO SET START POINT";
        
        // Map säubern
        this.map.eachLayer((layer) => { if (!layer._url) this.map.removeLayer(layer); });
        
        alert("CREATOR MODE: Tippe auf die Karte, um Punkte zu setzen.\n1. Start\n2. Checkpoints\n3. Finish");
    },

    addTrackPoint: function(latlng) {
        this.tempTrackPoints.push(latlng);
        const index = this.tempTrackPoints.length - 1;
        
        // Welches Icon?
        let icon = this.icons.point;
        if(index === 0) icon = this.icons.start;
        
        // Marker setzen
        L.marker(latlng, {icon: icon}).addTo(this.map);
        
        // Linie ziehen (wenn mehr als 1 Punkt)
        if(this.tempTrackPoints.length > 1) {
            L.polyline(this.tempTrackPoints, {color: '#ff3b30', weight: 4}).addTo(this.map);
        }

        // Status Text Update
        const overlay = document.getElementById('perf-map-overlay-text');
        if(index === 0) overlay.innerText = "SET CHECKPOINTS...";
        
        // Wenn 2 Punkte da sind -> Fragen ob fertig
        if(this.tempTrackPoints.length >= 2) {
            // Kleiner Timeout damit der Marker erst erscheint
            setTimeout(() => {
                if(confirm("Is this the Finish Line?")) {
                    this.finishTrackCreation();
                }
            }, 100);
        }
    },

    finishTrackCreation: function() {
        const name = prompt("Name your Track:", "New Track");
        if(!name) return; // Abgebrochen

        const newTrack = {
            id: Date.now(),
            name: name,
            points: this.tempTrackPoints,
            bestTime: null,
            score: 0,
            date: new Date().toISOString()
        };

        this.tracks.push(newTrack);
        this.saveData();
        
        this.isCreating = false;
        document.getElementById('perf-map-overlay-text').innerText = "TRACK SAVED";
        this.renderTrackList();
    },

    // === DATA MANAGEMENT ===

    saveData: function() {
        localStorage.setItem('driverhub_tracks', JSON.stringify(this.tracks));
        this.updateStats();
    },

    updateStats: function() {
        // Echte Stats berechnen
        document.getElementById('perf-total-tracks').innerText = this.tracks.length;
        // Best Time & Score Logik kommt später
    },

    renderTrackList: function() {
        const list = document.getElementById('perf-track-list');
        // Alles löschen bis auf den ersten Button (Create)
        const createBtn = list.firstElementChild;
        list.innerHTML = '';
        list.appendChild(createBtn);

        this.tracks.forEach(t => {
            const div = document.createElement('div');
            div.className = 'track-card';
            div.innerHTML = `
                <div class="tc-map-preview"></div>
                <div class="tc-info">
                    <div class="tc-name">${t.name}</div>
                    <div class="tc-stats">
                        <span><i class="fa-solid fa-trophy"></i> --:--</span>
                        <span><i class="fa-solid fa-road"></i> ? km</span>
                    </div>
                </div>
            `;
            // Klick lädt diesen Track in die Map
            div.onclick = () => this.loadTrackToMap(t);
            list.appendChild(div);
        });
        
        // Spacer am Ende
        const spacer = document.createElement('div');
        spacer.style.width = '20px';
        spacer.style.flexShrink = '0';
        list.appendChild(spacer);
    },

    loadTrackToMap: function(track) {
        // Hier kommt später die Logik, um einen existierenden Track anzuzeigen
        console.log("Loading Track:", track.name);
    }
};

// Init starten
PerfLogic.init();
