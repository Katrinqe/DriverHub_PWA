// navi.js - Handle Navigation Logic

const NaviLogic = {
    routeLayer: null,
    currentDestination: null,
    searchTimeout: null,

    init: function() {
        console.log("Navi Init");
        const input = document.getElementById('nav-search-input');
        
        // Listener für Sucheingabe
        input.addEventListener('input', (e) => {
            const query = e.target.value;
            if (this.searchTimeout) clearTimeout(this.searchTimeout);
            
            if (query.length > 2) {
                this.searchTimeout = setTimeout(() => {
                    this.performSearch(query);
                }, 600); // Debounce
            } else {
                this.clearResults();
            }
        });
    },

    performSearch: function(query) {
        // Nominatim API für Ortssuche
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
        
        fetch(url)
            .then(r => r.json())
            .then(data => {
                this.renderResults(data);
            })
            .catch(e => console.error("Search Error", e));
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
            // Name kürzen
            let name = res.display_name.split(',')[0];
            let details = res.display_name.split(',').slice(1, 3).join(',');
            
            div.innerHTML = `<i class="fa-solid fa-location-dot"></i> <div><strong>${name}</strong><br><small>${details}</small></div>`;
            
            div.onclick = () => {
                this.selectDestination(res);
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

    selectDestination: function(place) {
        if (!userMarker) {
            alert("No GPS Position yet!");
            return;
        }

        // Koordinaten
        const startLat = userMarker.getLatLng().lat;
        const startLng = userMarker.getLatLng().lng;
        const endLat = place.lat;
        const endLng = place.lon;

        // --- CLEAN START ---
        // Alle Explore Layer ausblenden
        if (typeof ExploreLogic !== 'undefined') {
            ExploreLogic.toggleLayer('gas', false);
            ExploreLogic.toggleLayer('cam', false);
            ExploreLogic.toggleLayer('parking', false);
            // Buttons im UI resetten
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        }

        // --- ROUTE BERECHNEN (OSRM) ---
        // OSRM braucht lng,lat (nicht lat,lng)!
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;

        document.getElementById('map-loading').classList.add('visible');

        fetch(osrmUrl)
            .then(r => r.json())
            .then(data => {
                document.getElementById('map-loading').classList.remove('visible');
                
                if (data.routes && data.routes.length > 0) {
                    this.drawRoute(data.routes[0], place.display_name.split(',')[0]);
                } else {
                    alert("No route found.");
                }
            })
            .catch(e => {
                document.getElementById('map-loading').classList.remove('visible');
                console.error("Routing Error", e);
            });
    },

    drawRoute: function(route, destName) {
        // Alte Route löschen
        if (this.routeLayer) map.removeLayer(this.routeLayer);

        // GeoJSON Linie zeichnen
        const coordinates = route.geometry.coordinates.map(c => [c[1], c[0]]); // Swap zurück zu Lat/Lng für Leaflet
        
        this.routeLayer = L.polyline(coordinates, {
            color: '#007aff', // Nav Blue
            weight: 6,
            opacity: 0.8,
            lineCap: 'round'
        }).addTo(map);

        // Ziel Marker setzen
        // (Optional: Könnten wir später stylen)
        
        // AUTO ZOOM (Fit Bounds)
        map.fitBounds(this.routeLayer.getBounds(), {
            padding: [50, 50], // Platz am Rand lassen
            maxZoom: 16
        });

        // Route Info Card anzeigen
        const durationMin = Math.round(route.duration / 60);
        const distKm = (route.distance / 1000).toFixed(1);

        document.getElementById('route-time').innerText = durationMin + " min";
        document.getElementById('route-dist').innerText = distKm + " km";
        document.getElementById('route-dest').innerText = destName;
        
        document.getElementById('navi-route-card').classList.add('active');
    },

    cancelRoute: function() {
        if (this.routeLayer) {
            map.removeLayer(this.routeLayer);
            this.routeLayer = null;
        }
        document.getElementById('navi-route-card').classList.remove('active');
        document.getElementById('nav-search-input').value = "";
    },

    startNavigation: function(mode) {
        // Hier kommt später die Logik für Ghost Mode vs Record Mode
        // Vorerst nur Alert zum Testen
        console.log("Starting Navigation in mode:", mode);
        
        // Switch to Drive Screen (existierende Funktion in app.js)
        startDriveMode(); 
        
        // Info Card ausblenden
        document.getElementById('navi-route-card').classList.remove('active');
    }
};

// Auto-Init beim Laden
window.addEventListener('load', () => {
    NaviLogic.init();
});
