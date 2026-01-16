/* ================================================= */
/* === PERF.JS - FINAL MASTER V80 (ALL FEATURES) === */
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
    selectedTrackLayer: null, 
    selectedTrackId: null,
    
    // --- SECTOR EDITOR VARS ---
    sectorSplits: [], 
    sectorMap: null,
    sectorColors: ['#bf5af2', '#30d158', '#007aff', '#ff9f0a', '#ff3b30'],
    currentSectorsData: [],
    cachedElevations: [],

    // --- CACHE & LAYERS ---
    hubMarkers: [], 
    
    // --- TEMP DATA ---
    currentRouteStats: { dist: "0 km", time: "--:--", elevUp: "0m", elevDown: "0m" },
    currentRouteGeo: null,
    startType: 'standing',

    // =================================================
    // 1. INITIALISIERUNG
    // =================================================
    init: function() {
        console.log("PerfLogic Init - Master Version");
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
                    
                    if(!this.isCreatorMode && !this.selectedTrackId) {
                        this.map.setView(latlng, 15);
                    }
                } else {
                    this.userMarker.setLatLng(latlng);
                }
            }, err => console.warn("GPS Error:", err), {enableHighAccuracy: true});
        }
    },

    // =================================================
    // 2. INTERACTION LOGIC
    // =================================================

    toggleTrackSelection: function(track) {
        if(this.selectedTrackId === track.id) {
            this.deselectTrack(); 
        } else {
            this.selectTrack(track);
        }
    },

    selectTrack: function(track) {
        this.selectedTrackId = track.id;
        this.showTrackOnMap(track);
        
        document.querySelectorAll('.track-card').forEach(c => c.classList.remove('active-card'));
        const card = document.getElementById(`track-card-${track.id}`);
        if(card) {
            card.classList.add('active-card');
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }

        this.updateStatsDisplay(track);
    },

    deselectTrack: function() {
        if(!this.selectedTrackId) return;
        this.selectedTrackId = null;

        if(this.selectedTrackLayer) {
            this.map.removeLayer(this.selectedTrackLayer);
            this.selectedTrackLayer = null;
        }
        
        this.map.eachLayer(layer => {
            if(layer instanceof L.Marker && layer !== this.userMarker && !this.hubMarkers.includes(layer)) {
                this.map.removeLayer(layer);
            }
        });

        document.querySelectorAll('.track-card').forEach(c => c.classList.remove('active-card'));
        this.updateStatsDisplay(null);
    },

    showTrackOnMap: function(track) {
        if(this.selectedTrackLayer) this.map.removeLayer(this.selectedTrackLayer);
        
        this.map.eachLayer(layer => {
            if(layer instanceof L.Marker && layer !== this.userMarker && !this.hubMarkers.includes(layer)) {
                this.map.removeLayer(layer);
            }
        });

        if(track.routePath) {
            this.selectedTrackLayer = L.polyline(track.routePath, {color: '#ff3b30', weight: 6}).addTo(this.map);
            this.map.flyToBounds(this.selectedTrackLayer.getBounds(), {
                paddingTopLeft: [30, 30],
                paddingBottomRight: [30, 180], 
                duration: 1.0
            });
        }

        if(track.pins) {
            track.pins.forEach(p => {
                if(p.type === 'start') {
                    const icon = L.divIcon({ 
                        className: 'custom-marker-wrap', 
                        html: `<div class="tm-marker tm-start"><i class="fa-solid fa-play" style="margin-left:2px;"></i></div>`, 
                        iconSize: [30,30], iconAnchor: [15,15] 
                    });
                    L.marker([p.lat, p.lng], {icon: icon}).addTo(this.map);
                }
                if(p.type === 'finish') {
                    const icon = L.divIcon({ 
                        className: 'custom-marker-wrap', 
                        html: `<div class="tm-marker tm-finish"><i class="fa-solid fa-flag-checkered"></i></div>`, 
                        iconSize: [30,30], iconAnchor: [15,15] 
                    });
                    L.marker([p.lat, p.lng], {icon: icon}).addTo(this.map);
                }
            });
        }
    },

    renderMapHubs: function() {
        this.hubMarkers.forEach(m => this.map.removeLayer(m));
        this.hubMarkers = [];

        this.tracks.forEach(track => {
            if(!track.routePath || track.routePath.length === 0) return;
            
            const midIndex = Math.floor(track.routePath.length / 2);
            const midPoint = track.routePath[midIndex]; 
            
            const iconHtml = `
                <div class="hub-fancy-wrapper">
                    <div class="hub-icon-box"><i class="fa-solid fa-flag-checkered"></i></div>
                    <div class="hub-info-box">
                        <span class="hub-label">TRACK</span>
                        <span class="hub-name">${track.name}</span>
                    </div>
                    <div class="hub-arrow-down"></div>
                </div>`;

            const icon = L.divIcon({
                className: 'custom-hub-icon',
                html: iconHtml,
                iconSize: [140, 42], iconAnchor: [70, 48] 
            });

            const marker = L.marker(midPoint, {icon: icon}).addTo(this.map);
            marker.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                this.toggleTrackSelection(track);
            });
            this.hubMarkers.push(marker);
        });
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
                <div class="p-stat-box"><label>ELEVATION</label>
                    <span style="font-size:0.8rem">
                        <i class="fa-solid fa-arrow-trend-up" style="color:#30d158"></i> ${track.elevUp || '0m'} 
                        <i class="fa-solid fa-arrow-trend-down" style="color:#ff3b30; margin-left:5px"></i> ${track.elevDown || '0m'}
                    </span>
                </div>`;
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
            if(this.userMarker) this.map.setView(this.userMarker.getLatLng(), 16);
        }, 100);

        this.selectPinType('start');
        document.getElementById('ct-dist').innerText = "0.0 km";
        document.getElementById('ct-elev').innerText = "0 m";
    },

    leaveCreatorMode: function() {
        if(this.creatorPoints.length > 0) {
            if(confirm("Discard Track creation?")) {
                this.quitCreator();
            }
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
        this.hubMarkers.forEach(m => m.setOpacity(1)); 
        this.renderMapHubs();
    },
    
    clearCreatorMap: function() {
        if(this.creatorPoints) {
            this.creatorPoints.forEach(p => {
                if(p.marker) this.map.removeLayer(p.marker);
            });
        }
        this.creatorPoints = [];
        if(this.routeLayer) {
            this.map.removeLayer(this.routeLayer);
            this.routeLayer = null;
        }
        document.getElementById('ct-dist').innerText = "0.0 km";
        document.getElementById('ct-elev').innerText = "0 m";
    },

    // =================================================
    // 4. PIN & ROUTING SYSTEM
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
        let className = 'pin-dot white';
        if(this.selectedPin === 'start') className = 'pin-dot green';
        if(this.selectedPin === 'finish') className = 'pin-dot red';

        const iconHtml = `<div class="${className}" style="width:16px;height:16px;"></div>`;
        const icon = L.divIcon({ className: 'custom-pin-icon', html: iconHtml, iconSize: [20,20], iconAnchor: [10,10] });

        const marker = L.marker(latlng, {icon: icon, interactive: true}).addTo(this.map);
        const pointData = { latlng: latlng, type: this.selectedPin, marker: marker };
        this.creatorPoints.push(pointData);

        marker.on('click', () => {
            if(this.selectedPin === 'remove') this.removePoint(pointData);
        });

        if(this.selectedPin === 'start') this.selectPinType('check');
        this.calculateRoute();
    },

    removePoint: function(pointObj) {
        this.map.removeLayer(pointObj.marker);
        this.creatorPoints = this.creatorPoints.filter(p => p !== pointObj);
        this.calculateRoute();
    },

    calculateRoute: function() {
        if(this.creatorPoints.length < 2) {
            if(this.routeLayer) this.map.removeLayer(this.routeLayer);
            this.routeLayer = null;
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

                this.fetchElevationForCreator(latlngs);
            }
        }).catch(err => console.log(err));
    },

    fetchElevationForCreator: function(latlngs) {
        const step = Math.ceil(latlngs.length / 10);
        const samplePoints = latlngs.filter((_, i) => i % step === 0);
        const latStr = samplePoints.map(p => p[0].toFixed(4)).join(',');
        const lngStr = samplePoints.map(p => p[1].toFixed(4)).join(',');

        fetch(`https://api.open-meteo.com/v1/elevation?latitude=${latStr}&longitude=${lngStr}`)
        .then(r => r.json())
        .then(data => {
            if(data.elevation) {
                this.cachedElevations = data.elevation;
                let up = 0, down = 0;
                let elevs = data.elevation;
                for(let i=1; i<elevs.length; i++) {
                    let diff = elevs[i] - elevs[i-1];
                    if(diff > 0) up += diff;
                    else down += Math.abs(diff);
                }
                this.currentRouteStats.elevUp = Math.round(up) + "m";
                this.currentRouteStats.elevDown = Math.round(down) + "m";
                
                const hudEl = document.getElementById('ct-elev');
                if(hudEl) hudEl.innerHTML = `<span style="color:#30d158"><i class="fa-solid fa-caret-up"></i> ${Math.round(up)}</span> <span style="color:#666">|</span> <span style="color:#ff3b30"><i class="fa-solid fa-caret-down"></i> ${Math.round(down)}</span>`;
            }
        });
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
        
        // MAP KILLER & SCROLL FIX
        const bgMap = document.getElementById('perf-map-container');
        if(bgMap) bgMap.style.display = 'none';
        const scrollBox = document.querySelector('.setup-content-scroll');
        if(scrollBox) scrollBox.addEventListener('touchmove', (e) => { e.stopPropagation(); }, { passive: true });

        // RESET SECTOR UI
        const sectorContainer = document.getElementById('sector-config-container');
        if(sectorContainer) {
            sectorContainer.innerHTML = `
            <div class="sector-add-card" onclick="PerfLogic.openSectorEditor()">
                <i class="fa-solid fa-plus-circle"></i> ADD SECTORS
            </div>`;
        }
        this.currentSectorsData = [];

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

            if(this.creatorPoints) {
                this.creatorPoints.forEach(p => {
                    if(p.type === 'start' || p.type === 'finish') {
                        const colorClass = p.type === 'start' ? 'green' : 'red';
                        const glowColor = p.type === 'start' ? '#30d158' : '#ff3b30';
                        const iconHtml = `<div class="pin-dot ${colorClass}" style="width:12px; height:12px; box-shadow: 0 0 8px ${glowColor};"></div>`;
                        const icon = L.divIcon({ className: 'custom-pin-icon', html: iconHtml, iconSize: [12,12], iconAnchor: [6,6] });
                        L.marker(p.latlng, {icon: icon}).addTo(this.setupMap);
                    }
                });
            }
        }, 200);
    },

    cancelSetup: function() {
        document.getElementById('perf-map-container').style.display = 'block';
        document.getElementById('track-setup-screen').classList.add('hidden');
        document.getElementById('perf-creator-ui').classList.remove('hidden');
    },

    // --- REPARIERTE SAVE FUNKTION ---
    finalizeSave: function() {
        const nameInput = document.getElementById('setup-name').value;
        const name = nameInput.trim() || "Unnamed Track";

        const tachoElement = document.getElementById('tacho-val-text');
        const targetSpeed = tachoElement ? tachoElement.innerText : "0";

        const track = {
            id: Date.now(),
            name: name,
            routePath: this.currentRouteGeo, 
            sectors: this.currentSectorsData || [], // SECTORS SPEICHERN!
            pins: this.creatorPoints.map(p => ({lat: p.latlng.lat, lng: p.latlng.lng, type: p.type})),
            dist: this.currentRouteStats.dist,
            elevUp: this.currentRouteStats.elevUp || "0m",
            elevDown: this.currentRouteStats.elevDown || "0m",
            bestTime: '---',
            config: {
                type: this.startType,
                flyTarget: targetSpeed,
                flyMin: document.getElementById('fly-min').value,
                flyMax: document.getElementById('fly-max').value
            }
        };

        this.tracks.push(track);
        localStorage.setItem('driverhub_tracks', JSON.stringify(this.tracks));
        
        document.getElementById('perf-map-container').style.display = 'block';
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

        if(type === 'flying') {
            flySettings.classList.remove('hidden'); 
            const currentVal = document.getElementById('tacho-val-text') ? document.getElementById('tacho-val-text').innerText : 120;
            setTimeout(() => this.updateTacho(currentVal), 50); 
        } else {
            flySettings.classList.add('hidden'); 
        }
    },

    // =================================================
    // 6. TACHO LOGIC V7 (DECOUPLED & SNAPPY)
    // =================================================

    _initTachoHTML: function() {
        const container = document.querySelector('.tacho-container');
        if (container && (!container.querySelector('.tacho-ticks') || container.innerHTML.trim() === '')) {
            container.innerHTML = ''; 
            container.classList.add('ready');

            const ticks = document.createElement('div'); ticks.className = 'tacho-ticks'; container.appendChild(ticks);
            const track = document.createElement('div'); track.className = 'tacho-track'; container.appendChild(track);
            const arc = document.createElement('div'); arc.className = 'tacho-arc'; arc.id = 'tacho-visual-arc'; container.appendChild(arc);
            const display = document.createElement('div'); display.className = 'tacho-value-display';
            display.innerHTML = `<div class="tacho-val" id="tacho-val-text">0</div><span class="tacho-unit">ENTRY SPEED</span>`;
            container.appendChild(display);
            const knobCont = document.createElement('div'); knobCont.className = 'tacho-knob-container'; knobCont.id = 'tacho-knob-rotator';
            knobCont.innerHTML = '<div class="tacho-knob"></div>'; container.appendChild(knobCont);
            
            this.updateTacho(120);
        }
    },

    updateTacho: function(val) {
        if(!document.querySelector('.tacho-track')) this._initTachoHTML();

        val = parseInt(val);
        val = Math.round(val / 5) * 5; 
        val = Math.max(0, Math.min(300, val));

        const textEl = document.getElementById('tacho-val-text');
        if(textEl) textEl.innerText = val;
        
        const percentage = val / 300; 
        const hue = 120 - (percentage * 120);
        const color = `hsl(${hue}, 100%, 50%)`;
        
        const container = document.querySelector('.tacho-container');
        if(container) {
            container.style.setProperty('--tacho-color', color);
            const cssPercent = percentage * 50; 
            container.style.setProperty('--tacho-percent', cssPercent + '%');
        }

        const knob = document.getElementById('tacho-knob-rotator');
        if(knob) {
            const knobDeg = -90 + (percentage * 180);
            knob.style.transform = `rotate(${knobDeg}deg)`;
        }

        const minInput = document.getElementById('fly-min');
        const maxInput = document.getElementById('fly-max');
        if(minInput && document.activeElement !== minInput) {
            minInput.value = Math.max(0, val - 5);
        }
        if(maxInput && document.activeElement !== maxInput) {
            maxInput.value = val + 5;
        }
    },

    stepValue: function(inputId, step) {
        const input = document.getElementById(inputId);
        let val = parseInt(input.value) || 0;
        const targetSpeed = parseInt(document.getElementById('tacho-val-text').innerText) || 0;

        val += step;

        if (inputId === 'fly-min') {
            if (val > targetSpeed) val = targetSpeed;
            if (val < 0) val = 0;
        }
        if (inputId === 'fly-max') {
            if (val < targetSpeed) val = targetSpeed;
            if (val > 350) val = 350;
        }
        input.value = val;
        if (navigator.vibrate) navigator.vibrate(5);
    },

    handleTachoTouch: function(event) {
        if(event.cancelable) event.preventDefault();
        const container = event.currentTarget;
        const rect = container.getBoundingClientRect();
        const clientX = event.touches ? event.touches[0].clientX : event.clientX;
        
        let percent = (clientX - rect.left) / rect.width;
        if(percent < 0) percent = 0;
        if(percent > 1) percent = 1;
        
        const rawVal = percent * 300;
        const snappedVal = Math.round(rawVal / 5) * 5;

        const currentText = document.getElementById('tacho-val-text');
        if(currentText && parseInt(currentText.innerText) !== snappedVal) {
            this.updateTacho(snappedVal);
            if (window.navigator && window.navigator.vibrate) window.navigator.vibrate(2);
        }
    },

    // =================================================
    // 7. SECTOR EDITOR (LOGIC)
    // =================================================

    openSectorEditor: function() {
        if(!this.currentRouteGeo) return;
        document.getElementById('sector-editor-overlay').classList.remove('hidden');
        
        if(!this.sectorMap) {
            this.sectorMap = L.map('sector-map', { zoomControl: false, attributionControl: false });
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(this.sectorMap);
            this.sectorMap.on('click', (e) => { this.handleSectorClick(e.latlng); });
        }
        
        this.sectorSplits = [0, this.currentRouteGeo.length - 1]; 
        
        setTimeout(() => {
            this.sectorMap.invalidateSize();
            this.renderSectorMap(); 
        }, 200);
    },

    closeSectorEditor: function() {
        document.getElementById('sector-editor-overlay').classList.add('hidden');
    },

    handleSectorClick: function(latlng) {
        let closestDist = Infinity;
        let closestIndex = -1;

        this.currentRouteGeo.forEach((pt, index) => {
            const pLat = L.latLng(pt[0], pt[1]);
            const dist = pLat.distanceTo(latlng);
            if(dist < closestDist) {
                closestDist = dist;
                closestIndex = index;
            }
        });

        if(closestDist > 50) return;
        const isTooClose = this.sectorSplits.some(idx => Math.abs(idx - closestIndex) < 5); 
        if(isTooClose) return;

        this.sectorSplits.push(closestIndex);
        this.sectorSplits.sort((a, b) => a - b);
        this.renderSectorMap();
        if(navigator.vibrate) navigator.vibrate(10);
    },

    undoSectorSplit: function() {
        if(this.sectorSplits.length <= 2) return; 
        this.sectorSplits.splice(this.sectorSplits.length - 2, 1);
        this.renderSectorMap();
    },

    renderSectorMap: function() {
        this.sectorMap.eachLayer(l => { if(!l._url) this.sectorMap.removeLayer(l); });
        const bounds = L.polyline(this.currentRouteGeo).getBounds();
        this.sectorMap.fitBounds(bounds, {padding: [50,50]});

        for(let i=0; i < this.sectorSplits.length - 1; i++) {
            const startIdx = this.sectorSplits[i];
            const endIdx = this.sectorSplits[i+1];
            const segment = this.currentRouteGeo.slice(startIdx, endIdx + 1);
            const color = this.sectorColors[i % this.sectorColors.length];
            
            L.polyline(segment, {color: color, weight: 6, opacity: 1}).addTo(this.sectorMap);
            
            if(i > 0) {
                const markerPos = this.currentRouteGeo[startIdx];
                const icon = L.divIcon({
                    className: 'split-marker',
                    html: `<div style="width:4px; height:20px; background:white; box-shadow:0 0 10px white; transform:rotate(45deg);"></div>`,
                    iconSize: [20,20], iconAnchor: [10,10]
                });
                L.marker(markerPos, {icon: icon}).addTo(this.sectorMap);
            }
        }
        
        const start = this.currentRouteGeo[0];
        const end = this.currentRouteGeo[this.currentRouteGeo.length-1];
        L.circleMarker(start, {radius: 6, color: '#30d158', fillOpacity: 1}).addTo(this.sectorMap);
        L.circleMarker(end, {radius: 6, color: '#ff3b30', fillOpacity: 1}).addTo(this.sectorMap);
    },

    saveSectors: function() {
        const container = document.getElementById('sector-config-container');
        container.innerHTML = `<div class="sector-list-container"></div>`;
        const list = container.querySelector('.sector-list-container');
        
        this.currentSectorsData = [];

        for(let i=0; i < this.sectorSplits.length - 1; i++) {
            const startIdx = this.sectorSplits[i];
            const endIdx = this.sectorSplits[i+1];
            
            let distMeters = 0;
            for(let j=startIdx; j < endIdx; j++) {
                const p1 = L.latLng(this.currentRouteGeo[j]);
                const p2 = L.latLng(this.currentRouteGeo[j+1]);
                distMeters += p1.distanceTo(p2);
            }
            const distKm = (distMeters / 1000).toFixed(2) + " km";

            let elevGain = 0;
            if(this.cachedElevations) {
                const ratio = this.cachedElevations.length / this.currentRouteGeo.length;
                const eStart = Math.floor(startIdx * ratio);
                const eEnd = Math.floor(endIdx * ratio);
                
                if(eEnd < this.cachedElevations.length) {
                     const diff = this.cachedElevations[eEnd] - this.cachedElevations[eStart];
                     const val = Math.round(diff);
                     elevGain = (val > 0 ? "+" : "") + val + "m";
                }
            } else {
                elevGain = "--";
            }

            const color = this.sectorColors[i % this.sectorColors.length];

            this.currentSectorsData.push({
                index: i+1, dist: distKm, elev: elevGain, startIdx: startIdx, endIdx: endIdx, color: color
            });

            const item = document.createElement('div');
            item.className = 'sector-item';
            item.style.borderLeftColor = color;
            item.innerHTML = `
                <div><div class="sec-num" style="color:${color}">SECTOR ${i+1}</div><div class="sec-title">Section ${i+1}</div></div>
                <div class="sec-stats">
                    <div class="sec-stat-box"><label>DIST</label><span>${distKm}</span></div>
                    <div class="sec-stat-box"><label>ELEV</label><span>${elevGain}</span></div>
                </div>`;
            item.onclick = () => this.openSectorEditor();
            list.appendChild(item);
        }
        
        const resetBtn = document.createElement('div');
        resetBtn.className = 'sector-add-card';
        resetBtn.style.minHeight = "50px";
        resetBtn.style.marginTop = "10px";
        resetBtn.style.fontSize = "0.7rem";
        resetBtn.innerHTML = '<i class="fa-solid fa-pen"></i> EDIT SECTORS';
        resetBtn.onclick = () => this.openSectorEditor();
        container.appendChild(resetBtn);

        this.closeSectorEditor();
    },

