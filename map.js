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

        // Falls die Karte schon existiert, zentrieren wir sie neu! (Peters Fix)
        if (libreMap) {
            if (currentCoords) {
                // Wir springen sofort (ohne Animation) auf den Standort zurück, 
                // da die Karte im Hintergrund war.
                libreMap.jumpTo({
                    center: currentCoords,
                    zoom: 14,
                    padding: { right: 150, bottom: 20 }
                });
            }
            setTimeout(() => libreMap.resize(), 50); 
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
    // 1. Standort sichern
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

   // --- BLAUER PUNKT (Zwingend zeichnen, Original-Klassen nutzen!) ---
    const customMarkerElement = document.createElement('div');
    customMarkerElement.className = 'user-marker-wrap';
    customMarkerElement.innerHTML = `
        <div class="user-pulse"></div>
        <div class="user-dot"></div>
    `;
    new maplibregl.Marker({ element: customMarkerElement })
        .setLngLat(coords)
        .addTo(libreMap);

    // 4. Restliche Einstellungen laden
    libreMap.on('load', () => {
        libreMap.setPadding({ right: 150, bottom: 20 });

        // --- 3D-GEBÄUDE LOGIK ---
// 1. Wir suchen den ersten Symbol-Layer (Straßennamen), um die Gebäude darunter zu schieben
const layers = libreMap.getStyle().layers;
let labelLayerId;
for (let i = 0; i < layers.length; i++) {
    if (layers[i].type === 'symbol' && layers[i].layout['text-field']) {
        labelLayerId = layers[i].id;
        break;
    }
}

// 2. Den 3D-Extrusion Layer hinzufügen
libreMap.addLayer({
    'id': '3d-buildings',
    'source': 'carto',
    'source-layer': 'building',
    'type': 'fill-extrusion',
    'minzoom': 15,
    'paint': {
        // Farbe dezent an das Dark Design angepasst
        'fill-extrusion-color': '#2a2a2a',
        
        // Nutzt die echten Höhendaten aus den OpenStreetMap-Daten
        'fill-extrusion-height': [
            'interpolate', ['linear'], ['zoom'],
            15, 0,
            15.05, ['get', 'render_height']
        ],
        'fill-extrusion-base': [
            'interpolate', ['linear'], ['zoom'],
            15, 0,
            15.05, ['get', 'render_min_height']
        ],
        'fill-extrusion-opacity': 0.8
    }
}, labelLayerId);
// ------------------------

        libreMap.dragPan.disable();
        libreMap.scrollZoom.disable();
        libreMap.touchZoomRotate.disable();
        libreMap.doubleClickZoom.disable();
        libreMap.dragRotate.disable();
        libreMap.dragPitch.disable();
        libreMap.touchPitch.disable();
    });

    setTimeout(() => { if (libreMap) libreMap.resize(); }, 300);
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

            // --- HIER EINFÜGEN: UI-Elemente & Nav-Bar zurücksetzen ---
            const bottomNav = document.querySelector('.bottom-nav');
            if (bottomNav) bottomNav.style.display = 'flex';

            const bottomSheet = document.getElementById('map-bottom-sheet');
            if (bottomSheet) bottomSheet.classList.remove('expanded');

            const searchInput = document.getElementById('tomtom-search-input');
            if (searchInput) searchInput.blur();
            // ---------------------------------------------------------

            if (!libreMap) return;

            libreMap.dragPan.disable();

            libreMap.scrollZoom.disable();

            libreMap.touchZoomRotate.disable();

            libreMap.doubleClickZoom.disable();



            libreMap.setPadding({ right: 150, bottom: 10 });



            // 3. Kamerafahrt nach Hause starten (INKLUSIVE NORDEN & FLACH)

            if (currentCoords) {

                libreMap.flyTo({

                    center: currentCoords,

                    zoom: 14,

                    bearing: 0,  // FIX: Rotiert die Karte sauber nach Norden zurück

                    pitch: 0,    // FIX: Nimmt die 3D-Neigung raus (wieder flach von oben)

                    speed: 1.5,

                    essential: true

                });

            }



            // 4. Der 60-FPS-Trick für den sauberen Resize während der CSS-Animation

            let start = Date.now();

            let resizeInterval = setInterval(() => {

                libreMap.resize();

                

                if (Date.now() - start > 450) {

                    clearInterval(resizeInterval);

                    // Sicherstellen, dass die Karte im finalen Zustand 100% perfekt sitzt

                    if (currentCoords) {

                        libreMap.jumpTo({ 

                            center: currentCoords, 

                            zoom: 14, 

                            bearing: 0, // Hier ebenfalls absichern!

                            pitch: 0 

                        });

                    }

                }

            }, 16); 

        });
    }
