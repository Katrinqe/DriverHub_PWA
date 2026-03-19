document.addEventListener('DOMContentLoaded', () => {
    const btnNewExplore = document.getElementById('nav-new-explore');
    const newExploreScreen = document.getElementById('new-explore-screen');
    const allNavItems = document.querySelectorAll('.nav-item');
    const mapContainerId = 'maplibre-snippet';
    

// Globale MapLibre Instanz
    let libreMap = null;
    let currentCoords = null; // NEU: Merkt sich deinen Standort
    if (btnNewExplore && newExploreScreen) {
        
        // FIX: Globaler Listener für die Nav-Bar (Farben weg)
        allNavItems.forEach(nav => {
            nav.addEventListener('click', () => {
                btnNewExplore.style.color = '';
                btnNewExplore.style.textShadow = '';
            });
        });

        // Klick auf den neuen Explore-Button
        btnNewExplore.addEventListener('click', () => {
            // 1. Alle Screens ausblenden
            document.querySelectorAll('.screen').forEach(screen => {
                screen.classList.remove('active');
                screen.classList.add('hidden');
            });

            // 2. Allen anderen Buttons das Leuchten wegnehmen
            allNavItems.forEach(nav => {
                nav.classList.remove('active-home', 'active-garage', 'active-map', 'active-perf');
            });

            // 3. Unseren neuen Screen anzeigen
            newExploreScreen.classList.remove('hidden');
            newExploreScreen.classList.add('active');

            // 4. Unseren Button zum Leuchten bringen
            btnNewExplore.style.color = '#30d158';
            btnNewExplore.style.textShadow = '0 0 15px rgba(48, 209, 88, 0.6)';

            // 5. MAPLIBRE INITIALISIERUNG STARTEN
            initMapLibreSnippet();
        });
    }

    // ==========================================
    // === MAPLIBRE SNIPPET LOGIC (CORE V1) ===
    // ==========================================

    function initMapLibreSnippet() {
        // Sicherstellen, dass MapLibre geladen ist
        if (typeof maplibregl === 'undefined') {
            console.error("MapLibre GL JS ist nicht geladen!");
            return;
        }

        const mapContainer = document.getElementById(mapContainerId);
        if (!mapContainer) return;

        // Falls die Karte schon existiert, springen wir nur kurz hin
        if (libreMap) {
            libreMap.resize(); // WICHTIG: MapLibre neu berechnen, wenn Screen wechselt
            // Für diesen Task (nur anzeigen) machen wir hier nichts weiter
            return;
        }

        console.log("Initialisiere MapLibre Snippet...");

        // 1. Standorterkennung
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userCoords = [position.coords.longitude, position.coords.latitude];
                console.log("Standort erkannt:", userCoords);
                loadMap(userCoords, true); // Erfolgreich mit Standort
            },
            (error) => {
                console.warn("Standorterkennung fehlgeschlagen, nutze Default (Nürnberg):", error);
                const defaultCoords = [11.0767, 49.4521]; // Nürnberg Altstadt
                loadMap(defaultCoords, false); // Geladen mit Default-Position
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 } // Hohe Präzision anfordern
        );
    }