// =================================================
    // 8. RENDER FUNCTIONS
    // =================================================

    // --- RENDER LOGIC V3 (REAL DATA & DASHBOARD) ---

    renderTrackList: function() {
        // 1. STATS BERECHNEN (Nur echte Daten!)
        const trackCount = this.tracks.length;
        let bestTime = "---";
        let globalScore = "---";
        let scoreInt = 0;

        if (trackCount > 0) {
            const validTracks = this.tracks.filter(t => t.bestTime && t.bestTime !== '---');
            if(validTracks.length > 0) {
                bestTime = validTracks[0].bestTime; 
                scoreInt = trackCount * 150; 
                globalScore = scoreInt;
            } else {
                globalScore = "0";
            }
        }

        const contentArea = document.querySelector('.perf-content-scroll');
        
        // HTML AUFBAU
        let html = `
            <div class="perf-dashboard-header">
                <div class="pd-side-stat">
                    <label>BEST TIME</label>
                    <div class="val">${bestTime}</div>
                </div>
                <div class="pd-main-score">
                    <label>PRM SCORE</label>
                    <div class="val" id="global-score-display">${trackCount > 0 ? 0 : '---'}</div>
                </div>
                <div class="pd-side-stat">
                    <label>TRACKS</label>
                    <div class="val">${trackCount}</div>
                </div>
            </div>
            
            <div id="perf-track-list">
            </div>

            <div class="perf-history-section">
                <div class="ph-title">Recent Activity</div>
                <div id="perf-history-list">
                </div>
            </div>
        `;
        
        contentArea.innerHTML = html;
        
        // Animation für Score nur starten, wenn wir Daten haben
        if(trackCount > 0 && scoreInt > 0) {
            this.animateValue("global-score-display", 0, scoreInt, 1200);
        }

        // 2. TRACKS RENDERN
        const list = document.getElementById('perf-track-list');
        
        this.tracks.forEach((t, index) => {
            const div = document.createElement('div');
            div.className = 'track-card-v2';
            div.style.animationDelay = (index * 0.1) + "s"; // Staggered
            
            div.innerHTML = `
                <div class="tc-bg-map" id="mini-map-${t.id}"></div>
                <div class="tc-overlay"></div>
                <div class="tc-content">
                    <div class="tc-name">${t.name}</div>
                    <div class="tc-details">
                        <span><i class="fa-solid fa-road"></i> ${t.dist}</span>
                        <span><i class="fa-solid fa-trophy"></i> ${t.bestTime}</span>
                    </div>
                </div>
                <div class="tc-condition-badge" id="cond-badge-${t.id}">
                    <div class="cond-dot" style="background:#888;"></div>
                    <div class="cond-text">LOADING</div>
                </div>
            `;
            
            div.onclick = () => this.selectTrack(t); 
            list.appendChild(div);

            setTimeout(() => this.renderMiniMap(t), 200);
            this.checkTrackConditions(t); // Echter Wetter Check
        });

        // 3. ADD TRACK BUTTON (Immer am Ende der Liste)
        const addBtn = document.createElement('div');
        addBtn.className = 'add-track-v2';
        addBtn.style.animationDelay = (this.tracks.length * 0.1) + "s";
        addBtn.innerHTML = '<i class="fa-solid fa-plus-circle" style="margin-right:8px"></i> CREATE NEW TRACK';
        addBtn.onclick = () => this.enterCreatorMode();
        list.appendChild(addBtn);

        // 4. HISTORY RENDERN
        const historyList = document.getElementById('perf-history-list');
        const hasHistory = false; 

        if(!hasHistory) {
            historyList.innerHTML = `<div class="ph-empty">NO RECENT DRIVES RECORDED</div>`;
        }
    },

    // --- HELPER ---
    animateValue: function(id, start, end, duration) {
        const obj = document.getElementById(id);
        if(!obj) return;
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.innerHTML = Math.floor(progress * (end - start) + start);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    },

    // Placeholder functions needs for the script to run if not defined elsewhere yet
    renderMiniMap: function(t) { /* ... Mini Map Logic ... */ },
    checkTrackConditions: function(t) { /* ... Weather Logic ... */ }

}; // <--- HIER WAR DER FEHLER: Das Objekt muss geschlossen werden!

// Init call nach dem Schließen des Objekts
PerfLogic.init();