// ==========================================
    // === TOMTOM SEARCH & ROUTING LOGIC ===
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

// ==========================================
    // === MULTI-ROUTING & TRAFFIC LOGIC ===
    // ==========================================
    let currentRouteIds = []; // Merkt sich die IDs der gerenderten Layer
    let currentRouteGeoJSONs = {}; // FIX: Sicherer Tresor für die GeoJSON-Daten

async function drawTomTomRoute(destLat, destLng) {
        if (!currentCoords || !libreMap) return;

        const startLng = currentCoords[0];
        const startLat = currentCoords[1];

        // UI-Wechsel: Normales Sheet weg, Route-Overview an
        const bottomSheet = document.getElementById('map-bottom-sheet');
        const searchInput = document.getElementById('tomtom-search-input');
        const routeOverviewUI = document.getElementById('route-overview-ui');
        const pillV = document.querySelector('.map-controls-pill-v'); 
        const mapCard = document.querySelector('.map-snippet-card'); 
        const expandTrigger = document.getElementById('map-expand-trigger'); 
        const bottomNav = document.querySelector('.bottom-nav');
        
        // 1. Karte zwingend auf Fullscreen setzen
        if (mapCard) mapCard.classList.add('map-expanded');
        if (expandTrigger) expandTrigger.style.display = 'none';
        if (bottomNav) bottomNav.style.display = 'none';

        // 2. UI Elemente umschalten
        if (bottomSheet) {
            bottomSheet.classList.remove('expanded');
            bottomSheet.style.display = 'none';
        }
        if (searchInput) searchInput.blur();
        if (routeOverviewUI) routeOverviewUI.classList.remove('hidden');
        if (pillV) pillV.style.display = 'none';

        // 3. ZWINGEND: Map-Interaktionen freischalten & PADDING NULLEN
        if (libreMap) {
            libreMap.dragPan.enable();
            libreMap.scrollZoom.enable();
            libreMap.touchZoomRotate.enable();
            libreMap.doubleClickZoom.enable();
            libreMap.dragRotate.enable();
            libreMap.dragPitch.enable();
            libreMap.touchPitch.enable();
            
            libreMap.setPadding({ right: 0, bottom: 0 });
        }

        // 4. Den 60-FPS-Trick anwenden, damit die Map-Engine beim Vergrößern mitrechnet
        let resizeInterval = setInterval(() => {
            if (libreMap) libreMap.resize();
        }, 16);

        try {
            // API-Call 
            const url = `https://api.tomtom.com/routing/1/calculateRoute/${startLat},${startLng}:${destLat},${destLng}/json?key=${TOMTOM_API_KEY}&maxAlternatives=2&computeTravelTimeFor=all&traffic=true&sectionType=traffic`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.routes && data.routes.length > 0) {
                clearRoutes(); 
                renderRouteCards(data.routes); 
                drawAllRoutesOnMap(data.routes); 
                
                // FIX 1: Bulletproof Methode um die Bounding-Box aufzubauen
                const bounds = new maplibregl.LngLatBounds();
                data.routes[0].legs[0].points.forEach(p => bounds.extend([p.longitude, p.latitude]));
                
                // 5. Wir warten EXAKT bis die 400ms CSS Animation der Karte fertig ist
                setTimeout(() => {
                    clearInterval(resizeInterval); // Resize-Loop stoppen
                    
                    if (libreMap && !bounds.isEmpty()) {
                        libreMap.resize(); // Ein letztes Sicherheits-Update
                        
                        // FIX 2: Dynamisches Padding berechnen
                        const mapHeight = libreMap.getContainer().clientHeight || window.innerHeight;
                        const safeBottom = Math.min(300, mapHeight * 0.4); // Maximal 40% der Höhe
                        const safeTop = Math.min(120, mapHeight * 0.15); // Maximal 15% der Höhe

                 libreMap.fitBounds(bounds, {
                    padding: 50,
                    duration: 1000,
                    pitch: 0 
                });
                    }
                    
                    // Die erste Route aktivieren
                    highlightRoute(0);
                }, 450);
            } else {
                clearInterval(resizeInterval);
            }
        } catch (error) {
            clearInterval(resizeInterval);
            console.error("TomTom Routing Fehler:", error);
        }
    }
    // --- RENDER LOGIK FÜR DIE MAP ---
    function drawAllRoutesOnMap(routes) {
        for (let i = routes.length - 1; i >= 0; i--) {
            const route = routes[i];
            const routePoints = route.legs[0].points.map(p => [p.longitude, p.latitude]);
            const sourceId = `tomtom-route-source-${i}`;
            const layerId = `tomtom-route-layer-${i}`;
            
            let features = [];

            // Basis-Linie
            features.push({
                type: 'Feature',
                properties: { trafficLevel: 0, isActive: false },
                geometry: { type: 'LineString', coordinates: routePoints }
            });

            // Stau-Segmente
            if (route.sections) {
                route.sections.forEach(sec => {
                    if (sec.sectionType === 'TRAFFIC') {
                        const segCoords = routePoints.slice(sec.startPointIndex, sec.endPointIndex + 1);
                        features.push({
                            type: 'Feature',
                            properties: { 
                                trafficLevel: sec.magnitudeOfDelay || 1, 
                                isActive: false 
                            },
                            geometry: { type: 'LineString', coordinates: segCoords }
                        });
                    }
                });
            }

            // FIX: GeoJSON im Tresor speichern, bevor es in die Map geht
            const geojson = { type: 'FeatureCollection', features: features };
            currentRouteGeoJSONs[sourceId] = geojson;

            libreMap.addSource(sourceId, {
                type: 'geojson',
                data: geojson
            });

            libreMap.addLayer({
                id: layerId,
                type: 'line',
                source: sourceId,
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: {
                    'line-width': ['case', ['boolean', ['get', 'isActive'], false], 7, 4], 
                    'line-color': [
                        'case',
                        ['==', ['get', 'isActive'], false], '#666666', 
                        ['==', ['get', 'trafficLevel'], 0], '#007aff', 
                        ['==', ['get', 'trafficLevel'], 1], '#ff9f0a', 
                        ['==', ['get', 'trafficLevel'], 2], '#ff3b30', 
                        ['==', ['get', 'trafficLevel'], 3], '#bf0000', 
                        '#000000' 
                    ],
                    'line-opacity': ['case', ['boolean', ['get', 'isActive'], false], 1.0, 0.4]
                }
            });

            currentRouteIds.push(i);
        }
    }

    // --- KARTEN GENERIEREN UND SCROLL-LOGIK ---
    function renderRouteCards(routes) {
        const container = document.getElementById('route-cards-container');
        container.innerHTML = '';

        routes.forEach((route, index) => {
            const summary = route.summary;
            
            const durationMin = Math.round(summary.travelTimeInSeconds / 60);
            const delayMin = Math.round(summary.trafficDelayInSeconds / 60);
            const distanceKm = (summary.lengthInMeters / 1000).toFixed(1);
            
            const arrival = new Date(Date.now() + summary.travelTimeInSeconds * 1000);
            const arrivalStr = arrival.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

            const trafficRisk = delayMin > 10 ? 'Hoch' : (delayMin > 3 ? 'Mittel' : 'Gering');

            const card = document.createElement('div');
            card.className = `route-card ${index === 0 ? 'active' : ''}`;
            card.dataset.index = index;
            card.innerHTML = `
                <div class="route-card-header">
                    <span class="route-time">${durationMin} Min</span>
                    <span class="route-distance">${distanceKm} km</span>
                </div>
                <div class="route-details">
                    <span>Ankunft: ${arrivalStr}</span>
                    <span class="traffic-prob">Stau-Risiko: ${trafficRisk} ${delayMin > 0 ? `(+${delayMin} Min)` : ''}</span>
                </div>
                <button class="btn-go" disabled>Go</button>
            `;
            container.appendChild(card);
        });

        container.addEventListener('scroll', () => {
            clearTimeout(container.scrollTimeout);
            container.scrollTimeout = setTimeout(() => {
                const scrollLeft = container.scrollLeft;
                const cardWidth = container.offsetWidth * 0.85 + 15; 
                const activeIndex = Math.round(scrollLeft / cardWidth);
                
                const safeIndex = Math.max(0, Math.min(activeIndex, routes.length - 1));
                highlightRoute(safeIndex);
            }, 150); 
        });
    }

    // --- HIGHLIGHTING LOGIK ---
    function highlightRoute(activeIndex) {
        document.querySelectorAll('.route-card').forEach((card, idx) => {
            if (idx === activeIndex) card.classList.add('active');
            else card.classList.remove('active');
        });

        currentRouteIds.forEach(id => {
            const sourceId = `tomtom-route-source-${id}`;
            const layerId = `tomtom-route-layer-${id}`;
            
            // FIX: Daten aus unserem Tresor holen, statt sie aus der Map zu erzwingen
            if (libreMap.getSource(sourceId) && currentRouteGeoJSONs[sourceId]) {
                const data = currentRouteGeoJSONs[sourceId];
                const isActive = (id === activeIndex);
                data.features.forEach(f => f.properties.isActive = isActive);
                libreMap.getSource(sourceId).setData(data);

                if (isActive) {
                    libreMap.moveLayer(layerId); 
                }
            }
        });
    }

    // --- CLEANUP & CANCEL LOGIK ---
    function clearRoutes() {
        currentRouteIds.forEach(id => {
            const layerId = `tomtom-route-layer-${id}`;
            const sourceId = `tomtom-route-source-${id}`;
            if (libreMap.getLayer(layerId)) libreMap.removeLayer(layerId);
            if (libreMap.getSource(sourceId)) libreMap.removeSource(sourceId);
        });
        currentRouteIds = [];
        currentRouteGeoJSONs = {}; // FIX: Tresor leeren
    }




