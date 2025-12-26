/* PERF.JS - V6 (HUBS, SVG, UNDO, ZOOM FIX) */

window.PerfLogic = {
    map: null,
    userMarker: null,
    tracks: JSON.parse(localStorage.getItem('driverhub_tracks') || '[]'),
    
    // Creator State
    isCreatorMode: false,
    selectedPin: 'start', 
    creatorPoints: [], 
    routeLayer: null,
    
    // Cache für Hub Marker
    hubMarkers: [],

    init: function() {
        console.log("PerfLogic Init V6");
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
        // Init Map
        this.map = L.map('perf-map', {
            zoomControl: false, attributionControl: false,
            dragging: true, touchZoom: true, doubleClickZoom: true,
            scrollWheelZoom: true, boxZoom: false, keyboard: false, tap: false 
        }).setView([51.1657, 10.4515], 6); // Default DE

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19
        }).addTo(this.map);

        this.map.on('click', (e) => {
            if(this.isCreatorMode) this.placePinOnMap(e.latlng);
        });

        // Hubs laden, sobald Map bereit ist
        this.renderMapHubs();
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
                    this.userMarker = L.marker(latlng, {icon: icon, zIndexOffset: 1000}).addTo(this.map);
                    
                    // ZOOM FIX: Wenn nicht im Creator Mode, hart auf User zoomen beim ersten Finden
                    if(!this.isCreatorMode) {
                        this.map.setView(latlng, 16, {animate: true});
                    }
                } else {
                    this.userMarker.setLatLng(latlng);
                }
            }, err => console.warn(err), {enableHighAccuracy: true});
        }
    },

    // === HAUPTANSICHT LOGIK (HUBS & SELECT) ===

    renderMapHubs: function() {
        // Alte Hubs löschen
        this.hubMarkers.forEach(m => this.map.removeLayer(m));
        this.hubMarkers = [];

        this.tracks.forEach(track => {
            if(!track.pins || track.pins.length === 0) return;
            
            // Startpunkt nehmen
            const start = track.pins.find(p => p.type === 'start') || track.pins[0];
            const latlng = [start.lat, start.lng];

            const icon = L.divIcon({
                className: 'custom-hub',
                html: `<div class="track-hub-marker">
                        <span class="thm-name">${track.name}</span>
                        <span class="thm-time">${track.bestTime}</span>
                       </div>`,
                iconSize: [80, 40],
                iconAnchor: [40, 45] // Spitze unten mittig
            });

            const marker = L.marker(latlng, {icon: icon}).addTo(this.map);
            
            // Klick auf Hub -> Track laden & Card highlighten
            marker.on('click', () => {
                this.selectTrack(track);
            });

            this.hubMarkers.push(marker);
        });
    },

    selectTrack: function(track) {
        this.showTrackOnMap(track);
        
        // Card Highlighten
        document.querySelectorAll('.track-card').forEach(c => c.classList.remove('active-card'));
        const card = document.getElementById(`track-card-${track.id}`);
        if(card) {
            card.classList.add('active-card');
            card.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
    },

    showTrackOnMap: function(track) {
        // Aufräumen (außer User & Hubs)
        this.map.eachLayer((layer) => { 
            if (!layer._url && layer !== this.userMarker && !this.hubMarkers.includes(layer)) {
                this.map.removeLayer(layer); 
            }
        });

        // Route zeichnen
        if(track.routePath) {
            const poly = L.polyline(track.routePath, {color: '#ff3b30', weight: 5}).addTo(this.map);
            this.map.flyToBounds(poly.getBounds(), {padding: [50, 200], duration: 1.0}); // Padding unten größer für UI
        }
    },

    // === CREATOR MODE ===

    enterCreatorMode: function() {
        this.isCreatorMode = true;
        this.creatorPoints = []; 

        // UI Switch
        document.querySelector('.perf-content-scroll').style.display = 'none';
        document.querySelector('.perf-map-fade').style.display = 'none';
        document.querySelector('.perf-sub-nav').style.display = 'none';
        this.hubMarkers.forEach(m => m.setOpacity(0)); // Hubs ausblenden

        const creatorUI = document.getElementById('perf-creator-ui');
        creatorUI.classList.remove('hidden');
        
        // UNDO BUTTON EINFÜGEN (Falls noch nicht da)
        const pinsContainer = document.querySelector('.cb-pins-container');
        if(!document.getElementById('btn-undo')) {
            const undoBtn = document.createElement('button');
            undoBtn.id = 'btn-undo';
            undoBtn.className = 'cb-action-btn undo';
            undoBtn.innerHTML = '<i class="fa-solid fa-rotate-left"></i>';
            undoBtn.onclick = () => this.undoLastPoint();
            // Vor den Pins einfügen
            pinsContainer.parentNode.insertBefore(undoBtn, pinsContainer);
        }

        document.getElementById('nav-perf').parentElement.classList.add('hidden');

        // Map Setup
        const mapContainer = document.getElementById('perf-map-container');
        mapContainer.style.height = "100vh"; 
        mapContainer.style.zIndex = "0"; 
        mapContainer.style.position = "fixed"; 
        
        setTimeout(() => { 
            this.map.invalidateSize(); 
            if(this.userMarker) this.map.setView(this.userMarker.getLatLng(), 16);
        }, 100);

        this.selectPinType('start');
        document.getElementById('ct-dist').innerText = "0.0 km";
    },

    // === UNDO LOGIC ===
    undoLastPoint: function() {
        if(this.creatorPoints.length === 0) return;

        // 1. Letzten Punkt entfernen
        const lastPoint = this.creatorPoints.pop();
        this.map.removeLayer(lastPoint.marker);

        // 2. Logik zurücksetzen
        if(this.creatorPoints.length === 0) {
            // Wenn alles weg ist
            if(this.routeLayer) this.map.removeLayer(this.routeLayer);
            this.selectPinType('start');
            document.getElementById('ct-dist').innerText = "0.0 km";
        } else {
            // Wenn noch Punkte da sind -> Route neu berechnen
            this.calculateRoute();
            // Pin Type zurücksetzen (Wenn wir Finish gelöscht haben, wieder Finish anbieten)
            const lastType = this.creatorPoints[this.creatorPoints.length-1].type;
            if(lastType === 'start') this.selectPinType('check');
            if(lastType === 'check') this.selectPinType('check'); // oder finish
        }
    },

    quitCreator: function() {
        this.isCreatorMode = false;
        
        // UI Reset
        document.querySelector('.perf-content-scroll').style.display = 'block';
        document.querySelector('.perf-map-fade').style.display = 'block';
        document.querySelector('.perf-sub-nav').style.display = 'flex';
        this.hubMarkers.forEach(m => m.setOpacity(1)); // Hubs wieder an

        document.getElementById('perf-creator-ui').classList.add('hidden');
        document.getElementById('nav-perf').parentElement.classList.remove('hidden');

        const mapContainer = document.getElementById('perf-map-container');
        mapContainer.style.height = "50vh";
        mapContainer.style.zIndex = "0";
        mapContainer.style.position = "absolute";
        
        setTimeout(() => { this.map.invalidateSize(); }, 300);
        this.clearCreatorMap();
    },

    // ... (selectPinType, placePinOnMap, calculateRoute, clearCreatorMap wie vorher) ...
    // Ich füge sie der Vollständigkeit halber ein, damit du copy-pasten kannst.

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
        this.calculateRoute();
    },

    calculateRoute: function() {
        if(this.creatorPoints.length < 2) {
            if(this.routeLayer) this.map.removeLayer(this.routeLayer);
            return;
        }

        const coords = this.creatorPoints.map(p => `${p.latlng.lng},${p.latlng.lat}`).join(';');
        const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;

        fetch(url).then(r => r.json()).then(data => {
            if(data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                if(this.routeLayer) this.map.removeLayer(this.routeLayer);
                
                const latlngs = route.geometry.coordinates.map(c => [c[1], c[0]]);
                this.routeLayer = L.polyline(latlngs, {color: '#bf5af2', weight: 5, opacity: 0.8}).addTo(this.map);

                const distKm = (route.distance / 1000).toFixed(2);
                const timeMin = Math.round(route.duration / 60);
                
                document.getElementById('ct-dist').innerText = distKm + " km";
                document.getElementById('ct-time').innerText = timeMin + " min";
                
                this.currentRouteGeo = latlngs;
                this.currentRouteStats = { dist: distKm + " km", time: timeMin + " min" };
            }
        });
    },

    clearCreatorMap: function() {
        this.creatorPoints.forEach(p => this.map.removeLayer(p.marker));
        if(this.routeLayer) this.map.removeLayer(this.routeLayer);
        this.creatorPoints = [];
        this.routeLayer = null;
        document.getElementById('ct-dist').innerText = "0.0 km";
    },

    saveTrack: function() {
        const hasStart = this.creatorPoints.some(p => p.type === 'start');
        const hasFinish = this.creatorPoints.some(p => p.type === 'finish');
        
        if(!hasStart || !hasFinish) { alert("Start & Finish required!"); return; }
        if(!this.currentRouteGeo) { alert("No route found."); return; }

        const name = prompt("Name your Track:", "My Track");
        if(name) {
            const track = {
                id: Date.now(),
                name: name,
                routePath: this.currentRouteGeo, 
                pins: this.creatorPoints.map(p => ({lat: p.latlng.lat, lng: p.latlng.lng, type: p.type})),
                dist: this.currentRouteStats.dist,
                bestTime: '---'
            };
            this.tracks.push(track);
            localStorage.setItem('driverhub_tracks', JSON.stringify(this.tracks));
            
            this.quitCreator();
            this.renderTrackList();
            this.renderMapHubs(); // Neue Hubs anzeigen
            this.updateGlobalStats();
        }
    },

    // === RENDER LIST + SVG GENERATOR ===

    renderTrackList: function() {
        const list = document.getElementById('perf-track-list');
        const createBtn = list.querySelector('.add-track-card');
        list.innerHTML = '';
        list.appendChild(createBtn);

        this.tracks.forEach(t => {
            // SVG generieren
            const svg = this.generateMiniMapSVG(t.routePath);

            const div = document.createElement('div');
            div.className = 'track-card';
            div.id = `track-card-${t.id}`; // ID für Scrolling
            div.innerHTML = `
                <div class="tc-map-preview">${svg}</div>
                <div class="tc-info">
                    <div class="tc-name">${t.name}</div>
                    <div class="tc-stats"><span><i class="fa-solid fa-trophy"></i> ${t.bestTime}</span><span><i class="fa-solid fa-road"></i> ${t.dist}</span></div>
                </div>`;
            div.onclick = () => this.selectTrack(t);
            list.appendChild(div);
        });
        const spacer = document.createElement('div');
        spacer.style.width='20px'; spacer.style.flexShrink='0';
        list.appendChild(spacer);
    },

    // Helper: SVG aus Geo-Koordinaten bauen
    generateMiniMapSVG: function(latlngs) {
        if(!latlngs || latlngs.length === 0) return '';

        // 1. Bounding Box finden
        let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
        latlngs.forEach(p => {
            if(p[0] < minLat) minLat = p[0];
            if(p[0] > maxLat) maxLat = p[0];
            if(p[1] < minLng) minLng = p[1];
            if(p[1] > maxLng) maxLng = p[1];
        });

        // Puffer hinzufügen damit es nicht am Rand klebt
        const pad = 0.002; 
        minLat -= pad; maxLat += pad; minLng -= pad; maxLng += pad;

        // 2. Koordinaten in 100x60 System umrechnen
        const width = 100;
        const height = 60;
        
        const points = latlngs.map(p => {
            const x = ((p[1] - minLng) / (maxLng - minLng)) * width;
            const y = height - ((p[0] - minLat) / (maxLat - minLat)) * height; // Y umdrehen (SVG 0 ist oben)
            return `${x},${y}`;
        }).join(' ');

        // 3. SVG String zurückgeben
        return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
                    <polyline points="${points}" fill="none" stroke="#ff3b30" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
                </svg>`;
    },

    updateGlobalStats: function() {
        document.getElementById('perf-total-tracks').innerText = this.tracks.length;
    }
};

PerfLogic.init();