function loadMap(coords, hasLocation) {
    // 1. Standort global speichern (WICHTIG für den Rückflug!)
    currentCoords = coords; 

    // 2. Map initialisieren
    libreMap = new maplibregl.Map({
        container: mapContainerId,
        style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: coords,
        zoom: 14,
        interactive: true, 
        attributionControl: false 
    });

    // WICHTIG: Alles was auf die Karte kommt, muss in diesen Block:
    libreMap.on('load', () => {
        // Interaktionen sofort sperren (für den Card-Look)
        libreMap.dragPan.disable();
        libreMap.scrollZoom.disable();
        libreMap.touchZoomRotate.disable();
        libreMap.doubleClickZoom.disable();
        libreMap.dragRotate.disable();
        libreMap.dragPitch.disable();
        libreMap.touchPitch.disable();

        // Padding setzen
        libreMap.setPadding({ right: 150, bottom: 20 });

        // --- 3D GEBÄUDE ---
        const layers = libreMap.getStyle().layers;
        let labelLayerId;
        for (let i = 0; i < layers.length; i++) {
            if (layers[i].type === 'symbol') {
                labelLayerId = layers[i].id;
                break;
            }
        }

        // FIX: 'openmaptiles' ist der Standard-Name für Carto-Vektordaten
        libreMap.addLayer({
            'id': '3d-buildings',
            'source': 'openmaptiles', 
            'source-layer': 'building',
            'type': 'fill-extrusion',
            'minzoom': 13,
            'paint': {
                'fill-extrusion-color': '#1f1f24',
                'fill-extrusion-height': ['get', 'render_height'],
                'fill-extrusion-base': ['get', 'render_min_height'],
                'fill-extrusion-opacity': 0 
            }
        }, labelLayerId);

        // Der Neigungs-Sensor
        libreMap.on('pitch', () => {
            const pitch = libreMap.getPitch();
            const opacity = pitch > 10 ? Math.min((pitch - 10) / 35, 0.8) : 0;
            if (libreMap.getLayer('3d-buildings')) {
                libreMap.setPaintProperty('3d-buildings', 'fill-extrusion-opacity', opacity);
            }
        });

        // --- BLAUER PUNKT (Jetzt sicher im load-event) ---
        if (hasLocation) {
            const customMarkerElement = document.createElement('div');
            customMarkerElement.className = 'user-marker-wrap';
            customMarkerElement.innerHTML = `
                <div class="user-pulse"></div>
                <div class="user-dot"></div>
            `;
            new maplibregl.Marker({ element: customMarkerElement })
                .setLngLat(coords)
                .addTo(libreMap);
        }
    });

    setTimeout(() => { if (libreMap) libreMap.resize(); }, 100);
}
    // ==========================================
    // === MAP EXPAND / SHRINK LOGIC ===
    // ==========================================
    const expandTrigger = document.getElementById('map-expand-trigger');
    const shrinkBtn = document.getElementById('btn-shrink-map');
    const mapCard = document.querySelector('.map-snippet-card');

    if (expandTrigger && shrinkBtn && mapCard) {
        
// Karte groß machen
        expandTrigger.addEventListener('click', () => {
            mapCard.classList.add('map-expanded');
            expandTrigger.style.display = 'none'; // Klickscheibe wegnehmen

            // Nav-Bar ausblenden (mit Sicherheitsabfrage)
            const bottomNav = document.querySelector('.bottom-nav');
            if (bottomNav) bottomNav.style.display = 'none';

            if (libreMap) {
                // Interaktion freischalten
                libreMap.dragPan.enable();
                libreMap.scrollZoom.enable();
                libreMap.touchZoomRotate.enable();
                libreMap.doubleClickZoom.enable();
                
                // FIX: dragRotate MUSS aktiv sein, damit Pitch funktioniert!
                libreMap.dragRotate.enable(); 
                libreMap.dragPitch.enable();  // Für Rechtsklick auf dem Desktop
                libreMap.touchPitch.enable(); // Für Zwei-Finger-Wisch auf dem Handy

                // Optischen Mittelpunkt zentrieren (Padding entfernen)
                libreMap.setPadding({ right: 0, bottom: 0 });

                // Map zwingen, sich an den neuen Fullscreen anzupassen
                setTimeout(() => libreMap.resize(), 400); // 400ms entspricht der CSS Animation
            }
        });



shrinkBtn.addEventListener('click', (e) => {
    e.stopPropagation(); 
    
    mapCard.classList.remove('map-expanded');
    expandTrigger.style.display = 'block';

    const bottomNav = document.querySelector('.bottom-nav');
    if (bottomNav) bottomNav.style.display = 'flex';

    const bottomSheet = document.getElementById('map-bottom-sheet');
    if (bottomSheet) bottomSheet.classList.remove('expanded');

    if (!libreMap) return;
    
    // Interaktionen sofort sperren
    libreMap.dragPan.disable();
    libreMap.scrollZoom.disable();
    libreMap.touchZoomRotate.disable();
    libreMap.dragRotate.disable();
    libreMap.dragPitch.disable();
    libreMap.touchPitch.disable();

    // RÜCKFLUG STARTEN
    if (currentCoords) {
        libreMap.easeTo({
            center: currentCoords,
            zoom: 14,
            bearing: 0,
            pitch: 0,
            padding: { right: 150, bottom: 20 },
            duration: 400,
            easing: (t) => t * (2 - t)
        });
    }

    // Einmaliges Resize nach der Animation
    setTimeout(() => { if (libreMap) libreMap.resize(); }, 450);
});
    }
