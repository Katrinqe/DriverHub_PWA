// navi.js - Advanced Navigation Logic

const NaviLogic = {
    routeLayer: null,
    currentDestination: null,
    searchTimeout: null,
    isNavigating: false,
    navMode: 'ghost', // 'ghost' or 'record'
    navStartTime: 0,
    navInterval: null,
    
    // Simulierter Route State (für V1 ohne echte Turn-by-Turn Engine)
    routeDistance: 0,
    routeDuration: 0,
    
    init: function() {
        console.log("Navi Init");
        const input = document.getElementById('nav-search-input');
        
        input.addEventListener('input', (e) => {
            const query = e.target.value;
            if (this.searchTimeout) clearTimeout(this.searchTimeout);
            
            if (query.length > 2) {
                this.searchTimeout = setTimeout(() => {
                    this.performSearch(query);
                }, 600); 
            } else {
                this.clearResults();
            }
        });
    },

    performSearch: function(query) {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
        fetch(url).then(r => r.json()).then(data => {
            this.renderResults(data);
        }).catch(e => console.error("Search Error", e));
    },

    renderResults: function(results) {
        const container = document.getElementById('nav-search-results');
        container.innerHTML = '';
        
        if (results.length === 0) {
            container.classList.remove('open');
            return;
        }

        results.forEach(res => {
            const div = document.createElement('div');
            div.className = 'search-result-item';
            let name = res.display_name.split(',')[0];
            let details = res.display_name.split(',').slice(1, 3).join(',');
            
            div.innerHTML = `<i class="fa-solid fa-location-dot"></i> <div><strong>${name}</strong><br><small>${details}</small></div>`;
            
            div.onclick = () => {
                this.selectDestination(res, name);
                container.classList.remove('open');
                document.getElementById('nav-search-input').value = name;
            };
            container.appendChild(div);
        });
        container.classList.add('open');
    },

    clearResults: function() {
        document.getElementById('nav-search-results').classList.remove('open');
    },

    selectDestination: function(place, name) {
        if (!userMarker) { alert("No GPS Position yet!"); return; }

        const startLat = userMarker.getLatLng().lat;
        const startLng = userMarker.getLatLng().lng;
        const endLat = place.lat;
        const endLng = place.lon;

        // CLEAN START: Filter & Icons weg
        if (typeof ExploreLogic !== 'undefined') {
            ExploreLogic.toggleLayer('gas', false);
            ExploreLogic.toggleLayer('cam', false);
            ExploreLogic.toggleLayer('parking', false);
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        }

        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
        document.getElementById('map-loading').classList.add('visible');

        fetch(osrmUrl).then(r => r.json()).then(data => {
            document.getElementById('map-loading').classList.remove('visible');
            if (data.routes && data.routes.length > 0) {
                this.currentDestination = { name: name, lat: endLat, lng: endLng };
                this.drawRoute(data.routes[0]);
                this.showPreview(data.routes[0], name);
            } else { alert("No route found."); }
        }).catch(e => {
            document.getElementById('map-loading').classList.remove('visible');
            console.error("Routing Error", e);
        });
    },

    drawRoute: function(route) {
        if (this.routeLayer) map.removeLayer(this.routeLayer);
        const coordinates = route.geometry.coordinates.map(c => [c[1], c[0]]); 
        this.routeLayer = L.polyline(coordinates, { color: '#007aff', weight: 6, opacity: 0.8, lineCap: 'round' }).addTo(map);
        map.fitBounds(this.routeLayer.getBounds(), { padding: [50, 50], maxZoom: 16 });
    },

    showPreview: function(route, destName) {
        const durationMin = Math.round(route.duration / 60);
        const distKm = (route.distance / 1000).toFixed(1);
        
        // Save for later
        this.routeDuration = route.duration; 
        this.routeDistance = route.distance / 1000;

        document.getElementById('preview-time').innerText = durationMin + " min";
        document.getElementById('preview-dist').innerText = distKm + " km";
        document.getElementById('preview-dest-name').innerText = destName;
        
        document.getElementById('route-preview-modal').classList.remove('hidden');
        setTimeout(() => document.getElementById('route-preview-modal').classList.add('active'), 10);
    },

    cancelRoute: function() {
        if (this.routeLayer) { map.removeLayer(this.routeLayer); this.routeLayer = null; }
        document.getElementById('route-preview-modal').classList.remove('active');
        setTimeout(() => document.getElementById('route-preview-modal').classList.add('hidden'), 300);
        document.getElementById('nav-search-input').value = "";
    },

    // --- NAVIGATION START ---
    startNavigation: function(mode) {
        this.navMode = mode;
        this.isNavigating = true;
        this.navStartTime = Date.now();

        // 1. UI Switch
        document.getElementById('route-preview-modal').classList.remove('active');
        setTimeout(() => document.getElementById('route-preview-modal').classList.add('hidden'), 300);
        
        // Hide Explore, Show Navi Screen
        document.getElementById('explore-screen').classList.add('hidden');
        document.getElementById('global-nav').classList.add('hidden'); // Nav bar weg
        
        const navScreen = document.getElementById('navi-screen');
        navScreen.classList.remove('hidden');
        setTimeout(() => navScreen.classList.add('active'), 10);

        // 2. Map Setup
        map.dragging.enable();
        map.touchZoom.enable();
        // Zoom in to Start
        if(userMarker) {
            map.setView(userMarker.getLatLng(), 18, { animate: true, duration: 1.5 });
        }

        // 3. Start Update Loop (für Zeit, Speed etc.)
        this.startNavLoop();
        
        // 4. Record Logic starten (wenn nötig)
        if (mode === 'record') {
            // Wir nutzen eine vereinfachte interne Logik, um drive.js nicht zu stören
            this.recordStats = { dist: 0, startTime: Date.now(), path: [] };
        }
    },

    startNavLoop: function() {
        if(this.navInterval) clearInterval(this.navInterval);
        
        // Initial ETA Update
        this.updateETA();

        this.navInterval = setInterval(() => {
            // Update Time / ETA
            this.updateETA();
            
            // Simuliere Restzeit/Strecke basierend auf Fortschritt (Simple V1 Logic)
            // In einer echten App müssten wir Position auf der Route matchen.
            // Hier machen wir es Zeit-basiert für die Demo.
            const elapsedSec = (Date.now() - this.navStartTime) / 1000;
            let remainSec = Math.max(0, this.routeDuration - elapsedSec);
            let remainMin = Math.ceil(remainSec / 60);
            
            document.getElementById('nav-remain-time').innerText = remainMin + " min";
            
            // Update Speed (wird eigentlich von handlePositionUpdate gemacht, aber hier Fallback)
            // ...
        }, 1000);
    },

    updateETA: function() {
        const now = new Date();
        const arrival = new Date(now.getTime() + (this.routeDuration * 1000));
        const hours = arrival.getHours().toString().padStart(2, '0');
        const minutes = arrival.getMinutes().toString().padStart(2, '0');
        document.getElementById('nav-eta-time').innerText = `${hours}:${minutes}`;
    },

    // Aufgerufen von app.js handlePositionUpdate
    updatePosition: function(pos) {
        if(!this.isNavigating) return;

        const speedKm = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;
        document.getElementById('nav-speed').innerText = speedKm;

        // Map Rotation
        const heading = pos.coords.heading;
        const mapEl = document.getElementById('background-map');
        if (heading && speedKm > 5) {
             mapEl.style.transform = `rotate(${-heading}deg)`;
        }

        // Record Logic Update
        if(this.navMode === 'record') {
            // Simple Distanz addieren
            // (In echter App genauer)
            // Wir speichern Punkte für Summary map
            this.recordStats.path.push({
                lat: pos.coords.latitude, 
                lng: pos.coords.longitude, 
                speed: speedKm,
                time: Date.now()
            });
        }
    },

    recenterNav: function() {
        if(userMarker) {
            map.setView(userMarker.getLatLng(), 18, { animate: true, duration: 1.0 });
        }
    },

    stopNavigation: function() {
        this.isNavigating = false;
        clearInterval(this.navInterval);

        // Reset Map Rotation
        document.getElementById('background-map').style.transform = `rotate(0deg)`;

        // Screen Switch
        const navScreen = document.getElementById('navi-screen');
        navScreen.classList.remove('active');
        setTimeout(() => navScreen.classList.add('hidden'), 300);

        if (this.navMode === 'ghost') {
            // Einfach zurück zu Explore
            showExplore(); 
            // Route löschen
            if(this.routeLayer) { map.removeLayer(this.routeLayer); this.routeLayer = null; }
            document.getElementById('nav-search-input').value = "";
        } 
        else if (this.navMode === 'record') {
            // Zu Summary (Logic kopiert aus drive.js aber angepasst)
            this.showSummary();
        }
    },

    showSummary: function() {
        // Berechne Stats
        const durationMs = Date.now() - this.recordStats.startTime;
        const durationMin = Math.floor(durationMs / 60000);
        const durationSec = Math.floor((durationMs % 60000) / 1000);
        const timeStr = `${durationMin.toString().padStart(2,'0')}:${durationSec.toString().padStart(2,'0')}`;
        
        // Berechne Distanz aus Path (Genauer als GPS Speed Integration)
        let totalDist = 0;
        for(let i=0; i < this.recordStats.path.length-1; i++) {
            const p1 = L.latLng(this.recordStats.path[i]);
            const p2 = L.latLng(this.recordStats.path[i+1]);
            totalDist += p1.distanceTo(p2);
        }
        totalDist = totalDist / 1000; // km

        const avgSpeed = (durationMs > 0 && totalDist > 0) ? Math.round(totalDist / (durationMs/3600000)) : 0;

        // UI füllen
        document.getElementById('sum-avg').innerText = avgSpeed;
        document.getElementById('sum-dist').innerText = totalDist.toFixed(2);
        document.getElementById('sum-time').innerText = timeStr;

        // Est vs Real
        const estMin = Math.round(this.routeDuration / 60);
        document.getElementById('sum-comparison-row').classList.remove('hidden');
        document.getElementById('sum-est-time').innerText = estMin + " min";
        document.getElementById('sum-real-time').innerText = durationMin + " min";

        // Summary Screen zeigen
        switchScreen('summary-screen');
        
        // Map auf Summary zeichnen
        setTimeout(() => {
            const latLngs = this.recordStats.path.map(p => [p.lat, p.lng]);
            const mapContainer = document.getElementById('summary-map');
            // Cleanup old map instance if exists (needs global var or check)
            // ... Simplified for now: just empty div
            mapContainer.innerHTML = ""; 
            
            const sumMap = L.map('summary-map', { zoomControl: false, attributionControl: false }).setView([51.1657, 10.4515], 13);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(sumMap);
            
            if (latLngs.length > 1) {
                const line = L.polyline(latLngs, {color: '#007aff', weight: 4}).addTo(sumMap);
                sumMap.fitBounds(line.getBounds(), {padding:[40,40]});
            }
        }, 300);

        // Buttons
        document.getElementById('btn-save').onclick = () => {
            GarageLogic.save({ 
                date: Date.now(), 
                dist: totalDist, 
                time: timeStr, 
                avg: avgSpeed, 
                path: this.recordStats.path 
            });
            showGarage();
        };
        document.getElementById('btn-discard').onclick = () => {
            showHome();
        };
    }
};
