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
                            // Baut die Adresse sauber zusammen
                            div.textContent = result.address.freeformAddress || result.address.municipality || "Unbekannter Ort"; 
                            
                          // 2. Klick auf einen Vorschlag: Route berechnen
                            div.addEventListener('click', () => {
                                console.log("STADT GEKLICKT", div.textContent); // <-- NEU (Schritt 1)
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

async function drawTomTomRoute(destLat, destLng) {
    if (!currentCoords || !libreMap) return;

    const startLng = currentCoords[0];
    const startLat = currentCoords[1];

    console.log("Routing gestartet", startLat, startLng, destLat, destLng);

    // 1. Map-Load Check
    if (!libreMap.loaded()) {
        console.log("Map noch nicht bereit, warte auf load...");
        libreMap.once("load", () => drawTomTomRoute(destLat, destLng));
        return;
    }

   // 2. UI & Interaktionen vorbereiten
    const routeUI = document.getElementById('route-overview-ui');
    const bottomSheet = document.getElementById('map-bottom-sheet');
    const pillV = document.querySelector('.map-controls-pill-v');
    
    // NEU: Pfeil oben links ausblenden, solange die Route aktiv ist
    const shrinkBtn = document.getElementById('btn-shrink-map');
    if (shrinkBtn) {
        shrinkBtn.style.opacity = '0'; 
        shrinkBtn.style.pointerEvents = 'none';
    }

    if (document.querySelector('.map-snippet-card')) {
        document.querySelector('.map-snippet-card').classList.add('map-expanded');
    }
    
    document.getElementById('map-expand-trigger').style.display = 'none';
    const navBar = document.querySelector('.bottom-nav');
    if (navBar) navBar.style.display = 'none';
    
    if (bottomSheet) {
        bottomSheet.classList.remove('expanded');
        bottomSheet.style.display = 'none';
    }
    document.getElementById('tomtom-search-input').blur();

    // Interaktionen aktivieren
    libreMap.dragPan.enable();
    libreMap.scrollZoom.enable();
    libreMap.touchZoomRotate.enable();
    libreMap.doubleClickZoom.enable();
    if (libreMap.dragRotate) libreMap.dragRotate.enable();
    libreMap.setPadding({ right: 0, bottom: 0 });

    try {
        // 3. API URL mit Traffic & Sections ...
        // 3. API URL mit Traffic & Sections (Nur traffic Typ nutzen für 100% Erfolg)
        const url = `https://api.tomtom.com/routing/1/calculateRoute/${startLat},${startLng}:${destLat},${destLng}/json?key=${TOMTOM_API_KEY}&traffic=true&sectionType=traffic`;
        
        // HIER WAR DER FEHLER: Die Definition von response!
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`API Fehler: ${response.status}`);
        }

        const data = await response.json();

        if (!data.routes || !data.routes[0].legs) return;

        const allPoints = data.routes[0].legs[0].points.map(p => [p.longitude, p.latitude]);
        const sections = data.routes[0].sections || [];
        const routeFeatures = [];

        // 4. Lückenlose Linien & Baustellen verarbeiten
        
        // A: Die gesamte Route als Basis-Linie (Blau)
        if (allPoints.length > 1) {
            routeFeatures.push({
                type: 'Feature',
                properties: { color: '#007aff' },
                geometry: { type: 'LineString', coordinates: allPoints }
            });
        }

        // B: Traffic-Overlays (Nur Farben, keine Fake-Icons)
        sections.forEach(section => {
            const start = section.startPointIndex;
            const end = section.endPointIndex;

            if (typeof start !== 'number' || typeof end !== 'number') return;

            const segmentCoords = allPoints.slice(start, end + 1);
            if (segmentCoords.length < 2) return;

            // Farben für Stau & zähfließenden Verkehr
            let color = null; 
            if (section.sectionType === 'TRAFFIC') {
                if (section.simpleCategory === 'JAM') color = '#ff3b30'; // Rot
                else if (section.simpleCategory === 'SLOW') color = '#ffcc00'; // Gelb
            }

            if (color) {
                routeFeatures.push({
                    type: 'Feature',
                    properties: { color: color },
                    geometry: { type: 'LineString', coordinates: segmentCoords }
                });
            }
        });

        if (routeFeatures.length === 0) return;

        // 5. Source & Layer Update
        if (!libreMap.getSource('simple-route-source')) {
            libreMap.addSource('simple-route-source', {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: routeFeatures }
            });
        } else {
            libreMap.getSource('simple-route-source').setData({
                type: 'FeatureCollection',
                features: routeFeatures
            });
        }

        if (!libreMap.getLayer('simple-route-layer')) {
            libreMap.addLayer({
                id: 'simple-route-layer',
                type: 'line',
                source: 'simple-route-source',
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: { 
                    'line-color': ['get', 'color'], 
                    'line-width': 6 
                }
            });
        }

        // 6. Ziel-Marker
        if (destMarker) destMarker.remove();
        const elDest = document.createElement('div');
        elDest.className = 'dest-marker';
        elDest.style.width = '18px'; elDest.style.height = '18px';
        elDest.style.background = '#30d158'; elDest.style.border = '3px solid white';
        elDest.style.borderRadius = '50%'; elDest.style.boxShadow = '0 0 15px rgba(48, 209, 88, 0.8)';
        
        destMarker = new maplibregl.Marker({ element: elDest }).setLngLat([destLng, destLat]).addTo(libreMap);

 // 7. UI Daten befüllen
        const summary = data.routes[0].summary;
        const arrivalDate = new Date(Date.now() + summary.travelTimeInSeconds * 1000);
        
        document.getElementById('route-info-time').textContent = `${Math.round(summary.travelTimeInSeconds / 60)} Min`;
        document.getElementById('route-info-dist').textContent = `${(summary.lengthInMeters / 1000).toFixed(1)} km`;
        document.getElementById('route-info-arrival').textContent = arrivalDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

        // NEU: Zielort in die grüne Pille eintragen
        const destNameDisplay = document.getElementById('dest-name-display');
        const searchInput = document.getElementById('tomtom-search-input');
        if (destNameDisplay && searchInput) {
            // Wir nehmen den Text aus der Suchleiste. Falls leer, Fallback auf "Zielort".
            destNameDisplay.textContent = searchInput.value || "Zielort";
        }

        if (routeUI) routeUI.classList.remove('hidden');
        if (pillV) pillV.style.display = 'none';

 // 8. Kamera-Zoom (Idle-Event für Stabilität)
        const bounds = new maplibregl.LngLatBounds();
        allPoints.forEach(coord => bounds.extend(coord));
        
        libreMap.resize();
        libreMap.once('idle', () => {
            libreMap.fitBounds(bounds, { 
                padding: { 
                    top: 120, 
                    bottom: 450, /* FIX: Massiv erhöht, damit die Route sicher über der Card schwebt */
                    left: 60, 
                    right: 60 
                }, 
                duration: 1000 
            });
        });

    } catch (error) {
        console.error("Routing Fehler:", error);
    }
}


