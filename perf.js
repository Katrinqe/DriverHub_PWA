/* PERF.JS - V12 (SPLIT SCREEN, LIVE ELEVATION, STABLE UI) */

window.PerfLogic = {
    map: null,
    setupMap: null,
    userMarker: null,
    tracks: JSON.parse(localStorage.getItem('driverhub_tracks') || '[]'),
    
    isCreatorMode: false,
    selectedPin: 'start', 
    creatorPoints: [], 
    routeLayer: null,
    selectedTrackId: null,
    
    hubMarkers: [],
    selectedTrackLayer: null, 
    
    // Temp Speicher für Route Stats
    currentRouteStats: { dist: "0 km", time: "--:--", elevUp: "0m", elevDown: "0m" },
    currentRouteGeo: null,

    init: function() {
        this.renderTrackList();
        this.updateStatsDisplay();
    },

    onScreenShow: function() {
        if (!this.map) this.loadMap();
        else setTimeout(() => { this.map.invalidateSize(); }, 200);
        this.startUserTracking();
    },

    loadMap: function() {
        this.map = L.map('perf-map', {
            zoomControl: false, attributionControl: false,
            dragging: true, touchZoom: true, doubleClickZoom: true,
            scrollWheelZoom: true, boxZoom: false, keyboard: false, tap: false 
        }).setView([51.1657, 10.4515], 6);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(this.map);

        this.map.on('click', (e) => {
            if(this.isCreatorMode) {
                if(this.selectedPin !== 'remove') this.placePinOnMap(e.latlng);
            } else {
                this.deselectTrack();
            }
        });
        this.renderMapHubs();
    },

    startUserTracking: function() {
        if(navigator.geolocation) {
            navigator.geolocation.watchPosition(pos => {
                const latlng = [pos.coords.latitude, pos.coords.longitude];
                if(!this.userMarker) {
                    const icon = L.divIcon({ className: 'user-marker-wrap', html: '<div class="user-pulse"></div><div class="user-dot"></div>', iconSize: [40,40], iconAnchor: [20,20] });
                    this.userMarker = L.marker(latlng, {icon: icon, zIndexOffset: 1000}).addTo(this.map);
                    if(!this.isCreatorMode && !this.selectedTrackId) this.map.setView(latlng, 15);
                } else {
                    this.userMarker.setLatLng(latlng);
                }
            }, e=>{}, {enableHighAccuracy: true});
        }
    },

    // === INTERACTION ===
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
            // Zeige Start Button (über Klasse für Animation)
            actionBar.classList.add('visible');
            btnInfo.classList.remove('hidden');
            btnEdit.classList.remove('hidden');

            statsRow.innerHTML = `
                <div class="p-stat-box"><label>LENGTH</label><span>${track.dist}</span></div>
                <div class="p-stat-box glow-text"><label>BEST TIME</label><span>${track.bestTime}</span></div>
                <div class="p-stat-box">
                    <label>ELEVATION</label>
                    <span style="font-size:0.8rem">
                        <i class="fa-solid fa-arrow-trend-up" style="color:#30d158"></i> ${track.elevUp} 
                        <i class="fa-solid fa-arrow-trend-down" style="color:#ff3b30; margin-left:5px"></i> ${track.elevDown}
                    </span>
                </div>
            `;
        } else {
            // Verstecke Start Button
            actionBar.classList.remove('visible');
            btnInfo.classList.add('hidden');
            btnEdit.classList.add('hidden');

            const totalScore = this.tracks.length * 150; 
            statsRow.innerHTML = `
                <div class="p-stat-box"><label>TRACKS</label><span id="perf-total-tracks">${this.tracks.length}</span></div>
                <div class="p-stat-box glow-text"><label>SCORE</label><span id="perf-global-score">${totalScore || '---'}</span></div>
                <div class="p-stat-box"><label>BEST TIME</label><span id="perf-best-time">--:--</span></div>
            `;
        }
    },

    // === CREATOR MODE ===
    enterCreatorMode: function() {
        this.isCreatorMode = true;
        this.creatorPoints = []; 
        this.deselectTrack(); // UI Reset
        
        // UI Switch
        document.querySelector('.perf-content-scroll').style.display = 'none';
        document.querySelector('.perf-map-fade').style.display = 'none';
        document.querySelector('.perf-sub-nav').style.display = 'none';
        document.getElementById('perf-creator-ui').classList.remove('hidden');
        document.getElementById('nav-perf').parentElement.classList.add('hidden');

        const mapContainer = document.getElementById('perf-map-container');
        mapContainer.style.height = "100vh"; mapContainer.style.zIndex = "0"; mapContainer.style.position = "fixed"; 
        
        setTimeout(() => { 
            this.map.invalidateSize(); 
            if(this.userMarker) this.map.setView(this.userMarker.getLatLng(), 16);
        }, 100);

        this.selectPinType('start');
        document.getElementById('ct-dist').innerText = "0.0 km";
        document.getElementById('ct-elev').innerText = "0 m"; // Reset Elev
    },

    // === ROUTE CALCULATION (MIT LIVE ELEVATION) ===
    calculateRoute: function() {
        if(this.creatorPoints.length < 2) {
            if(this.routeLayer) this.map.removeLayer(this.routeLayer);
            document.getElementById('ct-dist').innerText = "0.0 km";
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
                this.currentRouteStats.dist = distKm + " km";
                this.currentRouteStats.time = timeMin + " min";

                // DIREKT HÖHE ABFRAGEN FÜR CREATOR HUD
                this.fetchElevationForCreator(latlngs);
            }
        });
    },

    fetchElevationForCreator: function(latlngs) {
        // Sampling um API Requests klein zu halten
        const step = Math.ceil(latlngs.length / 10);
        const samplePoints = latlngs.filter((_, i) => i % step === 0);
        const latStr = samplePoints.map(p => p[0].toFixed(4)).join(',');
        const lngStr = samplePoints.map(p => p[1].toFixed(4)).join(',');

        fetch(`https://api.open-meteo.com/v1/elevation?latitude=${latStr}&longitude=${lngStr}`)
        .then(r=>r.json()).then(data => {
            if(data.elevation) {
                let up = 0, down = 0;
                let elevs = data.elevation;
                for(let i=1; i<elevs.length; i++) {
                    let diff = elevs[i] - elevs[i-1];
                    if(diff > 0) up += diff; else down += Math.abs(diff);
                }
                // Save for later
                this.currentRouteStats.elevUp = Math.round(up) + "m";
                this.currentRouteStats.elevDown = Math.round(down) + "m";
                
                // UPDATE HUD
                const hudEl = document.getElementById('ct-elev');
                if(hudEl) hudEl.innerText = `+${Math.round(up)} / -${Math.round(down)}`;
            }
        });
    },

    // === SETUP SCREEN ===
    openSetupScreen: function() {
        document.getElementById('track-setup-screen').classList.remove('hidden');
        
        if(!this.setupMap) {
            this.setupMap = L.map('setup-map', {
                zoomControl: false, attributionControl: false,
                dragging: false, touchZoom: false, doubleClickZoom: false, scrollWheelZoom: false
            });
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(this.setupMap);
        }

        setTimeout(() => {
            this.setupMap.invalidateSize();
            // Map Reset
            this.setupMap.eachLayer(l => { if(!l._url) this.setupMap.removeLayer(l); });
            
            if(this.currentRouteGeo) {
                const poly = L.polyline(this.currentRouteGeo, {color: '#ff3b30', weight: 5}).addTo(this.setupMap);
                this.setupMap.fitBounds(poly.getBounds(), {padding: [50, 50]});
            }
        }, 200);
    },

    finalizeSave: function() {
        const name = document.getElementById('setup-name').value.trim() || "Unnamed Track";
        const track = {
            id: Date.now(),
            name: name,
            routePath: this.currentRouteGeo, 
            pins: this.creatorPoints.map(p => ({lat: p.latlng.lat, lng: p.latlng.lng, type: p.type})),
            dist: this.currentRouteStats.dist,
            elevUp: this.currentRouteStats.elevUp || "0m",
            elevDown: this.currentRouteStats.elevDown || "0m",
            bestTime: '---'
        };

        this.tracks.push(track);
        localStorage.setItem('driverhub_tracks', JSON.stringify(this.tracks));
        
        document.getElementById('track-setup-screen').classList.add('hidden');
        this.quitCreator(); 
        this.renderTrackList();
        this.renderMapHubs(); 
        this.updateStatsDisplay(null);
    },

    // Standard Helper
    leaveCreatorMode: function() { if(this.creatorPoints.length>0 && confirm("Discard?")) this.quitCreator(); else this.quitCreator(); },
    quitCreator: function() { this.isCreatorMode = false; document.querySelector('.perf-content-scroll').style.display = 'block'; document.querySelector('.perf-map-fade').style.display = 'block'; document.querySelector('.perf-sub-nav').style.display = 'flex'; document.getElementById('perf-creator-ui').classList.add('hidden'); document.getElementById('nav-perf').parentElement.classList.remove('hidden'); const mapContainer = document.getElementById('perf-map-container'); mapContainer.style.height = "50vh"; mapContainer.style.zIndex = "0"; mapContainer.style.position = "absolute"; setTimeout(() => { this.map.invalidateSize(); }, 300); this.clearCreatorMap(); this.hubMarkers.forEach(m => m.setOpacity(1)); this.renderMapHubs(); },
    saveTrack: function() { 
        const hasStart = this.creatorPoints.some(p => p.type === 'start'); 
        const hasFinish = this.creatorPoints.some(p => p.type === 'finish');
        if(!hasStart || !hasFinish) { alert("Start & Finish required!"); return; }
        if(!this.currentRouteGeo) { alert("No route found."); return; }
        this.openSetupScreen(); 
    },
    
    // ... restliche Helper (placePinOnMap, selectPinType etc.) bleiben gleich wie V11 ...
    selectPinType: function(type) { this.selectedPin = type; document.querySelectorAll('.cb-pin').forEach(el => el.classList.remove('active')); if(type === 'start') document.getElementById('pin-start').classList.add('active'); if(type === 'check') document.getElementById('pin-check').classList.add('active'); if(type === 'finish') document.getElementById('pin-finish').classList.add('active'); if(type === 'remove') document.getElementById('pin-remove').classList.add('active'); },
    placePinOnMap: function(latlng) { let className = 'pin-dot white'; if(this.selectedPin === 'start') className = 'pin-dot green'; if(this.selectedPin === 'finish') className = 'pin-dot red'; const iconHtml = `<div class="${className}" style="width:16px;height:16px;"></div>`; const icon = L.divIcon({ className: 'custom-pin-icon', html: iconHtml, iconSize: [20,20], iconAnchor: [10,10] }); const marker = L.marker(latlng, {icon: icon, interactive: true}).addTo(this.map); const pointData = { latlng: latlng, type: this.selectedPin, marker: marker }; this.creatorPoints.push(pointData); marker.on('click', () => { if(this.selectedPin === 'remove') this.removePoint(pointData); }); if(this.selectedPin === 'start') this.selectPinType('check'); this.calculateRoute(); },
    removePoint: function(pointObj) { this.map.removeLayer(pointObj.marker); this.creatorPoints = this.creatorPoints.filter(p => p !== pointObj); this.calculateRoute(); },
    clearCreatorMap: function() { this.creatorPoints.forEach(p => this.map.removeLayer(p.marker)); if(this.routeLayer) this.map.removeLayer(this.routeLayer); this.creatorPoints = []; this.routeLayer = null; document.getElementById('ct-dist').innerText = "0.0 km"; document.getElementById('ct-elev').innerText = "0 m";},
    renderTrackList: function() { const list = document.getElementById('perf-track-list'); list.innerHTML = ''; this.tracks.forEach(t => { const div = document.createElement('div'); div.className = 'track-card'; div.id = `track-card-${t.id}`; div.innerHTML = `<div class="tc-map-preview" id="mini-map-${t.id}"></div><div class="tc-info"><div class="tc-name">${t.name}</div><div class="tc-stats"><span><i class="fa-solid fa-trophy"></i> ${t.bestTime}</span><span><i class="fa-solid fa-road"></i> ${t.dist}</span></div></div>`; div.onclick = (e) => { e.stopPropagation(); this.toggleTrackSelection(t); }; list.appendChild(div); setTimeout(() => this.renderMiniMap(t), 200); }); const createDiv = document.createElement('div'); createDiv.className = 'track-card add-track-card'; createDiv.onclick = (e) => { e.stopPropagation(); this.enterCreatorMode(); }; createDiv.innerHTML = `<div class="add-icon"><i class="fa-solid fa-plus"></i></div><span>CREATE TRACK</span>`; list.appendChild(createDiv); const spacer = document.createElement('div'); spacer.style.width='20px'; spacer.style.flexShrink='0'; list.appendChild(spacer); },
    renderMiniMap: function(track) { const container = document.getElementById(`mini-map-${track.id}`); if(!container || container._leaflet_id) return; const miniMap = L.map(container, {zoomControl: false, attributionControl: false, dragging: false, touchZoom: false, doubleClickZoom: false, scrollWheelZoom: false, boxZoom: false, keyboard: false, tap: false}); L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(miniMap); if(track.routePath && track.routePath.length > 0) { const poly = L.polyline(track.routePath, {color: '#ff3b30', weight: 6}).addTo(miniMap); setTimeout(() => { miniMap.invalidateSize(); miniMap.fitBounds(poly.getBounds(), {padding: [10, 10]}); }, 300); } },
    renderMapHubs: function() { this.hubMarkers.forEach(m => this.map.removeLayer(m)); this.hubMarkers = []; this.tracks.forEach(track => { if(!track.pins || track.pins.length === 0) return; const start = track.pins.find(p => p.type === 'start') || track.pins[0]; const icon = L.divIcon({ className: 'custom-hub', html: `<div class="track-hub-marker"><span class="thm-name">${track.name}</span></div>`, iconSize: [80, 30], iconAnchor: [40, 35] }); const marker = L.marker([start.lat, start.lng], {icon: icon}).addTo(this.map); marker.on('click', (e) => { L.DomEvent.stopPropagation(e); this.toggleTrackSelection(track); }); this.hubMarkers.push(marker); }); },
    showTrackOnMap: function(track) { if(this.selectedTrackLayer) this.map.removeLayer(this.selectedTrackLayer); this.map.eachLayer(layer => { if(layer instanceof L.Marker && layer !== this.userMarker && !this.hubMarkers.includes(layer)) { this.map.removeLayer(layer); } }); if(track.routePath) { this.selectedTrackLayer = L.polyline(track.routePath, {color: '#ff3b30', weight: 6}).addTo(this.map); this.map.flyToBounds(this.selectedTrackLayer.getBounds(), { paddingTopLeft: [30, 30], paddingBottomRight: [30, 180], duration: 1.0 }); } if(track.pins) { track.pins.forEach(p => { if(p.type === 'start' || p.type === 'finish') { const iconHtml = `<div class="pulsing-dot-${p.type === 'start' ? 'green' : 'red'}"></div>`; const icon = L.divIcon({ className: 'd', html: iconHtml, iconSize: [15,15] }); L.marker([p.lat, p.lng], {icon: icon}).addTo(this.map); } }); } },
    stepValue: function(inputId, step) { const input = document.getElementById(inputId); let val = parseInt(input.value) || 0; val += step; if(val < 0) val = 0; input.value = val; },
    setStartType: function(type) { /* ... (Toggle Logik aus V10) ... */ },
    cancelSetup: function() { document.getElementById('track-setup-screen').classList.add('hidden'); }
};

PerfLogic.init();
