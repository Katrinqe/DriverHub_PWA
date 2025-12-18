const TANKERKOENIG_API_KEY = ''; // Hier Key rein, wenn vorhanden

// Globale Variablen
let exploreLayers = { gas: null, cam: null, parking: null };
let exploreState = { gas: false, cam: false, parking: false };

// Cache für Tankstellen (damit wir nicht ständig neu laden müssen beim Umschalten)
let cachedGasStations = []; 
let currentFuelType = 'e10'; // Standard: E10

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
        // Debounce
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
        if (map.getZoom() > 14) radius = 2000;

        const loader = document.getElementById('map-loading');
        if(loader) loader.classList.add('visible');

        let query = "";
        if (type === 'gas') query = `[out:json];node["amenity"="fuel"](around:${radius},${center.lat},${center.lng});out;`;
        else if (type === 'cam') query = `[out:json];node["highway"="speed_camera"](around:${radius},${center.lat},${center.lng});out;`;
        else if (type === 'parking') query = `[out:json];node["amenity"="parking"](around:${radius},${center.lat},${center.lng});out;`;

        const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

        fetch(url)
            .then(r => r.json())
            .then(data => {
                if(loader) loader.classList.remove('visible');
                
                if (type === 'gas') {
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

    // --- NEU: Gas Marker Logik mit Name & Sorte ---
    redrawGasMarkers: function() {
        exploreLayers.gas.clearLayers();
        
        cachedGasStations.forEach(el => {
            const name = (el.tags && el.tags.name) ? el.tags.name : "Tankstelle";
            const brandClass = this.getBrandClass(name);
            
            // Name aufräumen & kürzen für die kleine Anzeige
            let displayName = name.replace(/Tankstelle|Station/gi, "").trim();
            if (displayName.length > 12) displayName = displayName.substring(0, 11) + "..";
            if (displayName === "") displayName = "TANK";

            // Preise simulieren falls nötig
            if (!el.simPrices) {
                const baseE10 = 1.70 + (Math.random() * 0.14 - 0.07);
                el.simPrices = {
                    e10: baseE10.toFixed(2),
                    diesel: (1.60 + (Math.random() * 0.14 - 0.07)).toFixed(2),
                    e5: (baseE10 + 0.06).toFixed(2)
                };
            }

            let displayPrice = el.simPrices[currentFuelType];
            
            // DAS NEUE MARKER HTML
            const html = `
                <div class="price-marker-wrap">
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

            const marker = L.marker([el.lat, el.lon], {icon: icon});
            
            marker.on('click', () => {
                this.openTotem(el);
            });
            
            exploreLayers.gas.addLayer(marker);
        });
    },

    renderGenericMarkers: function(type, elements) {
        elements.forEach(el => {
            let iconHtml = ''; let className = '';
            if (type === 'cam') { iconHtml = '<i class="fa-solid fa-camera"></i>'; className = 'icon-cam'; }
            else if (type === 'parking') { iconHtml = '<i class="fa-solid fa-square-parking"></i>'; className = 'icon-parking'; }

            const icon = L.divIcon({
                className: 'custom-div-icon', 
                html: `<div class="custom-map-icon ${className}">${iconHtml}</div>`,
                iconSize: [30, 30], iconAnchor: [15, 15]
            });

            const marker = L.marker([el.lat, el.lon], {icon: icon});
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

    // --- TOTEM LOGIK ---
    openTotem: function(el) {
        const overlay = document.getElementById('gas-totem-overlay');
        const brandHeader = document.getElementById('totem-brand-header');
        const brandTitle = document.getElementById('totem-brand');
        
        const name = (el.tags && el.tags.name) ? el.tags.name : "Tankstelle";
        
        brandHeader.className = 'totem-header ' + this.getBrandClass(name);
        brandTitle.innerText = name;
        
        document.getElementById('price-diesel').innerText = el.simPrices.diesel;
        document.getElementById('price-e10').innerText = el.simPrices.e10;
        document.getElementById('price-e5').innerText = el.simPrices.e5;

        this.updateTotemSelectionUI();
        overlay.classList.remove('hidden');
    },

    selectFuel: function(type) {
        currentFuelType = type;
        this.updateTotemSelectionUI();
        this.redrawGasMarkers(); // Sofortiges Update der Map!
    },

    updateTotemSelectionUI: function() {
        document.querySelectorAll('.price-row').forEach(r => r.classList.remove('selected'));
        document.getElementById('row-' + currentFuelType).classList.add('selected');
    },

    closeTotem: function() {
        document.getElementById('gas-totem-overlay').classList.add('hidden');
    }
};
