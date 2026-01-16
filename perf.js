/* ================================================= */
/* === PERF.JS - FINAL FIXED V79 (SYNTAX FIX) === */
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
    routeLayer: null,         // Die lila Linie beim Erstellen
    selectedTrackLayer: null, // Die rote Linie beim Anschauen
    selectedTrackId: null,
    
    // --- CACHE & LAYERS ---
    hubMarkers: [], // Die Labels auf der Karte
    
    // --- TEMP DATA ---
    currentRouteStats: { dist: "0 km", time: "--:--", elevUp: "0m", elevDown: "0m" },
    currentRouteGeo: null,
    startType: 'standing',

    // =================================================
    // 1. INITIALISIERUNG
    // =================================================
    init: function() {
        console.log("PerfLogic Init - Clean & Hubs");
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
                // Wenn man ins Leere klickt -> Auswahl aufheben
                this.deselectTrack();
            }
        });

        // WICHTIG: Labels zeichnen
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
    // 2. INTERACTION LOGIC (LABEL & ROUTE HANDLING)
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
        
        // HIER: Jetzt erst die Linie zeichnen!
        this.showTrackOnMap(track);
        
        // Karte in der Liste markieren
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

        // Linie entfernen!
        if(this.selectedTrackLayer) {
            this.map.removeLayer(this.selectedTrackLayer);
            this.selectedTrackLayer = null;
        }
        
        // Start/Ziel Punkte auch wegräumen (außer User & Hubs)
        this.map.eachLayer(layer => {
            if(layer instanceof L.Marker && layer !== this.userMarker && !this.hubMarkers.includes(layer)) {
                this.map.removeLayer(layer);
            }
        });

        document.querySelectorAll('.track-card').forEach(c => c.classList.remove('active-card'));
        this.updateStatsDisplay(null);
    },

    showTrackOnMap: function(track) {
        // Alte Linie weg
        if(this.selectedTrackLayer) this.map.removeLayer(this.selectedTrackLayer);
        
        // Alte Marker aufräumen (Start/Ziel)
        this.map.eachLayer(layer => {
            // Lösche alles, was ein Marker ist, ABER NICHT der User und NICHT die Labels (Hubs)
            if(layer instanceof L.Marker && layer !== this.userMarker && !this.hubMarkers.includes(layer)) {
                this.map.removeLayer(layer);
            }
        });

        // 1. Rote Linie zeichnen
        if(track.routePath) {
            this.selectedTrackLayer = L.polyline(track.routePath, {color: '#ff3b30', weight: 6}).addTo(this.map);
            
            this.map.flyToBounds(this.selectedTrackLayer.getBounds(), {
                paddingTopLeft: [30, 30],
                paddingBottomRight: [30, 180], 
                duration: 1.0
            });
        }

        // 2. Start & Ziel Icons zeichnen (Endlich sichtbar!)
        if(track.pins) {
            track.pins.forEach(p => {
                if(p.type === 'start') {
                    // START MARKER (Grün)
                    const icon = L.divIcon({ 
                        className: 'custom-marker-wrap', 
                        html: `<div class="tm-marker tm-start"><i class="fa-solid fa-play" style="margin-left:2px;"></i></div>`, 
                        iconSize: [30,30], iconAnchor: [15,15] 
                    });
                    L.marker([p.lat, p.lng], {icon: icon}).addTo(this.map);
                }
                
                if(p.type === 'finish') {
                    // ZIEL MARKER (Rot)
                    const icon = L.divIcon({ 
                        className: 'custom-marker-wrap', 
                        html: `<div class="tm-marker tm-finish"><i class="fa-solid fa-flag-checkered"></i></div>`, 
                        iconSize: [30,30], iconAnchor: [15,15] 
                    });
                    L.marker([p.lat, p.lng], {icon: icon}).addTo(this.map);
                }
            });
        }
    }, // <--- HIER HAT DAS KOMMA GEFEHLT!

    renderMapHubs: function() {
        this.hubMarkers.forEach(m => this.map.removeLayer(m));
        this.hubMarkers = [];

        this.tracks.forEach(track => {
            // Sicherheitscheck: Hat die Strecke Koordinaten?
            if(!track.routePath || track.routePath.length === 0) return;
            
            // TRICK: Wir nehmen den Punkt genau in der Mitte des Arrays!
            const midIndex = Math.floor(track.routePath.length / 2);
            const midPoint = track.routePath[midIndex]; // [lat, lng]
            
            const iconHtml = `
                <div class="hub-fancy-wrapper">
                    <div class="hub-icon-box">
                        <i class="fa-solid fa-flag-checkered"></i>
                    </div>
                    <div class="hub-info-box">
                        <span class="hub-label">TRACK</span>
                        <span class="hub-name">${track.name}</span>
                    </div>
                    <div class="hub-arrow-down"></div>
                </div>
            `;

            const icon = L.divIcon({
                className: 'custom-hub-icon',
                html: iconHtml,
                iconSize: [140, 42],
                iconAnchor: [70, 48] 
            });

            // Marker an der MITTLEREN Position erstellen
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
                <div class="p-stat-box">
                    <label>ELEVATION</label>
                    <span style="font-size:0.8rem">
                        <i class="fa-solid fa-arrow-trend-up" style="color:#30d158"></i> ${track.elevUp || '0m'} 
                        <i class="fa-solid fa-arrow-trend-down" style="color:#ff3b30; margin-left:5px"></i> ${track.elevDown || '0m'}
                    </span>
                </div>
            `;
        } else {
            actionBar.classList.remove('visible');
            setTimeout(() => actionBar.classList.add('hidden'), 300);
            
            btnInfo.classList.add('hidden');
            btnEdit.classList.add('hidden');

            const totalScore = this.tracks.length * 150; 
            
            statsRow.innerHTML = `
                <div class="p-stat-box"><label>TRACKS</label><span id="perf-total-tracks">${this.tracks.length}</span></div>
                <div class="p-stat-box glow-text"><label>SCORE</label><span id="perf-global-score">${totalScore}</span></div>
                <div class="p-stat-box"><label>BEST TIME</label><span id="perf-best-time">--:--</span></div>
            `;
        }
    },

    // =================================================
    // 3. CREATOR MODE LOGIC
    // =================================================

    enterCreatorMode: function() {
        this.isCreatorMode = true;
        this.creatorPoints = []; 
        this.deselectTrack();
        
        // Hubs ausblenden, damit sie nicht stören
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

    // === WICHTIG: CLEANUP FUNKTION ===
    quitCreator: function() {
        this.isCreatorMode = false;
        
        // UI zurücksetzen
        document.querySelector('.perf-content-scroll').style.display = 'block';
        document.querySelector('.perf-map-fade').style.display = 'block';
        document.querySelector('.perf-sub-nav').style.display = 'flex';
        
        document.getElementById('perf-creator-ui').classList.add('hidden');
        document.getElementById('nav-perf').parentElement.classList.remove('hidden');

        const mapContainer = document.getElementById('perf-map-container');
        mapContainer.style.height = "50vh"; // Zurück zur halben Höhe
        mapContainer.style.zIndex = "0";
        mapContainer.style.position = "absolute";
        
        setTimeout(() => { this.map.invalidateSize(); }, 300);

        // ALLE Temp-Zeichnungen löschen!
        this.clearCreatorMap();
        
        // Hubs wieder anzeigen
        this.hubMarkers.forEach(m => m.setOpacity(1)); 
        this.renderMapHubs(); // Labels neu malen
    },
    
    clearCreatorMap: function() {
        // 1. Alle Creator Marker weg
        if(this.creatorPoints) {
            this.creatorPoints.forEach(p => {
                if(p.marker) this.map.removeLayer(p.marker);
            });
        }
        this.creatorPoints = [];
        
        // 2. Die lila Route weg
        if(this.routeLayer) {
            this.map.removeLayer(this.routeLayer);
            this.routeLayer = null;
        }
        
        // Reset Text
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
                
                // Alte Route weg
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
        // ... (alter Code) ...
        fetch(`https://api.open-meteo.com/v1/elevation...`)
        .then(r => r.json())
        .then(data => {
            if(data.elevation) {
                // WICHTIG: Rohdaten speichern für späteres Slicing!
                this.cachedElevations = data.elevation; 
                
                // ... (Rest deiner Berechnung) ...
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
        
        // MAP KILLER: Hintergrundkarte ausblenden, damit Scrollen geht
        const bgMap = document.getElementById('perf-map-container');
        if(bgMap) bgMap.style.display = 'none';

        // Scroll Fix Listener
        const scrollBox = document.querySelector('.setup-content-scroll');
        if(scrollBox) {
            scrollBox.addEventListener('touchmove', (e) => { e.stopPropagation(); }, { passive: true });
        }

        // Setup Map (Vorschau)
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
        // Map wieder zeigen!
        document.getElementById('perf-map-container').style.display = 'block';
        
        document.getElementById('track-setup-screen').classList.add('hidden');
        document.getElementById('perf-creator-ui').classList.remove('hidden');
    },

    finalizeSave: function() {
        const nameInput = document.getElementById('setup-name').value;
        const name = nameInput.trim() || "Unnamed Track";

        // Tacho-Wert holen
        const tachoElement = document.getElementById('tacho-val-text');
        const targetSpeed = tachoElement ? tachoElement.innerText : "0";

        // 1. Objekt bauen
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
                flyTarget: targetSpeed,
                flyMin: document.getElementById('fly-min').value,
                flyMax: document.getElementById('fly-max').value

                const track = {
            id: Date.now(),
            name: name,
            routePath: this.currentRouteGeo, 
            
            // NEU: Sektoren speichern (oder leeres Array wenn keine)
            sectors: this.currentSectorsData || [], 
            
            pins: this.creatorPoints.map(p => ({lat: p.latlng.lat, lng: p.latlng.lng, type: p.type})),
            }
        };

        // 2. Speichern
        this.tracks.push(track);
        localStorage.setItem('driverhub_tracks', JSON.stringify(this.tracks));
        
        // 3. UI Schließen & Map wiederherstellen
        document.getElementById('perf-map-container').style.display = 'block';
        document.getElementById('track-setup-screen').classList.add('hidden');
        
        // 4. WICHTIG: Erstellmodus beenden und Karte putzen
        this.quitCreator(); // Das löscht die lila Linie und Punkte
        
        // 5. Alles neu rendern
        this.renderTrackList(); // Neue Karte in der Liste
        this.renderMapHubs();   // Neues Label auf der Map
        this.updateStatsDisplay(null);
    },

   setStartType: function(type) {
        this.startType = type;
        
        document.getElementById('btn-standing').classList.toggle('active', type === 'standing');
        document.getElementById('btn-flying').classList.toggle('active', type === 'flying');
        
        const flySettings = document.getElementById('flying-settings');

        if(type === 'flying') {
            flySettings.classList.remove('hidden'); 
            // NEU: Damit er sich sofort aufbaut!
            // Hol den aktuellen Wert oder Standard 120
            const currentVal = document.getElementById('tacho-val-text') ? document.getElementById('tacho-val-text').innerText : 120;
            setTimeout(() => this.updateTacho(currentVal), 50); 
        } else {
            flySettings.classList.add('hidden'); 
        }
    },
// --- TACHO LOGIC V7 (DECOUPLED MIN/MAX) ---

    _initTachoHTML: function() {
        const container = document.querySelector('.tacho-container');
        if (container && (!container.querySelector('.tacho-ticks') || container.innerHTML.trim() === '')) {
            container.innerHTML = ''; 
            container.classList.add('ready');

            // HTML Aufbau (Design V6)
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

        // 1. Tacho Snapping & Limits
        val = parseInt(val);
        val = Math.round(val / 5) * 5; 
        val = Math.max(0, Math.min(300, val));

        // 2. Visuelles Update (Tacho)
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

        // 3. AUTOMATIK: Min/Max folgen dem Tacho (Reset auf +/- 5)
        // Aber NUR, wenn wir nicht gerade in einem Input-Feld tippen (fokus)
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
        
        // Aktuelle Target-Speed holen (als Grenze)
        const targetSpeed = parseInt(document.getElementById('tacho-val-text').innerText) || 0;

        // Neuen Wert berechnen
        val += step;

        // LOGIK SPERRE: Manuelles Verstellen darf physikalisch unmögliche Werte nicht erlauben
        
        if (inputId === 'fly-min') {
            // Min darf nicht größer als Target sein
            if (val > targetSpeed) val = targetSpeed;
            if (val < 0) val = 0;
        }

        if (inputId === 'fly-max') {
            // Max darf nicht kleiner als Target sein
            if (val < targetSpeed) val = targetSpeed;
            if (val > 350) val = 350; // Hard Limit
        }

        // Wert setzen
        input.value = val;
        
        // HIER WICHTIG: KEIN Aufruf von updateTacho()!
        // Der Tacho bleibt stehen, wir ändern nur das Fenster drumherum.

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
    // 6. RENDER FUNCTIONS
    // =================================================

    renderTrackList: function() {
        const list = document.getElementById('perf-track-list');
        if(!list) return; // Sicherheits-Check
        list.innerHTML = ''; 

        this.tracks.forEach(t => {
            const div = document.createElement('div');
            div.className = 'track-card';
            div.id = `track-card-${t.id}`;
            div.innerHTML = `
                <div class="tc-map-preview" id="mini-map-${t.id}"></div>
                <div class="tc-info">
                    <div class="tc-name">${t.name}</div>
                    <div class="tc-stats">
                        <span><i class="fa-solid fa-trophy"></i> ${t.bestTime}</span>
                        <span><i class="fa-solid fa-road"></i> ${t.dist}</span>
                    </div>
                </div>`;
            div.onclick = (e) => {
                e.stopPropagation();
                this.toggleTrackSelection(t);
            };
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
            zoomControl: false, attributionControl: false,
            dragging: false, touchZoom: false, doubleClickZoom: false, 
            scrollWheelZoom: false, boxZoom: false, keyboard: false, tap: false
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(miniMap);

        if(track.routePath && track.routePath.length > 0) {
            const poly = L.polyline(track.routePath, {color: '#ff3b30', weight: 6}).addTo(miniMap);
            setTimeout(() => {
                miniMap.invalidateSize();
                miniMap.fitBounds(poly.getBounds(), {padding: [10, 10]});
            }, 300);
        }
    }
};

// =================================================
    // 4b. SECTOR EDITOR LOGIC
    // =================================================
    
    sectorSplits: [], // Indizes im routePath Array, wo geschnitten wurde
    sectorMap: null,
    sectorColors: ['#bf5af2', '#30d158', '#007aff', '#ff9f0a', '#ff3b30'], // Neon Palette

    openSectorEditor: function() {
        if(!this.currentRouteGeo) return;
        
        document.getElementById('sector-editor-overlay').classList.remove('hidden');
        
        // Map initialisieren
        if(!this.sectorMap) {
            this.sectorMap = L.map('sector-map', {
                zoomControl: false, attributionControl: false
            });
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(this.sectorMap);
            
            // Event Listener auf die Map für Klicks
            this.sectorMap.on('click', (e) => {
                this.handleSectorClick(e.latlng);
            });
        }
        
        // Reset Splits (Start 0 und Ende sind implizit)
        this.sectorSplits = [0, this.currentRouteGeo.length - 1]; 
        
        setTimeout(() => {
            this.sectorMap.invalidateSize();
            this.renderSectorMap(); // Zeichnet die Linie
        }, 200);
    },

    closeSectorEditor: function() {
        document.getElementById('sector-editor-overlay').classList.add('hidden');
    },

    handleSectorClick: function(latlng) {
        // Wir suchen den Punkt auf der Linie, der dem Klick am nächsten ist
        let closestDist = Infinity;
        let closestIndex = -1;

        // Simple Suche durch alle Punkte (schnell genug für < 5000 Punkte)
        this.currentRouteGeo.forEach((pt, index) => {
            // Leaflet LatLng Objekt erstellen für Distanz-Check
            const pLat = L.latLng(pt[0], pt[1]);
            const dist = pLat.distanceTo(latlng);
            if(dist < closestDist) {
                closestDist = dist;
                closestIndex = index;
            }
        });

        // Toleranz: Wenn Klick > 50m von der Strecke weg, ignorieren
        if(closestDist > 50) return;

        // Check: Ist der Punkt zu nah an Start/Ziel oder anderen Splits?
        const isTooClose = this.sectorSplits.some(idx => Math.abs(idx - closestIndex) < 5); // min 5 Punkte Abstand
        if(isTooClose) return;

        // Split hinzufügen und sortieren
        this.sectorSplits.push(closestIndex);
        this.sectorSplits.sort((a, b) => a - b);
        
        // Neu zeichnen
        this.renderSectorMap();
        
        // Feedback Vibration
        if(navigator.vibrate) navigator.vibrate(10);
    },

    undoSectorSplit: function() {
        if(this.sectorSplits.length <= 2) return; // Start & Ende dürfen nicht gelöscht werden
        // Den letzten HINZUGEFÜGTEN Split entfernen (nicht einfach den letzten im Array, weil sortiert)
        // Vereinfachung: Wir entfernen den vorletzten Index (der letzte Split vor dem Finish)
        this.sectorSplits.splice(this.sectorSplits.length - 2, 1);
        this.renderSectorMap();
    },

    renderSectorMap: function() {
        // Map aufräumen
        this.sectorMap.eachLayer(l => { if(!l._url) this.sectorMap.removeLayer(l); });

        // Kamera fitten
        const bounds = L.polyline(this.currentRouteGeo).getBounds();
        this.sectorMap.fitBounds(bounds, {padding: [50,50]});

        // Segmente zeichnen
        for(let i=0; i < this.sectorSplits.length - 1; i++) {
            const startIdx = this.sectorSplits[i];
            const endIdx = this.sectorSplits[i+1];
            
            // Teilstück extrahieren
            // slice endet exklusive, also +1
            const segment = this.currentRouteGeo.slice(startIdx, endIdx + 1);
            
            // Farbe wählen (Loop durch Palette)
            const color = this.sectorColors[i % this.sectorColors.length];
            
            // Linie zeichnen
            L.polyline(segment, {color: color, weight: 6, opacity: 1}).addTo(this.sectorMap);
            
            // Split-Marker zeichnen (außer am Start)
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
        
        // Start & Finish Marker immer dazu
        const start = this.currentRouteGeo[0];
        const end = this.currentRouteGeo[this.currentRouteGeo.length-1];
        L.circleMarker(start, {radius: 6, color: '#30d158', fillOpacity: 1}).addTo(this.sectorMap);
        L.circleMarker(end, {radius: 6, color: '#ff3b30', fillOpacity: 1}).addTo(this.sectorMap);
    },

    saveSectors: function() {
        // Daten berechnen und HTML bauen
        const container = document.getElementById('sector-config-container');
        container.innerHTML = `<div class="sector-list-container"></div>`;
        const list = container.querySelector('.sector-list-container');
        
        // Temporäre Speicherung der Sektoren für finalizeSave
        this.currentSectorsData = [];

        for(let i=0; i < this.sectorSplits.length - 1; i++) {
            const startIdx = this.sectorSplits[i];
            const endIdx = this.sectorSplits[i+1];
            
            // 1. Distanz berechnen
            let distMeters = 0;
            for(let j=startIdx; j < endIdx; j++) {
                const p1 = L.latLng(this.currentRouteGeo[j]);
                const p2 = L.latLng(this.currentRouteGeo[j+1]);
                distMeters += p1.distanceTo(p2);
            }
            const distKm = (distMeters / 1000).toFixed(2) + " km";

            // 2. Elevation berechnen (aus Cache interpolieren)
            let elevGain = 0;
            if(this.cachedElevations) {
                // Wir mappen die Indizes auf das Elevation Array (das evtl. kleiner ist)
                const ratio = this.cachedElevations.length / this.currentRouteGeo.length;
                const eStart = Math.floor(startIdx * ratio);
                const eEnd = Math.floor(endIdx * ratio);
                
                // Einfache Differenz (könnte man genauer machen)
                if(eEnd < this.cachedElevations.length) {
                     const diff = this.cachedElevations[eEnd] - this.cachedElevations[eStart];
                     // Nur positive Höhenmeter summieren? Oder netto? User wollte Höhenmeter.
                     // Wir nehmen hier Netto Differenz für den Sektor
                     const val = Math.round(diff);
                     elevGain = (val > 0 ? "+" : "") + val + "m";
                }
            } else {
                elevGain = "--";
            }

            // Farbe
            const color = this.sectorColors[i % this.sectorColors.length];

            // Datenobjekt
            this.currentSectorsData.push({
                index: i+1,
                dist: distKm,
                elev: elevGain,
                startIdx: startIdx,
                endIdx: endIdx,
                color: color
            });

            // HTML Item
            const item = document.createElement('div');
            item.className = 'sector-item';
            item.style.borderLeftColor = color;
            item.innerHTML = `
                <div>
                    <div class="sec-num" style="color:${color}">SECTOR ${i+1}</div>
                    <div class="sec-title">Section ${i+1}</div>
                </div>
                <div class="sec-stats">
                    <div class="sec-stat-box">
                        <label>DIST</label><span>${distKm}</span>
                    </div>
                    <div class="sec-stat-box">
                        <label>ELEV</label><span>${elevGain}</span>
                    </div>
                </div>
            `;
            // Klick auf Sektor öffnet wieder Editor? Optional.
            item.onclick = () => this.openSectorEditor();
            
            list.appendChild(item);
        }
        
        // Reset Button unten drunter hängen
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

PerfLogic.init();
