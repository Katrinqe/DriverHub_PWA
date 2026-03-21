document.addEventListener('DOMContentLoaded', () => {
    const btnNewExplore = document.getElementById('nav-new-explore');
    const newExploreScreen = document.getElementById('new-explore-screen');
    const allNavItems = document.querySelectorAll('.nav-item');
    const mapContainerId = 'maplibre-snippet';

    // Globale MapLibre Instanz
    let libreMap = null;
    let destMarker = null; // Nur einmal definieren!
    let currentCoords = null; 
    
    if (btnNewExplore && newExploreScreen) {
        // ... restlicher Code
        
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

libreMap = new maplibregl.Map({
        container: mapContainerId,
        style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: coords,
        zoom: 14,
        interactive: true,
        dragRotate: true, // FIX: Von Anfang an aktiv für Desktop-Stabilität
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
        
        if (libreMap.dragRotate) libreMap.dragRotate.disable();
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
        
        // 1. Karte groß machen (Fullscreen)
        expandTrigger.addEventListener('click', () => {
            mapCard.classList.add('map-expanded');
            expandTrigger.style.display = 'none'; // Klickscheibe wegnehmen

            // Nav-Bar ausblenden
            const bottomNav = document.querySelector('.bottom-nav');
            if (bottomNav) bottomNav.style.display = 'none';

            if (libreMap) {
                // Interaktion freischalten
                libreMap.dragPan.enable();
                libreMap.scrollZoom.enable();
                libreMap.touchZoomRotate.enable();
                libreMap.doubleClickZoom.enable();
                if (libreMap.dragRotate) libreMap.dragRotate.enable(); 

                // Optischen Mittelpunkt zentrieren
                libreMap.setPadding({ right: 0, bottom: 0 });

                // Map an Fullscreen anpassen
                setTimeout(() => libreMap.resize(), 400); 
            }
        });

        // 2. Karte wieder klein machen ODER Route abbrechen (EINZIGER LISTENER!)
        shrinkBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            
      
            // -----------------------------------------

            // --- NORMALER SHRINK CODE (Nur wenn keine Route offen ist) ---
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

           debounceTimer = setTimeout(async () => {
                try {
                    // --- NEU: INTELLIGENTE LOKALE SUCHE ---
                    // Basis-URL
                    let searchUrl = `https://api.tomtom.com/search/2/search/${encodeURIComponent(query)}.json?key=${TOMTOM_API_KEY}&language=de-DE&limit=5`;
                    
                    // Location Biasing: Wenn wir den Standort haben, zwingen wir TomTom, lokal zu priorisieren!
                    if (currentCoords) {
                        // currentCoords[1] ist Latitude, currentCoords[0] ist Longitude
                        searchUrl += `&lat=${currentCoords[1]}&lon=${currentCoords[0]}`;
                    }

                    const response = await fetch(searchUrl);
                    // --------------------------------------
                    
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
                            
                            // --- NEUE POI-LOGIK: Erkennt Orte wie "REWE" oder "Pizzeria" ---
                            let primaryName = "";
                            let secondaryName = "";

                            // Prüfen, ob TomTom ein Geschäft/Ort (POI) erkannt hat
                            if (result.poi && result.poi.name) {
                                primaryName = result.poi.name;
                                secondaryName = result.address.freeformAddress || result.address.municipality || "";
                            } else {
                                // Es ist nur eine normale Adresse/Stadt
                                primaryName = result.address.freeformAddress || result.address.municipality || "Unbekannter Ort";
                            }

                            // Elegantes zweizeiliges Layout für das Dropdown
                            if (secondaryName) {
                                div.innerHTML = `<div style="font-weight: 600; color: #fff; font-size: 15px;">${primaryName}</div>
                                                 <div style="font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 4px;">${secondaryName}</div>`;
                            } else {
                                div.innerHTML = `<div style="font-weight: 600; color: #fff; font-size: 15px;">${primaryName}</div>`;
                            }
                            
                            // Klick auf einen Vorschlag
                            div.addEventListener('click', () => {
                                console.log("ORT GEKLICKT:", primaryName); 
                                
                                // Wir schreiben bewusst nur den sauberen Namen (z.B. "REWE") in die Suchleiste
                                searchInput.value = primaryName; 
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

async function drawTomTomRoute(destLat, destLng) {
    if (!currentCoords || !libreMap) return;

    const startLng = currentCoords[0];
    const startLat = currentCoords[1];

    if (!libreMap.loaded()) {
        libreMap.once("load", () => drawTomTomRoute(destLat, destLng));
        return;
    }

    const routeUI = document.getElementById('route-overview-ui');
    const bottomSheet = document.getElementById('map-bottom-sheet');
    const pillV = document.querySelector('.map-controls-pill-v');
    const shrinkBtn = document.getElementById('btn-shrink-map');
    
    if (shrinkBtn) {
        shrinkBtn.style.opacity = '0'; 
        shrinkBtn.style.pointerEvents = 'none';
    }

    if (document.querySelector('.map-snippet-card')) document.querySelector('.map-snippet-card').classList.add('map-expanded');
    document.getElementById('map-expand-trigger').style.display = 'none';
    
    const navBar = document.querySelector('.bottom-nav');
    if (navBar) navBar.style.display = 'none';
    
    if (bottomSheet) {
        bottomSheet.classList.remove('expanded');
        bottomSheet.style.display = 'none';
    }
    document.getElementById('tomtom-search-input').blur();

    libreMap.dragPan.enable();
    libreMap.scrollZoom.enable();
    libreMap.touchZoomRotate.enable();
    libreMap.doubleClickZoom.enable();
    if (libreMap.dragRotate) libreMap.dragRotate.enable();
    libreMap.setPadding({ right: 0, bottom: 0 });

    try {
        // NEU: maxAlternatives=1 liefert uns bis zu 2 Routen. instructionsType liefert Straßennamen.
        const url = `https://api.tomtom.com/routing/1/calculateRoute/${startLat},${startLng}:${destLat},${destLng}/json?key=${TOMTOM_API_KEY}&traffic=true&sectionType=traffic&maxAlternatives=1&instructionsType=text&language=de-DE`;
        
        const response = await fetch(url);
        if (!response.ok) throw new Error(`API Fehler: ${response.status}`);
        
        const data = await response.json();
        if (!data.routes || data.routes.length === 0) return;

        // Alte Routen restlos löschen, bevor wir neu zeichnen
        clearRoutes();
        RouteLogic.routeGeoJSONs = [null, null];
        RouteLogic.activeIndex = 0;

        const bounds = new maplibregl.LngLatBounds();

        // BEIDE ROUTEN VERARBEITEN (Hauptroute = 0, Alternative = 1)
        data.routes.forEach((route, index) => {
            if (index > 1) return; // Wir zeigen maximal 2 Routen an

            const allPoints = route.legs[0].points.map(p => [p.longitude, p.latitude]);
            const sections = route.sections || [];
            const routeFeatures = [];

           
allPoints.forEach(coord => bounds.extend(coord));
            
   // NEU: Wir speichern die reinen Koordinaten ab für unser Höhenprofil
         // NEU: Wir speichern die reinen Koordinaten ab für unser Höhenprofil
            RouteLogic.routePointsData[index] = allPoints;
            RouteLogic.routeDistances[index] = route.summary.lengthInMeters; // <--- HIER MUSS route.summary STEHEN!
            // NEU: Wir erstellen ein Array für die Farben. Standard ist komplett Grün.
            const pointColors = new Array(allPoints.length).fill('#30d158');

            // A: Basis-Linie (Blau)
            if (allPoints.length > 1) {
                routeFeatures.push({
                    type: 'Feature',
                    properties: { color: '#007aff' },
                    geometry: { type: 'LineString', coordinates: allPoints }
                });
            }

            // B: Traffic-Overlays (Kugelsicher mit feiner Magnitude-Erkennung)
            sections.forEach(section => {
                const start = section.startPointIndex;
                const end = section.endPointIndex;

                if (typeof start !== 'number' || typeof end !== 'number') return;

                const segmentCoords = allPoints.slice(start, end + 1);
                if (segmentCoords.length < 2) return;

                let color = null; 
                
                if (section.sectionType && section.sectionType.toUpperCase() === 'TRAFFIC') {
                    const delay = section.magnitudeOfDelay || 0;
                    
                    if (delay === 4) {
                        color = '#8b0000'; // Stillstand
                    } else if (delay === 3 || section.simpleCategory === 'JAM') {
                        color = '#ff3b30'; // Stau
                    } else if (delay === 2) {
                        color = '#ff9500'; // Stockend
                    } else if (delay === 1 || section.simpleCategory === 'SLOW') {
                        color = '#ffcc00'; // Zäh
                    } else {
                        color = '#ffcc00'; 
                    }
                }

                if (color) {
                    routeFeatures.push({
                        type: 'Feature',
                        properties: { color: color, isTraffic: true },
                        geometry: { type: 'LineString', coordinates: segmentCoords }
                    });
                    
                    // NEU: Wir "malen" die Stau-Farbe exakt auf die betroffenen Punkte im Array!
                    for (let k = start; k <= end; k++) {
                        pointColors[k] = color;
                    }
                }
            });

            // NEU: Fertiges Farb-Array in unserer Logik abspeichern
            RouteLogic.routeColorsData[index] = pointColors;

            // Im Objekt speichern für späteres Umschalten (Aktiv/Grau)
            RouteLogic.routeGeoJSONs[index] = routeFeatures;

            // Layer sofort anlegen
            const sourceId = `route-source-${index}`;
            const layerId = `route-layer-${index}`;

            libreMap.addSource(sourceId, {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: routeFeatures }
            });

            libreMap.addLayer({
                id: layerId,
                type: 'line',
                source: sourceId,
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: { 
                    'line-color': ['get', 'color'], 
                    // Pro-Tipp: Wenn es eine Stau-Linie ist (isTraffic = true), machen wir sie 1px dicker (7 statt 6). 
                    // Das verhindert, dass die blaue Basis-Linie an den Rändern hässlich durchschimmert.
                    'line-width': ['case', ['==', ['get', 'isTraffic'], true], 7, 6] 
                }
            });

            libreMap.addLayer({
                id: layerId,
                type: 'line',
                source: sourceId,
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: { 'line-color': ['get', 'color'], 'line-width': 6 }
            });

// --- UI DATEN BEFÜLLEN ---
            const summary = route.summary;
            const arrivalDate = new Date(Date.now() + summary.travelTimeInSeconds * 1000);
            
            // Zeiten extrahieren (TomTom travelTime beinhaltet bereits den Stau)
            const totalSeconds = summary.travelTimeInSeconds;
            const delaySeconds = summary.trafficDelayInSeconds || 0;
            const normalSeconds = totalSeconds - delaySeconds; // Wie lange es ohne Stau dauern würde
            
            const totalMins = Math.round(totalSeconds / 60);
            const delayMins = Math.round(delaySeconds / 60);

            // 1. Zeit-String bauen (Stunden & Minuten)
            let timeString = "";
            if (totalMins >= 60) {
                const hours = Math.floor(totalMins / 60);
                const remainingMins = totalMins % 60;
                timeString = remainingMins > 0 ? `${hours} Std ${remainingMins} Min` : `${hours} Std`;
            } else {
                timeString = `${totalMins} Min`;
            }
            
            const timeElement = document.getElementById(`opt-time-${index}`);
            const delayElement = document.getElementById(`opt-delay-${index}`);
            
            timeElement.textContent = timeString;

       // 2. Intelligente Prozent-Logik für die Farben
            let timeColor = '#30d158'; // Standard: Schönes Grün (Kein Stau)
            let delayColor = '#ffcc00'; // Farbe für den +X Min Text unten
            let delayText = '';

            if (delayMins > 0 && normalSeconds > 0) {
                // Verhältnis ausrechnen: Wie viel % macht der Stau auf dieser Strecke aus?
                const percentDelay = (delaySeconds / normalSeconds) * 100;
                
                if (percentDelay >= 35) {
                    timeColor = '#b30000'; // Dunkelrot (Massiver Zeitverlust)
                    delayColor = '#b30000';
                } else if (percentDelay >= 15) {
                    timeColor = '#ff3b30'; // Rot (Deutlicher Stau)
                    delayColor = '#ff3b30';
                } else {
                    timeColor = '#ffcc00'; // Gelb (Leichter Verkehr)
                    delayColor = '#ffcc00';
                }
                
                // Mit Klammern sieht es neben dem "über A3" Text eleganter aus
                delayText = `(+${delayMins} Min)`; 
            }

            // Farbe hart auf die Hauptzeit anwenden
            timeElement.style.color = timeColor;

            // Den Erklär-Text einblenden, färben oder verstecken
            if (delayText) {
                delayElement.textContent = delayText;
                delayElement.style.color = delayColor; // <-- NEU: Stau-Farbe auf Text anwenden
                delayElement.classList.remove('hidden');
            } else {
                delayElement.classList.add('hidden');
            }
            // Farbe hart auf die Zahl anwenden
            timeElement.style.color = timeColor;

            // Den Erklär-Text einblenden oder verstecken
            if (delayText) {
                delayElement.textContent = delayText;
                delayElement.classList.remove('hidden');
            } else {
                delayElement.classList.add('hidden');
            }
            // Farbe hart auf die Zahl anwenden
            timeElement.style.color = timeColor;

            // Den Erklär-Text einblenden oder verstecken
            if (delayText) {
                delayElement.textContent = delayText;
                delayElement.classList.remove('hidden');
            } else {
                delayElement.classList.add('hidden');
            }

            document.getElementById(`opt-dist-${index}`).textContent = `${(summary.lengthInMeters / 1000).toFixed(1)} km`;
            document.getElementById(`opt-eta-${index}`).textContent = arrivalDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
            
            // Autobahn-Erkennung ("über A3")
            const viaText = RouteLogic.extractHighway(route.guidance ? route.guidance.instructions : null);
            document.getElementById(`opt-via-${index}`).textContent = index === 0 && viaText === "Lokale Route" ? "Schnellste Route" : viaText;

            // Die zweite Pille einblenden, falls TomTom eine Alternative geschickt hat
            if (index === 1) {
                document.getElementById('route-opt-1').classList.remove('hidden');
            }
        }); // <-- ECHTES ENDE DER SCHLEIFE

        // Falls TomTom keine Alternative schickt, die zweite Pille hart ausblenden
        if (data.routes.length === 1) {
            document.getElementById('route-opt-1').classList.add('hidden');
        }

        // Initiale Einfärbung (Route 0 wird blau/bunt, Route 1 wird grau)
        RouteLogic.updateMapLayers();

        // Ziel-Marker zeichnen
        if (destMarker) destMarker.remove();
        const elDest = document.createElement('div');
        elDest.className = 'dest-marker';
        elDest.style.width = '18px'; elDest.style.height = '18px';
        elDest.style.background = '#30d158'; elDest.style.border = '3px solid white';
        elDest.style.borderRadius = '50%'; elDest.style.boxShadow = '0 0 15px rgba(48, 209, 88, 0.8)';
        destMarker = new maplibregl.Marker({ element: elDest }).setLngLat([destLng, destLat]).addTo(libreMap);

        const destNameDisplay = document.getElementById('dest-name-display');
        const searchInput = document.getElementById('tomtom-search-input');
        if (destNameDisplay && searchInput) destNameDisplay.textContent = searchInput.value || "Zielort";

        if (routeUI) routeUI.classList.remove('hidden');
        if (pillV) pillV.style.display = 'none';

   // --- NEU: HÖHE MESSEN FÜR SMOOTHEN SWIPE NACH UNTEN ---
        setTimeout(() => {
            const routeCardInfo = document.getElementById('route-overview-card');
            if (routeCardInfo && !routeCardInfo.classList.contains('expanded')) {
                // 1. Etwaige Blockaden lösen
                routeCardInfo.style.height = ''; 
                // 2. Reale Pixel abmessen
                const exactHeight = routeCardInfo.offsetHeight; 
                // 3. NUR als Variable speichern. Das CSS erledigt den Rest!
                routeCardInfo.style.setProperty('--closed-height', exactHeight + 'px'); 
            }
        }, 50);
        // -------------------------------------------------------

        // 8. Kamera-Zoom (Dynamisches Padding für die große Route-Card)
        libreMap.resize();
        libreMap.once('idle', () => {
            libreMap.fitBounds(bounds, { 
                padding: { 
                    top: 120, 
                    bottom: 480, /* FIX: Wert massiv erhöht (von 400 auf 480). Hier kannst du nachjustieren! */
                    left: 60, 
                    right: 60 
                }, 
                duration: 1000 
            });

// Lade das Höhenprofil sofort für die primäre Route (Route 0)
        if (RouteLogic.routePointsData[0]) {
            window.loadElevationData(
                RouteLogic.routePointsData[0], 
                RouteLogic.routeColorsData[0], 
                RouteLogic.routeDistances[0] // <-- NEU: Distanz übergeben
            ); 
        }
            
        });

    } catch (error) {
        console.error("Routing Fehler:", error);
    }
}

function clearRoutes() {
    if (!libreMap) return;

    // 1. Wir löschen radikal alle Layers (altes & neues System)
    const layersToRemove = ['simple-route-layer', 'route-layer-0', 'route-layer-1'];
    layersToRemove.forEach(layer => {
        if (libreMap.getLayer(layer)) libreMap.removeLayer(layer);
    });

    // 2. Wir löschen alle Sources
    const sourcesToRemove = ['simple-route-source', 'route-source-0', 'route-source-1'];
    sourcesToRemove.forEach(source => {
        if (libreMap.getSource(source)) libreMap.removeSource(source);
    });

    // 3. Ziel-Marker entfernen
    if (destMarker) {
        destMarker.remove();
        destMarker = null;
    }

    // 4. Den Multi-Route Zwischenspeicher leeren
    if (window.RouteLogic) {
        window.RouteLogic.routeGeoJSONs = [null, null];
    }
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
            
            // Falls gerade eine Route aktiv ist -> Route abbrechen (wie beim X-Button)
            if (libreMap && libreMap.getLayer('simple-route-layer')) {
                clearRoutes();
                const routeUI = document.getElementById('route-overview-ui');
                if (routeUI) routeUI.classList.add('hidden');
                
                const bottomSheet = document.getElementById('map-bottom-sheet');
                if (bottomSheet) bottomSheet.style.display = 'flex';
                
                const searchInput = document.getElementById('tomtom-search-input');
                if (searchInput) searchInput.value = '';
            }

            // Zurück zum Standort (ABSOLUT MITTIG)
            if (currentCoords && libreMap) {
                libreMap.flyTo({ 
                    center: currentCoords, 
                    zoom: 14, 
                    pitch: 0, 
                    bearing: 0, 
                    padding: { top: 0, bottom: 0, left: 0, right: 0 }, // FIX: Zentriert es exakt mittig im Viewport
                    speed: 1.5, 
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
    // === SHRINK BUTTON LOGIC (PFEIL OBEN LINKS) ===
    // ==========================================
    if (shrinkBtn && mapCard && expandTrigger) {
        shrinkBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            
            // Karte wieder klein machen
            mapCard.classList.remove('map-expanded');
            expandTrigger.style.display = 'block';

            // Nav-Bar WIEDER EINBLENDEN!
            const bottomNav = document.querySelector('.bottom-nav');
            if (bottomNav) bottomNav.style.display = 'flex';

            const bottomSheet = document.getElementById('map-bottom-sheet');
            if (bottomSheet) bottomSheet.classList.remove('expanded');

            const searchInput = document.getElementById('tomtom-search-input');
            if (searchInput) searchInput.blur();

            if (!libreMap) return;

            // Karte für kleine Ansicht sperren
            libreMap.dragPan.disable();
            libreMap.scrollZoom.disable();
            libreMap.touchZoomRotate.disable();
            libreMap.doubleClickZoom.disable();
            libreMap.setPadding({ right: 150, bottom: 10 });

            // Zurück zum Standort fliegen
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

            // Fix für sauberes Resizen während der Animation
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
    // === NEUE CANCEL ROUTE LOGIK (X-BUTTON) ===
    // ==========================================
    const btnCancelRouteNew = document.getElementById('btn-cancel-route-new');
    if (btnCancelRouteNew) {
        // .onclick überschreibt alle fehlerhaften Alt-Befehle hart!
        btnCancelRouteNew.onclick = (e) => {
            e.stopPropagation();

            // 1. Karte komplett abräumen (Nuke)
            clearRoutes();
            
            // 2. Card unten ausblenden
            const routeOverviewUI = document.getElementById('route-overview-ui');
            if (routeOverviewUI) routeOverviewUI.classList.add('hidden');
            
            // 3. UI wiederherstellen (Suchfeld & Map-Controls)
            const bottomSheet = document.getElementById('map-bottom-sheet');
            if (bottomSheet) bottomSheet.style.display = 'flex';
            
            const pillV = document.querySelector('.map-controls-pill-v');
            if (pillV) pillV.style.display = 'flex';
            
            // 4. Suchfeld leeren und Tastatur schließen
            const searchInput = document.getElementById('tomtom-search-input');
            if (searchInput) {
                searchInput.value = '';
                searchInput.blur();
            }

            // 5. Pfeil oben links WIEDER EINBLENDEN
            const shrinkBtnMap = document.getElementById('btn-shrink-map');
            if (shrinkBtnMap) {
                shrinkBtnMap.style.opacity = '1';
                shrinkBtnMap.style.pointerEvents = 'auto';
            }
            
            // 6. Kamera sanft zurück zum eigenen Standort fliegen
            if (currentCoords && libreMap) {
                libreMap.flyTo({ center: currentCoords, zoom: 14, pitch: 0, bearing: 0, speed: 1.5, essential: true });
            }
        };
    }
    // ==========================================
    // === BOTTOM SHEET TOUCH & FOCUS LOGIC ===
    // ==========================================
    const bottomSheetElement = document.getElementById('map-bottom-sheet');
    const tomtomInputElement = document.getElementById('tomtom-search-input');

    if (bottomSheetElement && tomtomInputElement) {
        
        tomtomInputElement.addEventListener('focus', () => {
            bottomSheetElement.classList.add('expanded');

            const preventScroll = () => {
                window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
                document.body.scrollTop = 0;
            };

            setTimeout(preventScroll, 10);
            setTimeout(preventScroll, 150);
            setTimeout(preventScroll, 300);
        });

        let startY = 0;

        bottomSheetElement.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
        }, { passive: true });

        bottomSheetElement.addEventListener('touchend', (e) => {
            let endY = e.changedTouches[0].clientY;
            let diff = startY - endY;

            if (diff > 30) {
                bottomSheetElement.classList.add('expanded');
            } 
            else if (diff < -30) {
                bottomSheetElement.classList.remove('expanded');
                tomtomInputElement.blur(); 
            }
        });
    }
// ==========================================
    // === ROUTE LOGIC (MULTI-ROUTE & UI) ===
    // ==========================================
  window.RouteLogic = {
        routeGeoJSONs: [null, null],
        routePointsData: [null, null], 
        routeColorsData: [null, null], 
        routeDistances: [null, null], // <--- DIESE ZEILE HAT BEI DIR GEFEHLT!
        activeIndex: 0,

        selectRouteOpt: function(index) {
            if (!this.routeGeoJSONs[index]) return; 
            this.activeIndex = index;

            document.getElementById('route-opt-0').classList.toggle('active', index === 0);
            document.getElementById('route-opt-1').classList.toggle('active', index === 1);

            this.updateMapLayers();
            
            // NEU: Beim Klick auf eine andere Route zeichnet sich das Höhenprofil dynamisch neu!
            if (this.routePointsData[index]) {
               window.loadElevationData(this.routePointsData[index], this.routeColorsData[index], this.routeDistances[index]);
            }
        }, // <-- DIESE KLAMMER UND DAS KOMMA HABEN BEI DIR GEFEHLT!

        // Zeichnet die Linien auf der Karte neu (Aktiv = Bunt/Blau, Inaktiv = Grau)
        updateMapLayers: function() {
            for (let i = 0; i < 2; i++) {
                if (!this.routeGeoJSONs[i]) continue;
                
                const isAct = (i === this.activeIndex);
                const layerId = `route-layer-${i}`;
                const sourceId = `route-source-${i}`;

                // Kopie der Originaldaten für den grauen Modus erstellen
                let displayFeatures = JSON.parse(JSON.stringify(this.routeGeoJSONs[i]));
                
                if (!isAct) {
                    // Wenn inaktiv, überschreiben wir alle Farben hart mit Grau
                    displayFeatures.forEach(f => { f.properties.color = '#555555'; });
                }

                if (libreMap.getSource(sourceId)) {
                    libreMap.getSource(sourceId).setData({ type: 'FeatureCollection', features: displayFeatures });
                }

                if (libreMap.getLayer(layerId)) {
                    // Aktive Route dicker machen und nach vorne holen (Opazität)
                    libreMap.setPaintProperty(layerId, 'line-width', isAct ? 6 : 4);
                    libreMap.setPaintProperty(layerId, 'line-opacity', isAct ? 1 : 0.4);
                }
            }
        },

  

        // Extrahiert die Autobahn (z.B. "A3") aus den TomTom Instruktionen
        extractHighway: function(instructions) {
            if (!instructions) return "Schnellste Route";
            for (let i = 0; i < instructions.length; i++) {
                let inst = instructions[i];
                if (inst.roadNumbers && inst.roadNumbers.length > 0) {
                    let road = inst.roadNumbers[0];
                    // Wir akzeptieren nur A-Straßen (Autobahnen in DE)
                    if (road.startsWith('A')) return `über ${road}`; 
                }
            }
            return "Lokale Route"; // Wenn keine Autobahn gefunden wurde
        }
    };
// ==========================================
    // === ROUTE CARD SWIPE LOGIC (CLEAN) ===
    // ==========================================
    const routeCard = document.getElementById('route-overview-card');
    
    if (routeCard) {
        let startY = 0;

        routeCard.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
        }, { passive: true });

        routeCard.addEventListener('touchend', (e) => {
            let endY = e.changedTouches[0].clientY;
            let diff = startY - endY; // Positiv = Wisch nach OBEN

            if (diff > 40) {
                // Hochwischen -> Card wird 85% hoch
                routeCard.classList.add('expanded');
            } else if (diff < -40) {
                // Runterwischen -> Card wird wieder klein
                routeCard.classList.remove('expanded');
            }
        });

        // Beim Klick auf das X muss die Card auch wieder schrumpfen
        const btnCancel = document.getElementById('btn-cancel-route-new');
        if (btnCancel) {
            btnCancel.addEventListener('click', () => {
                routeCard.classList.remove('expanded');
            });
        }
    }


// ==========================================
    // === ELEVATION API & WEATHER RENDERING ===
    // ==========================================
    window.loadElevationData = async function(allPoints, allColors, totalDistMeters) { 
        if (!allPoints || allPoints.length === 0) return;

        // --- 1. HÖHENDATEN ABFRAGEN ---
        const sampleSize = 50;
        const step = Math.max(1, Math.floor(allPoints.length / sampleSize));
        const sampledPoints = [];
        const sampledColors = []; 

        for (let i = 0; i < allPoints.length; i += step) {
            sampledPoints.push(allPoints[i]);
            sampledColors.push(allColors ? allColors[i] : '#30d158'); 
        }
        
        if (sampledPoints[sampledPoints.length - 1] !== allPoints[allPoints.length - 1]) {
            sampledPoints.push(allPoints[allPoints.length - 1]);
            sampledColors.push(allColors ? allColors[allColors.length - 1] : '#30d158'); 
        }

        const lats = sampledPoints.map(p => p[1]).join(',');
        const lons = sampledPoints.map(p => p[0]).join(',');

        try {
            const url = `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lons}`;
            const response = await fetch(url);
            const data = await response.json();

            if (data && data.elevation) {
                // Zeichnen mit 120px Höhe anstoßen
                drawElevationChart(data.elevation, sampledColors, 120, totalDistMeters); 
            }
        } catch (error) {
            console.error("Höhendaten Fehler:", error);
        }

        // --- 2. WETTER LOGIK (Die Flächen-Zentrierung) ---
        const weatherContainer = document.getElementById('weather-track-container');
        if (weatherContainer) weatherContainer.innerHTML = ''; 

        // UNTER 80KM: Brutal abbrechen, kein Wetter!
        if (!totalDistMeters || totalDistMeters < 80000) return; 

        // Wie viele harte 40km Blöcke haben wir?
        const numIntervals = Math.floor(totalDistMeters / 40000); 
        const weatherLats = [];
        const weatherLons = [];
        const weatherPercentages = [];

        // Wir berechnen den visuellen Mittelpunkt jeder 40km-Fläche
        for (let i = 0; i <= numIntervals; i++) {
            const dataDist = i * 40000; 
            if (dataDist >= totalDistMeters) break; 

            // Optischer Mittelpunkt der Fläche (z.B. bei 20km für die 0-40km Fläche)
            const blockEnd = Math.min((i + 1) * 40000, totalDistMeters);
            const visualDistCenter = dataDist + ((blockEnd - dataDist) / 2);
            const visualPercentage = visualDistCenter / totalDistMeters;

            // Wir holen aber das Wetter vom STARTPUNKT dieser Fläche (also 0km, 40km, 80km)
            const ptIndex = Math.floor((dataDist / totalDistMeters) * (allPoints.length - 1));
            const pt = allPoints[ptIndex];

            weatherLats.push(pt[1]);
            weatherLons.push(pt[0]);
            weatherPercentages.push(visualPercentage * 100); // Hier wird das Icon platziert
        }

        try {
            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${weatherLats.join(',')}&longitude=${weatherLons.join(',')}&current_weather=true`;
            const wRes = await fetch(weatherUrl);
            const wData = await wRes.json();

            const results = Array.isArray(wData) ? wData : [wData];

            results.forEach((res, idx) => {
                if (!res.current_weather) return;
                const temp = Math.round(res.current_weather.temperature);
                const code = res.current_weather.weathercode;
                let icon = 'fa-cloud'; 

                if (code === 0) icon = 'fa-sun';
                else if (code >= 1 && code <= 3) icon = 'fa-cloud-sun';
                else if (code >= 45 && code <= 48) icon = 'fa-smog';
                else if (code >= 51 && code <= 67) icon = 'fa-cloud-rain';
                else if (code >= 71 && code <= 77) icon = 'fa-snowflake';
                else if (code >= 80 && code <= 82) icon = 'fa-cloud-showers-heavy';
                else if (code >= 95) icon = 'fa-cloud-bolt';

                const div = document.createElement('div');
                div.className = 'weather-point';
                div.style.left = `${weatherPercentages[idx]}%`;
                div.innerHTML = `<i class="fa-solid ${icon}"></i><span>${temp}°</span>`;
                weatherContainer.appendChild(div);
            });
        } catch(e) {
            console.error("Wetter Fehler:", e);
        }
    };

    function drawElevationChart(elevations, pointColors, canvasHeight, totalDistMeters) { 
        const canvas = document.getElementById('elevation-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const exactWidth = window.innerWidth - 86; 
        const exactHeight = canvasHeight || 120; 

        const dpr = window.devicePixelRatio || 1;
        canvas.width = exactWidth * dpr;
        canvas.height = exactHeight * dpr;
        ctx.scale(dpr, dpr);

        const minElev = Math.min(...elevations);
        const maxElev = Math.max(...elevations);
        const diff = maxElev - minElev;

        document.getElementById('elevation-stats').textContent = `▲ ${Math.round(maxElev)}m  ▼ ${Math.round(minElev)}m`;

        ctx.clearRect(0, 0, exactWidth, exactHeight);
        if (diff === 0) return;

        // NEU: Platz für die X-Achse am Boden lassen!
        const paddingTop = 10;
        const paddingBottom = 25; // Exakt hier drunter stehen die "40 km" Texte
        const chartHeight = exactHeight - paddingTop - paddingBottom;
        const baseY = exactHeight - paddingBottom; // Das ist der Boden des grünen Graphens
        const xStep = exactWidth / (elevations.length - 1);

        // 1. FLÄCHEN-LOGIK (Die grüne Masse bis zur X-Achse)
        ctx.beginPath();
        ctx.moveTo(0, baseY); 
        
        for (let i = 0; i < elevations.length; i++) {
            const x = i * xStep;
            const normalizedY = (elevations[i] - minElev) / diff;
            const y = paddingTop + chartHeight - (normalizedY * chartHeight);
            ctx.lineTo(x, y);
        }
        ctx.lineTo(exactWidth, baseY);
        ctx.closePath();

        const gradient = ctx.createLinearGradient(0, 0, 0, baseY);
        gradient.addColorStop(0, 'rgba(48, 209, 88, 0.4)'); 
        gradient.addColorStop(1, 'rgba(48, 209, 88, 0.1)'); 
        ctx.fillStyle = gradient;
        ctx.fill();

        // 2. HARTE OBERE LINIE (Die Stau-Farben)
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        for (let i = 0; i < elevations.length - 1; i++) {
            ctx.beginPath();
            const y1_norm = (elevations[i] - minElev) / diff;
            const y1 = paddingTop + chartHeight - (y1_norm * chartHeight);
            const y2_norm = (elevations[i+1] - minElev) / diff;
            const y2 = paddingTop + chartHeight - (y2_norm * chartHeight);

            ctx.moveTo(i * xStep, y1);
            ctx.lineTo((i + 1) * xStep, y2);
            
            ctx.strokeStyle = pointColors[i] || '#30d158'; 
            ctx.stroke();
        }

        // 3. X-ACHSE & GESTRICHELTE TRENNWÄNDE (Nur bei über 80km!)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '10px sans-serif';
        ctx.textBaseline = 'top';

        if (totalDistMeters && totalDistMeters >= 80000) {
            const numIntervals = Math.floor(totalDistMeters / 40000);
            
            for (let i = 0; i <= numIntervals; i++) {
                const dist = i * 40000;
                const percentage = dist / totalDistMeters;
                const x = percentage * exactWidth;

                // Kilometer-Texte sauber ausrichten
                ctx.textAlign = i === 0 ? 'left' : (i === numIntervals && dist > totalDistMeters - 5000 ? 'right' : 'center');
                ctx.fillText(`${i * 40} km`, x, baseY + 8);

                // Die gestrichelte Wand einziehen (Außer ganz links bei 0km)
                if (i > 0) { 
                    ctx.beginPath();
                    ctx.setLineDash([4, 4]); // 4px Strich, 4px Lücke
                    ctx.moveTo(x, baseY);
                    
                    // Finde den exakten Y-Punkt auf der Berglinie, um die Wand dort enden zu lassen
                    const ptIndex = Math.min(Math.floor(percentage * (elevations.length - 1)), elevations.length - 1);
                    const y_norm = (elevations[ptIndex] - minElev) / diff;
                    const y = paddingTop + chartHeight - (y_norm * chartHeight);
                    
                    ctx.lineTo(x, y);
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    ctx.setLineDash([]); // Zurücksetzen
                }
            }
            
            // Ganz am Ende nochmal die Gesamt-Kilometer anzeigen, falls noch Platz ist
            if (totalDistMeters - (numIntervals * 40000) > 8000) {
                ctx.textAlign = 'right';
                ctx.fillText(`${(totalDistMeters/1000).toFixed(0)} km`, exactWidth, baseY + 8);
            }
            
        } else if (totalDistMeters) {
            // UNTER 80KM: Keine Wände, nur minimaler Start- und End-Text
            ctx.textAlign = 'left';
            ctx.fillText(`0 km`, 0, baseY + 8);
            ctx.textAlign = 'right';
            ctx.fillText(`${(totalDistMeters/1000).toFixed(0)} km`, exactWidth, baseY + 8);
        }
    }
    
}); // <-- Dies ist die allerletzte Klammer deiner Datei (schließt den DOMContentLoaded)
