// navi.js - Advanced Navigation Logic

const NaviLogic = {
    routeLayer: null,
    previewMap: null,
    previewRouteLayer: null,
    previewBounds: null,
    
    currentDestination: null,
    searchTimeout: null,
    isNavigating: false,
    navMode: 'ghost', 
    navStartTime: 0,
    navInterval: null,
    
    routeDistance: 0,
    routeDuration: 0,
    routeSteps: [],
    destMarker: null,
    
    distanceFactor: 1.0,
    
    recordStats: null,
    lastSpeedCheck: 0,
    
    init: function() {
        console.log("Navi Init");
        const input = document.getElementById('nav-search-input');
        input.addEventListener('input', (e) => {
            const query = e.target.value;
            if (this.searchTimeout) clearTimeout(this.searchTimeout);
            if (query.length > 2) {
                this.searchTimeout = setTimeout(() => { this.performSearch(query); }, 600); 
            } else {
                this.clearResults();
            }
        });
    },

    performSearch: function(query) {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
        fetch(url).then(r => r.json()).then(data => { this.renderResults(data); }).catch(e => console.error("Search Error", e));
    },

    renderResults: function(results) {
        const container = document.getElementById('nav-search-results');
        container.innerHTML = '';
        if (results.length === 0) { container.classList.remove('open'); return; }
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

        if (typeof ExploreLogic !== 'undefined') {
            ExploreLogic.resetAll();
        }

        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson&steps=true`;
        document.getElementById('map-loading').classList.add('visible');

        fetch(osrmUrl).then(r => r.json()).then(data => {
            document.getElementById('map-loading').classList.remove('visible');
            if (data.routes && data.routes.length > 0) {
                this.currentDestination = { name: name, lat: endLat, lng: endLng };
                this.routeSteps = data.routes[0].legs[0].steps;
                this.drawRoute(data.routes[0]);
                
                const destLatLng = L.latLng(endLat, endLng);
                const airDistKm = userMarker.getLatLng().distanceTo(destLatLng) / 1000;
                const roadDistKm = data.routes[0].distance / 1000;
                this.distanceFactor = (airDistKm > 0) ? (roadDistKm / airDistKm) : 1.0;
                
                this.showPreview(data.routes[0], name, [startLat, startLng], [endLat, endLng]);
            } else { alert("No route found."); }
        }).catch(e => {
            document.getElementById('map-loading').classList.remove('visible');
            console.error("Routing Error", e);
        });
    },

    drawRoute: function(route) {
        if (this.routeLayer) { map.removeLayer(this.routeLayer); this.routeLayer = null; }
        if (this.destMarker) { map.removeLayer(this.destMarker); this.destMarker = null; }

        const coordinates = route.geometry.coordinates.map(c => [c[1], c[0]]); 
        this.routeLayer = L.polyline(coordinates, { color: '#bf5af2', weight: 6, opacity: 0.8, lineCap: 'round' }).addTo(map);
        
        if(this.currentDestination) {
            const endIcon = L.divIcon({className: 'preview-end-icon', html:'<i class="fa-solid fa-flag-checkered"></i>', iconSize:[20,20]});
            this.destMarker = L.marker([this.currentDestination.lat, this.currentDestination.lng], {icon: endIcon}).addTo(map);
        }

        map.fitBounds(this.routeLayer.getBounds(), { padding: [50, 50], maxZoom: 16 });
    },

    togglePreviewMap: function() {
        const container = document.getElementById('preview-map-container');
        const content = document.querySelector('.preview-content-wrapper');
        const isExpanded = container.classList.contains('expanded');
        container.classList.toggle('expanded');
        content.classList.toggle('hidden-visually');
        setTimeout(() => { 
            if(this.previewMap) {
                this.previewMap.invalidateSize();
                if(isExpanded && this.previewBounds) {
                    this.previewMap.fitBounds(this.previewBounds, {animate: true, padding: [20,20]});
                }
            }
        }, 450);
    },

    renderPreviewMap: function(coordinates, startLatLng, endLatLng) {
        if(this.previewMap) { this.previewMap.remove(); this.previewMap = null; }
        const el = document.getElementById('preview-map-obj');
        if(!el) return;
        this.previewMap = L.map('preview-map-obj', {
            zoomControl: false, attributionControl: false, dragging: true,
            touchZoom: true, doubleClickZoom: true, scrollWheelZoom: false
        });
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(this.previewMap);
        const line = L.polyline(coordinates, { color: '#bf5af2', weight: 4 }).addTo(this.previewMap);
        this.previewBounds = line.getBounds();
        const startIcon = L.divIcon({className: 'preview-start-icon', iconSize:[14,14]});
        const endIcon = L.divIcon({className: 'preview-end-icon', html:'<i class="fa-solid fa-flag-checkered"></i>', iconSize:[20,20]});
        L.marker(startLatLng, {icon: startIcon}).addTo(this.previewMap);
        L.marker(endLatLng, {icon: endIcon}).addTo(this.previewMap);
        setTimeout(() => {
            if(this.previewMap) {
                this.previewMap.invalidateSize();
                this.previewMap.fitBounds(this.previewBounds, {padding: [20,20]});
            }
        }, 300);
    },

    showPreview: function(route, destName, startLatLng, endLatLng) {
        const durationMin = Math.round(route.duration / 60);
        const distKm = (route.distance / 1000).toFixed(1);
        this.routeDuration = route.duration; 
        this.routeDistance = route.distance / 1000;

        let timeDisplay = durationMin + " min";
        if (durationMin > 60) {
            const h = Math.floor(durationMin / 60);
            const m = durationMin % 60;
            timeDisplay = `${h}:${m.toString().padStart(2, '0')} h`;
        }

        document.getElementById('preview-time').innerText = timeDisplay;
        document.getElementById('preview-dist').innerText = distKm + " km";
        document.getElementById('preview-dest-name').innerText = destName;
        
        const modal = document.getElementById('route-preview-modal');
        modal.classList.remove('hidden');
        setTimeout(() => modal.classList.add('active'), 10);

        document.getElementById('preview-map-container').classList.remove('expanded');
        document.querySelector('.preview-content-wrapper').classList.remove('hidden-visually');

        const coordinates = route.geometry.coordinates.map(c => [c[1], c[0]]);
        this.renderPreviewMap(coordinates, startLatLng, endLatLng);
    },

    cancelRoute: function() {
        if (this.routeLayer && map) { map.removeLayer(this.routeLayer); this.routeLayer = null; }
        if (this.destMarker && map) { map.removeLayer(this.destMarker); this.destMarker = null; }
        const modal = document.getElementById('route-preview-modal');
        if(modal) { modal.classList.remove('active'); setTimeout(() => modal.classList.add('hidden'), 300); }
        const input = document.getElementById('nav-search-input');
        if(input) input.value = "";
        this.isNavigating = false;
        if(this.navInterval) clearInterval(this.navInterval);

        if(userMarker && map) {
            map.setView(userMarker.getLatLng(), 15, { animate: true, duration: 1.0 });
        }
    },

    startNavigation: function(mode) {
        this.navMode = mode;
        this.isNavigating = true;
        this.navStartTime = Date.now();

        // FIX: Animation EINschalten für Navi
        document.getElementById('background-map').classList.add('map-smooth-rotate');

        document.getElementById('route-preview-modal').classList.remove('active');
        setTimeout(() => document.getElementById('route-preview-modal').classList.add('hidden'), 300);
        
        document.getElementById('explore-screen').classList.add('hidden');
        document.getElementById('global-nav').classList.add('hidden'); 
        
        const navScreen = document.getElementById('navi-screen');
        navScreen.classList.remove('hidden');
        setTimeout(() => navScreen.classList.add('active'), 10);

        map.dragging.enable();
        map.touchZoom.enable();
        
        if(userMarker) {
            map.setView(userMarker.getLatLng(), 18, { animate: false });
            const el = userMarker.getElement();
            if(el) {
                el.innerHTML = '<div class="user-arrow-icon"><i class="fa-solid fa-location-arrow"></i></div>';
                el.className = 'user-marker-wrap'; 
            }
        }

        this.startNavLoop();
        
        if (mode === 'record') {
            this.recordStats = { dist: 0, startTime: Date.now(), path: [] };
        }
    },

    startNavLoop: function() {
        if(this.navInterval) clearInterval(this.navInterval);
        this.updateETA();

        this.navInterval = setInterval(() => {
            this.updateETA();
            const elapsedSec = (Date.now() - this.navStartTime) / 1000;
            
            let distRemain = 0;
            if(userMarker && this.currentDestination) {
                const destLatLng = L.latLng(this.currentDestination.lat, this.currentDestination.lng);
                const airDist = userMarker.getLatLng().distanceTo(destLatLng) / 1000;
                distRemain = (airDist * this.distanceFactor).toFixed(1);
            }
            document.getElementById('nav-remain-dist').innerText = distRemain;

            let remainSec = Math.max(0, this.routeDuration - elapsedSec);
            let remainMin = Math.ceil(remainSec / 60);
            
            let timeStr = remainMin + " min";
            if (remainMin > 60) {
                const h = Math.floor(remainMin / 60);
                const m = remainMin % 60;
                timeStr = `${h}:${m.toString().padStart(2,'0')} h`;
            }
            document.getElementById('nav-remain-time').innerText = timeStr;
        }, 1000);
    },

    updateETA: function() {
        const now = new Date();
        const arrival = new Date(now.getTime() + (this.routeDuration * 1000));
        const hours = arrival.getHours().toString().padStart(2, '0');
        const minutes = arrival.getMinutes().toString().padStart(2, '0');
        document.getElementById('nav-eta-time').innerText = `${hours}:${minutes}`;
    },

    updatePosition: function(pos) {
        if(!this.isNavigating) return;

        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const speedKm = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;
        document.getElementById('nav-speed').innerText = speedKm;

        const heading = pos.coords.heading;
        const mapEl = document.getElementById('background-map');
        if (heading && speedKm > 3) { 
             mapEl.style.transform = `rotate(${-heading}deg)`;
        }

        if(!this.lastSpeedCheck || Date.now() - this.lastSpeedCheck > 5000) {
            this.lastSpeedCheck = Date.now();
            this.checkSpeedLimit(lat, lng);
        }

        this.updateInstructions(lat, lng);

        if(this.navMode === 'record' && this.recordStats) {
            this.recordStats.path.push({ lat: lat, lng: lng, speed: speedKm, time: Date.now() });
        }
    },

    checkSpeedLimit: function(lat, lng) {
        const query = `[out:json][timeout:5];way["maxspeed"](around:25,${lat},${lng});out tags;`;
        const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
        fetch(url).then(r=>r.json()).then(data => {
            const el = document.getElementById('nav-speed-limit');
            if(data.elements && data.elements.length > 0) {
                let max = data.elements[0].tags.maxspeed;
                if(max && !isNaN(parseInt(max))) {
                    el.querySelector('span').innerText = max;
                    el.classList.remove('hidden');
                } else { el.classList.add('hidden'); }
            } else { el.classList.add('hidden'); }
        }).catch(e => {}); 
    },

    updateInstructions: function(lat, lng) {
        if(!this.routeSteps || this.routeSteps.length === 0) return;
        let nextStep = null;
        let distToNext = 99999;
        const userLoc = L.latLng(lat, lng);

        for(let i=0; i<this.routeSteps.length; i++) {
            const step = this.routeSteps[i];
            const stepLoc = L.latLng(step.maneuver.location[1], step.maneuver.location[0]);
            const dist = userLoc.distanceTo(stepLoc);
            if(dist > 40) { nextStep = step; distToNext = dist; break; }
        }

        if(nextStep) {
            let iconClass = "fa-arrow-up";
            const modifier = nextStep.maneuver.modifier;
            if(modifier) {
                if(modifier.includes('left')) iconClass = "fa-arrow-left";
                else if(modifier.includes('right')) iconClass = "fa-arrow-right";
                else if(modifier.includes('slight left')) iconClass = "fa-arrow-up-left";
            }
            let text = nextStep.name || nextStep.maneuver.type || "Folgen Sie der Route";
            if (text === "new name") text = "Geradeaus"; 
            document.getElementById('nav-instruction').innerText = text;
            document.getElementById('nav-next-dist').innerText = "in " + Math.round(distToNext) + " m";
            document.getElementById('nav-arrow-icon').className = `fa-solid ${iconClass}`;
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

        // FIX: Animation AUSschalten beim Stop
        document.getElementById('background-map').classList.remove('map-smooth-rotate');

        const mapEl = document.getElementById('background-map');
        if(mapEl) mapEl.style.transform = `rotate(0deg)`;

        if(userMarker) {
            const el = userMarker.getElement();
            if(el) {
                el.innerHTML = '<div class="user-pulse"></div><div class="user-dot"></div>';
                el.className = 'user-marker-wrap';
            }
        }

        const navScreen = document.getElementById('navi-screen');
        navScreen.classList.remove('active');
        setTimeout(() => navScreen.classList.add('hidden'), 300);

        if (this.navMode === 'ghost') {
            this.cancelRoute(); 
            showExplore(); 
            document.getElementById('explore-screen').classList.remove('hidden');
            if(typeof ExploreLogic !== 'undefined') ExploreLogic.enter();
        } 
        else if (this.navMode === 'record') {
            this.cancelRoute();
            this.showSummary();
        }
    },

    showSummary: function() {
        if(!this.recordStats) return;
        const durationMs = Date.now() - this.recordStats.startTime;
        const durationMin = Math.floor(durationMs / 60000);
        const durationSec = Math.floor((durationMs % 60000) / 1000);
        const timeStr = `${durationMin.toString().padStart(2,'0')}:${durationSec.toString().padStart(2,'0')}`;
        
        let totalDist = 0;
        for(let i=0; i < this.recordStats.path.length-1; i++) {
            const p1 = L.latLng(this.recordStats.path[i]);
            const p2 = L.latLng(this.recordStats.path[i+1]);
            totalDist += p1.distanceTo(p2);
        }
        totalDist = totalDist / 1000; 
        const avgSpeed = (durationMs > 0 && totalDist > 0) ? Math.round(totalDist / (durationMs/3600000)) : 0;

        document.getElementById('sum-avg').innerText = avgSpeed;
        document.getElementById('sum-dist').innerText = totalDist.toFixed(2);
        document.getElementById('sum-time').innerText = timeStr;

        const estMin = Math.round(this.routeDuration / 60);
        document.getElementById('sum-comparison-row').classList.remove('hidden');
        document.getElementById('sum-est-time').innerText = estMin + " min";
        document.getElementById('sum-real-time').innerText = durationMin + " min";

        switchScreen('summary-screen');
        
        setTimeout(() => {
            const mapContainer = document.getElementById('summary-map');
            if (window.summaryMapInstance) {
                window.summaryMapInstance.remove();
                window.summaryMapInstance = null;
            }
            
            if(mapContainer) {
                mapContainer.innerHTML = ""; 
                window.summaryMapInstance = L.map('summary-map', { zoomControl: false, attributionControl: false }).setView([51.1657, 10.4515], 13);
                L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(window.summaryMapInstance);
                
                if (this.recordStats.path.length > 1) {
                    const latLngs = this.recordStats.path.map(p => [p.lat, p.lng]);
                    const line = L.polyline(latLngs, {color: '#bf5af2', weight: 4}).addTo(window.summaryMapInstance);
                    window.summaryMapInstance.fitBounds(line.getBounds(), {padding:[40,40]});
                }
                window.summaryMapInstance.invalidateSize();
            }
        }, 300);

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
