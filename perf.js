/* PERF.JS - CREATOR MODE V2 */

window.PerfLogic = {
    map: null,
    userMarker: null,
    tracks: JSON.parse(localStorage.getItem('driverhub_tracks') || '[]'),
    
    // Creator State
    isCreatorMode: false,
    selectedPin: 'start', // 'start', 'check', 'finish'
    creatorPoints: [], // Array von Markern

    init: function() {
        console.log("PerfLogic Init");
        this.renderTrackList();
        this.updateGlobalStats();
    },

    onScreenShow: function() {
        if (!this.map) {
            this.loadMap();
        } else {
            setTimeout(() => { this.map.invalidateSize(); }, 200);
        }
        this.startUserTracking();
    },

    loadMap: function() {
        this.map = L.map('perf-map', {
            zoomControl: false, attributionControl: false
        }).setView([51.1657, 10.4515], 6);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19
        }).addTo(this.map);

        // Klick auf Map -> Punkt setzen (nur im Creator Mode)
        this.map.on('click', (e) => {
            if(this.isCreatorMode) {
                this.placePinOnMap(e.latlng);
            }
        });
    },

    startUserTracking: function() {
        if(navigator.geolocation) {
            navigator.geolocation.watchPosition(pos => {
                const latlng = [pos.coords.latitude, pos.coords.longitude];
                
                // User Marker erstellen / updaten
                if(!this.userMarker) {
                    const icon = L.divIcon({
                        className: 'user-marker-wrap', // Nutzt dein existierendes CSS
                        html: '<div class="user-pulse"></div><div class="user-dot"></div>',
                        iconSize: [40,40], iconAnchor: [20,20]
                    });
                    this.userMarker = L.marker(latlng, {icon: icon}).addTo(this.map);
                    // Nur beim ersten Mal hinzoomen, wenn nicht im Creator Mode
                    if(!this.isCreatorMode) this.map.setView(latlng, 15);
                } else {
                    this.userMarker.setLatLng(latlng);
                }
            }, err => {}, {enableHighAccuracy: true});
        }
    },

    // === CREATOR MODE LOGIC ===

    enterCreatorMode: function() {
        this.isCreatorMode = true;
        this.creatorPoints = []; // Reset

        // 1. UI Animation
        document.getElementById('perf-dashboard-ui').classList.add('fade-out-ui');
        document.getElementById('perf-creator-ui').classList.remove('hidden');
        document.getElementById('perf-fade-overlay').style.opacity = '0'; // Fade weg für klare Sicht
        document.getElementById('nav-perf').parentElement.classList.add('hidden'); // Navbar weg

        // 2. Map Interaktion freischalten
        // Wir ändern die CSS Klasse des Map Containers temporär
        document.getElementById('perf-map-container').style.height = "100vh"; // Vollbild
        document.getElementById('perf-map-container').style.zIndex = "100"; // Nach vorne holen
        
        setTimeout(() => { this.map.invalidateSize(); }, 300);

        // Standard Pin
        this.selectPinType('start');
    },

    leaveCreatorMode: function() {
        if(confirm("Discard Track?")) {
            this.quitCreator();
        }
    },

    quitCreator: function() {
        this.isCreatorMode = false;

        // UI Reset
        document.getElementById('perf-dashboard-ui').classList.remove('fade-out-ui');
        document.getElementById('perf-creator-ui').classList.add('hidden');
        document.getElementById('perf-fade-overlay').style.opacity = '1';
        document.getElementById('nav-perf').parentElement.classList.remove('hidden');

        // Map Reset
        document.getElementById('perf-map-container').style.height = "50vh";
        document.getElementById('perf-map-container').style.zIndex = "0";
        setTimeout(() => { this.map.invalidateSize(); }, 300);

        // Marker löschen
        this.clearCreatorMap();
    },

    selectPinType: function(type) {
        this.selectedPin = type;
        
        // UI Update (Buttons highlighten)
        document.querySelectorAll('.cb-pin').forEach(el => el.classList.remove('active'));
        if(type === 'start') document.getElementById('pin-start').classList.add('active');
        if(type === 'check') document.getElementById('pin-check').classList.add('active');
        if(type === 'finish') document.getElementById('pin-finish').classList.add('active');
    },

    placePinOnMap: function(latlng) {
        // Welches Icon?
        let color = '#fff';
        if(this.selectedPin === 'start') color = '#30d158';
        if(this.selectedPin === 'finish') color = '#ff3b30';

        const iconHtml = `<div style="width:16px;height:16px;background:${color};border:2px solid white;border-radius:50%;box-shadow:0 0 10px ${color};"></div>`;
        const icon = L.divIcon({ className: 'd', html: iconHtml, iconSize: [20,20], iconAnchor: [10,10] });

        const marker = L.marker(latlng, {icon: icon}).addTo(this.map);
        this.creatorPoints.push({ latlng: latlng, type: this.selectedPin, marker: marker });

        // Automatisch weiter schalten
        if(this.selectedPin === 'start') this.selectPinType('check');
        
        this.drawCreatorPolyline();
    },

    drawCreatorPolyline: function() {
        // Linie zwischen Punkten ziehen (Simuliert Routing für jetzt)
        if(this.polyLine) this.map.removeLayer(this.polyLine);
        
        const latlngs = this.creatorPoints.map(p => p.latlng);
        if(latlngs.length > 1) {
            this.polyLine = L.polyline(latlngs, {color: '#bf5af2', weight: 4, dashArray: '10, 10'}).addTo(this.map);
            
            // Distanz berechnen (Luftlinie grob)
            let dist = 0;
            for(let i=0; i<latlngs.length-1; i++) {
                dist += latlngs[i].distanceTo(latlngs[i+1]);
            }
            document.getElementById('ct-dist').innerText = (dist/1000).toFixed(2) + " km";
        }
    },

    clearCreatorMap: function() {
        this.creatorPoints.forEach(p => this.map.removeLayer(p.marker));
        if(this.polyLine) this.map.removeLayer(this.polyLine);
        this.creatorPoints = [];
    },

    saveTrack: function() {
        // Validierung
        const hasStart = this.creatorPoints.some(p => p.type === 'start');
        const hasFinish = this.creatorPoints.some(p => p.type === 'finish');
        
        if(!hasStart || !hasFinish) {
            alert("Track needs at least a START and FINISH point!");
            return;
        }

        const name = prompt("Track Name:", "My Epic Track");
        if(name) {
            const track = {
                id: Date.now(),
                name: name,
                // Speichere nur Koordinaten, nicht die Marker-Objekte
                points: this.creatorPoints.map(p => ({lat: p.latlng.lat, lng: p.latlng.lng, type: p.type})),
                dist: document.getElementById('ct-dist').innerText,
                bestTime: '---'
            };
            
            this.tracks.push(track);
            localStorage.setItem('driverhub_tracks', JSON.stringify(this.tracks));
            
            // Clean Exit
            this.isCreatorMode = false; // Flag resetten damit quitCreator nicht fragt
            this.quitCreator();
            this.renderTrackList();
            this.updateGlobalStats();
        }
    },

    // === RENDER DASHBOARD ===

    renderTrackList: function() {
        const list = document.getElementById('perf-track-list');
        // Behalte den Create Button
        const createBtn = list.querySelector('.add-track-card');
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
                        <span><i class="fa-solid fa-trophy"></i> ${t.bestTime}</span>
                        <span><i class="fa-solid fa-road"></i> ${t.dist}</span>
                    </div>
                </div>
            `;
            list.appendChild(div);
        });
        
        // Spacer
        const spacer = document.createElement('div');
        spacer.style.width='20px'; spacer.style.flexShrink='0';
        list.appendChild(spacer);
    },

    updateGlobalStats: function() {
        document.getElementById('perf-total-tracks').innerText = this.tracks.length;
    }
};

PerfLogic.init();
