const TANKERKOENIG_API_KEY = ''; // DEIN KEY HIER REIN (wenn er da ist)

// Globale Variablen
let exploreLayers = { gas: null, cam: null, parking: null };
let exploreState = { gas: false, cam: false, parking: false };

let cachedGasStations = []; 
let currentFuelType = 'e10'; 

const ExploreLogic = {
    init: function() {
        console.log("Explore Init");
        if (typeof L === 'undefined') return;

        exploreLayers.gas = L.layerGroup();
        exploreLayers.cam = L.layerGroup();
        exploreLayers.parking = L.layerGroup();

        this.setupButton('filter-gas', 'gas');
        this.setupButton('filter-cam', 'cam');
        this.setupButton('filter-parking', 'parking');

        const btnRecenter = document.getElementById('btn-explore-recenter');
        if(btnRecenter) {
            btnRecenter.onclick = () => {
                if(map && userMarker) map.panTo(userMarker.getLatLng(), { animate: true, duration: 1.0 });
            };
        }
    },

    setupButton: function(id, type) {
        const btn = document.getElementById(id);
        if (btn) {
            btn.onclick = () => {
                btn.classList.toggle('active');
                exploreState[type] = !exploreState[type];
                this.toggleLayer(type, exploreState[type]);
            };
        }
    },

    enter: function() {
        if(map) {
            map.dragging.enable();
            map.touchZoom.enable();
            map.scrollWheelZoom.enable();
            
            const mapEl = document.getElementById('background-map');
            if(mapEl) mapEl.style.transform = `rotate(0deg)`;

            if(exploreLayers.gas) exploreLayers.gas.addTo(map);
            if(exploreLayers.cam) exploreLayers.cam.addTo(map);
            if(exploreLayers.parking) exploreLayers.parking.addTo(map);

            map.on('moveend', this.onMapMove);
            this.onMapMove(); 
        }
    },

    leave: function() {
        if(map) {
            map.dragging.disable();
            map.touchZoom.disable();
            map.scrollWheelZoom.disable();

            if(exploreLayers.gas) exploreLayers.gas.remove();
            if(exploreLayers.cam) exploreLayers.cam.remove();
            if(exploreLayers.parking) exploreLayers.parking.remove();
            
            map.off('moveend', this.onMapMove);
            
            if(typeof userMarker !== 'undefined' && userMarker) {
                map.panTo(userMarker.getLatLng(), { animate: true, duration: 1.0 });
            }
        }
    },

    toggleLayer: function(type, isActive) {
        if (isActive) { this.fetchData(type); } 
        else { if(exploreLayers[type]) exploreLayers[type].clearLayers(); }
    },

    onMapMove: function() {
        if (this.moveTimeout) clearTimeout(this.moveTimeout);
        this.moveTimeout = setTimeout(() => {
            if (exploreState.gas) ExploreLogic.fetchData('gas');
            if (exploreState.cam) ExploreLogic.fetchData('cam');
            if (exploreState.parking) ExploreLogic.fetchData('parking');
        }, 500);
    },

    fetchData: function(type) {
        if (!map) return;
        const center = map.getCenter();
        let radius = 3000; 
        if (map.getZoom() < 12) radius = 10000; 
        if (map.getZoom() > 14) radius = 2500; // Etwas größerer Radius

        const loader = document.getElementById('map-loading');
        if(loader) loader.classList.add('visible');

        // WICHTIG: nwr statt node (findet auch Gebäude/Ways)
        // und 'out center' damit wir Koordinaten für Gebäude kriegen
        let query = "";
        let endTag = "out center;"; 

        if (type === 'gas') query = `[out:json][timeout:25];nwr["amenity"="fuel"](around:${radius},${center.lat},${center.lng});${endTag}`;
        else if (type === 'cam') query = `[out:json][timeout:25];node["highway"="speed_camera"](around:${radius},${center.lat},${center.lng});out;`;
        else if (type === 'parking') query = `[out:json][timeout:25];nwr["amenity"="parking"](around:${radius},${center.lat},${center.lng});${endTag}`;

        const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

        fetch(url)
            .then(r => r.json())
            .then(data => {
                if(loader) loader.classList.remove('visible');
                
                if (type === 'gas') {
                    // Wir filtern Duplikate (manche Tankstellen sind als Node UND Way drin)
                    // Simple Deduplizierung über ID wäre gut, aber für jetzt reicht das Array
                    cachedGasStations = data.elements || [];
                    this.redrawGasMarkers();
                } else {
                    if(exploreLayers[type]) exploreLayers[type].clearLayers();
                    if (!data.elements) return;
                    this.renderGenericMarkers(type, data.elements);
                }
            })
            .catch(err => {
                if(loader) loader.classList.remove('visible');
                console.log("API Error:", err);
            });
    },

    // --- MARKER LOGIK MIT OPEN/CLOSED STATUS ---
    redrawGasMarkers: function() {
        exploreLayers.gas.clearLayers();
        
        cachedGasStations.forEach(el => {
            // Geometrie Check: Ist es ein Punkt oder ein Gebäude?
            let lat = el.lat;
            let lon = el.lon;
            if (el.center) {
                lat = el.center.lat;
                lon = el.center.lon;
            }
            if (!lat || !lon) return; // Skip broken data

            const name = (el.tags && el.tags.name) ? el.tags.name : "Tankstelle";
            const brandClass = this.getBrandClass(name);
            
            let displayName = name.replace(/Tankstelle|Station/gi, "").trim();
            if (displayName.length > 12) displayName = displayName.substring(0, 11) + "..";
            if (displayName === "") displayName = "TANK";

            // Preise simulieren (Fallback) oder behalten
            if (!el.simPrices) {
                const baseE10 = 1.70 + (Math.random() * 0.14 - 0.07);
                el.simPrices = {
                    e10: baseE10.toFixed(2),
                    diesel: (1.60 + (Math.random() * 0.14 - 0.07)).toFixed(2),
                    e5: (baseE10 + 0.06).toFixed(2),
                    isOpen: true // Default: Offen (bis Key da ist)
                };
            }

            // Wenn wir echte Daten haben (vom Key), nutzen wir die
            if (el.realData) {
                el.simPrices.isOpen = el.realData.isOpen;
                // Echte Preise nutzen wir hier noch nicht für die Map (erst im Popup), 
                // weil wir sonst die Map neu laden müssten.
            }

            let displayPrice = el.simPrices[currentFuelType];
            
            // STATUS CHECK: CSS Klasse für "Geschlossen"
            // Wenn Key da ist -> Echtes isOpen. Wenn nicht -> Immer offen (sicherer als falsch zu).
            const closedClass = (el.simPrices.isOpen === false) ? 'closed' : '';

            const html = `
                <div class="price-marker-wrap ${closedClass}">
                    <div class="pm-brand-bar ${brandClass}">${displayName}</div>
                    <div class="pm-content">
                        <div class="pm-price">${displayPrice}</div>
                        <div class="pm-fuel-label">${currentFuelType.toUpperCase()}</div>
                    </div>
                </div>
            `;

            const icon = L.divIcon({
                className: 'custom-div-icon',
                html: html,
                iconSize: [70, 50], 
                iconAnchor: [35, 50] 
            });

            const marker = L.marker([lat, lon], {icon: icon});
            
            marker.on('click', () => {
                this.openTotem(name, lat, lon, el); // el mitgeben um Daten zu speichern
            });
            
            exploreLayers.gas.addLayer(marker);
        });
    },

    renderGenericMarkers: function(type, elements) {
        elements.forEach(el => {
            let lat = el.lat; let lon = el.lon;
            if (el.center) { lat = el.center.lat; lon = el.center.lon; }
            if (!lat || !lon) return;

            let iconHtml = ''; let className = '';
            if (type === 'cam') { iconHtml = '<i class="fa-solid fa-camera"></i>'; className = 'icon-cam'; }
            else if (type === 'parking') { iconHtml = '<i class="fa-solid fa-square-parking"></i>'; className = 'icon-parking'; }

            const icon = L.divIcon({
                className: 'custom-div-icon', 
                html: `<div class="custom-map-icon ${className}">${iconHtml}</div>`,
                iconSize: [30, 30], iconAnchor: [15, 15]
            });

            const marker = L.marker([lat, lon], {icon: icon});
            if (el.tags && el.tags.name) marker.bindPopup(`<b>${el.tags.name}</b>`);
            exploreLayers[type].addLayer(marker);
        });
    },

    getBrandClass: function(name) {
        const n = name.toLowerCase();
        if(n.includes('aral')) return 'aral';
        if(n.includes('shell')) return 'shell';
        if(n.includes('esso')) return 'esso';
        if(n.includes('total')) return 'total';
        if(n.includes('jet')) return 'jet';
        if(n.includes('hem')) return 'hem';
        if(n.includes('avanti')) return 'avanti';
        return ''; 
    },

    // --- HYBRIDE TOTEM LOGIK ---
    openTotem: function(name, lat, lng, elementRef) {
        const overlay = document.getElementById('gas-totem-overlay');
        const brandHeader = document.getElementById('totem-brand-header');
        const brandTitle = document.getElementById('totem-brand');
        
        brandHeader.className = 'totem-header ' + this.getBrandClass(name);
        brandTitle.innerText = name;
        
        // Reset
        document.getElementById('totem-status').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> LOADING';
        overlay.classList.remove('hidden');

        // CHECK API
        if (TANKERKOENIG_API_KEY && TANKERKOENIG_API_KEY.length > 10) {
            const url = `https://creativecommons.tankerkoenig.de/json/list.php?lat=${lat}&lng=${lng}&rad=1.0&sort=dist&type=all&apikey=${TANKERKOENIG_API_KEY}`;
            fetch(url)
                .then(r => r.json())
                .then(data => {
                    if (data.ok && data.stations && data.stations.length > 0) {
                        const station = data.stations[0];
                        
                        // Echte Daten speichern für die Map-Anzeige (Update beim nächsten Redraw)
                        if(elementRef) {
                            elementRef.realData = station; // Speichern
                            elementRef.simPrices.isOpen = station.isOpen; // Status update
                            // Optional: Preise auch im Marker updaten
                            if(station.diesel) elementRef.simPrices.diesel = station.diesel.toFixed(2);
                            if(station.e10) elementRef.simPrices.e10 = station.e10.toFixed(2);
                            if(station.e5) elementRef.simPrices.e5 = station.e5.toFixed(2);
                        }

                        this.updateTotemUI(station.isOpen, station.diesel, station.e10, station.e5);
                        // Map updaten, damit der Marker grau wird falls zu
                        this.redrawGasMarkers(); 
                    } else {
                        // Fallback Simulation
                        this.updateTotemUI(true, elementRef.simPrices.diesel, elementRef.simPrices.e10, elementRef.simPrices.e5);
                    }
                })
                .catch(e => {
                    this.updateTotemUI(true, elementRef.simPrices.diesel, elementRef.simPrices.e10, elementRef.simPrices.e5);
                });
        } else {
            // Nur Simulation
            setTimeout(() => {
                this.updateTotemUI(true, elementRef.simPrices.diesel, elementRef.simPrices.e10, elementRef.simPrices.e5);
            }, 300);
        }
    },

    updateTotemUI: function(isOpen, diesel, e10, e5) {
        const statusEl = document.getElementById('totem-status');
        if (isOpen) {
            statusEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> OPEN';
            statusEl.style.color = '#30d158';
        } else {
            statusEl.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> CLOSED';
            statusEl.style.color = '#ff3b30';
        }

        document.getElementById('price-diesel').innerText = diesel ? Number(diesel).toFixed(2) : "-.--";
        document.getElementById('price-e10').innerText = e10 ? Number(e10).toFixed(2) : "-.--";
        document.getElementById('price-e5').innerText = e5 ? Number(e5).toFixed(2) : "-.--";
        
        this.updateTotemSelectionUI();
    },

    selectFuel: function(type) {
        currentFuelType = type;
        this.updateTotemSelectionUI();
        this.redrawGasMarkers(); 
    },

    updateTotemSelectionUI: function() {
        document.querySelectorAll('.price-row').forEach(r => r.classList.remove('selected'));
        document.getElementById('row-' + currentFuelType).classList.add('selected');
    },

    closeTotem: function() {
        document.getElementById('gas-totem-overlay').classList.add('hidden');
    }
};
