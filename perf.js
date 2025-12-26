/* PERF.JS - V4 (INTERACTIVE MAP FIX) */

window.PerfLogic = {
    map: null,
    userMarker: null,
    tracks: JSON.parse(localStorage.getItem('driverhub_tracks') || '[]'),
    
    // Creator State
    isCreatorMode: false,
    selectedPin: 'start', // 'start', 'check', 'finish'
    creatorPoints: [], 
    polyLine: null,

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
        // Init mit expliziten Interaktions-Rechten
        this.map = L.map('perf-map', {
            zoomControl: false, 
            attributionControl: false,
            dragging: true,      // WICHTIG
            touchZoom: true,     // WICHTIG
            doubleClickZoom: true,
            scrollWheelZoom: true,
            tap: false // Fix für manche Mobile-Browser
        }).setView([51.1657, 10.4515], 6);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19
        }).addTo(this.map);

        // Klick Handler
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
                
                // User Marker (Blauer Punkt)
                if(!this.userMarker) {
                    const icon = L.divIcon({
                        className: 'user-marker-wrap', 
                        html: '<div class="user-pulse"></div><div class="user-dot"></div>',
                        iconSize: [40,40], iconAnchor: [20,20]
                    });
                    this.userMarker = L.marker(latlng, {icon: icon}).addTo(this.map);
                    
                    // Nur hinspringen wenn wir nicht gerade eine Strecke bauen
                    if(!this.isCreatorMode) this.map.setView(latlng, 15);
                } else {
                    this.userMarker.setLatLng(latlng);
                }
            }, err => console.warn(err), {enableHighAccuracy: true});
        }
    },

    // === CREATOR MODE LOGIC ===

    enterCreatorMode: function() {
        this.isCreatorMode = true;
        this.creatorPoints = []; 

        // 1. UI Animation (Dashboard weg, Creator rein)
        document.getElementById('perf-dashboard-ui').classList.add('fade-out-ui');
        document.getElementById('perf-creator-ui').classList.remove('hidden');
        document.getElementById('perf-creator-ui').classList.add('fade-in-ui'); // Sicherstellen dass es sichtbar ist
        
        // Navbar & Fade weg
        document.getElementById('perf-fade-overlay').style.opacity = '0';
        document.getElementById('nav-perf').parentElement.classList.add('hidden');

        // 2. MAP FREISCHALTEN (Der wichtige Teil!)
        const mapContainer = document.getElementById('perf-map-container');
        mapContainer.style.height = "100vh"; // Vollbild
        mapContainer.style.zIndex = "100";   // Nach ganz vorne holen
        
        // Leaflet zwingen aufzuwachen
        setTimeout(() => { 
            this.map.invalidateSize(); 
            this.map.dragging.enable();
            this.map.touchZoom.enable();
        }, 300);

        // Standard Pin wählen
        this.selectPinType('start');
        
        // Reset Text
        document.getElementById('ct-dist').innerText = "0.0 km";
    },

    leaveCreatorMode: function() {
        if(this.creatorPoints.length > 0) {
            if(confirm("Discard Track?")) this.quitCreator();
        } else {
            this.quitCreator();
        }
    },

    quitCreator: function() {
        this.isCreatorMode = false;

        // UI Reset
        document.getElementById('perf-dashboard-ui').classList.remove('fade-out-ui');
        document.getElementById('perf-creator-ui').classList.add('hidden');
        document.getElementById('perf-creator-ui').classList.remove('fade-in-ui');
        
        document.getElementById('perf-fade-overlay').style.opacity = '1';
        document.getElementById('nav-perf').parentElement.classList.remove('hidden');

        // Map Reset
        const mapContainer = document.getElementById('perf-map-container');
        mapContainer.style.height = "50vh";
        mapContainer.style.zIndex = "0"; // Wieder nach hinten
        
        setTimeout(() => { this.map.invalidateSize(); }, 300);

        this.clearCreatorMap();
    },

    selectPinType: function(type) {
        this.selectedPin = type;
        
        // UI Update
        document.querySelectorAll('.cb-pin').forEach(el => el.classList.remove('active'));
        if(type === 'start') document.getElementById('pin-start').classList.add('active');
        if(type === 'check') document.getElementById('pin-check').classList.add('active');
        if(type === 'finish') document.getElementById('pin-finish').classList.add('active');
    },

    placePinOnMap: function(latlng) {
        // Icon Logik
        let color = '#fff';
        let className = 'pin-dot white';
        
        if(this.selectedPin === 'start') { color = '#30d158'; className = 'pin-dot green'; }
        if(this.selectedPin === 'finish') { color = '#ff3b30'; className = 'pin-dot red'; }

        // Marker erstellen (Wir nutzen die CSS Klassen aus style.css)
        const iconHtml = `<div class="${className}" style="width:16px;height:16px;"></div>`;
        const icon = L.divIcon({ 
            className: 'custom-pin-icon', // Dummy Klasse damit Leaflet nicht meckert
            html: iconHtml, 
            iconSize: [20,20], 
            iconAnchor: [10,10] 
        });

        const marker = L.marker(latlng, {icon: icon}).addTo(this.map);
        this.creatorPoints.push({ latlng: latlng, type: this.selectedPin, marker: marker });

        // Auto-Switch Logik (User Flow)
        if(this.selectedPin === 'start') this.selectPinType('check');
        
        this.drawCreatorPolyline();
    },

    drawCreatorPolyline: function() {
        if(this.polyLine) this.map.removeLayer(this.polyLine);
        
        const latlngs = this.creatorPoints.map(p => p.latlng);
        if(latlngs.length > 1) {
            this.polyLine = L.polyline(latlngs, {color: '#bf5af2', weight: 4, dashArray: '10, 10'}).addTo(this.map);
            
            // Distanz berechnen
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
        document.getElementById('ct-dist').innerText = "0.0 km";
    },

    saveTrack: function() {
        // Validierung
        const hasStart = this.creatorPoints.some(p => p.type === 'start');
        const hasFinish = this.creatorPoints.some(p => p.type === 'finish');
        
        if(!hasStart || !hasFinish) {
            alert("Track needs START (Green) and FINISH (Red)!");
            return;
        }

        const name = prompt("Name your Track:", "My Track");
        if(name) {
            const track = {
                id: Date.now(),
                name: name,
                // Speichern als reines Daten-Objekt
                points: this.creatorPoints.map(p => ({lat: p.latlng.lat, lng: p.latlng.lng, type: p.type})),
                dist: document.getElementById('ct-dist').innerText,
                bestTime: '---'
            };
            
            this.tracks.push(track);
            localStorage.setItem('driverhub_tracks', JSON.stringify(this.tracks));
            
            // Beenden ohne Confirm-Frage
            this.quitCreator();
            this.renderTrackList();
            this.updateGlobalStats();
        }
    },

    // === RENDER DASHBOARD ===

    renderTrackList: function() {
        const list = document.getElementById('perf-track-list');
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
            // Wenn man hier klickt, soll später die Detail-Ansicht kommen
            // div.onclick = () => this.showTrackDetails(t);
            list.appendChild(div);
        });
        
        const spacer = document.createElement('div');
        spacer.style.width='20px'; spacer.style.flexShrink='0';
        list.appendChild(spacer);
    },

    updateGlobalStats: function() {
        document.getElementById('perf-total-tracks').innerText = this.tracks.length;
    }
};

PerfLogic.init();
