/* ================================================= */
/* === PERF.JS - TRUE MASTER (FULL INTEGRITY)    === */
/* ================================================= */

window.PerfLogic = {
    // =================================================
    // 1. DATA & VARIABLES
    // =================================================
    map: null,
    setupMap: null,
    userMarker: null,
    
    // Daten aus LocalStorage laden
    tracks: JSON.parse(localStorage.getItem('driverhub_tracks') || '[]'),
    
    // Status Variablen Creator Mode
    isCreatorMode: false,
    selectedPin: 'start', 
    creatorPoints: [], 
    routeLayer: null,          
    selectedTrackLayer: null, 
    selectedTrackId: null,
    
    // Sektor Editor Variablen
    sectorSplits: [], 
    sectorMap: null,
    sectorColors: ['#ff3b30', '#00e5ff', '#30d158', '#bf5af2', '#ff9f0a', '#ffffff'], 
    currentSectorsData: [],
    
    // Cache & Temp Daten
    cachedElevations: [],
    hubMarkers: [], 
    currentRouteStats: { dist: "0 km", time: "--:--", elevUp: "0m", elevDown: "0m" },
    currentRouteGeo: null,
    startType: 'standing',

    // =================================================
    // 2. INITIALISIERUNG
    // =================================================
    init: function() {
        console.log("PerfLogic INIT - Full Version Loaded");
        this.renderTrackList();
        
        // Initialer Check: Analytics Tab verstecken, Track Tab zeigen
        this.switchTab('track'); 
    },

    // =================================================
    // 3. TAB SWITCHING (TRACK | DRAG | ANALYTICS)
    // =================================================
    switchTab: function(tabName) {
        console.log("Switching Tab to:", tabName);

        // 1. Buttons zurücksetzen
        const allBtns = document.querySelectorAll('.psn-item');
        allBtns.forEach(btn => btn.classList.remove('active'));

        // 2. Aktiven Button setzen
        const activeBtn = document.getElementById('btn-tab-' + tabName);
        if(activeBtn) activeBtn.classList.add('active');

        // 3. Alle Views ausblenden
        const views = ['track', 'drag', 'analytics'];
        views.forEach(v => {
            const el = document.getElementById('view-' + v);
            if(el) el.style.display = 'none';
        });

        // 4. Gewählten View einblenden
        const targetView = document.getElementById('view-' + tabName);
        if(targetView) {
            targetView.style.display = 'block';
            // Scroll nach oben
            const scrollContainer = document.querySelector('.perf-content-scroll');
            if(scrollContainer) scrollContainer.scrollTop = 0;
        }

        // 5. Wenn Analytics gewählt wurde -> Daten laden
        if(tabName === 'analytics') {
            this.updateLiveDashboard();
        }
    },

    // =================================================
    // 4. MAP SYSTEM (LEAFLET)
    // =================================================
    onScreenShow: function() {
        // Wird aufgerufen, wenn der Performance Tab sichtbar wird
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

        // Klick-Handler für Map (Unterscheidung Creator / Normal)
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
                    
                    // Nur zoomen, wenn wir nicht grad was machen
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
    // 5. INTERACTION LOGIC (TRACK SELECTION)
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
        if(this.isCreatorMode) {
            this.showTrackOnMap(track);
        } else {
            // Normaler Modus: Könnte Details öffnen
            console.log("Selected Track: " + track.name);
            // Optional: Fokus auf Map setzen
            const mapContainer = document.getElementById('perf-map-container');
            if(mapContainer) mapContainer.style.opacity = 1;
            this.showTrackOnMap(track);
        }
    },

    deselectTrack: function() {
        if(!this.selectedTrackId) return;
        this.selectedTrackId = null;

        if(this.selectedTrackLayer) {
            this.map.removeLayer(this.selectedTrackLayer);
            this.selectedTrackLayer = null;
        }
        
        // Marker aufräumen (außer User & Hubs)
        this.map.eachLayer(layer => {
            if(layer instanceof L.Marker && layer !== this.userMarker && !this.hubMarkers.includes(layer)) {
                this.map.removeLayer(layer);
            }
        });
    },

    showTrackOnMap: function(track) {
        if(this.selectedTrackLayer) this.map.removeLayer(this.selectedTrackLayer);
        
        // Clean old markers
        this.map.eachLayer(layer => {
            if(layer instanceof L.Marker && layer !== this.userMarker && !this.hubMarkers.includes(layer)) {
                this.map.removeLayer(layer);
            }
        });

        // Route zeichnen
        if(track.routePath) {
            this.selectedTrackLayer = L.polyline(track.routePath, {color: '#ff3b30', weight: 6}).addTo(this.map);
            this.map.flyToBounds(this.selectedTrackLayer.getBounds(), {
                paddingTopLeft: [30, 30],
                paddingBottomRight: [30, 180], 
                duration: 1.0
            });
        }

        // Pins zeichnen
        if(track.pins) {
            track.pins.forEach(p => {
                const icon = L.divIcon({ 
                    className: 'custom-marker-wrap', 
                    html: `<div class="tm-marker tm-${p.type}"><i class="fa-solid fa-${p.type === 'start' ? 'play' : 'flag-checkered'}"></i></div>`, 
                    iconSize: [30,30], iconAnchor: [15,15] 
                });
                L.marker([p.lat, p.lng], {icon: icon}).addTo(this.map);
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

    // =================================================
    // 6. CREATOR MODE LOGIC (MIT FIX FÜR NAV BAR)
    // =================================================
    enterCreatorMode: function() {
        console.log("Entering Creator Mode...");
        this.isCreatorMode = true;
        this.creatorPoints = []; 
        this.deselectTrack();
        this.hubMarkers.forEach(m => m.setOpacity(0)); 

        document.body.classList.add('creator-active');
        
        // --- FIX: NAV BAR & HAUPT NAV HIDE ---
        // 1. Sub-Nav (Track/Drag/Analytics) ausblenden
        const subNav = document.querySelector('.perf-sub-nav');
        if(subNav) subNav.style.display = 'none';
        
        // 2. HAUPT NAV (Home/Map/Garage) ausblenden
        // Wir suchen nach dem Element mit der ID "nav-bar" oder der Klasse "nav-bar"
        const mainNav = document.getElementById('nav-bar') || document.querySelector('.nav-bar') || document.querySelector('nav');
        if(mainNav) {
            mainNav.style.display = 'none'; // Hart ausblenden
            mainNav.classList.add('hidden-force'); // Klasse setzen falls nötig
        }

        // UI Anzeigen
        document.getElementById('perf-creator-ui').classList.remove('hidden');

        // Map Fix
        setTimeout(() => { 
            if(this.map) {
                this.map.invalidateSize(); 
                this.map.dragging.enable();
                this.map.touchZoom.enable();
                this.map.locate({setView: true, maxZoom: 17, enableHighAccuracy: true});
                if(this.userMarker) {
                    this.map.setView(this.userMarker.getLatLng(), 17);
                }
            }
        }, 100);

        this.selectPinType('start');
        document.getElementById('ct-dist').innerText = "0.0 km";
        document.getElementById('ct-elev').innerText = "0 m";
    },

    quitCreator: function() {
        console.log("Quitting Creator Mode...");
        this.isCreatorMode = false;
        
        document.body.classList.remove('creator-active');

        // --- FIX: NAV BAR RESTORE ---
        // 1. Sub-Nav wieder anzeigen
        const subNav = document.querySelector('.perf-sub-nav');
        if(subNav) subNav.style.display = 'flex';

        // 2. HAUPT NAV wieder anzeigen
        const mainNav = document.getElementById('nav-bar') || document.querySelector('.nav-bar') || document.querySelector('nav');
        if(mainNav) {
            mainNav.style.display = ''; // Style entfernen
            mainNav.classList.remove('hidden-force');
            // Fallback falls display flex war
            mainNav.style.display = 'flex'; 
        }

        document.getElementById('perf-creator-ui').classList.add('hidden');

        this.clearCreatorMap();
        this.hubMarkers.forEach(m => m.setOpacity(1)); 
        this.renderMapHubs();
        this.renderTrackList(); 
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
    // 7. PIN & ROUTING SYSTEM
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
                this.routeLayer = L.polyline(latlngs, {color: '#ff3b30', weight: 5, opacity: 0.8}).addTo(this.map);

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
    // 8. SETUP & SAVE LOGIC
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
        document.getElementById('track-setup-screen').classList.remove('hidden');
        
        // Hide Sub Nav
        const navBar = document.querySelector('.perf-sub-nav');
        if(navBar) navBar.style.display = 'none'; 

        // HTML INJECTEN
        const scrollContent = document.querySelector('.setup-content-scroll');
        scrollContent.innerHTML = `
            <div class="setup-card">
                <h2>CONFIGURE TRACK</h2>
                <div class="config-group"><label>TRACK NAME</label><div class="fancy-input-wrap"><input type="text" id="setup-name" placeholder="Ex: Midnight Run" value="Unnamed Track"></div></div>
                <div class="config-group"><label>START TYPE</label><div class="fancy-toggle-row"><button class="fancy-toggle active" id="btn-standing" onclick="PerfLogic.setStartType('standing')"><i class="fa-solid fa-flag"></i> STANDING</button><button class="fancy-toggle" id="btn-flying" onclick="PerfLogic.setStartType('flying')"><i class="fa-solid fa-plane-departure"></i> FLYING</button></div></div>
                <div id="flying-settings" class="hidden"><div class="tacho-container"></div><div class="fly-grid-row"><div class="fly-col"><label>MIN SPEED</label><div class="stepper-control"><div class="step-btn" onclick="PerfLogic.stepValue('fly-min', -5)">-</div><div class="step-display"><input type="number" id="fly-min" value="30" readonly></div><div class="step-btn" onclick="PerfLogic.stepValue('fly-min', 5)">+</div></div></div><div class="fly-col"><label>MAX SPEED</label><div class="stepper-control"><div class="step-btn" onclick="PerfLogic.stepValue('fly-max', -5)">-</div><div class="step-display"><input type="number" id="fly-max" value="300" readonly></div><div class="step-btn" onclick="PerfLogic.stepValue('fly-max', 5)">+</div></div></div></div></div>
                <div class="config-group" style="margin-top:20px;"><label>SECTORS & SPLITS</label><div id="sector-config-container"><div class="sector-add-card" onclick="PerfLogic.openSectorEditor()"><i class="fa-solid fa-plus-circle"></i> ADD SECTORS</div></div></div>
                <div class="prm-engine-box"><div class="prm-bg-stripes"></div><div class="prm-title">PRM CALCULATION ENGINE</div><div class="prm-status"><div class="prm-dot"></div>WAITING FOR TRACK DATA</div></div>
                <div class="setup-actions"><button class="btn-discard-text" onclick="PerfLogic.cancelSetup()">DISCARD</button><button class="btn-save-final" onclick="PerfLogic.finalizeSave()">SAVE TRACK</button></div>
            </div>
        `;

        if(!this.setupMap) {
            this.setupMap = L.map('setup-map', { zoomControl: false, attributionControl: false, dragging: false, touchZoom: false, doubleClickZoom: false, scrollWheelZoom: false });
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

        this.setStartType('standing'); 
        this.currentSectorsData = [];
        this._initTachoHTML(); 
    },

    cancelSetup: function() {
        document.getElementById('track-setup-screen').classList.add('hidden');
        document.getElementById('perf-creator-ui').classList.remove('hidden');
    },

    finalizeSave: function() {
        const nameInput = document.getElementById('setup-name').value;
        const name = nameInput.trim() || "Unnamed Track";
        const tachoElement = document.getElementById('tacho-val-text');
        const targetSpeed = tachoElement ? tachoElement.innerText : "0";

        const track = {
            id: Date.now(),
            name: name,
            routePath: this.currentRouteGeo, 
            sectors: this.currentSectorsData || [], 
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
        
        document.getElementById('track-setup-screen').classList.add('hidden');
        this.quitCreator();
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
    // 9. TACHO LOGIC
    // =================================================
    _initTachoHTML: function() {
        const container = document.querySelector('.tacho-container');
        if (!container) return; 
        if (!container.querySelector('.tacho-ticks') || container.innerHTML.trim() === '') {
            container.innerHTML = ''; container.classList.add('ready');
            const ticks = document.createElement('div'); ticks.className = 'tacho-ticks'; container.appendChild(ticks);
            const track = document.createElement('div'); track.className = 'tacho-track'; container.appendChild(track);
            const arc = document.createElement('div'); arc.className = 'tacho-arc'; arc.id = 'tacho-visual-arc'; container.appendChild(arc);
            const display = document.createElement('div'); display.className = 'tacho-value-display'; display.innerHTML = `<div class="tacho-val" id="tacho-val-text">0</div><span class="tacho-unit">ENTRY SPEED</span>`; container.appendChild(display);
            const knobCont = document.createElement('div'); knobCont.className = 'tacho-knob-container'; knobCont.id = 'tacho-knob-rotator'; knobCont.innerHTML = '<div class="tacho-knob"></div>'; container.appendChild(knobCont);
            const overlay = document.createElement('div'); overlay.className = 'tacho-input-overlay';
            const handleTouch = (e) => this.handleTachoTouch(e);
            overlay.addEventListener('touchmove', handleTouch, {passive: false}); overlay.addEventListener('touchstart', handleTouch, {passive: false}); overlay.addEventListener('mousemove', (e) => { if(e.buttons === 1) handleTouch(e); }); overlay.addEventListener('mousedown', handleTouch); container.appendChild(overlay);
            this.updateTacho(120);
        }
    },

    updateTacho: function(val) {
        if(!document.querySelector('.tacho-track')) this._initTachoHTML();
        val = parseInt(val); val = Math.round(val / 5) * 5; val = Math.max(0, Math.min(300, val));
        const textEl = document.getElementById('tacho-val-text'); if(textEl) textEl.innerText = val;
        const percentage = val / 300; const hue = 120 - (percentage * 120); const color = `hsl(${hue}, 100%, 50%)`;
        const container = document.querySelector('.tacho-container'); if(container) { container.style.setProperty('--tacho-color', color); const cssPercent = percentage * 50; container.style.setProperty('--tacho-percent', cssPercent + '%'); }
        const knob = document.getElementById('tacho-knob-rotator'); if(knob) { const knobDeg = -90 + (percentage * 180); knob.style.transform = `rotate(${knobDeg}deg)`; }
        const minInput = document.getElementById('fly-min'); const maxInput = document.getElementById('fly-max');
        if(minInput) minInput.value = Math.max(0, val - 5); if(maxInput) maxInput.value = val + 5;
    },

    stepValue: function(inputId, step) {
        const input = document.getElementById(inputId); let val = parseInt(input.value) || 0; val += step; input.value = val;
    },

    handleTachoTouch: function(event) {
        if(event.cancelable) event.preventDefault();
        const container = event.currentTarget.parentElement; const rect = container.getBoundingClientRect(); const clientX = event.touches ? event.touches[0].clientX : event.clientX;
        let percent = (clientX - rect.left) / rect.width; if(percent < 0) percent = 0; if(percent > 1) percent = 1;
        const rawVal = percent * 300; const snappedVal = Math.round(rawVal / 5) * 5; this.updateTacho(snappedVal);
    },

    // =================================================
    // 10. SECTOR EDITOR
    // =================================================
    openSectorEditor: function() {
        if(!this.currentRouteGeo) return;
        const overlay = document.getElementById('sector-editor-overlay');
        overlay.classList.remove('hidden');
        overlay.innerHTML = ''; 
        const hintHub = document.createElement('div'); hintHub.className = 'sec-hint-hub'; hintHub.innerHTML = `<i class="fa-solid fa-scissors sec-hint-icon"></i><div class="sec-hint-text">TAP TRACK TO SPLIT</div>`; overlay.appendChild(hintHub);
        const mapDiv = document.createElement('div'); mapDiv.id = 'sector-map'; mapDiv.style.width = '100%'; mapDiv.style.height = '100%'; overlay.appendChild(mapDiv);
        const hud = document.createElement('div'); hud.className = 'sec-editor-hud'; hud.innerHTML = `<div class="sec-btn" onclick="PerfLogic.closeSectorEditor()"><i class="fa-solid fa-xmark"></i> CANCEL</div><div class="sec-btn" onclick="PerfLogic.undoSectorSplit()"><i class="fa-solid fa-rotate-left"></i> UNDO</div><div class="sec-btn save" onclick="PerfLogic.saveSectors()"><i class="fa-solid fa-check"></i> SAVE SECTORS</div>`; overlay.appendChild(hud);
        if(this.sectorMap) { this.sectorMap.remove(); } 
        this.sectorMap = L.map('sector-map', { zoomControl: false, attributionControl: false });
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(this.sectorMap);
        this.sectorMap.on('click', (e) => { this.handleSectorClick(e.latlng); });
        this.sectorSplits = [0, this.currentRouteGeo.length - 1]; 
        setTimeout(() => { this.sectorMap.invalidateSize(); this.renderSectorMap(true); }, 200);
    },

    closeSectorEditor: function() {
        const overlay = document.getElementById('sector-editor-overlay');
        overlay.classList.add('hidden');
        if(this.sectorMap) { this.sectorMap.remove(); this.sectorMap = null; }
    },

    handleSectorClick: function(latlng) {
        let closestDist = Infinity; let closestIndex = -1;
        this.currentRouteGeo.forEach((pt, index) => {
            const pLat = L.latLng(pt[0], pt[1]); const dist = pLat.distanceTo(latlng);
            if(dist < closestDist) { closestDist = dist; closestIndex = index; }
        });
        if(closestDist > 50) return;
        if (this.sectorSplits.includes(closestIndex)) return;
        this.sectorSplits.push(closestIndex);
        this.sectorSplits.sort((a, b) => a - b);
        this.renderSectorMap(false);
        if(navigator.vibrate) navigator.vibrate(10);
    },

    undoSectorSplit: function() {
        if(this.sectorSplits.length <= 2) return; 
        this.sectorSplits.splice(this.sectorSplits.length - 2, 1);
        this.renderSectorMap(false);
    },

    renderSectorMap: function(fitBounds = false) {
        if(!this.sectorMap) return;
        this.sectorMap.eachLayer(l => { if(!l._url) this.sectorMap.removeLayer(l); });
        if(fitBounds && this.currentRouteGeo) {
            const bounds = L.polyline(this.currentRouteGeo).getBounds();
            this.sectorMap.fitBounds(bounds, {padding: [40,40]});
        }
        for(let i=0; i < this.sectorSplits.length - 1; i++) {
            const startIdx = this.sectorSplits[i]; const endIdx = this.sectorSplits[i+1];
            const segment = this.currentRouteGeo.slice(startIdx, endIdx + 1);
            const color = this.sectorColors[i % this.sectorColors.length];
            L.polyline(segment, {color: color, weight: 6, opacity: 1}).addTo(this.sectorMap);
            if(i > 0 && i < this.sectorSplits.length - 1) {
                const markerPos = this.currentRouteGeo[startIdx];
                const icon = L.divIcon({ className: 'split-marker', html: `<div style="width:4px; height:20px; background:white; transform:rotate(20deg); box-shadow:0 0 5px black;"></div>`, iconSize: [20,20], iconAnchor: [10,10] });
                L.marker(markerPos, {icon: icon}).addTo(this.sectorMap);
            }
        }
        if(this.currentRouteGeo && this.currentRouteGeo.length > 0) {
            const start = this.currentRouteGeo[0]; const end = this.currentRouteGeo[this.currentRouteGeo.length-1];
            const startIcon = L.divIcon({className: 'custom-icon', html: '<div class="sec-marker-start"></div>', iconSize:[14,14], iconAnchor:[7,7]});
            const endIcon = L.divIcon({className: 'custom-icon', html: '<div class="sec-marker-finish"></div>', iconSize:[14,14], iconAnchor:[7,7]});
            L.marker(start, {icon: startIcon}).addTo(this.sectorMap); L.marker(end, {icon: endIcon}).addTo(this.sectorMap);
        }
    },

    saveSectors: function() {
        const container = document.getElementById('sector-config-container');
        container.innerHTML = `<div class="sector-list-container"></div>`;
        const list = container.querySelector('.sector-list-container');
        this.currentSectorsData = [];
        for(let i=0; i < this.sectorSplits.length - 1; i++) {
            const startIdx = this.sectorSplits[i]; const endIdx = this.sectorSplits[i+1];
            let distMeters = 0;
            for(let j=startIdx; j < endIdx; j++) {
                const p1 = L.latLng(this.currentRouteGeo[j]); const p2 = L.latLng(this.currentRouteGeo[j+1]);
                distMeters += p1.distanceTo(p2);
            }
            const distKm = (distMeters / 1000).toFixed(2) + " km";
            const color = this.sectorColors[i % this.sectorColors.length];
            this.currentSectorsData.push({ index: i+1, dist: distKm, elev: "--", startIdx: startIdx, endIdx: endIdx, color: color });
            const item = document.createElement('div'); item.className = 'sector-item'; item.style.borderLeftColor = color;
            item.innerHTML = `<div><div class="sec-num" style="color:${color}">SECTOR ${i+1}</div><div class="sec-title">Section ${i+1}</div></div><div class="sec-stats"><div class="sec-stat-box"><label>DIST</label><span>${distKm}</span></div></div>`;
            item.onclick = () => this.openSectorEditor();
            list.appendChild(item);
        }
        const resetBtn = document.createElement('div'); resetBtn.className = 'sector-add-card';
        resetBtn.innerHTML = '<i class="fa-solid fa-pen"></i> EDIT SECTORS';
        resetBtn.onclick = () => this.openSectorEditor();
        container.appendChild(resetBtn);
        this.closeSectorEditor();
    },

    // =================================================
    // 11. RENDER & UI UPDATES
    // =================================================
    renderTrackList: function() {
        const trackCount = this.tracks.length;
        let bestTime = "---";
        let scoreInt = 0;

        if (trackCount > 0) {
            const validTracks = this.tracks.filter(t => t.bestTime && t.bestTime !== '---');
            if(validTracks.length > 0) {
                bestTime = validTracks[0].bestTime; 
                scoreInt = trackCount * 150; 
            }
        }

        const contentArea = document.querySelector('.perf-content-scroll');
        
        // --- HTML INJECTION (MIT ONCLICK DIRECTIVES) ---
        contentArea.innerHTML = `
            <div class="header-fade-overlay"></div>

            <div class="perf-dashboard-header">
                <div class="glass-stats-hub">
                    <div class="pd-side-stat">
                        <label>BEST TIME</label>
                        <div class="val">${bestTime}</div>
                    </div>
                    <div class="pd-main-score">
                        <label>PRM SCORE</label>
                        <div class="val" id="global-score-display">${scoreInt > 0 ? scoreInt : '---'}</div>
                    </div>
                    <div class="pd-side-stat">
                        <label>TRACKS</label>
                        <div class="val">${trackCount}</div>
                    </div>
                </div>
            </div>
            
            <div id="view-track" style="display:block; padding-bottom:150px;">
                <div id="perf-track-list"></div>
            </div>

            <div id="view-drag" style="display:none; padding:40px; text-align:center;">
                <div style="color:#666; font-weight:800; margin-top:50px;">DRAG MODE COMING SOON</div>
            </div>

            <div id="view-analytics" style="display:none; padding-bottom:150px;">
                <div class="live-dashboard-section">
                    <div class="ld-title"><div class="ld-pulse"></div> LIVE CONDITIONS</div>
                    
                    <div class="ld-card" id="live-weather-card">
                        <div class="weather-main-row">
                            <div class="weather-temp" id="ld-temp">--°</div>
                            <div class="weather-icon" id="ld-icon"><i class="fa-solid fa-satellite-dish"></i></div>
                        </div>
                        <div class="weather-grid">
                            <div class="wg-item"><label>HUMIDITY</label><div id="ld-hum">--%</div></div>
                            <div class="wg-item"><label>PRESSURE</label><div id="ld-press">-- hPa</div></div>
                            <div class="wg-item"><label>WIND</label><div id="ld-wind">-- km/h</div></div>
                        </div>
                        <div class="traction-index-box">
                            <div class="ti-label">TRACTION INDEX</div>
                            <div class="ti-value" id="ld-grip">---</div>
                        </div>
                        <div class="weather-summary" id="ld-summary">
                            Connecting to satellites...
                        </div>
                    </div>

                    <div class="ld-title" style="margin-top:20px;">PERFORMANCE DATA</div>

                    <div class="stats-grid-row">
                        <div class="stat-mini-card">
                            <label>AVG SCORE</label>
                            <div class="val" id="stat-avg">---</div>
                        </div>
                        <div class="stat-mini-card best">
                            <label>BEST SCORE</label>
                            <div class="val" id="stat-best">---</div>
                        </div>
                        <div class="stat-mini-card">
                            <label>WORST</label>
                            <div class="val" id="stat-worst">---</div>
                        </div>
                    </div>

                    <div class="ld-card" id="best-track-card" style="display:none; margin-top:15px;">
                        <div class="ld-title" style="color:#fff; opacity:0.5; margin-bottom:10px;">STRONGEST TRACK</div>
                        <div class="best-track-layout">
                            <div class="bt-info">
                                <h3 id="bt-name">---</h3>
                                <p><i class="fa-solid fa-road"></i> <span id="bt-dist">---</span> | Best: <span id="bt-time" style="color:#ff3b30">---</span></p>
                            </div>
                            <div class="bt-score-badge" id="bt-badge">A+</div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="perf-sub-nav">
                <div class="psn-item active" id="btn-tab-track" onclick="window.PerfLogic.switchTab('track')">TRACK</div>
                <div class="psn-item" id="btn-tab-drag" onclick="window.PerfLogic.switchTab('drag')">DRAG</div>
                <div class="psn-item" id="btn-tab-analytics" onclick="window.PerfLogic.switchTab('analytics')">ANALYTICS</div>
            </div>
        `;
        
        if(trackCount > 0 && scoreInt > 0) {
            this.animateValue("global-score-display", 0, scoreInt, 1200);
        }

        // --- TRACK LISTE RENDERN ---
        const list = document.getElementById('perf-track-list');
        
        this.tracks.forEach((t, index) => {
            const div = document.createElement('div');
            div.className = 'track-card-v2';
            div.style.animationDelay = (index * 0.1) + "s";
            
            const distDisplay = t.dist || "0.0 km";
            const nameDisplay = t.name || "UNNAMED TRACK";
            const timeDisplay = t.bestTime || "---";

            div.innerHTML = `
                <div class="tc-bg-map" id="mini-map-${t.id}"></div>
                <div class="tc-overlay"></div>
                <div class="tc-content">
                    <div class="tc-name">${nameDisplay}</div>
                    <div class="tc-details">
                        <span><i class="fa-solid fa-road"></i> ${distDisplay}</span>
                        <span><i class="fa-solid fa-stopwatch"></i> ${timeDisplay}</span>
                    </div>
                </div>
                <div class="tc-condition-badge" id="cond-badge-${t.id}" style="display:none"></div>
            `;
            
            div.onclick = () => this.selectTrack(t); 
            list.appendChild(div);

            setTimeout(() => this.renderMiniMap(t), 200 + (index * 50));
            this.checkTrackConditions(t); 
        });

        // Add Button
        const addBtn = document.createElement('div');
        addBtn.className = 'add-track-v2';
        addBtn.style.animationDelay = (this.tracks.length * 0.1) + "s";
        addBtn.innerHTML = '<i class="fa-solid fa-plus-circle" style="font-size:1.8rem; margin-bottom:5px"></i><span>ADD TRACK</span>';
        addBtn.onclick = (e) => {
            e.stopPropagation(); 
            this.enterCreatorMode();
        };

        list.appendChild(addBtn);

        // Daten im Hintergrund laden
        this.updateLiveDashboard();
    },

    renderMiniMap: function(track) {
        const mapId = `mini-map-${track.id}`;
        const container = document.getElementById(mapId);
        if(!container) return;
        if(container._leaflet_id) return; 

        const miniMap = L.map(mapId, {
            zoomControl: false, attributionControl: false,
            dragging: false, touchZoom: false, doubleClickZoom: false,
            scrollWheelZoom: false, boxZoom: false, keyboard: false,
            zoomAnimation: false
        });

        if(track.routePath && track.routePath.length > 0) {
            const polyline = L.polyline(track.routePath, {
                color: '#ff3b30', weight: 5, opacity: 1, lineCap: 'round', className: 'track-poly-line'
            }).addTo(miniMap);
            miniMap.fitBounds(polyline.getBounds(), { padding: [50, 50], animate: false });
        }
        setTimeout(() => { miniMap.invalidateSize(); }, 150);
    },

    checkTrackConditions: function(track) {
        if(!track.routePath || track.routePath.length === 0) return;
        const startPoint = track.routePath[0]; 
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${startPoint[0]}&longitude=${startPoint[1]}&current=temperature_2m,weather_code,is_day&timezone=auto`;

        fetch(url).then(r => r.json()).then(data => {
            if(data.current) {
                const temp = data.current.temperature_2m;
                const code = data.current.weather_code; 
                let label = "PERFECT GRIP"; let dotColor = "#30d158";
                if(code >= 51) { label = "WET / SLIPPERY"; dotColor = "#ff3b30"; } else if(temp < 5) { label = "COLD TIRES"; dotColor = "#ff9f0a"; }
                const badge = document.getElementById(`cond-badge-${track.id}`);
                if(badge) { badge.style.display = 'flex'; badge.innerHTML = `<div class="cond-dot" style="background:${dotColor}; box-shadow: 0 0 5px ${dotColor}"></div><div class="cond-text">${label} (${temp}°C)</div>`; }
            }
        }).catch(err => { const badge = document.getElementById(`cond-badge-${track.id}`); if(badge) badge.style.display = 'none'; });
    },

    updateLiveDashboard: function() {
        const validTracks = this.tracks.filter(t => t.bestTime && t.bestTime !== '---');
        let avgScore = 0, bestScore = 0, worstScore = 0;
        
        const calculatedScores = validTracks.map(t => {
            return Math.floor(Math.random() * 40) + 60; 
        });

        if (calculatedScores.length > 0) {
            bestScore = Math.max(...calculatedScores);
            worstScore = Math.min(...calculatedScores);
            avgScore = Math.floor(calculatedScores.reduce((a,b)=>a+b,0) / calculatedScores.length);
            
            const elAvg = document.getElementById('stat-avg'); if(elAvg) elAvg.innerText = avgScore;
            const elBest = document.getElementById('stat-best'); if(elBest) elBest.innerText = bestScore;
            const elWorst = document.getElementById('stat-worst'); if(elWorst) elWorst.innerText = worstScore;
            
            this.animateValue("global-score-display", 0, avgScore, 1500);

            const bestTrackIndex = calculatedScores.indexOf(bestScore);
            const bestTrack = validTracks[bestTrackIndex];
            if(bestTrack) {
                document.getElementById('best-track-card').style.display = 'block';
                document.getElementById('bt-name').innerText = bestTrack.name;
                document.getElementById('bt-dist').innerText = bestTrack.dist;
                document.getElementById('bt-time').innerText = bestTrack.bestTime;
                document.getElementById('bt-badge').innerText = bestScore;
            }
        } else {
            const elGlob = document.getElementById('global-score-display');
            if(elGlob) elGlob.innerText = "---";
        }

        if(navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(pos => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                
                fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,surface_pressure,weather_code,wind_speed_10m&timezone=auto`)
                .then(r => r.json())
                .then(data => {
                    if(data.current) {
                        const c = data.current;
                        document.getElementById('ld-temp').innerText = Math.round(c.temperature_2m) + "°";
                        document.getElementById('ld-hum').innerText = c.relative_humidity_2m + "%";
                        document.getElementById('ld-press').innerText = Math.round(c.surface_pressure) + " hPa";
                        document.getElementById('ld-wind').innerText = Math.round(c.wind_speed_10m) + " km/h";

                        let traction = 100;
                        let text = "Optimal racing conditions. ";
                        
                        if(c.temperature_2m < 10) {
                            traction -= (10 - c.temperature_2m) * 2;
                            text = "Cold surface temperatures detected. Tire warmup essential. ";
                        }
                        
                        if(c.weather_code >= 51) {
                            traction -= 40; 
                            text = "Wet/Slippery surface detected. Reduced grip levels. Caution advised. ";
                            document.getElementById('ld-icon').innerHTML = '<i class="fa-solid fa-cloud-rain"></i>';
                        } else if(c.weather_code <= 3) {
                            text += "Dry surface with good visibility.";
                            document.getElementById('ld-icon').innerHTML = '<i class="fa-solid fa-sun"></i>';
                        }

                        traction = Math.max(0, Math.min(100, Math.round(traction)));
                        const gripEl = document.getElementById('ld-grip');
                        gripEl.innerText = traction + "/100";
                        
                        if(traction > 80) gripEl.style.color = "#30d158"; 
                        else if(traction > 50) gripEl.style.color = "#ff9f0a"; 
                        else gripEl.style.color = "#ff3b30"; 

                        document.getElementById('ld-summary').innerText = text;
                    }
                });
            });
        }
    },

    animateValue: function(id, start, end, duration) {
        const obj = document.getElementById(id); if(!obj) return;
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.innerHTML = Math.floor(progress * (end - start) + start);
            if (progress < 1) window.requestAnimationFrame(step);
        };
        window.requestAnimationFrame(step);
    }
};

// Start
PerfLogic.init();