// ==========================================
    // === MAP CONTROLS LOGIC (PILL) ===
    // ==========================================
    const btnRecenter = document.getElementById('btn-recenter-map');
    const btnNorth = document.getElementById('btn-align-north');

    if (btnRecenter && btnNorth) {
        
        // 1. Klick auf Standort-Button (Zentrieren)
        btnRecenter.addEventListener('click', (e) => {
            e.stopPropagation();
            if (libreMap && currentCoords) {
                libreMap.flyTo({
                    center: currentCoords,
                    zoom: 16,
                    speed: 1.2,
                    essential: true
                });
            }
        });

        // 2. Klick auf Nord-Button (Norden ausrichten & flach legen)
        btnNorth.addEventListener('click', (e) => {
            e.stopPropagation();
            if (libreMap) {
                libreMap.flyTo({
                    bearing: 0, 
                    pitch: 0,   
                    speed: 1.5,
                    essential: true
                });
            }
        });
    }

    // ==========================================
    // === SHRINK BUTTON / CANCEL ROUTE LOGIC ===
    // ==========================================


    if (shrinkBtn && mapCard && expandTrigger) {
        shrinkBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            
            // --- NEU: ROUTE-CANCEL INTERCEPT LOGIK ---
            const routeOverviewUI = document.getElementById('route-overview-ui');
            if (routeOverviewUI && !routeOverviewUI.classList.contains('hidden')) {
                // Wir sind in der Routen-Auswahl -> Nur Route löschen!
                if (typeof clearRoutes === 'function') clearRoutes();
                routeOverviewUI.classList.add('hidden');
                
                const bottomSheet = document.getElementById('map-bottom-sheet');
                if (bottomSheet) bottomSheet.style.display = 'flex';
                
                const pillV = document.querySelector('.map-controls-pill-v');
                if (pillV) pillV.style.display = 'flex'; // Pille wieder einblenden
                
                if (currentCoords && libreMap) {
                    libreMap.flyTo({ center: currentCoords, zoom: 14, pitch: 0, bearing: 0, speed: 1.5, essential: true });
                }
                return; // WICHTIG: Hier brechen wir ab! Die Karte schrumpft dadurch nicht.
            }
            // -----------------------------------------

            // --- DEIN ALTER CODE ZUM SCHRUMPFEN DER KARTE ---
            mapCard.classList.remove('map-expanded');
            expandTrigger.style.display = 'block';

            const bottomNav = document.querySelector('.bottom-nav');
            if (bottomNav) bottomNav.style.display = 'flex';

            const bottomSheet = document.getElementById('map-bottom-sheet');
            if (bottomSheet) bottomSheet.classList.remove('expanded');

            const searchInput = document.getElementById('tomtom-search-input');
            if (searchInput) searchInput.blur();

            if (!libreMap) return;

            libreMap.dragPan.disable();
            libreMap.scrollZoom.disable();
            libreMap.touchZoomRotate.disable();
            libreMap.doubleClickZoom.disable();
            libreMap.setPadding({ right: 150, bottom: 10 });

            if (currentCoords) {
                libreMap.flyTo({
                    center: currentCoords,
                    zoom: 14,
                    bearing: 0,  
                    pitch: 0,    
                    speed: 1.5,
                    essential: true
                });
            }

            let start = Date.now();
            let resizeInterval = setInterval(() => {
                libreMap.resize();
                if (Date.now() - start > 450) {
                    clearInterval(resizeInterval);
                    if (currentCoords) {
                        libreMap.jumpTo({ 
                            center: currentCoords, 
                            zoom: 14, 
                            bearing: 0, 
                            pitch: 0 
                        });
                    }
                }
            }, 16); 
        });
    }

    // ==========================================
    // === BOTTOM SHEET TOUCH & FOCUS LOGIC ===
    // ==========================================
    const bottomSheet = document.getElementById('map-bottom-sheet');
    const tomtomInput = document.getElementById('tomtom-search-input');

    if (bottomSheet && tomtomInput) {
        
        tomtomInput.addEventListener('focus', () => {
            bottomSheet.classList.add('expanded');

            const preventScroll = () => {
                window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                document.body.scrollTop = 0;
            };

            setTimeout(preventScroll, 10);
            setTimeout(preventScroll, 150);
            setTimeout(preventScroll, 300);
        });

        let startY = 0;

        bottomSheet.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
        }, { passive: true });

        bottomSheet.addEventListener('touchend', (e) => {
            let endY = e.changedTouches[0].clientY;
            let diff = startY - endY;

            if (diff > 30) {
                bottomSheet.classList.add('expanded');
            } 
            else if (diff < -30) {
                bottomSheet.classList.remove('expanded');
                tomtomInput.blur(); 
            }
        });
    }
}); // <-- Dies ist die allerletzte Klammer deiner Datei (schließt den DOMContentLoaded)
