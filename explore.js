// Globale Variablen für den Explore-Modus
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

        // Sicherheitscheck: Ist Leaflet (L) geladen?
        if (typeof L === 'undefined') {
            console.error("Leaflet nicht gefunden!");
            return;
        }

        // Layer Gruppen initialisieren
        exploreLayers.gas = L.layerGroup();
        exploreLayers.cam = L.layerGroup();
        exploreLayers.parking = L.layerGroup();

        // Button Listener setzen (mit Sicherheitsabfrage)
        this.setupButton('filter-gas', 'gas');
        this.setupButton('filter-cam', 'cam');
        this.setupButton('filter-parking', 'parking');

        // Recenter Button
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
        } else {
            console.warn(`Button ${id} nicht gefunden.`);
        }
    },

    enter: function() {
        console.log("Entering Explore Mode");
        if(map) {
            // 1. Map interaktiv machen (WICHTIG!)
            map.dragging.enable();
            map.touchZoom.enable();
            map.scrollWheelZoom.enable();
            
            // 2. Rotation entfernen (Norden oben)
            const mapEl = document.getElementById('background-map');
            if(mapEl) mapEl.style.transform = `rotate(0deg)`;

            // 3. Layer zur Map hinzufügen
            if(exploreLayers.gas) exploreLayers.gas.addTo(map);
            if(exploreLayers.cam) exploreLayers.cam.addTo(map);
            if(exploreLayers.parking) exploreLayers.parking.addTo(map);

            // 4. Listener für Bewegung
            map.on('moveend', this.onMapMove);
            
            // Einmalig Daten laden beim Betreten, falls Filter an sind
            this.onMapMove(); 
        }
    },

    leave: function() {
        console.log("Leaving Explore Mode");
        if(map) {
            // 1. Map wieder sperren
            map.dragging.disable();
            map.touchZoom.disable();
            map.scrollWheelZoom.disable();

            // 2. Layer aufräumen
            if(exploreLayers.gas) exploreLayers.gas.remove();
            if(exploreLayers.cam) exploreLayers.cam.remove();
            if(exploreLayers.parking) exploreLayers.parking.remove();
            
            // 3. Listener entfernen
            map.off('moveend', this.onMapMove);
            
            // 4. Zurück zum User gleiten
            if(typeof userMarker !== 'undefined' && userMarker) {
                map.panTo(userMarker.getLatLng(), { animate: true, duration: 1.0 });
            }
        }
    },

    toggleLayer: function(type, isActive) {
        if (isActive) {
            this.fetchData(type);
        } else {
            if(exploreLayers[type]) exploreLayers[type].clearLayers();
        }
    },

    onMapMove: function() {
        // "this" ist hier oft das Map-Objekt, deshalb nutzen wir explizit ExploreLogic
        if (exploreState.gas) ExploreLogic.fetchData('gas');
        if (exploreState.cam) ExploreLogic.fetchData('cam');
        if (exploreState.parking) ExploreLogic.fetchData('parking');
    },

    fetchData: function(type) {
        if (!map) return;

        const center = map.getCenter();
        // Zoom-basierter Radius
        let radius = 3000; 
        if (map.getZoom() < 12) radius = 10000; 
        if (map.getZoom() > 15) radius = 1500;

        let query = "";
        
        // Overpass QL Queries
        if (type === 'gas') {
            query = `[out:json];node["amenity"="fuel"](around:${radius},${center.lat},${center.lng});out;`;
        } 
        else if (type === 'cam') {
            query = `[out:json];node["highway"="speed_camera"](around:${radius},${center.lat},${center.lng});out;`;
        } 
        else if (type === 'parking') {
            query = `[out:json];node["amenity"="parking"](around:${radius},${center.lat},${center.lng});out;`;
        }

        const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

        fetch(url)
            .then(r => r.json())
            .then(data => {
                if(exploreLayers[type]) exploreLayers[type].clearLayers();

                if (!data.elements) return;

                data.elements.forEach(el => {
                    let iconHtml = '';
                    let className = '';

                    if (type === 'gas') {
                        iconHtml = '<i class="fa-solid fa-gas-pump"></i>';
                        className = 'icon-gas';
                    } else if (type === 'cam') {
                        iconHtml = '<i class="fa-solid fa-camera"></i>';
                        className = 'icon-cam';
                    } else if (type === 'parking') {
                        iconHtml = '<i class="fa-solid fa-square-parking"></i>';
                        className = 'icon-parking';
                    }

                    const icon = L.divIcon({
                        className: 'custom-div-icon', 
                        html: `<div class="custom-map-icon ${className}">${iconHtml}</div>`,
                        iconSize: [30, 30],
                        iconAnchor: [15, 15]
                    });

                    const marker = L.marker([el.lat, el.lon], {icon: icon});
                    
                    if (el.tags && el.tags.name) {
                        marker.bindPopup(`<b>${el.tags.name}</b>`);
                    }
                    
                    if(exploreLayers[type]) exploreLayers[type].addLayer(marker);
                });
            })
            .catch(err => {
                console.log("API Error (Explore):", err);
            });
    }
};