// ==========================================
    // === TOMTOM SEARCH & ROUTING LOGIC ===
    // ==========================================
    const TOMTOM_API_KEY = 'qUXu7VMUc8RMDm7pkiItGa6WUsqWfFUM'; // <-- HIER DEINEN ECHTEN KEY REIN
    
    const searchInput = document.getElementById('tomtom-search-input');
    const suggestionsBox = document.getElementById('tomtom-suggestions');

    if (searchInput && suggestionsBox) {
        
        let debounceTimer;

        // 1. Autocomplete mit Anti-Spam (Debounce) und Fehler-Feedback
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer); // Stoppt den vorherigen Timer beim Weitertippen
            const query = e.target.value.trim();
            
            if (query.length < 3) {
                suggestionsBox.classList.add('hidden');
                suggestionsBox.innerHTML = '';
                return;
            }

            // Visuelles Feedback, dass im Hintergrund gearbeitet wird
            suggestionsBox.innerHTML = '<div class="suggestion-item" style="color: rgba(255,255,255,0.5);">Suche läuft...</div>';
            suggestionsBox.classList.remove('hidden');

            // Wir warten 400ms nach dem letzten Tastendruck, um TomTom nicht zu überlasten
            debounceTimer = setTimeout(async () => {
                try {
                    const response = await fetch(`https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json?key=${TOMTOM_API_KEY}&language=de-DE&limit=5`);
                    
                    // NEU: Wenn TomTom den API-Key ablehnt, zeigen wir es dir sofort an!
                    if (!response.ok) {
                        suggestionsBox.innerHTML = `<div class="suggestion-item" style="color: #ff453a;">API Fehler: Key ungültig oder nicht aktiv (${response.status})</div>`;
                        return;
                    }

                    const data = await response.json();
                    suggestionsBox.innerHTML = '';
                    
                    if (data.results && data.results.length > 0) {
                        data.results.forEach(result => {
                            const div = document.createElement('div');
                            div.className = 'suggestion-item';
                            // Baut die Adresse sauber zusammen
                            div.textContent = result.address.freeformAddress || result.address.municipality || "Unbekannter Ort"; 
                            
                            // 2. Klick auf einen Vorschlag: Route berechnen
                            div.addEventListener('click', () => {
                                searchInput.value = div.textContent;
                                suggestionsBox.classList.add('hidden');
                                drawTomTomRoute(result.position.lat, result.position.lon);
                            });

                            suggestionsBox.appendChild(div);
                        });
                    } else {
                        suggestionsBox.innerHTML = '<div class="suggestion-item" style="color: rgba(255,255,255,0.5);">Kein Ort gefunden</div>';
                    }
                } catch (err) {
                    suggestionsBox.innerHTML = '<div class="suggestion-item" style="color: #ff453a;">Netzwerkfehler. Internetverbindung prüfen.</div>';
                }
            }, 400); 
        });

        // Dropdown schließen, wenn man ins Leere klickt
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
                suggestionsBox.classList.add('hidden');
            }
        });
    }

    // 3. Die Route holen und auf die Karte zeichnen
    async function drawTomTomRoute(destLat, destLng) {
        if (!currentCoords || !libreMap) return;

        const startLng = currentCoords[0];
        const startLat = currentCoords[1];

        try {
            // TomTom Routing API: Startpunkt zu Zielpunkt
            const response = await fetch(`https://api.tomtom.com/routing/1/calculateRoute/${startLat},${startLng}:${destLat},${destLng}/json?key=${TOMTOM_API_KEY}`);
            const data = await response.json();

            if (data.routes && data.routes.length > 0) {
                // TomTom gibt uns ein Array aus {latitude, longitude}. MapLibre braucht [lng, lat].
                const routePoints = data.routes[0].legs[0].points.map(p => [p.longitude, p.latitude]);

                const geojson = {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'LineString',
                        coordinates: routePoints
                    }
                };

                // Bestehende Route updaten oder neu zeichnen
                if (libreMap.getSource('tomtom-route')) {
                    libreMap.getSource('tomtom-route').setData(geojson);
                } else {
                    libreMap.addSource('tomtom-route', {
                        type: 'geojson',
                        data: geojson
                    });

                    libreMap.addLayer({
                        id: 'tomtom-route-line',
                        type: 'line',
                        source: 'tomtom-route',
                        layout: {
                            'line-join': 'round',
                            'line-cap': 'round'
                        },
                        paint: {
                            'line-color': '#007aff', 
                            'line-width': 6,         
                            'line-opacity': 0.8      
                        }
                    });
                }

                // Kamera elegant so verschieben, dass die ganze Route sichtbar wird
                const bounds = routePoints.reduce((bounds, coord) => {
                    return bounds.extend(coord);
                }, new maplibregl.LngLatBounds(routePoints[0], routePoints[0]));

                libreMap.fitBounds(bounds, {
                    padding: { top: 150, bottom: 100, left: 50, right: 50 },
                    duration: 1000 
                });
            }
        } catch (error) {
            console.error("TomTom Routing Fehler:", error);
        }
    }
    // ==========================================
    // === BOTTOM SHEET TOUCH & FOCUS LOGIC ===
    // ==========================================
    const bottomSheet = document.getElementById('map-bottom-sheet');
    const tomtomInput = document.getElementById('tomtom-search-input');

    if (bottomSheet && tomtomInput) {
        
        // 1. Wenn du in die Searchbar klickst -> Sheet sofort ausfahren UND Browser-Scroll killen
        tomtomInput.addEventListener('focus', () => {
            bottomSheet.classList.add('expanded');

            // FIX: Safari/Chrome daran hindern, den ganzen Screen nach oben zu schieben!
            // Wir ziehen den Bildschirm in den ersten Millisekunden gnadenlos auf 0 zurück.
            const preventScroll = () => {
                window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                document.body.scrollTop = 0;
            };

            // Mehrere Timeouts, weil die Tastatur-Animation auf verschiedenen Handys unterschiedlich lange dauert
            setTimeout(preventScroll, 10);
            setTimeout(preventScroll, 150);
            setTimeout(preventScroll, 300);
        });

        // 2. Wisch-Logik (Swipe Up / Swipe Down)
        let startY = 0;

        bottomSheet.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
        }, { passive: true });

        bottomSheet.addEventListener('touchend', (e) => {
            let endY = e.changedTouches[0].clientY;
            let diff = startY - endY;

            // Wisch nach oben (mehr als 30px) -> Ausfahren
            if (diff > 30) {
                bottomSheet.classList.add('expanded');
            } 
            // Wisch nach unten (mehr als 30px) -> Einklappen
            else if (diff < -30) {
                bottomSheet.classList.remove('expanded');
                tomtomInput.blur(); // Tastatur einklappen, wenn offen!
            }
        });
    }
});