function clearRoutes() {
    // 1. Linie entfernen
    if (libreMap && libreMap.getLayer('simple-route-layer')) {
        libreMap.removeLayer('simple-route-layer');
        libreMap.removeSource('simple-route-source');
    }

    // 2. Grünen Ziel-Marker entfernen
    if (destMarker) {
        destMarker.remove();
        destMarker = null;
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
    // === NEUE CANCEL ROUTE LOGIK (X-BUTTON IN CARD) ===
    // ==========================================
    const btnCancelRouteNew = document.getElementById('btn-cancel-route-new');
    if (btnCancelRouteNew) {
        btnCancelRouteNew.addEventListener('click', (e) => {
            e.stopPropagation();

            // 1. Linie und Marker restlos löschen
            if (typeof clearRoutes === 'function') clearRoutes();
            
            // 2. Card unten ausblenden
            const routeOverviewUI = document.getElementById('route-overview-ui');
            if (routeOverviewUI) routeOverviewUI.classList.add('hidden');
            
            // 3. UI wiederherstellen (Pillen und Search)
            const bottomSheet = document.getElementById('map-bottom-sheet');
            if (bottomSheet) bottomSheet.style.display = 'flex';
            
            const pillV = document.querySelector('.map-controls-pill-v');
            if (pillV) pillV.style.display = 'flex';
            
            // 4. Suchfeld leeren
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
            
            // 6. Zurück zum eigenen Standort fliegen
            if (currentCoords && libreMap) {
                libreMap.flyTo({ center: currentCoords, zoom: 14, pitch: 0, bearing: 0, speed: 1.5, essential: true });
            }
        });
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

}); // <-- Dies ist die allerletzte Klammer deiner Datei (schließt den DOMContentLoaded)
