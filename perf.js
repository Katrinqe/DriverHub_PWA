/* PERF.JS - V5 (FORCE INTERACTION) */

window.PerfLogic = {
    map: null,
    userMarker: null,
    tracks: JSON.parse(localStorage.getItem('driverhub_tracks') || '[]'),
    
    // Creator State
    isCreatorMode: false,
    selectedPin: 'start', 
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
        // Init OHNE "tap: true" (Das macht oft Probleme auf Mobile)
        this.map = L.map('perf-map', {
            zoomControl: false, 
            attributionControl: false,
            dragging: true,
            touchZoom: true,
            doubleClickZoom: true,
            scrollWheelZoom: true,
            boxZoom: false,
            keyboard: false
        }).setView([51.1657, 10.4515], 6);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19
        }).addTo(this.map);

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
                if(!this.userMarker) {
                    const icon = L.divIcon({
                        className: 'user-marker-wrap', 
                        html: '<div class="user-pulse"></div><div class="user-dot"></div>',
                        iconSize: [40,40], iconAnchor: [20,20]
                    });
                    this.userMarker = L.marker(latlng, {icon: icon}).addTo(this.map);
                    if(!this.isCreatorMode) this.map.setView(latlng, 15);
                } else {
                    this.userMarker.setLatLng(latlng);
                }
            }, err => console.warn(err), {enableHighAccuracy: true});
        }
    },

    // === CREATOR MODE (DER FIX) ===

    enterCreatorMode: function() {
        this.isCreatorMode = true;
        this.creatorPoints = []; 

        // 1. STÖRENFRIEDE KOMPLETT ENTFERNEN (Display: none)
        // Das ist der Unterschied: Wir verstecken sie nicht nur, wir nehmen sie aus dem Layout.
        document.querySelector('.perf-content-scroll').style.display = 'none';
        document.querySelector('.perf-map-fade').style.display = 'none';
        document.querySelector('.perf-sub-nav').style.display = 'none'; // Leiste weg
        
        // UI einblenden
        document.getElementById('perf-creator-ui').classList.remove('hidden');
        document.getElementById('nav-perf').parentElement.classList.add('hidden'); // Main Nav weg

        // 2. MAP AUF VOLLBILD ZWINGEN
        const mapContainer = document.getElementById('perf-map-container');
        mapContainer.style.height = "100vh"; 
        mapContainer.style.zIndex = "0"; // Brutal nach vorne
        mapContainer.style.position = "fixed"; // Sicherstellen dass es steht
        
        // 3. LEAFLET AUFWECKEN
        setTimeout(() => { 
            this.map.invalidateSize(); 
            this.map.dragging.enable();
            this.map.touchZoom.enable();
        }, 100);

        this.selectPinType('start');
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

        // 1. ALLES WIEDERHERSTELLEN
        document.querySelector('.perf-content-scroll').style.display = 'block';
        document.querySelector('.perf-map-fade').style.display = 'block';
        document.querySelector('.perf-sub-nav').style.display = 'flex';
        
        document.getElementById('perf-creator-ui').classList.add('hidden');
        document.getElementById('nav-perf').parentElement.classList.remove('hidden');

        // 2. MAP ZURÜCKSETZEN
        const mapContainer = document.getElementById('perf-map-container');
        mapContainer.style.height = "50vh";
        mapContainer.style.zIndex = "0";
        mapContainer.style.position = "absolute";
        
        setTimeout(() => { this.map.invalidateSize(); }, 300);

        this.clearCreatorMap();
    },

    // === PIN LOGIC (Bleibt gleich) ===

    selectPinType: function(type) {
        this.selectedPin = type;
        document.querySelectorAll('.cb-pin').forEach(el => el.classList.remove('active'));
        if(type === 'start') document.getElementById('pin-start').classList.add('active');
        if(type === 'check') document.getElementById('pin-check').classList.add('active');
        if(type === 'finish') document.getElementById('pin-finish').classList.add('active');
    },

    placePinOnMap: function(latlng) {
        let className = 'pin-dot white';
        if(this.selectedPin === 'start') className = 'pin-dot green';
        if(this.selectedPin === 'finish') className = 'pin-dot red';

        const iconHtml = `<div class="${className}" style="width:16px;height:16px;"></div>`;
        const icon = L.divIcon({ className: 'custom-pin-icon', html: iconHtml, iconSize: [20,20], iconAnchor: [10,10] });

        const marker = L.marker(latlng, {icon: icon}).addTo(this.map);
        this.creatorPoints.push({ latlng: latlng, type: this.selectedPin, marker: marker });

        if(this.selectedPin === 'start') this.selectPinType('check');
        this.drawCreatorPolyline();
    },

    drawCreatorPolyline: function() {
        if(this.polyLine) this.map.removeLayer(this.polyLine);
        const latlngs = this.creatorPoints.map(p => p.latlng);
        if(latlngs.length > 1) {
            this.polyLine = L.polyline(latlngs, {color: '#bf5af2', weight: 4, dashArray: '10, 10'}).addTo(this.map);
            let dist = 0;
            for(let i=0; i<latlngs.length-1; i++) dist += latlngs[i].distanceTo(latlngs[i+1]);
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
                points: this.creatorPoints.map(p => ({lat: p.latlng.lat, lng: p.latlng.lng, type: p.type})),
                dist: document.getElementById('ct-dist').innerText,
                bestTime: '---'
            };
            this.tracks.push(track);
            localStorage.setItem('driverhub_tracks', JSON.stringify(this.tracks));
            
            this.isCreatorMode = false; // Flag resetten
            this.quitCreator();
            this.renderTrackList();
            this.updateGlobalStats();
        }
    },

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
                    <div class="tc-stats"><span><i class="fa-solid fa-trophy"></i> ${t.bestTime}</span><span><i class="fa-solid fa-road"></i> ${t.dist}</span></div>
                </div>`;
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
