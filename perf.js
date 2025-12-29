/* ================================================= */
/* === PERF.JS - V4 (DEBOUNCE / FINAL STABLE) === */
/* ================================================= */

window.PerfLogic = {
    // --- MAP VARIABLES ---
    map: null,
    setupMap: null,
    userMarker: null,

    // --- DATA ---
    tracks: JSON.parse(localStorage.getItem('driverhub_tracks') || '[]'),
    
    // --- STATE MANAGEMENT ---
    isCreatorMode: false,
    selectedPin: 'start', 
    creatorPoints: [], 
    routeLayer: null,
    selectedTrackId: null,
    
    // --- CACHE & LAYERS ---
    hubMarkers: [],
    selectedTrackLayer: null, 
    
    // --- TEMP DATA ---
    currentRouteStats: { dist: "0 km", time: "--:--", elevUp: "0m", elevDown: "0m" },
    currentRouteGeo: null,
    startType: 'standing',
    
    // --- SYSTEM VARIABLES ---
    watchId: null,
    currentPolyline: null,
    hasInitialZoom: false,
    
    // --- DER FIX (TIMER) ---
    calcTimer: null, // Speichert die Verzögerung

    // =================================================
    // 1. INITIALISIERUNG
    // =================================================
    init: function() {
        console.log("PerfLogic Init - V4 Debounce Loaded");
        this.renderTrackList();
        this.updateStatsDisplay(null);
    },

    onScreenShow: function() {
        if (!this.map) {
            this.loadMap();
        } else {
            setTimeout(() => { 
                this.map.invalidateSize(); 
            }, 200);
        }
        this.startUserTracking();
    },

    loadMap: function() {
        this.map = L.map('perf-map', {
            zoomControl: false, attributionControl: false,
            dragging: true, touchZoom: true, doubleClickZoom: true,
            scrollWheelZoom: true, boxZoom: false, keyboard: false, tap: false 
        }).setView([51.1657, 10.4515], 6);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19
        }).addTo(this.map);

        this.map.on('click', (e) => {
            if(this.isCreatorMode) {
                if(this.selectedPin !== 'remove') {
                    this.placePinOnMap(e.latlng);
                }
            } else {
                this.deselectTrack();
            }
        });

        this.renderMapHubs();
    },

    startUserTracking: function() {
        if (!navigator.geolocation) return;
        const options = { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 };

        if (!this.currentPolyline && this.isCreatorMode) {
            this.currentPolyline = L.polyline([], {color: '#bf5af2', weight: 5}).addTo(this.map);
        }

        if (this.watchId) navigator.geolocation.clearWatch(this.watchId);

        this.watchId = navigator.geolocation.watchPosition(pos => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const latlng = [lat, lng];

            if (!this.userMarker) {
                const icon = L.divIcon({ 
                    className: 'user-marker-wrap', 
                    html: '<div class="user-pulse"></div><div class="user-dot"></div>', 
                    iconSize: [40,40], iconAnchor: [20,20] 
                });
                this.userMarker = L.marker(latlng, {icon: icon, zIndexOffset: 1000}).addTo(this.map);
            } else {
                this.userMarker.setLatLng(latlng);
            }

            if(!this.hasInitialZoom && !this.selectedTrackId) {
                this.map.setView(latlng, 17);
                this.hasInitialZoom = true;
            }

            if (this.isCreatorMode) {
                this.creatorPoints.push({
                    lat: lat, lng: lng, alt: pos.coords.altitude, 
                    speed: pos.coords.speed, time: pos.timestamp, acc: pos.coords.accuracy
                });
                if (this.creatorPoints.length % 50 === 0) {
                    localStorage.setItem('driverhub_temp_track', JSON.stringify(this.creatorPoints));
                }
            }
        }, err => console.warn("GPS Error:", err), options);
    },

    // =================================================
    // 2. INTERACTION LOGIC
    // =================================================

    toggleTrackSelection: function(track) {
        if(this.selectedTrackId === track.id) this.deselectTrack(); 
        else this.selectTrack(track);
    },

    selectTrack: function(track) {
        this.selectedTrackId = track.id;
        this.showTrackOnMap(track);
        document.querySelectorAll('.track-card').forEach(c => c.classList.remove('active-card'));
        const card = document.getElementById(`track-card-${track.id}`);
        if(card) {
            card.classList.add('active-card');
            card.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
        this.updateStatsDisplay(track);
    },

    deselectTrack: function() {
        if(!this.selectedTrackId) return;
        this.selectedTrackId = null;
        if(this.selectedTrackLayer) this.map.removeLayer(this.selectedTrackLayer);
        this.map.eachLayer(layer => {
            if(layer instanceof L.Marker && layer !== this.userMarker && !this.hubMarkers.includes(layer)) {
                this.map.removeLayer(layer);
            }
        });
        document.querySelectorAll('.track-card').forEach(c => c.classList.remove('active-card'));
        this.updateStatsDisplay(null);
    },

    updateStatsDisplay: function(track) {
        const statsRow = document.getElementById('main-stats-row');
        const actionBar = document.getElementById('track-action-bar');
        const btnInfo = document.getElementById('btn-track-info');
        const btnEdit = document.getElementById('btn-track-edit');

        if(track) {
            actionBar.classList.remove('hidden'); 
            setTimeout(() => actionBar.classList.add('visible'), 10);
            btnInfo.classList.remove('hidden');
            btnEdit.classList.remove('hidden');
            statsRow.innerHTML = `
                <div class="p-stat-box"><label>LENGTH</label><span>${track.dist}</span></div>
                <div class="p-stat-box glow-text"><label>BEST TIME</label><span>${track.bestTime}</span></div>
                <div class="p-stat-box"><label>ELEVATION</label><span style="font-size:0.8rem"><i class="fa-solid fa-arrow-trend-up" style="color:#30d158"></i> ${track.elevUp || '0m'} <i class="fa-solid fa-arrow-trend-down" style="color:#ff3b30; margin-left:5px"></i> ${track.elevDown || '0m'}</span></div>`;
        } else {
            actionBar.classList.remove('visible');
            setTimeout(() => actionBar.classList.add('hidden'), 300);
            btnInfo.classList.add('hidden');
            btnEdit.classList.add('hidden');
            const totalScore = this.tracks.length * 150; 
            statsRow.innerHTML = `
                <div class="p-stat-box"><label>TRACKS</label><span id="perf-total-tracks">${this.tracks.length}</span></div>
                <div class="p-stat-box glow-text"><label>SCORE</label><span id="perf-global-score">${totalScore}</span></div>
                <div class="p-stat-box"><label>BEST TIME</label><span id="perf-best-time">--:--</span></div>`;
        }
    },

    // =================================================
    // 3. CREATOR MODE LOGIC
    // =================================================

    enterCreatorMode: function() {
        this.isCreatorMode = true;
        this.creatorPoints = []; 
        this.deselectTrack(); 
        this.hubMarkers.forEach(m => m.setOpacity(0));

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
            if(this.userMarker) this.map.setView(this.userMarker.getLatLng(), 17);
        }, 100);

        this.selectPinType('start');
        document.getElementById('ct-dist').innerText = "0.0 km";
        document.getElementById('ct-elev').innerText = "0 m";
    },

    leaveCreatorMode: function() {
        if(this.creatorPoints.length > 0) {
            if(confirm("Discard Track creation?")) this.quitCreator();
        } else {
            this.quitCreator();
        }
    },

    quitCreator: function() {
        this.isCreatorMode = false;
        this.clearCreatorMap(); 

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
        this.hubMarkers.forEach(m => m.setOpacity(1)); 
        this.renderMapHubs();
    },

    // =================================================
    // 4. PIN & ROUTING SYSTEM (DEBOUNCED)
    // =================================================

    selectPinType: function(type) {
        this.selectedPin = type;
        document.querySelectorAll('.cb-pin').forEach(el => el.classList.remove('active'));
        if(type === 'start') document.getElementById('pin-start').classList.add('active');
        if(type === 'check') document.getElementById('pin-check').classList.add('active');
        if(type === 'finish') document.getElementById('pin-finish').classList.add('active');
        if(type === 'remove') document.getElementById('pin-remove').classList.add('active');
    },

    placePinOnMap: function(latlng) {
        // --- 1. ERST AUFRÄUMEN OHNE BERECHNUNG ---
        // (False am Ende heißt: Nicht berechnen, wir machen das gleich am Ende einmal)
        if(this.selectedPin === 'start' || this.selectedPin === 'finish') {
            const existing = this.creatorPoints.find(p => p.type === this.selectedPin);
            if(existing) this.removePoint(existing, false); 
        }

        let className = 'pin-dot white';
        if(this.selectedPin === 'start') className = 'pin-dot green';
        if(this.selectedPin === 'finish') className = 'pin-dot red';

        const icon = L.divIcon({ className: 'custom-pin-icon', html: `<div class="${className}" style="width:16px;height:16px;"></div>`, iconSize: [20,20], iconAnchor: [10,10] });
        const marker = L.marker(latlng, {icon: icon, interactive: true}).addTo(this.map);
        
        const pointData = { latlng: latlng, type: this.selectedPin, marker: marker };
        this.creatorPoints.push(pointData);

        marker.on('click', () => {
            if(this.selectedPin === 'remove') this.removePoint(pointData, true);
        });

        if(this.selectedPin === 'start' && this.creatorPoints.length === 1) this.selectPinType('check');
        
        // --- 2. JETZT BERECHNEN (Verzögert) ---
        this.triggerRouteCalculation();
    },

    removePoint: function(pointObj, shouldCalc = true) {
        if(pointObj.marker) this.map.removeLayer(pointObj.marker);
        this.creatorPoints = this.creatorPoints.filter(p => p !== pointObj);
        
        if(shouldCalc) this.triggerRouteCalculation();
    },

    // --- DER NEUE TRIGGER: Wartet 300ms bevor er loslegt ---
    triggerRouteCalculation: function() {
        // Wenn schon ein Timer läuft: STOPPEN (Abbrechen)
        if(this.calcTimer) clearTimeout(this.calcTimer);

        // UI Feedback sofort:
        document.getElementById('ct-dist').innerText = "Wait...";

        // Neuen Timer setzen
        this.calcTimer = setTimeout(() => {
            this.executeRouteCalculation();
        }, 400); // 400ms warten
    },

    executeRouteCalculation: function() {
        // 1. Alte Route löschen
        if(this.routeLayer) {
            this.map.removeLayer(this.routeLayer);
            this.routeLayer = null;
        }

        if(this.creatorPoints.length < 2) {
            document.getElementById('ct-dist').innerText = "0.0 km";
            return;
        }

        document.getElementById('ct-dist').innerText = "Calc...";

        const coords = this.creatorPoints.map(p => `${p.latlng.lng},${p.latlng.lat}`).join(';');
        const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;

        fetch(url)
        .then(r => r.json())
        .then(data => {
            if(data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                this.drawRoute(route.geometry.coordinates.map(c => [c[1], c[0]]));
                const distKm = (route.distance / 1000).toFixed(2);
                const timeMin = Math.round(route.duration / 60);
                this.updateRouteUI(distKm, timeMin);
            } else {
                console.warn("No route found. Fallback.");
                this.drawFallbackRoute();
            }
        })
        .catch(err => {
            console.error("OSRM Error:", err);
            this.drawFallbackRoute();
        });
    },

    drawRoute: function(latlngs) {
        if(this.routeLayer) this.map.removeLayer(this.routeLayer);
        this.routeLayer = L.polyline(latlngs, {color: '#bf5af2', weight: 5, opacity: 0.8}).addTo(this.map);
        this.currentRouteGeo = latlngs;
        this.fetchElevationForCreator(latlngs);
    },

    drawFallbackRoute: function() {
        if(this.routeLayer) this.map.removeLayer(this.routeLayer);
        const simpleLine = this.creatorPoints.map(p => p.latlng);
        this.routeLayer = L.polyline(simpleLine, {
            color: '#bf5af2', weight: 4, dashArray: '10, 10', opacity: 0.7
        }).addTo(this.map);
        
        this.currentRouteGeo = simpleLine;
        
        let totalDist = 0;
        for(let i=0; i<simpleLine.length-1; i++) {
            totalDist += this.map.distance(simpleLine[i], simpleLine[i+1]);
        }
        const distKm = (totalDist / 1000).toFixed(2);
        this.updateRouteUI(distKm, "??");
    },

    updateRouteUI: function(dist, time) {
        document.getElementById('ct-dist').innerText = dist + " km";
        document.getElementById('ct-time').innerText = time + " min";
        this.currentRouteStats.dist = dist + " km";
        this.currentRouteStats.time = time + " min";
    },

    fetchElevationForCreator: function(latlngs) {
        if(!latlngs || latlngs.length === 0) return;
        const step = Math.ceil(latlngs.length / 15);
        const samplePoints = latlngs.filter((_, i) => i % step === 0);
        const latStr = samplePoints.map(p => p[0].toFixed(4)).join(',');
        const lngStr = samplePoints.map(p => p[1].toFixed(4)).join(',');

        fetch(`https://api.open-meteo.com/v1/elevation?latitude=${latStr}&longitude=${lngStr}`)
        .then(r => r.json())
        .then(data => {
            if(data.elevation) {
                let up = 0, down = 0;
                let elevs = data.elevation;
                for(let i=1; i<elevs.length; i++) {
                    let diff = elevs[i] - elevs[i-1];
                    if(diff > 0) up += diff; else down += Math.abs(diff);
                }
                this.currentRouteStats.elevUp = Math.round(up) + "m";
                this.currentRouteStats.elevDown = Math.round(down) + "m";
                const hudEl = document.getElementById('ct-elev');
                if(hudEl) hudEl.innerText = `+${Math.round(up)} / -${Math.round(down)}`;
            }
        }).catch(e => console.log("Elev Error", e));
    },

    clearCreatorMap: function() {
        if(this.creatorPoints) {
            this.creatorPoints.forEach(p => {
                if(p.marker) this.map.removeLayer(p.marker);
            });
        }
        if(this.routeLayer) this.map.removeLayer(this.routeLayer);
        
        this.creatorPoints = [];
        this.routeLayer = null;
        this.currentRouteGeo = null;
        if(this.calcTimer) clearTimeout(this.calcTimer); // Timer stoppen
        
        document.getElementById('ct-dist').innerText = "0.0 km";
        document.getElementById('ct-elev').innerText = "0 m";
    },

    // =================================================
    // 5. SETUP & SAVE LOGIC
    // =================================================

    saveTrack: function() {
        const hasStart = this.creatorPoints.some(p => p.type === 'start');
        const hasFinish = this.creatorPoints.some(p => p.type === 'finish');
        if(!hasStart || !hasFinish) { alert("Start & Finish required!"); return; }
        if(!this.currentRouteGeo) { alert("No route found."); return; }
        this.openSetupScreen();
    },

    openSetupScreen: function() {
        document.getElementById('perf-creator-ui').classList.add('hidden');
        const setupScreen = document.getElementById('track-setup-screen');
        setupScreen.classList.remove('hidden');
        
        if(!this.setupMap) {
            this.setupMap = L.map('setup-map', {
                zoomControl: false, attributionControl: false,
                dragging: false, touchZoom: false, doubleClickZoom: false, scrollWheelZoom: false
            });
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(this.setupMap);
        }

        setTimeout(() => {
            this.setupMap.invalidateSize();
            this.setupMap.eachLayer(l => { if(!l._url) this.setupMap.removeLayer(l); });
            if(this.currentRouteGeo) {
                const poly = L.polyline(this.currentRouteGeo, {color: '#ff3b30', weight: 5}).addTo(this.setupMap);
                this.setupMap.fitBounds(poly.getBounds(), {padding: [50, 50]});
            }
        }, 200);
    },

    cancelSetup: function() {
        document.getElementById('track-setup-screen').classList.add('hidden');
        document.getElementById('perf-creator-ui').classList.remove('hidden');
    },

    finalizeSave: function() {
        const nameInput = document.getElementById('setup-name').value;
        const name = nameInput.trim() || "Unnamed Track";

        const track = {
            id: Date.now(),
            name: name,
            routePath: this.currentRouteGeo, 
            pins: this.creatorPoints.map(p => ({lat: p.latlng.lat, lng: p.latlng.lng, type: p.type})),
            dist: this.currentRouteStats.dist,
            elevUp: this.currentRouteStats.elevUp || "0m",
            elevDown: this.currentRouteStats.elevDown || "0m",
            bestTime: '---',
            config: {
                type: this.startType,
                flyTarget: document.getElementById('fly-target').value,
                flyMin: document.getElementById('fly-min').value,
                flyMax: document.getElementById('fly-max').value
            }
        };

        this.tracks.push(track);
        localStorage.setItem('driverhub_tracks', JSON.stringify(this.tracks));
        
        document.getElementById('track-setup-screen').classList.add('hidden');
        this.quitCreator(); 
        
        this.renderTrackList();
        this.renderMapHubs(); 
        this.updateStatsDisplay(null);
    },

    setStartType: function(type) {
        this.startType = type;
        document.getElementById('btn-standing').classList.toggle('active', type === 'standing');
        document.getElementById('btn-flying').classList.toggle('active', type === 'flying');
        const flySettings = document.getElementById('flying-settings');
        if(type === 'flying') flySettings.classList.remove('hidden'); else flySettings.classList.add('hidden');
    },

    stepValue: function(inputId, step) {
        const input = document.getElementById(inputId);
        let val = parseInt(input.value) || 0;
        val += step;
        if(val < 0) val = 0; input.value = val;
    },

    // =================================================
    // 6. RENDER FUNCTIONS
    // =================================================

    renderTrackList: function() {
        const list = document.getElementById('perf-track-list');
        list.innerHTML = ''; 
        this.tracks.forEach(t => {
            const div = document.createElement('div');
            div.className = 'track-card';
            div.id = `track-card-${t.id}`;
            div.innerHTML = `
                <div class="tc-map-preview" id="mini-map-${t.id}"></div>
                <div class="tc-info">
                    <div class="tc-name">${t.name}</div>
                    <div class="tc-stats"><span><i class="fa-solid fa-trophy"></i> ${t.bestTime}</span><span><i class="fa-solid fa-road"></i> ${t.dist}</span></div>
                </div>`;
            div.onclick = (e) => { e.stopPropagation(); this.toggleTrackSelection(t); };
            list.appendChild(div);
            setTimeout(() => this.renderMiniMap(t), 200);
        });

        const createDiv = document.createElement('div');
        createDiv.className = 'track-card add-track-card';
        createDiv.onclick = (e) => { e.stopPropagation(); this.enterCreatorMode(); };
        createDiv.innerHTML = `<div class="add-icon"><i class="fa-solid fa-plus"></i></div><span>CREATE TRACK</span>`;
        list.appendChild(createDiv);
        
        const spacer = document.createElement('div');
        spacer.style.width='20px'; spacer.style.flexShrink='0';
        list.appendChild(spacer);
    },

    renderMiniMap: function(track) {
        const container = document.getElementById(`mini-map-${track.id}`);
        if(!container || container._leaflet_id) return; 
        const miniMap = L.map(container, {
            zoomControl: false, attributionControl: false, dragging: false, touchZoom: false, doubleClickZoom: false, scrollWheelZoom: false, boxZoom: false, keyboard: false, tap: false
        });
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(miniMap);
        if(track.routePath && track.routePath.length > 0) {
            const poly = L.polyline(track.routePath, {color: '#ff3b30', weight: 6}).addTo(miniMap);
            setTimeout(() => { miniMap.invalidateSize(); miniMap.fitBounds(poly.getBounds(), {padding: [10, 10]}); }, 300);
        }
    },

    renderMapHubs: function() {
        this.hubMarkers.forEach(m => this.map.removeLayer(m));
        this.hubMarkers = [];
        this.tracks.forEach(track => {
            if(!track.pins || track.pins.length === 0) return;
            const start = track.pins.find(p => p.type === 'start') || track.pins[0];
            const icon = L.divIcon({
                className: 'custom-hub',
                html: `<div class="track-hub-marker"><span class="thm-name">${track.name}</span></div>`,
                iconSize: [80, 30], iconAnchor: [40, 35]
            });
            const marker = L.marker([start.lat, start.lng], {icon: icon}).addTo(this.map);
            marker.on('click', (e) => { L.DomEvent.stopPropagation(e); this.toggleTrackSelection(track); });
            this.hubMarkers.push(marker);
        });
    },

    showTrackOnMap: function(track) {
        if(this.selectedTrackLayer) this.map.removeLayer(this.selectedTrackLayer);
        this.map.eachLayer(layer => {
            if(layer instanceof L.Marker && layer !== this.userMarker && !this.hubMarkers.includes(layer)) this.map.removeLayer(layer);
        });
        if(track.routePath) {
            this.selectedTrackLayer = L.polyline(track.routePath, {color: '#ff3b30', weight: 6}).addTo(this.map);
            this.map.flyToBounds(this.selectedTrackLayer.getBounds(), { paddingTopLeft: [30, 30], paddingBottomRight: [30, 180], duration: 1.0 });
        }
        if(track.pins) {
            track.pins.forEach(p => {
                if(p.type === 'start' || p.type === 'finish') {
                    const iconHtml = `<div class="pulsing-dot-${p.type === 'start' ? 'green' : 'red'}"></div>`;
                    const icon = L.divIcon({ className: 'd', html: iconHtml, iconSize: [15,15] });
                    L.marker([p.lat, p.lng], {icon: icon}).addTo(this.map);
                }
            });
        }
    }
};

PerfLogic.init();
