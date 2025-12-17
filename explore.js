let exploreLayers = {
    gas: null,
    cam: null,
    parking: null
};

let exploreState = {
    gas: false,
    cam: false,
    parking: false
};

const ExploreLogic = {
    init: function() {
        console.log("Explore Module: Initializing...");

        if (typeof L === 'undefined') { console.error("Leaflet Missing"); return; }

        exploreLayers.gas = L.layerGroup();
        exploreLayers.cam = L.layerGroup();
        exploreLayers.parking = L.layerGroup();

        this.setupButton('filter-gas', 'gas');
        this.setupButton('filter-cam', 'cam');
        this.setupButton('filter-parking', 'parking');

        const btnRecenter = document.getElementById('btn-explore-recenter');
        if(btnRecenter) {
            btnRecenter.onclick = () => {
                if(map && userMarker) {
                    map.panTo(userMarker.getLatLng(), { animate: true, duration: 1.0 });
                }
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
        if (exploreState.gas) ExploreLogic.fetchData('gas');
        if (exploreState.cam) ExploreLogic.fetchData('cam');
        if (exploreState.parking) ExploreLogic.fetchData('parking');
    },

    fetchData: function(type) {
        if (!map) return;
        const center = map.getCenter();
        let radius = 3000; 
        if (map.getZoom() < 12) radius = 10000; 
        if (map.getZoom() > 15) radius = 1500;

        let query = "";
        if (type === 'gas') query = `[out:json];node["amenity"="fuel"](around:${radius},${center.lat},${center.lng});out;`;
        else if (type === 'cam') query = `[out:json];node["highway"="speed_camera"](around:${radius},${center.lat},${center.lng});out;`;
        else if (type === 'parking') query = `[out:json];node["amenity"="parking"](around:${radius},${center.lat},${center.lng});out;`;

        const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

        fetch(url)
            .then(r => r.json())
            .then(data => {
                if(exploreLayers[type]) exploreLayers[type].clearLayers();
                if (!data.elements) return;

                data.elements.forEach(el => {
                    let iconHtml = '';
                    let className = '';

                    if (type === 'gas') { iconHtml = '<i class="fa-solid fa-gas-pump"></i>'; className = 'icon-gas'; }
                    else if (type === 'cam') { iconHtml = '<i class="fa-solid fa-camera"></i>'; className = 'icon-cam'; }
                    else if (type === 'parking') { iconHtml = '<i class="fa-solid fa-square-parking"></i>'; className = 'icon-parking'; }

                    const icon = L.divIcon({
                        className: 'custom-div-icon', 
                        html: `<div class="custom-map-icon ${className}">${iconHtml}</div>`,
                        iconSize: [30, 30],
                        iconAnchor: [15, 15]
                    });

                    const marker = L.marker([el.lat, el.lon], {icon: icon});
                    
                    // --- CLICK HANDLER FÜR TOTEM (NUR BEI GAS) ---
                    if (type === 'gas') {
                        marker.on('click', () => {
                            const name = (el.tags && el.tags.name) ? el.tags.name : "Tankstelle";
                            ExploreLogic.openTotem(name);
                        });
                    } else if (el.tags && el.tags.name) {
                        marker.bindPopup(`<b>${el.tags.name}</b>`);
                    }
                    
                    if(exploreLayers[type]) exploreLayers[type].addLayer(marker);
                });
            })
            .catch(err => console.log("API Error:", err));
    },

    // --- TOTEM LOGIK ---
    openTotem: function(name) {
        const overlay = document.getElementById('gas-totem-overlay');
        const brandHeader = document.getElementById('totem-brand-header');
        const brandTitle = document.getElementById('totem-brand');
        
        // Reset classes
        brandHeader.className = 'totem-header';
        
        // Marke erkennen & Styling setzen
        const n = name.toLowerCase();
        if(n.includes('aral')) brandHeader.classList.add('aral');
        else if(n.includes('shell')) brandHeader.classList.add('shell');
        else if(n.includes('esso')) brandHeader.classList.add('esso');
        else if(n.includes('total')) brandHeader.classList.add('total');
        else if(n.includes('jet')) brandHeader.classList.add('jet');
        
        brandTitle.innerText = name;

        // Preise simulieren (Basispreis + Zufallsschwankung)
        const baseE10 = 1.70 + (Math.random() * 0.10 - 0.05);
        const baseDiesel = 1.60 + (Math.random() * 0.10 - 0.05);
        const baseE5 = baseE10 + 0.06;

        document.getElementById('price-diesel').innerText = baseDiesel.toFixed(2);
        document.getElementById('price-e10').innerText = baseE10.toFixed(2);
        document.getElementById('price-e5').innerText = baseE5.toFixed(2);

        overlay.classList.remove('hidden');
    },

    closeTotem: function() {
        document.getElementById('gas-totem-overlay').classList.add('hidden');
    }
};
