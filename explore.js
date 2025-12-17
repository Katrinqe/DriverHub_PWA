// Layer Gruppen für die Icons (damit wir sie einzeln an/abschalten können)
let layers = {
    gas: null,
    cam: null,
    parking: null
};

// Status merken
let activeFilters = {
    gas: false,
    cam: false,
    parking: false
};

const ExploreLogic = {
    init: function() {
        console.log("Explore Module Loaded");
        
        // Layer Gruppen initialisieren
        layers.gas = L.layerGroup();
        layers.cam = L.layerGroup();
        layers.parking = L.layerGroup();

        // 1. Gas Button
        document.getElementById('filter-gas').onclick = function() {
            this.classList.toggle('active');
            activeFilters.gas = !activeFilters.gas;
            ExploreLogic.toggleLayer('gas', activeFilters.gas);
        };

        // 2. Cam Button
        document.getElementById('filter-cam').onclick = function() {
            this.classList.toggle('active');
            activeFilters.cam = !activeFilters.cam;
            ExploreLogic.toggleLayer('cam', activeFilters.cam);
        };

        // 3. Parking Button
        document.getElementById('filter-parking').onclick = function() {
            this.classList.toggle('active');
            activeFilters.parking = !activeFilters.parking;
            ExploreLogic.toggleLayer('parking', activeFilters.parking);
        };

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

    enter: function() {
        console.log("Entering Explore Mode");
        if(map) {
            map.dragging.enable();
            map.touchZoom.enable();
            map.scrollWheelZoom.enable();
            
            // Map Rotation resetten
            const mapEl = document.getElementById('background-map');
            if(mapEl) mapEl.style.transform = `rotate(0deg)`;

            // Layer zur Map hinzufügen (sind erst mal leer)
            layers.gas.addTo(map);
            layers.cam.addTo(map);
            layers.parking.addTo(map);

            // Listener: Wenn Map bewegt wird -> Daten nachladen
            map.on('moveend', ExploreLogic.onMapMove);
        }
    },

    leave: function() {
        console.log("Leaving Explore Mode");
        if(map) {
            map.dragging.disable();
            map.touchZoom.disable();
            map.scrollWheelZoom.disable();

            // Layer entfernen (Clean up)
            layers.gas.remove();
            layers.cam.remove();
            layers.parking.remove();
            
            // Listener entfernen (Wichtig für Performance!)
            map.off('moveend', ExploreLogic.onMapMove);
            
            if(typeof userMarker !== 'undefined' && userMarker) {
                map.panTo(userMarker.getLatLng(), { animate: true, duration: 1.0 });
            }
        }
    },

    // Wenn Filter an/aus geschaltet wird
    toggleLayer: function(type, isActive) {
        if (isActive) {
            // Sofort laden
            this.fetchData(type);
        } else {
            // Layer leeren
            layers[type].clearLayers();
        }
    },

    // Automatisch nachladen beim Bewegen
    onMapMove: function() {
        // Wir checken alle aktiven Filter und laden nach
        if (activeFilters.gas) ExploreLogic.fetchData('gas');
        if (activeFilters.cam) ExploreLogic.fetchData('cam');
        if (activeFilters.parking) ExploreLogic.fetchData('parking');
    },

    // Die echte API Abfrage
    fetchData: function(type) {
        if (!map) return;

        const center = map.getCenter();
        const lat = center.lat;
        const lng = center.lng;
        
        // Radius basierend auf Zoom Level (damit wir nicht ganz Deutschland laden wenn wir rauszoomen)
        // Zoom 14 = ca 2km Radius. Zoom 10 = ca 20km.
        let radius = 3000; // Standard 3km
        if (map.getZoom() < 12) radius = 10000; 
        if (map.getZoom() > 15) radius = 1500;

        // Overpass Queries bauen
        let query = "";
        
        if (type === 'gas') {
            // Suche Tankstellen
            query = `[out:json];node["amenity"="fuel"](around:${radius},${lat},${lng});out;`;
        } 
        else if (type === 'cam') {
            // Suche Blitzer (nodes mit highway=speed_camera)
            query = `[out:json];node["highway"="speed_camera"](around:${radius},${lat},${lng});out;`;
        } 
        else if (type === 'parking') {
            // Suche Parkplätze (nur Nodes, keine Flächen, um Performance zu sparen)
            query = `[out:json];node["amenity"="parking"](around:${radius},${lat},${lng});out;`;
        }

        const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

        // Fetch
        fetch(url)
            .then(r => r.json())
            .then(data => {
                // Alten Layer leeren bevor wir neue hinzufügen (vermeidet Dopplungen)
                layers[type].clearLayers();

                if (!data.elements) return;

                data.elements.forEach(el => {
                    const lat = el.lat;
                    const lon = el.lon;
                    
                    // Icon auswählen
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

                    // Leaflet Marker erstellen
                    const icon = L.divIcon({
                        className: 'custom-div-icon', // Dummy Klasse, wir stylen das innere Div
                        html: `<div class="custom-map-icon ${className}">${iconHtml}</div>`,
                        iconSize: [30, 30],
                        iconAnchor: [15, 15]
                    });

                    const marker = L.marker([lat, lon], {icon: icon});
                    
                    // Optional: Popup mit Namen (z.B. "Shell")
                    if (el.tags && el.tags.name) {
                        marker.bindPopup(`<b>${el.tags.name}</b>`);
                    } else if (type === 'cam') {
                         marker.bindPopup(`<b>Blitzer</b><br>${el.tags.maxspeed ? el.tags.maxspeed + ' km/h' : ''}`);
                    }

                    // Zum Layer hinzufügen
                    layers[type].addLayer(marker);
                });
            })
            .catch(err => {
                console.warn("Overpass API Error:", err);
            });
    }
};// Layer Gruppen für die Icons (damit wir sie einzeln an/abschalten können)
let layers = {
    gas: null,
    cam: null,
    parking: null
};

// Status merken
let activeFilters = {
    gas: false,
    cam: false,
    parking: false
};

const ExploreLogic = {
    init: function() {
        console.log("Explore Module Loaded");
        
        // Layer Gruppen initialisieren
        layers.gas = L.layerGroup();
        layers.cam = L.layerGroup();
        layers.parking = L.layerGroup();

        // 1. Gas Button
        document.getElementById('filter-gas').onclick = function() {
            this.classList.toggle('active');
            activeFilters.gas = !activeFilters.gas;
            ExploreLogic.toggleLayer('gas', activeFilters.gas);
        };

        // 2. Cam Button
        document.getElementById('filter-cam').onclick = function() {
            this.classList.toggle('active');
            activeFilters.cam = !activeFilters.cam;
            ExploreLogic.toggleLayer('cam', activeFilters.cam);
        };

        // 3. Parking Button
        document.getElementById('filter-parking').onclick = function() {
            this.classList.toggle('active');
            activeFilters.parking = !activeFilters.parking;
            ExploreLogic.toggleLayer('parking', activeFilters.parking);
        };

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

    enter: function() {
        console.log("Entering Explore Mode");
        if(map) {
            map.dragging.enable();
            map.touchZoom.enable();
            map.scrollWheelZoom.enable();
            
            // Map Rotation resetten
            const mapEl = document.getElementById('background-map');
            if(mapEl) mapEl.style.transform = `rotate(0deg)`;

            // Layer zur Map hinzufügen (sind erst mal leer)
            layers.gas.addTo(map);
            layers.cam.addTo(map);
            layers.parking.addTo(map);

            // Listener: Wenn Map bewegt wird -> Daten nachladen
            map.on('moveend', ExploreLogic.onMapMove);
        }
    },

    leave: function() {
        console.log("Leaving Explore Mode");
        if(map) {
            map.dragging.disable();
            map.touchZoom.disable();
            map.scrollWheelZoom.disable();

            // Layer entfernen (Clean up)
            layers.gas.remove();
            layers.cam.remove();
            layers.parking.remove();
            
            // Listener entfernen (Wichtig für Performance!)
            map.off('moveend', ExploreLogic.onMapMove);
            
            if(typeof userMarker !== 'undefined' && userMarker) {
                map.panTo(userMarker.getLatLng(), { animate: true, duration: 1.0 });
            }
        }
    },

    // Wenn Filter an/aus geschaltet wird
    toggleLayer: function(type, isActive) {
        if (isActive) {
            // Sofort laden
            this.fetchData(type);
        } else {
            // Layer leeren
            layers[type].clearLayers();
        }
    },

    // Automatisch nachladen beim Bewegen
    onMapMove: function() {
        // Wir checken alle aktiven Filter und laden nach
        if (activeFilters.gas) ExploreLogic.fetchData('gas');
        if (activeFilters.cam) ExploreLogic.fetchData('cam');
        if (activeFilters.parking) ExploreLogic.fetchData('parking');
    },

    // Die echte API Abfrage
    fetchData: function(type) {
        if (!map) return;

        const center = map.getCenter();
        const lat = center.lat;
        const lng = center.lng;
        
        // Radius basierend auf Zoom Level (damit wir nicht ganz Deutschland laden wenn wir rauszoomen)
        // Zoom 14 = ca 2km Radius. Zoom 10 = ca 20km.
        let radius = 3000; // Standard 3km
        if (map.getZoom() < 12) radius = 10000; 
        if (map.getZoom() > 15) radius = 1500;

        // Overpass Queries bauen
        let query = "";
        
        if (type === 'gas') {
            // Suche Tankstellen
            query = `[out:json];node["amenity"="fuel"](around:${radius},${lat},${lng});out;`;
        } 
        else if (type === 'cam') {
            // Suche Blitzer (nodes mit highway=speed_camera)
            query = `[out:json];node["highway"="speed_camera"](around:${radius},${lat},${lng});out;`;
        } 
        else if (type === 'parking') {
            // Suche Parkplätze (nur Nodes, keine Flächen, um Performance zu sparen)
            query = `[out:json];node["amenity"="parking"](around:${radius},${lat},${lng});out;`;
        }

        const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

        // Fetch
        fetch(url)
            .then(r => r.json())
            .then(data => {
                // Alten Layer leeren bevor wir neue hinzufügen (vermeidet Dopplungen)
                layers[type].clearLayers();

                if (!data.elements) return;

                data.elements.forEach(el => {
                    const lat = el.lat;
                    const lon = el.lon;
                    
                    // Icon auswählen
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

                    // Leaflet Marker erstellen
                    const icon = L.divIcon({
                        className: 'custom-div-icon', // Dummy Klasse, wir stylen das innere Div
                        html: `<div class="custom-map-icon ${className}">${iconHtml}</div>`,
                        iconSize: [30, 30],
                        iconAnchor: [15, 15]
                    });

                    const marker = L.marker([lat, lon], {icon: icon});
                    
                    // Optional: Popup mit Namen (z.B. "Shell")
                    if (el.tags && el.tags.name) {
                        marker.bindPopup(`<b>${el.tags.name}</b>`);
                    } else if (type === 'cam') {
                         marker.bindPopup(`<b>Blitzer</b><br>${el.tags.maxspeed ? el.tags.maxspeed + ' km/h' : ''}`);
                    }

                    // Zum Layer hinzufügen
                    layers[type].addLayer(marker);
                });
            })
            .catch(err => {
                console.warn("Overpass API Error:", err);
            });
    }
};
