/* PERF.JS - V6 (SMART ROUTING & FIXES) */

window.PerfLogic = {
    map: null,
    userMarker: null,
    tracks: JSON.parse(localStorage.getItem('driverhub_tracks') || '[]'),
    
    // Creator State
    isCreatorMode: false,
    selectedPin: 'start', 
    creatorPoints: [], 
    routeLayer: null, // Statt Polyline nutzen wir das hier für die echte Route

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
        // START FIX: Letzte Position laden oder Default DE
        const savedPos = JSON.parse(localStorage.getItem('last_known_pos') || '[51.1657, 10.4515]');
        const zoom = localStorage.getItem('last_known_pos') ? 15 : 6;

        this.map = L.map('perf-map', {
            zoomControl: false, attributionControl: false,
            dragging: true, touchZoom: true, doubleClickZoom: true,
            scrollWheelZoom: true, boxZoom: false, keyboard: false, tap: false 
        }).setView(savedPos, zoom);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19
        }).addTo(this.map);

        this.map.on('click', (e) => {
            if(this.isCreatorMode) this.placePinOnMap(e.latlng);
        });
    },

    startUserTracking: function() {
        if(navigator.geolocation) {
            navigator.geolocation.watchPosition(pos => {
                const latlng = [pos.coords.latitude, pos.coords.longitude];
                
                // Position speichern für nächsten Start
                localStorage.setItem('last_known_pos', JSON.stringify(latlng));

                if(!this.userMarker) {
                    const icon = L.divIcon({
                        className: 'user-marker-wrap', 
                        html: '<div class="user-pulse"></div><div class="user-dot"></div>',
                        iconSize: [40,40], iconAnchor: [20,20]
                    });
                    this.userMarker = L.marker(latlng, {icon: icon}).addTo(this.map);
                    // Nur hinspringen wenn kein Creator Mode UND beim allerersten Mal
                    if(!this.isCreatorMode && !localStorage.getItem('last_known_pos')) this.map.setView(latlng, 15);
                } else {
                    this.userMarker.setLatLng(latlng);
                }
            }, err => console.warn(err), {enableHighAccuracy: true});
        }
    },

    // === CREATOR MODE ===

    enterCreatorMode: function() {
        this.isCreatorMode = true;
        this.creatorPoints = []; 

        document.querySelector('.perf-content-scroll').style.display = 'none';
        document.querySelector('.perf-map-fade').style.display = 'none';
        document.querySelector('.perf-sub-nav').style.display = 'none';
        
        document.getElementById('perf-creator-ui').classList.remove('hidden');
        document.getElementById('nav-perf').parentElement.classList.add('hidden');

        const mapContainer = document.getElementById('perf-map-container');
        mapContainer.style.height = "100vh"; 
        mapContainer.style.zIndex = "0"; 
        mapContainer.style.position = "fixed"; 
        
        setTimeout(() => { 
            this.map.invalidateSize(); 
            // Falls User Marker da ist, zentrieren
            if(this.userMarker) this.map.setView(this.userMarker.getLatLng(), 16);
        }, 100);

        this.selectPinType('start');
        document.getElementById('ct-dist').innerText = "0.0 km";
        document.getElementById('ct-time').innerText = "--:--";
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

        document.querySelector('.perf-content-scroll').style.display = 'block';
        document.querySelector('.perf-map-fade').style.display = 'block';
        document.querySelector('.perf-sub-nav').style.display = 'flex';
        
        document.getElementById('perf-creator-ui').classList.add('hidden');
        document.getElementById('nav-perf').parentElement.classList.remove('hidden');

        const mapContainer = document.getElementById('perf-map-container');
        mapContainer.style.height = "50vh";
        mapContainer.style.zIndex = "0";
        mapContainer.style.position = "absolute";
        
        setTimeout(() => { this.map.invalidateSize(); }, 300);

        this.clearCreatorMap();
    },

    // === PIN & ROUTING LOGIC ===

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
        
        // ROUTE BERECHNEN (OSRM)
        this.calculateRoute();
    },

    calculateRoute: function() {
        if(this.creatorPoints.length < 2) return;

        // Koordinaten String bauen (lng,lat;lng,lat...)
        const coords = this.creatorPoints.map(p => `${p.latlng.lng},${p.latlng.lat}`).join(';');
        
        // OSRM API Call (Auto Profil)
        const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;

        fetch(url)
        .then(r => r.json())
        .then(data => {
            if(data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                
                // Alte Route löschen
                if(this.routeLayer) this.map.removeLayer(this.routeLayer);
                
                // Neue Route zeichnen
                const latlngs = route.geometry.coordinates.map(c => [c[1], c[0]]); // GeoJSON ist lng,lat -> Leaflet braucht lat,lng
                this.routeLayer = L.polyline(latlngs, {color: '#bf5af2', weight: 5, opacity: 0.8}).addTo(this.map);

                // Stats updaten
                const distKm = (route.distance / 1000).toFixed(2);
                const timeMin = Math.round(route.duration / 60);
                
                document.getElementById('ct-dist').innerText = distKm + " km";
                document.getElementById('ct-time').innerText = timeMin + " min";
                
                // Merken der Geometrie für späteres Speichern
                this.currentRouteGeo = latlngs;
                this.currentRouteStats = { dist: distKm + " km", time: timeMin + " min" };
            }
        })
        .catch(err => console.error("Routing Error:", err));
    },

    clearCreatorMap: function() {
        this.creatorPoints.forEach(p => this.map.removeLayer(p.marker));
        if(this.routeLayer) this.map.removeLayer(this.routeLayer);
        this.creatorPoints = [];
        this.routeLayer = null;
        document.getElementById('ct-dist').innerText = "0.0 km";
        document.getElementById('ct-time').innerText = "--:--";
    },

    saveTrack: function() {
        const hasStart = this.creatorPoints.some(p => p.type === 'start');
        const hasFinish = this.creatorPoints.some(p => p.type === 'finish');
        
        if(!hasStart || !hasFinish) {
            alert("Track needs START and FINISH!");
            return;
        }
        
        if(!this.currentRouteGeo) {
            alert("No valid route calculated yet.");
            return;
        }

        const name = prompt("Name your Track:", "My Track");
        if(name) {
            const track = {
                id: Date.now(),
                name: name,
                // Wir speichern jetzt die ECHTE Route (viele Punkte), nicht nur die Pins
                routePath: this.currentRouteGeo, 
                pins: this.creatorPoints.map(p => ({lat: p.latlng.lat, lng: p.latlng.lng, type: p.type})),
                dist: this.currentRouteStats.dist,
                estTime: this.currentRouteStats.time,
                bestTime: '---'
            };
            
            this.tracks.push(track);
            localStorage.setItem('driverhub_tracks', JSON.stringify(this.tracks));
            
            this.isCreatorMode = false; 
            this.quitCreator();
            this.renderTrackList();
            this.updateGlobalStats();
        }
    },

    // === RENDER & VIEW LOGIC ===

    renderTrackList: function() {
        const list = document.getElementById('perf-track-list');
        list.innerHTML = ''; // Alles leeren

        // 1. Gespeicherte Tracks rendern
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
            // Klick lädt den Track auf die Map
            div.onclick = () => this.showTrackOnMap(t);
            list.appendChild(div);
        });

        // 2. "Create Track" Button AM ENDE (Rechts)
        const createDiv = document.createElement('div');
        createDiv.className = 'track-card add-track-card';
        createDiv.onclick = () => this.enterCreatorMode();
        createDiv.innerHTML = `
            <div class="add-icon"><i class="fa-solid fa-plus"></i></div>
            <span>CREATE TRACK</span>
        `;
        list.appendChild(createDiv);
        
        // Spacer
        const spacer = document.createElement('div');
        spacer.style.width='20px'; spacer.style.flexShrink='0';
        list.appendChild(spacer);
    },

    // Track auf der Haupt-Karte anzeigen
    showTrackOnMap: function(track) {
        // Map bereinigen
        this.map.eachLayer((layer) => { 
            if (!layer._url && layer !== this.userMarker) this.map.removeLayer(layer); 
        });

        // Route zeichnen
        if(track.routePath) {
            const poly = L.polyline(track.routePath, {color: '#ff3b30', weight: 5}).addTo(this.map);
            this.map.flyToBounds(poly.getBounds(), {padding: [50, 50], duration: 1.5});
        }

        // Pins setzen
        if(track.pins) {
            track.pins.forEach(p => {
                let color = '#fff';
                if(p.type === 'start') color = '#30d158';
                if(p.type === 'finish') color = '#ff3b30';
                
                const iconHtml = `<div style="width:12px;height:12px;background:${color};border:2px solid white;border-radius:50%;box-shadow:0 0 10px ${color};"></div>`;
                const icon = L.divIcon({ className: 'd', html: iconHtml, iconSize: [12,12] });
                L.marker([p.lat, p.lng], {icon: icon}).addTo(this.map);
            });
        }
    },

    updateGlobalStats: function() {
        document.getElementById('perf-total-tracks').innerText = this.tracks.length;
    }
};

PerfLogic.init();
