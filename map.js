document.addEventListener('DOMContentLoaded', () => {

    // === BOSS-FIX 1: SERVICE WORKER REGISTRIEREN ===
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('Service Worker registriert!'))
        .catch(err => console.error('Service Worker Fehler:', err));
    }

    // === BOSS-FIX 2: ALARM-LOGIK STARTEN ===
    setTimeout(initPriceAlarm, 500); // Wartet kurz, bis das HTML sicher da ist


    // ... hier geht dein normaler Code weiter ...
    const btnNewExplore = document.getElementById('nav-new-explore');
    const newExploreScreen = document.getElementById('new-explore-screen');
    const allNavItems = document.querySelectorAll('.nav-item');
    const mapContainerId = 'maplibre-snippet';

    // Globale MapLibre Instanz
    let libreMap = null;
    let destMarker = null; // Nur einmal definieren!
    let currentCoords = null; 
    let navWatchId = null; // <-- NEU: Hier speichern wir den Motor

    let ttsAudioPlayer = new Audio();

// --- BOSS-FEATURE: TRAFFIC LIGHT ENGINE STATE ---
    window.trafficLightMarkers = []; 
    window.knownTrafficLightNodes = new Set();


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
            if (window.ExploreLogic) window.ExploreLogic.init();
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

// 1. Standorterkennung (BOSS-FIX: Hardcore 3uTools Waiter - KEIN FALLBACK)
        console.log("Warte auf 3uTools GPS-Signal... KEIN NÜRNBERG FALLBACK MEHR!");

        const options = {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: Infinity // Wir warten bis zum bitteren Ende! Keine Kompromisse.
        };

        const huntWatchId = navigator.geolocation.watchPosition(
            (position) => {
                const userCoords = [position.coords.longitude, position.coords.latitude];

                // Sobald wir ECHTE Koordinaten haben und die Karte noch nicht geladen ist
                if (!libreMap && userCoords[0] !== 0 && userCoords[1] !== 0) {
                    console.log("BOOM! 3uTools Standort gefangen:", userCoords);
                    navigator.geolocation.clearWatch(huntWatchId); // Motor stoppen, Karte laden
                    loadMap(userCoords, true);
                }
            },
            (error) => {
                // Wir loggen den Fehler nur, aber wir geben NICHT auf und setzen KEINEN Default-Standort.
                console.warn("GPS wartet weiter... Error:", error.message);
            },
            options
        );
    }
function loadMap(coords, hasLocation) {
    // 1. Standort sichern
    currentCoords = coords; 

const TOMTOM_API_KEY = 'qUXu7VMUc8RMDm7pkiItGa6WUsqWfFUM';

    libreMap = new maplibregl.Map({
        container: mapContainerId,
        style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: coords,
        zoom: 14,
        interactive: true,
        dragRotate: true,
        attributionControl: false,
   // --- DER BOSS-FIX: Der Interceptor hängt den API-Key an jedes TomTom-Icon! ---
        transformRequest: (url, resourceType) => {
            if (url.includes('api.tomtom.com') && !url.includes('key=')) {
                return { url: url + (url.includes('?') ? '&' : '?') + 'key=' + TOMTOM_API_KEY };
            }
            return { url };
        }
    });


   // --- BLAUER PUNKT (Zwingend zeichnen, Original-Klassen nutzen!) ---
    const customMarkerElement = document.createElement('div');
    customMarkerElement.className = 'user-marker-wrap';
    customMarkerElement.innerHTML = `
        <div class="user-pulse"></div>
        <div class="user-dot"></div>
    `;
// NEU:
    window.userLocationMarker = new maplibregl.Marker({ 
        element: customMarkerElement,
        pitchAlignment: 'map',    // <-- BOSS-FIX: Legt den Marker flach auf die 3D-Karte!
        rotationAlignment: 'map'  // <-- BOSS-FIX: Dreht den Pfeil synchron zur Karte!
    })
    .setLngLat(coords)
    .addTo(libreMap);
// === BOSS-FIX: DYNAMISCHER ZOOM-WÄCHTER (COMPACT MARKERS) ===
        // Überwacht jeden einzelnen Frame beim Zoomen
        libreMap.on('zoom', () => {
            const currentZoom = libreMap.getZoom();
            const mapEl = document.getElementById(mapContainerId);
            if (!mapEl) return;

            // Ab Zoom-Level 14.2 abwärts klappen wir die Preise ein!
            // (Du kannst diesen Wert perfektionieren: 14.5 ist näher dran, 13.5 weiter weg)
            if (currentZoom < 12) {
                mapEl.classList.add('map-compact-mode');
            } else {
                mapEl.classList.remove('map-compact-mode');
            }
        });

        // Einmaliger Check direkt beim Start, falls die Karte schon rausgezoomt startet
        libreMap.once('idle', () => {
            const mapEl = document.getElementById(mapContainerId);
            if (mapEl && libreMap.getZoom() < 12) {
                mapEl.classList.add('map-compact-mode');
            }
        });
        // ============================================================
// 4. Restliche Einstellungen laden
   libreMap.on('load', () => {
       libreMap.setPadding({ right: 150, bottom: 20 });

       // --- 3D-GEBÄUDE LOGIK (ZURÜCK AN IHREM ALTEN, STABILEN PLATZ!) ---
       if (window.currentPoiMode !== 'explore') {
           const initialTheme = window.currentMapTheme || 'dark';
           const buildingColor = initialTheme === 'grey' ? '#a0a0a0' : '#2a2a2a';
           const buildingOpacity = initialTheme === 'grey' ? 1.0 : 0.8;

           libreMap.addLayer({
               'id': '3d-buildings',
               'source': 'carto',
               'source-layer': 'building',
               'type': 'fill-extrusion',
               'minzoom': 14, // Auf 14 gesetzt, damit sie sofort beim Start sichtbar sind!
               'paint': {
                   'fill-extrusion-color': buildingColor,
                   'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.5, ['get', 'render_height']],
                   'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.5, ['get', 'render_min_height']],
                   'fill-extrusion-opacity': buildingOpacity
               }
           });
       }

       libreMap.dragPan.disable();
       libreMap.scrollZoom.disable();
       libreMap.touchZoomRotate.disable();
       libreMap.doubleClickZoom.disable();

       if (libreMap.dragRotate) libreMap.dragRotate.disable();
   });

// ==========================================
    // === POI CLICK & INFO LOGIC (NUR EXPLORE MODE!) ===
    // ==========================================
    libreMap.on('click', async (e) => {
        // BOSS-REGEL: Absolutes Verbot im Clean Mode!
        if (window.currentPoiMode !== 'explore') return;

        // Prüfen, ob wir auf einen Text/Icon (POI) geklickt haben
        const features = libreMap.queryRenderedFeatures(e.point);
        const clickedPoi = features.find(f => f.layer.type === 'symbol' && f.properties && f.properties.name);

        if (!clickedPoi) return; // Wenn man daneben klickt, passiert nichts.

        const poiName = clickedPoi.properties.name;
        const coords = e.lngLat;

        // 1. Schickes Lade-Popup erstellen
        if (!window.poiPopup) {
            window.poiPopup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, offset: 15, maxWidth: '280px' });
        }

        window.poiPopup.setLngLat(coords)
            .setHTML(`<div style="font-family: sans-serif; color: #1c1c1e; padding: 5px;">
                        <strong style="font-size: 15px;">${poiName}</strong><br>
                        <span style="font-size: 12px; color: #666;">Lade Live-Daten...</span>
                      </div>`)
            .addTo(libreMap);

        // 2. Blitz-Call an die TomTom API für exakte Details an dieser Koordinate
        try {
            const url = `https://api.tomtom.com/search/2/poiSearch/${encodeURIComponent(poiName)}.json?key=${TOMTOM_API_KEY}&lat=${coords.lat}&lon=${coords.lng}&radius=50`;
            const res = await fetch(url);
            const data = await res.json();

            let infoHtml = `<div style="font-family: sans-serif; color: #1c1c1e; padding: 5px;">
                                <strong style="font-size: 15px;">${poiName}</strong>`;

            if (data.results && data.results.length > 0) {
                const bestResult = data.results[0];

                // Adresse
                if (bestResult.address && bestResult.address.freeformAddress) {
                    infoHtml += `<div style="font-size: 12px; color: #555; margin-top: 4px; margin-bottom: 6px;">${bestResult.address.freeformAddress}</div>`;
                }

                // TomTom Kategorie (z.B. "SUPERMARKET" oder "PETROL STATION")
                if (bestResult.poi && bestResult.poi.categories && bestResult.poi.categories.length > 0) {
                    infoHtml += `<div style="font-size: 10px; font-weight: 700; color: #30d158; text-transform: uppercase; letter-spacing: 0.5px;">${bestResult.poi.categories[0]}</div>`;
                }

                // Telefonnummer (falls vorhanden)
                if (bestResult.poi && bestResult.poi.phone) {
                    infoHtml += `<div style="font-size: 13px; color: #1c1c1e; margin-top: 6px;">📞 ${bestResult.poi.phone}</div>`;
                }

                // URL (falls vorhanden)
                if (bestResult.poi && bestResult.poi.url) {
                    infoHtml += `<div style="font-size: 13px; margin-top: 4px;"><a href="http://${bestResult.poi.url}" target="_blank" style="color: #007aff; text-decoration: none;">🌐 Webseite besuchen</a></div>`;
                }
            } else {
                infoHtml += `<div style="font-size: 12px; color: #888; margin-top: 4px;">Keine weiteren Live-Details verfügbar.</div>`;
            }

            infoHtml += `</div>`;

            // Popup mit echten Daten füllen
            window.poiPopup.setHTML(infoHtml);

        } catch (error) {
            console.error("POI Fetch Error:", error);
            window.poiPopup.setHTML(`<div style="font-family: sans-serif; color: #1c1c1e; padding: 5px;">
                                        <strong style="font-size: 15px;">${poiName}</strong><br>
                                        <span style="font-size: 12px; color: #ff3b30;">Keine Internetverbindung</span>
                                     </div>`);
        }
    });

    // --- Mauszeiger-Logik (Optional, aber Premium) ---
    // Zeigt eine Hand, wenn man im Explore-Modus mit der Maus über ein Geschäft fährt
// --- NEU: POI-RADAR BEIM BEWEGEN DER KARTE ---

    // --- NEU: GESPEICHERTES THEME & POI-MODUS LADEN ---
    setTimeout(() => { 
        if (libreMap) libreMap.resize(); 

        const themeOptions = document.querySelectorAll('.theme-option');
        if (themeOptions.length > 0) {
            themeOptions.forEach(opt => opt.classList.remove('active'));
            const activeOpt = document.querySelector(`.theme-option[data-theme="${window.currentMapTheme}"]`);
            if (activeOpt) activeOpt.classList.add('active');
        }

        const poiOptions = document.querySelectorAll('.poi-option');
        if (poiOptions.length > 0) {
            poiOptions.forEach(opt => opt.classList.remove('active'));
            const activePoiOpt = document.querySelector(`.poi-option[data-poi="${window.currentPoiMode}"]`);
            if (activePoiOpt) activePoiOpt.classList.add('active');
        }

        window.updateMapAppearance();
    }, 350);

    if (window.ExploreLogic) {
        window.ExploreLogic.fetchData();
    }

} // <--- DAS SAUBERE ENDE VON loadMap!
// ==========================================
    // === MAP EXPAND / SHRINK LOGIC ===
    // ==========================================
    const expandTrigger = document.getElementById('map-expand-trigger');
    const shrinkBtn = document.getElementById('btn-shrink-map');
    const mapCard = document.querySelector('.map-snippet-card');

    if (expandTrigger && shrinkBtn && mapCard) {

        // 1. Karte groß machen (Fullscreen)
        expandTrigger.addEventListener('click', () => {
            if (mapSettingsBtn) mapSettingsBtn.classList.remove('hidden');
            mapCard.classList.add('map-expanded');
            expandTrigger.style.display = 'none'; // Klickscheibe wegnehmen

            // Nav-Bar ausblenden
            const bottomNav = document.querySelector('.bottom-nav');
            if (bottomNav) bottomNav.style.display = 'none';

            // BOSS-FIX: Suchleiste Oben nur im Fullscreen einblenden!
            const topSearch = document.getElementById('top-search-container');
            if (topSearch) topSearch.style.display = 'flex';

            if (libreMap) {
                libreMap.dragPan.enable();
                libreMap.scrollZoom.enable();
                libreMap.touchZoomRotate.enable();
                libreMap.doubleClickZoom.enable();
                if (libreMap.dragRotate) libreMap.dragRotate.enable(); 
                libreMap.setPadding({ right: 0, bottom: 0 });
                setTimeout(() => libreMap.resize(), 400); 
            }
        });

        // 2. Karte wieder klein machen
        shrinkBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 

            if (mapSettingsBtn) mapSettingsBtn.classList.add('hidden');
            if (mapSettingsOverlay) mapSettingsOverlay.classList.add('hidden');

            mapCard.classList.remove('map-expanded');
            expandTrigger.style.display = 'block';

            // BOSS-FIX: Suchleiste wieder ausblenden
            const topSearch = document.getElementById('top-search-container');
            if (topSearch) topSearch.style.display = 'none';

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

    // BOSS-FIX: Referenz zur Suchleiste
    const topSearch = document.getElementById('top-search-container');

    if (shrinkBtn) {
        shrinkBtn.style.opacity = '0'; 
        shrinkBtn.style.pointerEvents = 'none';
    }

    if (document.querySelector('.map-snippet-card')) document.querySelector('.map-snippet-card').classList.add('map-expanded');
    document.getElementById('map-expand-trigger').style.display = 'none';

    const navBar = document.querySelector('.bottom-nav');
    if (navBar) navBar.style.display = 'none';
    if (mapSettingsBtn) mapSettingsBtn.classList.add('hidden');
    if (mapSettingsOverlay) mapSettingsOverlay.classList.add('hidden');

    // BOSS-FIX: Suchleiste oben wegschießen, wenn Route angezeigt wird!
    if (topSearch) topSearch.style.display = 'none';

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
        // === BOSS-FIX: HEADING PARAMETER ===
        let headingParam = "";
        if (typeof window.lastHeading !== 'undefined' && window.lastHeading !== null) {
            headingParam = `&vehicleHeading=${Math.round(window.lastHeading)}`;
        }

        // === DIE OFFIZIELLE TOMTOM-SUPPORT URL ===
        // 1. Zweimal sectionType (einmal traffic, einmal lanes) - KEINE KOMMAS!
        // 2. instructionAnnouncementPoints=all (Für perfekte Sprach-Timings)
        // 3. instructionRoadShieldReferences=all (Für deutsche Autobahnschilder)
        const url = `https://api.tomtom.com/routing/1/calculateRoute/${startLat},${startLng}:${destLat},${destLng}/json?key=${TOMTOM_API_KEY}&traffic=true&sectionType=traffic&sectionType=lanes&maxAlternatives=1&instructionsType=text&instructionAnnouncementPoints=all&instructionRoadShieldReferences=all&language=de-DE${headingParam}`;

        console.log("🚀 Lade Route mit offiziellen Support-Parametern...");
        const response = await fetch(url);

        if (!response.ok) {
            const err = await response.json();
            alert("TomTom 400 Fehler: " + (err.detailedError?.message || JSON.stringify(err)));
            return;
        }

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
            RouteLogic.routeTimesData[index] = route.summary.travelTimeInSeconds;
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
            // --- NEU: ECHTE STRAßENMETER VORBERECHNEN ---
            const cumulativeDists = [0];
            let currentDist = 0;
            for (let k = 1; k < allPoints.length; k++) {
                // Wir messen die kurzen Stücke zwischen jedem TomTom-Punkt
                currentDist += calculateDistance(allPoints[k-1][1], allPoints[k-1][0], allPoints[k][1], allPoints[k][0]);
                cumulativeDists.push(currentDist);
            }
            RouteLogic.routeCumulativeDistances[index] = cumulativeDists;



// --- BOSS-FIX: BEIDE GEHIRNE SPEICHERN (MULTI-ROUTE AWARENESS) ---
            // Wir speichern nicht mehr nur Index 0 ab, sondern laden ALLE verfügbaren
            // Routen in Arrays, damit wir beim Klick später umschalten können!
            if (!RouteLogic.allInstructions) RouteLogic.allInstructions = [];
            if (!RouteLogic.allLaneSections) RouteLogic.allLaneSections = [];

            if (route.guidance && route.guidance.instructions) {
                RouteLogic.allInstructions[index] = route.guidance.instructions;
            } else {
                RouteLogic.allInstructions[index] = [];
            }

            if (route.sections) {
                RouteLogic.allLaneSections[index] = route.sections.filter(s => s.sectionType === 'LANES');
            } else {
                RouteLogic.allLaneSections[index] = [];
            }

            // Für den ersten Start setzen wir standardmäßig alles auf Route 0
            if (index === 0) {
                RouteLogic.currentInstructions = RouteLogic.allInstructions[0];
                RouteLogic.currentLaneSections = RouteLogic.allLaneSections[0];
                RouteLogic.currentInstructionIndex = 0;
            }

          // Im Objekt speichern für späteres Umschalten (Aktiv/Grau)
            RouteLogic.routeGeoJSONs[index] = routeFeatures;

            // --- BOSS-FIX: ASPHALT-INTEGRATION (Route unter Gebäude & Texte schieben) ---
            let beforeLayerId = null;
            const layers = libreMap.getStyle().layers;
            if (layers) {
                for (let i = 0; i < layers.length; i++) {
                    // Wir suchen die erste Ebene, die Text oder Symbole (Straßennamen) enthält
                    if (layers[i].type === 'symbol') {
                        beforeLayerId = layers[i].id;
                        break;
                    }
                }
            }
            // Wenn die 3D-Gebäude da sind, legen wir die Route zwingend auch darunter!
            if (libreMap.getLayer('3d-buildings')) {
                beforeLayerId = '3d-buildings';
            }

            // Layer sofort anlegen
            const sourceId = `route-source-${index}`;
            const layerId = `route-layer-${index}`;

            libreMap.addSource(sourceId, {
                type: 'geojson',
                data: { type: 'FeatureCollection', features: routeFeatures }
            });

            // Wir zeichnen jetzt einen perfekten, sauberen Layer (und keine doppelten IDs mehr)
            libreMap.addLayer({
                id: layerId,
                type: 'line',
                source: sourceId,
                layout: { 
                    'line-join': 'round', 
                    'line-cap': 'round' 
                },
                paint: { 
                    'line-color': ['get', 'color'], 
                    // Traffic-Linien minimal dicker machen, damit das Blau an den Rändern nicht durchblitzt
                    'line-width': ['case', ['==', ['get', 'isTraffic'], true], 7, 6] 
                }
            }, beforeLayerId); // <--- HIER WIRD DIE ROUTE UNTER DEN ASPHALT GEDRÜCKT!
            // ============================================================================
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
                RouteLogic.routeDistances[0], 
                RouteLogic.routeTimesData[0] 
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

    // 4. Den Multi-Route Zwischenspeicher leeren
    if (window.RouteLogic) {
        window.RouteLogic.routeGeoJSONs = [null, null];
    }

    // BOSS-FEATURE: Ampeln von der Karte putzen
    if (window.trafficLightMarkers) {
        window.trafficLightMarkers.forEach(m => m.remove());
        window.trafficLightMarkers = [];
    }
    if (window.knownTrafficLightNodes) {
        window.knownTrafficLightNodes.clear();
    }
} // <--- Das ist die schließende Klammer von clearRoutes()





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
    // === CENTRAL MAP STYLE ENGINE (THEME + POI) ===
    // ==========================================
    window.currentMapTheme = localStorage.getItem('mapTheme') || 'dark'; 
    window.currentPoiMode = localStorage.getItem('mapPoiMode') || 'clean';
    window.loadedStyleUrl = null;

    window.updateMapAppearance = async function() {
        if (!libreMap) return;

        let activeTheme = window.currentMapTheme;
        if (activeTheme === 'auto') {
            try {
                const lat = currentCoords ? currentCoords[1] : 51.16;
                const lon = currentCoords ? currentCoords[0] : 10.45;
                const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=is_day`);
                if (res.ok) {
                    const data = await res.json();
                    activeTheme = data.current.is_day ? 'grey' : 'dark';
                } else throw new Error("API fail");
            } catch (e) {
                const hour = new Date().getHours();
                activeTheme = (hour >= 7 && hour < 19) ? 'grey' : 'dark';
            }
        }

        let styleUrl = '';
        if (window.currentPoiMode === 'explore') {
            const ttStyle = activeTheme === 'grey' ? 'basic_main' : 'basic_night';
            styleUrl = `https://api.tomtom.com/map/1/style/22.2.1-9/${ttStyle}.json`;
        } else {
            styleUrl = activeTheme === 'grey' 
                ? 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'
                : 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
        }

        if (window.loadedStyleUrl === styleUrl) {
            applyPoiVisibility();
            return;
        }

        window.loadedStyleUrl = styleUrl;
        libreMap.setStyle(styleUrl);


    libreMap.once('styledata', () => {
            restore3DBuildings(activeTheme);
            restoreRoutes();
        });

    };

    function applyPoiVisibility() {
        if (window.currentPoiMode === 'explore') return; 

        const layers = libreMap.getStyle().layers;
        if (!layers) return;

        layers.forEach(layer => {
            if (layer.type === 'symbol') {
                const id = layer.id.toLowerCase();
                const sourceLayer = layer['source-layer'] ? layer['source-layer'].toLowerCase() : '';
                const isPoi = id.includes('poi') || id.includes('amenity') || id.includes('shop') || id.includes('tourism') || sourceLayer.includes('poi');

                if (isPoi && libreMap.getLayer(layer.id)) {
                    libreMap.setLayoutProperty(layer.id, 'visibility', 'none');
                }
            }
        });
    }

function restore3DBuildings(activeTheme) {
        if (window.currentPoiMode === 'explore') return; // TomTom hat eigene Gebäude
        if (libreMap.getLayer('3d-buildings')) return;

        // Dein altes, funktionierendes Design (mit sanftem Interpolate)
        const buildingColor = activeTheme === 'grey' ? '#a0a0a0' : '#2a2a2a';
        const buildingOpacity = activeTheme === 'grey' ? 1.0 : 0.8;

        // Wir jagen den Layer direkt in die Karte, so wie in deiner alten Version
        libreMap.addLayer({
            'id': '3d-buildings',
            'source': 'carto',
            'source-layer': 'building',
            'type': 'fill-extrusion',
            'minzoom': 14, // Ab Zoom 14 sichtbar
            'paint': {
                'fill-extrusion-color': buildingColor,
                'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.5, ['get', 'render_height']],
                'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.5, ['get', 'render_min_height']],
                'fill-extrusion-opacity': buildingOpacity
            }
        });
    }

function restoreRoutes() {
        if (!window.RouteLogic || !window.RouteLogic.routeGeoJSONs) return;

        // BOSS-FIX: Auch beim Theme-Wechsel die Route unter den Asphalt legen!
        let beforeLayerId = null;
        const layers = libreMap.getStyle().layers;
        if (layers) {
            for (let i = 0; i < layers.length; i++) {
                if (layers[i].type === 'symbol') { 
                    beforeLayerId = layers[i].id; 
                    break; 
                }
            }
        }
        if (libreMap.getLayer('3d-buildings')) beforeLayerId = '3d-buildings';

        window.RouteLogic.routeGeoJSONs.forEach((features, index) => {
            if (!features) return;
            const sourceId = `route-source-${index}`;
            const layerId = `route-layer-${index}`;

            if (!libreMap.getSource(sourceId)) {
                libreMap.addSource(sourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: features } });
            }
            if (!libreMap.getLayer(layerId)) {
                libreMap.addLayer({
                    id: layerId, 
                    type: 'line', 
                    source: sourceId,
                    layout: { 'line-join': 'round', 'line-cap': 'round' },
                    paint: { 'line-color': ['get', 'color'], 'line-width': ['case', ['==', ['get', 'isTraffic'], true], 7, 6] }
                }, beforeLayerId); // <-- Hier exakt eingefügt!
            }
        });
        window.RouteLogic.updateMapLayers();
    }

    setInterval(() => {
        if (window.currentMapTheme === 'auto') window.updateMapAppearance();
    }, 15 * 60 * 1000);
    // ==========================================
    // === DYNAMIC CUSTOM POI ENGINE (KAUFLAND-GARANTIE) ===
    // ==========================================
    let poiSourceId = "custom-tomtom-pois";
    let poiLayerId = "custom-tomtom-pois-layer";
    window.poiCooldown = null;


    // ==========================================
    // === MAP SETTINGS MENÜ (3 STRICHE & BLUR) ===
    // ==========================================
    const mapSettingsBtn = document.getElementById('map-settings-btn');
    const mapSettingsOverlay = document.getElementById('map-settings-overlay');
    const themeOptions = document.querySelectorAll('.theme-option');

    if (mapSettingsBtn && mapSettingsOverlay) {
        // Klick auf die 3 Striche (Menü öffnen/schließen)
        mapSettingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            mapSettingsOverlay.classList.toggle('hidden');
        });

// Klick auf Theme (Dark / Grey / Auto)
        themeOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                themeOptions.forEach(opt => opt.classList.remove('active'));
                option.classList.add('active');

                window.currentMapTheme = option.getAttribute('data-theme');
                localStorage.setItem('mapTheme', window.currentMapTheme);
                window.updateMapAppearance(); // <-- Engine triggern!
            });
        });

        // Klick auf POI Details (Clean / Explore)
        const poiOptions = document.querySelectorAll('.poi-option');
        if (poiOptions.length > 0) {
            poiOptions.forEach(option => {
                option.addEventListener('click', (e) => {
                    e.stopPropagation();
                    poiOptions.forEach(opt => opt.classList.remove('active'));
                    option.classList.add('active');

                    window.currentPoiMode = option.getAttribute('data-poi');
                    localStorage.setItem('mapPoiMode', window.currentPoiMode);
                    window.updateMapAppearance(); // <-- Engine triggern!
                });
            });
        }

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

            if (mapSettingsBtn) mapSettingsBtn.classList.add('hidden');
            if (mapSettingsOverlay) mapSettingsOverlay.classList.add('hidden');

            // 0. GPS MOTOR ABWÜRGEN
            if (navWatchId !== null) {
                navigator.geolocation.clearWatch(navWatchId);
                navWatchId = null;
            }
            // HUD Speed wieder auf 0 setzen
            const speedDisplay = document.getElementById('hud-current-speed');
            if (speedDisplay) speedDisplay.textContent = '0';

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

            // BOSS-FIX: Suchleiste wieder anzeigen!
            const topSearch = document.getElementById('top-search-container');
            if (topSearch) topSearch.style.display = 'flex';

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
    // === BOTTOM SHEET TOUCH LOGIC ===
    // ==========================================
    const bottomSheetElement = document.getElementById('map-bottom-sheet');

    if (bottomSheetElement) {
        let startY = 0;

        bottomSheetElement.addEventListener('touchstart', (e) => {
            startY = e.touches[0].clientY;
        }, { passive: true });

        bottomSheetElement.addEventListener('touchend', (e) => {
            let endY = e.changedTouches[0].clientY;
            let diff = startY - endY;

            if (diff > 30) {
                // Wisch nach oben -> Pille ausfahren
                bottomSheetElement.classList.add('expanded');
            } 
            else if (diff < -30) {
                // Wisch nach unten -> Pille einklappen
                bottomSheetElement.classList.remove('expanded');

                // Falls man unten wischt, auch die Tastatur oben schließen
                const topSearch = document.getElementById('tomtom-search-input');
                if (topSearch) topSearch.blur(); 
            }
        });
    }
// ==========================================
    // === PREMIUM GAS STATION ENGINE (TANKERKÖNIG) ===
    // ==========================================

    // Wir initialisieren den Sprit-Typ sicher (falls im LocalStorage Müll steht)
    let savedFuel = localStorage.getItem('preferredFuelType');
    if (savedFuel !== 'e10' && savedFuel !== 'e5' && savedFuel !== 'diesel') {
        savedFuel = 'e10'; // Fallback
    }

window.ExploreLogic = {
        apiKey: '448a2db3-bf39-415e-a763-8f889d8b31dd',
        mlMarkers: {}, 
        mapListenerBound: false, 
        cachedStations: [],
        currentFuelType: savedFuel,
        isActive: false,

        init: function() {
            // Menüs aus dem unsichtbaren Screen befreien
            const totemOverlay = document.getElementById('gas-totem-overlay');
            if (totemOverlay) document.body.appendChild(totemOverlay);

            const filterModal = document.getElementById('gas-filter-modal');
            if (filterModal) document.body.appendChild(filterModal);

            // --- BOSS-FIX: Wir reißen die Klicks an uns, damit die alte explore.js ignoriert wird! ---
            const rowDiesel = document.getElementById('row-diesel');
            const rowE10 = document.getElementById('row-e10');
            const rowE5 = document.getElementById('row-e5');
            const closeBtn = document.querySelector('.totem-close');

            if (rowDiesel) rowDiesel.onclick = (e) => { e.stopPropagation(); this.selectFuel('diesel'); };
            if (rowE10) rowE10.onclick = (e) => { e.stopPropagation(); this.selectFuel('e10'); };
            if (rowE5) rowE5.onclick = (e) => { e.stopPropagation(); this.selectFuel('e5'); };
            if (closeBtn) closeBtn.onclick = (e) => { e.stopPropagation(); this.closeTotem(); };
            // -----------------------------------------------------------------------------------------

            const btnGas = document.getElementById('btn-sheet-gas');
            if (btnGas) {
                btnGas.addEventListener('click', (e) => {
                    e.stopPropagation();

                    const bottomSheet = document.getElementById('map-bottom-sheet');
                    const searchInput = document.getElementById('tomtom-search-input');
                    if (bottomSheet) bottomSheet.classList.remove('expanded');
                    if (searchInput) searchInput.blur();

             this.isActive = !this.isActive;
                 if (this.isActive) {
                        btnGas.classList.add('active-orange');

                        // === BOSS-FIX: ZEICHNEN STATT LADEN ===
                        // Wenn wir schon Daten haben, zeichnen wir sofort.
                        // Wenn nicht (z.B. weil das GPS lahmte), feuern wir doch noch einen Fetch ab.
                        if (this.cachedStations && this.cachedStations.length > 0) {
                            this.redrawMarkers();
                        } else {
                            this.fetchData();
                        }
                        // ======================================

                    } else {
                        btnGas.classList.remove('active-orange');
                        this.clearMarkers();
                        this.closeTotem();
                    }
                });
            }

           // === BOSS-FIX: SILENT FETCH & DAUERHAFTES DASHBOARD ===
            // 1. Zwingt das Dashboard sofort in den Lade-Modus (zeigt den Spinner)
            this.updateDashboard(); 



        }, // <--- Hier endet die init-Funktion


 clearMarkers: function() {
            if (this.mlMarkers) {
                // Objekt-Werte (Marker) durchlaufen und hart löschen
                Object.values(this.mlMarkers).forEach(m => m.remove());
                this.mlMarkers = {};
            }
        },
fetchData: async function() {
            if (!libreMap) return; // currentCoords Check entfernt, da wir jetzt die Map nutzen
            const loader = document.getElementById('map-loading');
            if (loader) loader.classList.add('visible');

            // === BOSS-FIX: DYNAMISCHES RADAR ===
            if (!this.mapListenerBound) {
                // Wenn die Karte bewegt wird, müssen wir NEUE Daten vom Server holen!
                libreMap.on('moveend', () => { if (this.isActive) this.fetchData(); });
                // Beim reinen Zoomen reicht es, die bestehenden neu zu skalieren
                libreMap.on('zoomend', () => { if (this.isActive) this.redrawMarkers(); });
                this.mapListenerBound = true;
            }

            try {
                // === BOSS-FIX: KARTEN-MITTE STATT KÖRPER-GPS ===
                // Wir scannen jetzt immer dort, wo du gerade hinschaust!
                const center = libreMap.getCenter();
                const lat = center.lat;
                const lng = center.lng;

                // Wir suchen 15km um den sichtbaren Kartenausschnitt
                let tkRadius = 15; 

                const tkUrl = `https://creativecommons.tankerkoenig.de/json/list.php?lat=${lat}&lng=${lng}&rad=${tkRadius}&sort=dist&type=all&apikey=${this.apiKey}`;

                const response = await fetch(tkUrl);
                // ... ab hier geht dein Code mit "const data = await response.json();" exakt so weiter wie bisher!
                const data = await response.json();
                if(loader) loader.classList.remove('visible');

                if (data.ok && data.stations) {
                    this.cachedStations = data.stations.map(st => {

                        // BOSS-FIX: Radikaler Schnitt! Nur die reine Marke, sonst nichts.
                        let pureBrand = "TANK";
                        if (st.brand && st.brand.trim() !== "") {
                            pureBrand = st.brand.trim().toUpperCase();
                        } else if (st.name) {
                            // Fallback: Falls die Marke leer ist, nehmen wir knallhart nur das allererste Wort des Namens
                            pureBrand = st.name.trim().split(' ')[0].toUpperCase();
                        }

                        // Letztes Sicherheitsnetz fürs UI-Design (maximal 12 Zeichen)
                        //if (pureBrand.length > 12) pureBrand = pureBrand.substring(0, 10) + "..";//

                        return {
                            lat: st.lat,
                            lon: st.lng,
                            center: { lat: st.lat, lon: st.lng },
                            name: pureBrand, 
                            realData: st,
                            simPrices: {
                                e10: (typeof st.e10 === 'number') ? (Math.floor(st.e10 * 100) / 100).toFixed(2) : "-.--",
                                e5: (typeof st.e5 === 'number') ? (Math.floor(st.e5 * 100) / 100).toFixed(2) : "-.--",
                                diesel: (typeof st.diesel === 'number') ? (Math.floor(st.diesel * 100) / 100).toFixed(2) : "-.--",
                                isOpen: st.isOpen
                            }
                        };
                    });
                    this.redrawMarkers();
                    this.updateDashboard(); // BOSS-FIX: Dashboard updaten nach dem Laden!
                } else {
                    console.error("Tankerkönig API Fehler:", data.message);
                }
            } catch (err) {
                if (loader) loader.classList.remove('visible');
                console.error("Tankerkönig Fetch Error:", err);
            }
        },
 getBrandClass: function(name) {
            if (!name) return 'unknown';
            const n = name.toLowerCase();
            if(n.includes('aral')) return 'aral';
            if(n.includes('shell')) return 'shell';
            if(n.includes('esso')) return 'esso';
            if(n.includes('total')) return 'total';
            if(n.includes('jet')) return 'jet';
            if(n.includes('hem')) return 'hem';
            if(n.includes('avanti')) return 'avanti';

            // BOSS-FIX: Wenn wir die Marke nicht kennen, kriegt sie das Label 'unknown'
            return 'unknown'; 
        },

redrawMarkers: function() {
            // Wenn keine Daten da sind oder die Map nicht bereit ist -> Abbruch
            if (!this.cachedStations || !libreMap) return;

            // 1. Die sichtbaren Grenzen deines Bildschirms abrufen
            const bounds = libreMap.getBounds();

            this.cachedStations.forEach(el => {
                if (!el.lat || !el.lon) return;

                const stationKey = el.lat + "_" + el.lon;

                // 2. Ist die Tankstelle auf dem Bildschirm UND ist der Map-Button (isActive) an?
                const isVisibleAndActive = bounds.contains([el.lon, el.lat]) && this.isActive;

                if (isVisibleAndActive) {
                    // --- TANKSTELLE SOLL AUF DIE KARTE ---
                    if (!this.mlMarkers[stationKey]) {
                        // A) Neu erschaffen
                        const brandClass = this.getBrandClass(el.name);
                        let displayName = el.name ? el.name.replace(/Tankstelle|Station/gi, "").trim() : "TANK";
                        if (displayName.length > 10) displayName = displayName.substring(0, 9) + "..";
                        if (displayName === "") displayName = "TANK";

                        if (!el.simPrices) {
                            el.simPrices = { e10: "-.--", diesel: "-.--", e5: "-.--", isOpen: true };
                        }

                        let displayPrice = el.simPrices[this.currentFuelType] || "-.--";
                        const closedClass = (el.simPrices.isOpen === false) ? 'closed' : '';

                        const elDiv = document.createElement('div');
                        elDiv.className = 'custom-div-icon map-v2-icon'; 

                        elDiv.innerHTML = `
                            <div class="price-marker-wrap map-v2-marker ${closedClass}" style="cursor: pointer; transition: transform 0.1s;">
                                <div class="pm-brand-bar ${brandClass}">${displayName}</div>
                                <div class="pm-content">
                                    <div class="pm-price">${displayPrice}</div>
                                    <div class="pm-fuel-label">${this.currentFuelType.toUpperCase()}</div>
                                </div>
                            </div>
                        `;

                        elDiv.addEventListener('mouseenter', () => elDiv.firstChild.style.transform = 'scale(1.05)');
                        elDiv.addEventListener('mouseleave', () => elDiv.firstChild.style.transform = 'scale(1)');

                        elDiv.addEventListener('click', (e) => {
                            e.stopPropagation();
                            libreMap.flyTo({ 
                                center: [el.lon, el.lat], 
                                zoom: 15.5, 
                                speed: 1.2,
                                essential: true
                            });
                            this.openTotem(el.name, el.lat, el.lon, el);
                        });

                        const marker = new maplibregl.Marker({ element: elDiv, anchor: 'bottom' })
                            .setLngLat([el.lon, el.lat])
                            .addTo(libreMap);

                        this.mlMarkers[stationKey] = marker;
                    } else {
                        // B) Update (falls sich der Kraftstoff ändert)
                        const markerDiv = this.mlMarkers[stationKey].getElement();
                        const priceNode = markerDiv.querySelector('.pm-price');
                        const labelNode = markerDiv.querySelector('.pm-fuel-label');

                        if (priceNode) priceNode.innerText = el.simPrices[this.currentFuelType] || "-.--";
                        if (labelNode) labelNode.innerText = this.currentFuelType.toUpperCase();
                    }
                } else {
                    // --- 3. TANKSTELLE IST OUT-OF-BOUNDS ODER BUTTON IST AUS ---
                    if (this.mlMarkers[stationKey]) {
                        this.mlMarkers[stationKey].remove();
                        delete this.mlMarkers[stationKey];
                    }
                }
            });
        },

openTotem: function(name, lat, lng, elementRef) {
            const overlay = document.getElementById('gas-totem-overlay');
            const brandHeader = document.getElementById('totem-brand-header');

            // === BOSS-FIX: NUTZE BRAND STATT NAME FÜR MAXIMALE SAUBERKEIT ===
            // Wir priorisieren 'brand', weil dort keine Adresse drinsteht.
            let fullName = "Tankstelle";

            if (elementRef && elementRef.realData) {
                // Wenn die Marke existiert, nehmen wir sie. Wenn nicht, den Namen.
                fullName = elementRef.realData.brand || elementRef.realData.name || "Tankstelle";
            } else {
                fullName = name || "Tankstelle";
            }

            // Falls doch mal jemand "ARAL - Nuernberg" in die Marke schreibt, 
            // putzen wir nur kurz den Bindestrich weg:
            fullName = fullName.split(' - ')[0].trim();
            // ============================================================

            if (brandHeader) {
                brandHeader.className = 'totem-header ' + this.getBrandClass(fullName);
            }

            const brandTitle = document.querySelector('.v2-totem-overlay .totem-header h2');

            if (brandTitle) {
                brandTitle.innerText = fullName; 

                // Dynamische Skalierung bleibt zur Sicherheit
                const len = fullName.length;
                if (len > 20) brandTitle.style.fontSize = '1.0rem';
                else if (len > 14) brandTitle.style.fontSize = '1.2rem';
                else if (len > 10) brandTitle.style.fontSize = '1.4rem';
                else brandTitle.style.fontSize = '1.8rem';
            }

            const statusEl = document.getElementById('totem-status');
            // ... weiter wie im Original
            if (statusEl) statusEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> LOADING';

            if (overlay) overlay.classList.remove('hidden');

            if (overlay) {
                const goBtn = overlay.querySelector('.btn-navigate');
                if (goBtn) {
                    goBtn.onclick = () => {
                        this.closeTotem();
                        if (typeof drawTomTomRoute === 'function') drawTomTomRoute(lat, lng);
                    };
                }
            }

            if (this.apiKey && this.apiKey.length > 10) {
                const url = `https://creativecommons.tankerkoenig.de/json/list.php?lat=${lat}&lng=${lng}&rad=1.0&sort=dist&type=all&apikey=${this.apiKey}`;
                fetch(url).then(r => r.json()).then(data => {
                    if (data.ok && data.stations && data.stations.length > 0) {
                        const station = data.stations[0];
                        if(elementRef && elementRef.simPrices) {
                            elementRef.realData = station; 
                            elementRef.simPrices.isOpen = station.isOpen; 
                            if(station.diesel) elementRef.simPrices.diesel = (Math.floor(station.diesel * 100) / 100).toFixed(2);
                            if(station.e10) elementRef.simPrices.e10 = (Math.floor(station.e10 * 100) / 100).toFixed(2);
                            if(station.e5) elementRef.simPrices.e5 = (Math.floor(station.e5 * 100) / 100).toFixed(2);
                        }
                        this.updateTotemUI(station.isOpen, station.diesel, station.e10, station.e5);
                        this.redrawMarkers(); 
                    } else if (elementRef && elementRef.simPrices) { 
                        this.updateTotemUI(elementRef.simPrices.isOpen, elementRef.simPrices.diesel, elementRef.simPrices.e10, elementRef.simPrices.e5); 
                    }
                }).catch(e => {
                    console.log("Tankerkoenig Error", e);
                    if (elementRef && elementRef.simPrices) {
                        this.updateTotemUI(elementRef.simPrices.isOpen, elementRef.simPrices.diesel, elementRef.simPrices.e10, elementRef.simPrices.e5);
                    }
                });
            } else if (elementRef && elementRef.simPrices) {
                setTimeout(() => {
                    this.updateTotemUI(elementRef.simPrices.isOpen, elementRef.simPrices.diesel, elementRef.simPrices.e10, elementRef.simPrices.e5);
                }, 300);
            }
        },

        updateTotemUI: function(isOpen, diesel, e10, e5) {
            const statusEl = document.getElementById('totem-status');
            if (statusEl) {
                if (isOpen) {
                    statusEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> OPEN';
                    statusEl.style.color = '#30d158';
                } else {
                    statusEl.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> CLOSED';
                    statusEl.style.color = '#ff3b30';
                }
            }

            const pDiesel = document.getElementById('price-diesel');
            const pE10 = document.getElementById('price-e10');
            const pE5 = document.getElementById('price-e5');

            if (pDiesel) pDiesel.innerText = diesel ? (Math.floor(Number(diesel) * 100) / 100).toFixed(2) : "-.--";
            if (pE10) pE10.innerText = e10 ? (Math.floor(Number(e10) * 100) / 100).toFixed(2) : "-.--";
            if (pE5) pE5.innerText = e5 ? (Math.floor(Number(e5) * 100) / 100).toFixed(2) : "-.--";

            this.updateTotemSelectionUI();
        },

   selectFuel: function(type) {
            this.currentFuelType = type;
            localStorage.setItem('preferredFuelType', type); 

            this.updateTotemSelectionUI();
            this.redrawMarkers(); 
            this.updateDashboard(); // BOSS-FIX: Dashboard sofort neu sortieren bei Klick auf Diesel/E10!
        },

        updateTotemSelectionUI: function() {
            document.querySelectorAll('.price-row').forEach(r => r.classList.remove('selected'));
            const row = document.getElementById('row-' + this.currentFuelType);
            if (row) row.classList.add('selected');
        },

     closeTotem: function() {
            const overlay = document.getElementById('gas-totem-overlay');
            if (overlay) overlay.classList.add('hidden');
        }, // <--- WICHTIG: Hier nur ein Komma, kein "};" !

updateDashboard: function() {
            const dashboard = document.getElementById('gas-dashboard');
            const listContainer = document.getElementById('dash-top-4-list');
            const labelEl = document.getElementById('dash-graph-fuel-label');

            if (!dashboard || !listContainer) return;

            // Dashboard IMMER einblenden
            dashboard.classList.remove('hidden');
            const fuel = this.currentFuelType; // 'e10', 'e5', 'diesel'
            if (labelEl) labelEl.textContent = fuel.toUpperCase();

            // Wenn noch keine Daten da sind
            if (!this.cachedStations || this.cachedStations.length === 0) {
                listContainer.innerHTML = '<div style="color:#888; font-size:0.8rem; text-align:center; margin-top:20px;"><i class="fa-solid fa-spinner fa-spin"></i> Analysiere Preise im Umkreis...</div>';
                return;
            }

            // 1. Filtern: Nur offene Tanken mit echtem Preis
            let validStations = this.cachedStations.filter(st => {
                if (st.simPrices.isOpen === false) return false;
                const price = parseFloat(st.simPrices[fuel]);
                return !isNaN(price) && price > 0;
            });

            // 2. Sortieren: Die billigste ganz nach oben (Aufsteigend)
            validStations.sort((a, b) => parseFloat(a.simPrices[fuel]) - parseFloat(b.simPrices[fuel]));

            // 3. Die Top 4 abschneiden
            const top4 = validStations.slice(0, 3);

            // 4. HTML rendern
            listContainer.innerHTML = '';

            if (top4.length === 0) {
                listContainer.innerHTML = '<div style="color:#888; font-size:0.8rem; text-align:center; margin-top:20px;">Keine Preise gefunden.</div>';
                return;
            }

            top4.forEach((st, index) => {
           const priceStr = parseFloat(st.simPrices[fuel]).toFixed(2);
                const distStr = st.realData.dist ? st.realData.dist.toFixed(1) + ' km' : '';

                // BOSS-FIX: Wir holen uns die Marken-Klasse (z.B. 'aral', 'shell')
                const brandClass = this.getBrandClass(st.name); 

                // Neues 2-Zeilen-Layout ohne die Rang-Nummer
                const html = `
                    <div class="dash-list-item ${brandClass}" onclick="ExploreLogic.flyToAndOpen('${st.name}', ${st.lat}, ${st.lon})">
                        <div class="dash-item-name">${st.name}</div>
                        <div class="dash-item-bottom">
                            <div class="dash-item-price">${priceStr}</div>
                            <div class="dash-item-dist">${distStr}</div>
                        </div>
                    </div>
                `;
                listContainer.insertAdjacentHTML('beforeend', html);
            });
        },

        // Helper-Funktion für den Klick auf ein Listenelement im Dashboard
        flyToAndOpen: function(name, lat, lon) {
            if (!libreMap) return;
            libreMap.flyTo({ center: [lon, lat], zoom: 15.5, speed: 1.2, essential: true });

            // Finde das korrekte Element aus dem Cache, um das Totem mit allen Live-Daten zu füttern
            const el = this.cachedStations.find(s => s.lat === lat && s.lon === lon);
            if (el) this.openTotem(name, lat, lon, el);
        }

    }; // <--- DAS ist jetzt das einzige und echte Ende von window.ExploreLogic!

// ==========================================
    // === BLITZER.DE NATIVE ENGINE (ATUDO API) ===
    // ==========================================
    window.BlitzerLogic = {
        markers: [],
        isActive: false,

fetchLiveRadars: async function() {
            if (!libreMap) return;

            // 1. Sichtbaren Kartenausschnitt berechnen
            const bounds = libreMap.getBounds();
            const latMin = bounds.getSouth();
            const lngMin = bounds.getWest();
            const latMax = bounds.getNorth();
            const lngMax = bounds.getEast();
            const zoom = Math.floor(libreMap.getZoom());

            // 2. BOSS-FIX: Wir übergeben jetzt JEDEN Typen, den wir aus dem Rust-Code gelernt haben!
            // Mobile (0-6), Baustellen/Gefahren (20-29), Feste (101-117) und Anhänger (ts)
            const types = "0,1,2,3,4,5,6,20,21,22,23,24,25,26,29,101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,117,ts"; 

            const targetUrl = `https://cdn2.atudo.net/api/4.0/pois.php?z=${zoom}&type=${types}&box=${latMin},${lngMin},${latMax},${lngMax}`;
            const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`;

            console.log("📸 Lade Blitzer... URL:", targetUrl);

            try {
                const response = await fetch(proxyUrl);
                if (!response.ok) {
                    console.error("❌ Blitzer API blockiert! Status:", response.status);
                    return;
                }

                const data = await response.json();
                console.log("🚨 BLITZER PAYLOAD:", data);

                if (data && data.pois && data.pois.length > 0) {
                    this.drawMarkers(data.pois);
                } else {
                    console.log("ℹ️ Keine Blitzer in diesem Kartenausschnitt.");
                    this.clearMarkers(); // Alte Marker von der Karte putzen
                }
            } catch (error) {
                console.warn("⚠️ Blitzer Fetch Error:", error);
            }
        },

     drawMarkers: function(pois) {
            this.markers.forEach(m => m.remove());
            this.markers = [];

            pois.forEach(poi => {
                if (!poi.lat || !poi.lng) return;

                const lat = parseFloat(poi.lat);
                const lng = parseFloat(poi.lng);
                const vmax = poi.vmax && poi.vmax !== "0" ? poi.vmax : null;
                const streetName = (poi.address && poi.address.street) ? poi.address.street : "Unbekannte Straße";
                const typeStr = poi.type ? String(poi.type) : "";

                // === DIAGNOSE-DATEN EXTRAHIEREN ===
                const isConfirmed = poi.info && poi.info.confirmed !== undefined ? poi.info.confirmed : "?";
                const isGesperrt = poi.info && poi.info.gesperrt !== undefined ? poi.info.gesperrt : "?";
                const quality = poi.info && poi.info.quality !== undefined ? poi.info.quality : "?";
                const createDate = poi.create_date || "?";

                let categoryName = "Radar";
                let iconHtml = '<i class="fa-solid fa-camera"></i>';
                let cssClass = "icon-cam"; 

                const typeNum = parseInt(typeStr);

                if (typeNum >= 101 && typeNum <= 117) categoryName = "Fester Blitzer";
                else if (typeNum >= 0 && typeNum <= 6) categoryName = "Mobiler Blitzer";
                else if (typeStr === "ts") categoryName = "Blitzer-Anhänger";
                else if (typeNum >= 20 && typeNum <= 29) {
                    categoryName = "Gefahrenstelle";
                    iconHtml = '<i class="fa-solid fa-triangle-exclamation"></i>';
                }
                else if (typeStr === "114") categoryName = "Tunnel-Blitzer";

                if (vmax && categoryName.includes("Blitzer")) {
                    iconHtml = `<span style="font-family: monospace; font-weight: 900; font-size: 0.85rem; letter-spacing: -1px;">${vmax}</span>`;
                }

                const el = document.createElement('div');
                el.className = `custom-map-icon ${cssClass}`; 
                el.innerHTML = iconHtml;

                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (!window.poiPopup) {
                        window.poiPopup = new maplibregl.Popup({ closeButton: false, offset: 15 });
                    }
                    
                    // ⚠️ HIER IST DAS NEUE DIAGNOSE-POPUP
                    window.poiPopup.setLngLat([lng, lat])
                        .setHTML(`<div style="font-family: sans-serif; color: #1c1c1e; padding: 2px 5px;">
                                    <strong style="font-size: 13px;">${categoryName} (Typ: ${typeStr})</strong><br>
                                    <span style="font-size: 11px; color: #666;">${vmax ? vmax + ' km/h | ' : ''}${streetName}</span><br>
                                    <hr style="margin: 5px 0; border: 0; border-top: 1px solid #ccc;">
                                    <span style="font-size: 10px; color: #888;">
                                        Confirmed: <b>${isConfirmed}</b> | Gesperrt: <b>${isGesperrt}</b><br>
                                        Quality: <b>${quality}</b> | Erstellt: ${createDate}
                                    </span>
                                  </div>`)
                        .addTo(libreMap);
                });

                const marker = new maplibregl.Marker({ element: el })
                    .setLngLat([lng, lat])
                    .addTo(libreMap);

                this.markers.push(marker);
            });
        },


        clearMarkers: function() {
            this.markers.forEach(m => m.remove());
            this.markers = [];
        }
    };

// ==========================================
    // === MATH: ECHTE LUFTLINIEN-DISTANZ IN METER ===
    // ==========================================
    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Erdradius in Metern
        const rad = Math.PI / 180;
        const dLat = (lat2 - lat1) * rad;
        const dLon = (lon2 - lon1) * rad;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * rad) * Math.cos(lat2 * rad) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

  // ====================================================
    // === BOSS-FEATURE: DIE SCHLAUCH-ARCHITEKTUR (AMPELN V3 - PRO LEVEL) ===
    // ====================================================
    async function scanTrafficLightsForNext3KM() {
        // 1. THROTTLE (API Spam Protection)
        if (!window.lastAmpelScanTime) window.lastAmpelScanTime = 0;
        if (Date.now() - window.lastAmpelScanTime < 15000) return; // Maximal alle 15 Sekunden feuern
        window.lastAmpelScanTime = Date.now();

        const activeRoutePts = window.RouteLogic.routePointsData[window.RouteLogic.activeIndex];
        const cumulativeDists = window.RouteLogic.routeCumulativeDistances[window.RouteLogic.activeIndex];
        if (!activeRoutePts || activeRoutePts.length === 0 || !cumulativeDists) return;

        // 2. ECHTER START-INDEX (Wo ist das Auto JETZT?)
        let startIdx = window.lastRouteIdx !== undefined ? window.lastRouteIdx : 0;
        let endIdx = startIdx;
        let distanceCovered = 0;

        // 3km Schlauch abstecken (ab dem Auto!)
        while (endIdx < activeRoutePts.length - 1 && distanceCovered < 3000) {
            let p1 = activeRoutePts[endIdx];
            let p2 = activeRoutePts[endIdx + 1];
            distanceCovered += calculateDistance(p1[1], p1[0], p2[1], p2[0]);
            endIdx++;
        }

        const routeChunk = activeRoutePts.slice(startIdx, endIdx + 1);
        if (routeChunk.length === 0) return;

        console.log(`🚦 API Call: Scanne nächste ${Math.round(distanceCovered)}m ab Position...`);

        let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
        routeChunk.forEach(coord => {
            if (coord[1] < minLat) minLat = coord[1];
            if (coord[1] > maxLat) maxLat = coord[1];
            if (coord[0] < minLng) minLng = coord[0];
            if (coord[0] > maxLng) maxLng = coord[0];
        });

        minLat -= 0.0005; maxLat += 0.0005; 
        minLng -= 0.0005; maxLng += 0.0005;

        const overpassQuery = `
            [out:json][timeout:10];
            node["highway"="traffic_signals"](${minLat},${minLng},${maxLat},${maxLng});
            out body;
        `;
        const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (!data.elements) return;

            let validLights = [];
            const userCurrentDist = cumulativeDists[startIdx]; // Wie weit ist das Auto vom Start der Route entfernt?

            // 3. FILTERN & ECHTE DISTANZ ZUM AUTO BERECHNEN
            data.elements.forEach(node => {
                let closestDistToLine = Infinity;
                let routePositionIndex = -1;

                // Finde exakt den Punkt auf der blauen Linie, der der Ampel am nächsten ist
                routeChunk.forEach((routePt, chunkIdx) => {
                    let dist = calculateDistance(node.lat, node.lon, routePt[1], routePt[0]);
                    if (dist < closestDistToLine) {
                        closestDistToLine = dist;
                        routePositionIndex = startIdx + chunkIdx; // Absoluter Index auf der Gesamtroute
                    }
                });

                // 8-Meter Türsteher
                if (closestDistToLine <= 8) {
                    // Berechne die echte Fahr-Distanz vom Auto bis zur Ampel
                    let lightDistFromStart = cumulativeDists[routePositionIndex];
                    let distFromUser = lightDistFromStart - userCurrentDist;

                    // Nur Ampeln VOR uns aufnehmen (verhindert Geisterampeln im Rückspiegel)
                    if (distFromUser > -20) { 
                        validLights.push({ 
                            node: node, 
                            distFromUser: distFromUser 
                        });
                    }
                }
            });

            // 4. SORTIEREN NACH ECHTER DISTANZ
            validLights.sort((a, b) => a.distFromUser - b.distFromUser);

            // 5. CLEANUP (Alte Marker radikal löschen)
            if (window.trafficLightMarkers) {
                window.trafficLightMarkers.forEach(m => m.remove());
            }
            window.trafficLightMarkers = [];
            window.knownTrafficLightNodes.clear(); // Reset Memory

            // 6. TOP 3 ZEICHNEN
            const next3Lights = validLights.slice(0, 3);

            next3Lights.forEach(item => {
                window.knownTrafficLightNodes.add(item.node.id);

                const el = document.createElement('div');
                el.className = 'traffic-light-marker';
                el.innerHTML = '🚦'; 
                el.style.fontSize = '26px';
                el.style.background = 'transparent';
                el.style.border = 'none';
                el.style.boxShadow = 'none';
                el.style.textShadow = '0px 3px 6px rgba(0,0,0,0.6)';

                const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
                    .setLngLat([item.node.lon, item.node.lat])
                    .addTo(libreMap);

                window.trafficLightMarkers.push(marker);
            });

            console.log(`🚦 Update: ${next3Lights.length} Ampeln live vor dir.`);
        } catch (error) {
            console.warn("Ampel-Scan fehlgeschlagen:", error);
        }
    }
    // ==========================================
    // === ROUTE LOGIC (MULTI-ROUTE & UI) ===
    // ==========================================
    window.RouteLogic = {
        routeGeoJSONs: [null, null],
        routePointsData: [null, null], 
        routeColorsData: [null, null], 
        routeDistances: [null, null], 
        routeTimesData: [null, null], 
        routeCumulativeDistances: [null, null],
        activeIndex: 0,
        // --- NEU: HIER SPEICHERN WIR DIE ABBIEGEBEFEHLE ---
        currentInstructions: [],
        currentInstructionIndex: 0,

selectRouteOpt: function(index) {
            if (!this.routeGeoJSONs[index]) return; 
            this.activeIndex = index;

            document.getElementById('route-opt-0').classList.toggle('active', index === 0);
            document.getElementById('route-opt-1').classList.toggle('active', index === 1);

            this.updateMapLayers();

            if (this.routePointsData[index]) {
                window.loadElevationData(this.routePointsData[index], this.routeColorsData[index], this.routeDistances[index], this.routeTimesData[index]);
            }

            // === BOSS-FIX: GEHIRN-SWAP ===
            // Wenn der User die Route wechselt, MÜSSEN wir auch die Navigations-Daten 
            // (Manöver und Spuren) auf diese Route umschalten, bevor er auf GO drückt!
            if (this.allInstructions && this.allInstructions[index]) {
                this.currentInstructions = this.allInstructions[index];
                this.currentInstructionIndex = 0; // Zurückspulen für den neuen Start
            }
            if (this.allLaneSections && this.allLaneSections[index]) {
                this.currentLaneSections = this.allLaneSections[index];
            }
        },

        updateMapLayers: function() {
            for (let i = 0; i < 2; i++) {
                if (!this.routeGeoJSONs[i]) continue;
                const isAct = (i === this.activeIndex);
                const layerId = `route-layer-${i}`;
                const sourceId = `route-source-${i}`;
                let displayFeatures = JSON.parse(JSON.stringify(this.routeGeoJSONs[i]));

                if (!isAct) {
                    displayFeatures.forEach(f => { f.properties.color = '#555555'; });
                }

                if (libreMap.getSource(sourceId)) {
                    libreMap.getSource(sourceId).setData({ type: 'FeatureCollection', features: displayFeatures });
                }

                if (libreMap.getLayer(layerId)) {
                    libreMap.setPaintProperty(layerId, 'line-width', isAct ? 6 : 4);
                    libreMap.setPaintProperty(layerId, 'line-opacity', isAct ? 1 : 0.4);
                }
            }
        },

        extractHighway: function(instructions) {
            if (!instructions) return "Schnellste Route";
            for (let i = 0; i < instructions.length; i++) {
                let inst = instructions[i];
                if (inst.roadNumbers && inst.roadNumbers.length > 0) {
                    let road = inst.roadNumbers[0];
                    if (road.startsWith('A')) return `über ${road}`; 
                }
            }
            return "Lokale Route";
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

    // Hilfsfunktion: Welches Wetter ist "schlimmer"? (Höherer Score = Schlimmer)
    function getWeatherSeverity(code) {
        if (code >= 95) return 7; // Gewitter
        if (code >= 71 && code <= 77) return 6; // Schnee
        if (code >= 80 && code <= 82) return 5; // Starker Schauer
        if (code >= 51 && code <= 67) return 4; // Regen
        if (code >= 45 && code <= 48) return 3; // Nebel
        if (code >= 1 && code <= 3) return 2; // Bewölkt
        return 1; // Klar
    }

  window.loadElevationData = async function(allPoints, allColors, totalDistMeters, totalTimeSeconds) { 
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
                drawElevationChart(data.elevation, sampledColors, 140, totalDistMeters); 
            }
        } catch (error) {
            console.error("Höhendaten Fehler:", error);
        }

        // --- 2. ZEITREISE-WETTER INTELLIGENZ ---
        const weatherContainer = document.getElementById('weather-track-container');
        if (weatherContainer) weatherContainer.innerHTML = ''; 

        if (!totalDistMeters || totalDistMeters < 80000) return; // Unter 80km: Abbruch!

        const numVisualSegments = Math.min(5, Math.floor(totalDistMeters / 40000));
        const visualSegLength = totalDistMeters / numVisualSegments;

        const numFetches = Math.floor(totalDistMeters / 40000); 
        const fetchLats = [];
        const fetchLons = [];
        const fetchMapToVisual = []; 

        for (let i = 1; i <= numFetches; i++) {
            const dist = i * 40000;
            const ptIndex = Math.floor((dist / totalDistMeters) * (allPoints.length - 1));
            fetchLats.push(allPoints[ptIndex][1]);
            fetchLons.push(allPoints[ptIndex][0]);

            let visIdx = Math.floor((dist - 1) / visualSegLength);
            if (visIdx >= numVisualSegments) visIdx = numVisualSegments - 1;
            fetchMapToVisual.push(visIdx);
        }

        try {
            // NEU: Wir holen hourly=temperature_2m,weathercode,is_day im UNIX-Zeitformat!
            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${fetchLats.join(',')}&longitude=${fetchLons.join(',')}&hourly=temperature_2m,weathercode,is_day&timeformat=unixtime`;
            const wRes = await fetch(weatherUrl);
            const wData = await wRes.json();

            const results = Array.isArray(wData) ? wData : [wData];

            const visualWeather = [];
            for (let i = 0; i < numVisualSegments; i++) {
                visualWeather.push({ temp: 0, code: -1, severity: -1, isDay: 1, hasData: false });
            }

            // Aktuelle UNIX-Zeit in Sekunden
            const nowUnix = Math.floor(Date.now() / 1000);

            results.forEach((res, idx) => {
                if (!res.hourly || !res.hourly.time) return;

                // 1. Berechne die lineare ETA für genau diesen 40km-Abfrage-Punkt
                const distRatio = ((idx + 1) * 40000) / totalDistMeters;
                const etaUnix = nowUnix + Math.floor(distRatio * totalTimeSeconds);

                // 2. Finde die exakte Vorhersage-Stunde, die dieser ETA am nächsten kommt
                let closestHourIdx = 0;
                let minDiff = Infinity;
                for(let h = 0; h < res.hourly.time.length; h++) {
                    const diff = Math.abs(res.hourly.time[h] - etaUnix);
                    if(diff < minDiff) {
                        minDiff = diff;
                        closestHourIdx = h;
                    }
                }

                // 3. Greife die Daten für exakt diese zukünftige Stunde ab!
                const temp = Math.round(res.hourly.temperature_2m[closestHourIdx]);
                const code = res.hourly.weathercode[closestHourIdx];
                const isDay = res.hourly.is_day[closestHourIdx]; // 1 = Tag, 0 = Nacht
                const severity = getWeatherSeverity(code);

                const visIdx = fetchMapToVisual[idx];
                if (severity > visualWeather[visIdx].severity) {
                    visualWeather[visIdx] = { temp, code, severity, isDay, hasData: true };
                }
            });

            // Zeichnen
            visualWeather.forEach((vw, i) => {
                if (!vw.hasData) return;

                let icon = 'fa-cloud'; 
                // NEU: Tag & Nacht Prüfung mit MOND-ICONS!
                if (vw.code === 0) icon = vw.isDay ? 'fa-sun' : 'fa-moon';
                else if (vw.code >= 1 && vw.code <= 3) icon = vw.isDay ? 'fa-cloud-sun' : 'fa-cloud-moon';
                else if (vw.code >= 45 && vw.code <= 48) icon = 'fa-smog';
                else if (vw.code >= 51 && vw.code <= 67) icon = 'fa-cloud-rain';
                else if (vw.code >= 71 && vw.code <= 77) icon = 'fa-snowflake';
                else if (vw.code >= 80 && vw.code <= 82) icon = 'fa-cloud-showers-heavy';
                else if (vw.code >= 95) icon = 'fa-cloud-bolt';

                const centerPercentage = ((i + 0.5) * visualSegLength) / totalDistMeters;

                const div = document.createElement('div');
                div.className = 'weather-point';
                div.style.left = `${centerPercentage * 100}%`;
                div.innerHTML = `<i class="fa-solid ${icon}"></i><span>${vw.temp}°</span>`;
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
        const exactHeight = 140; // Fest auf unsere neue Canvas-Höhe gesetzt!

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

        // --- DIE MAGISCHEN BEREICHE (Deine Logik in Code gegossen!) ---
        const paddingTop = 15; // Luft nach oben zum Card-Rand
        const textZoneHeight = 25; // Die unteren 25px gehören NUR den "40 km" Texten
        const iconSafeZone = 45; // DEIN GRÜNER BALKEN! Exakt so hoch wie der CSS-Container.

        const baseY = exactHeight - textZoneHeight; // y=115: Boden der grünen Masse
        const graphBaseY = baseY - iconSafeZone; // y=70: Tiefster Punkt, den das Tal erreichen darf!
        const chartHeight = graphBaseY - paddingTop; // y=55: Der nutzbare Raum für die Bergspitzen

        const xStep = exactWidth / (elevations.length - 1);

        // 1. FLÄCHEN-LOGIK (Füllt alles bis tief unten zum Text-Rand)
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
        gradient.addColorStop(1, 'rgba(48, 209, 88, 0.15)'); 
        ctx.fillStyle = gradient;
        ctx.fill();

        // 2. BERG-LINIE (Mit Staufarben)
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

        // 3. X-ACHSE & GESTRICHELTE TRENNWÄNDE (Max. 5 Sektoren)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '10px sans-serif';
        ctx.textBaseline = 'top';

        if (totalDistMeters && totalDistMeters >= 80000) {
            const numVisualSegments = Math.min(5, Math.floor(totalDistMeters / 40000));
            const visualSegLength = totalDistMeters / numVisualSegments;

            for (let i = 0; i <= numVisualSegments; i++) {
                const dist = i * visualSegLength;
                const percentage = dist / totalDistMeters;
                const x = percentage * exactWidth;

                // Text sauber anordnen
                ctx.textAlign = i === 0 ? 'left' : (i === numVisualSegments ? 'right' : 'center');
                ctx.fillText(`${(dist / 1000).toFixed(0)} km`, x, baseY + 6);

                // Gestrichelte Trennwände ziehen (Nur innen)
                if (i > 0 && i < numVisualSegments) { 
                    ctx.beginPath();
                    ctx.setLineDash([3, 4]); 
                    ctx.moveTo(x, baseY);

                    // Wand geht exakt hoch bis zur Berg-Oberfläche
                    const ptIndex = Math.min(Math.floor(percentage * (elevations.length - 1)), elevations.length - 1);
                    const y_norm = (elevations[ptIndex] - minElev) / diff;
                    const y = paddingTop + chartHeight - (y_norm * chartHeight);

                    ctx.lineTo(x, y);
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    ctx.setLineDash([]); 
                }
            }
        } else if (totalDistMeters) {
            // Unter 80km: Nur Start und Ende
            ctx.textAlign = 'left';
            ctx.fillText(`0 km`, 0, baseY + 6);
            ctx.textAlign = 'right';
            ctx.fillText(`${(totalDistMeters/1000).toFixed(0)} km`, exactWidth, baseY + 6);
        }
    }


// --- NIKITAS NAV-SIMULATOR (Szenarien 1-4) ---
    window.testScenarioIdx = 0;
    window.NavTestScenarios = [
        null, // Index 0 = Live Betrieb
        {
            // Szenario 1: Komplexe Autobahnausfahrt (A9)
            maneuver: "EXIT_RIGHT",
            roadNumbers: ["A9"],
            signpostText: "München-Schwabing",
            street: "A9",
            lanes: [
                {valid: false, indications: ["STRAIGHT"]},
                {valid: true, indications: ["STRAIGHT", "RIGHT"]},
                {valid: true, indications: ["RIGHT"]}
            ],
            mockSpeed: 120,
            mockDist: 450
        },
        {
            // Szenario 2: Autobahngabelung (A3)
            maneuver: "KEEP_LEFT",
            roadNumbers: ["A3"],
            signpostText: "Frankfurt",
            street: "A3",
            lanes: [
                {valid: true, indications: ["LEFT"]},
                {valid: true, indications: ["LEFT"]},
                {valid: false, indications: ["STRAIGHT"]},
                {valid: false, indications: ["STRAIGHT"]}
            ],
            mockSpeed: 110,
            mockDist: 850
        },
        {
            // Szenario 3: Stadt-Abbiegung (B16)
            maneuver: "TURN_RIGHT",
            roadNumbers: ["B16"],
            street: "Regensburger Straße",
            lanes: [
                {valid: false, indications: ["STRAIGHT"]},
                {valid: true, indications: ["RIGHT"]}
            ],
            mockSpeed: 45,
            mockDist: 80
        },
      {
            // Szenario 5: Die 5-Spurige Monster-Kreuzung (A9 -> A99)
            maneuver: "EXIT_RIGHT", // Es ist eine Ausfahrt...
            roadNumbers: ["A99"],
            signpostText: "München-Ost",
            street: "A9",
            lanes: [
                {valid: false, indications: ["STRAIGHT"]}, // Spur 1: Falsch, geht geradeaus
                {valid: false, indications: ["STRAIGHT"]}, // Spur 2: Falsch, geht geradeaus
                {valid: true, indications: ["STRAIGHT", "RIGHT"]}, // Spur 3: KOMBI-SPUR! (Hier triggert dein neuer Prioritäten-Filter!)
                {valid: true, indications: ["RIGHT"]}, // Spur 4: Ausfahrt
                {valid: true, indications: ["RIGHT"]}  // Spur 5: Ausfahrt
            ],
            mockSpeed: 130,
            mockDist: 500
        }
    ];

    // Button-Logic
 // Button-Logic (BOSS-FIX: Global verfügbar machen!)
    window.toggleNavTest = function() {
        window.testScenarioIdx++;
        if (window.testScenarioIdx >= window.NavTestScenarios.length) {
            window.testScenarioIdx = 0; // Zurück zu Live
        }

        const btn = document.getElementById('btn-test-hud');
        if (btn) {
            btn.textContent = window.testScenarioIdx === 0 ? 'T' : window.testScenarioIdx;
            btn.classList.toggle('active', window.testScenarioIdx > 0);
        }
    }

    // ==========================================
    // === SMART CAMERA ENGINE (V9 BITURBO) ===
    // ==========================================
    window.SmartCameraEngine = {
        currentState: 'CRUISE_CITY',
        stateChangeInitiatedAt: 0,
        pendingState: null,
        lastHeading: 0,

        getTimeToTurn: function(distMeters, speedKmh) {
            if (speedKmh < 5) return 999; 
            return distMeters / (speedKmh / 3.6); // Echte Sekunden bis zum Ziel
        },

        update: function(libreMap, currentCoords, heading, speedKmh, distMeters, currentManeuver) {
            if (!libreMap) return;

            const timeToTurn = this.getTimeToTurn(distMeters, speedKmh);
            const manType = currentManeuver ? (currentManeuver.maneuver || '') : '';
            // Peters Fix: Saubere Regex für Autobahnen (z.B. "A3", "A 100"), ignoriert "B10A"
            const roadNums = currentManeuver && currentManeuver.roadNumbers ? currentManeuver.roadNumbers.join(',') : '';
            const isHighway = /^[A]\s?\d+/i.test(roadNums) || speedKmh > 100;

            let newState = 'CRUISE_CITY';

            // Prio 1: Kreisverkehr (Echte 2D Draufsicht)
            if (manType.includes('ROUNDABOUT') && (timeToTurn < 15 || distMeters < 150)) {
                newState = 'ROUNDABOUT';
            }
            // Prio 2: Autobahn-Gabelung (Strikes 3D)
            else if ((manType.includes('EXIT') || manType.includes('KEEP_LEFT') || manType.includes('KEEP_RIGHT')) &&
                     isHighway && (timeToTurn < 20 || distMeters < 600)) {
                newState = 'HIGHWAY_EXIT';
            }
            // Prio 3: Stadt-Abbiegung
            else if ((manType.includes('TURN') || manType.includes('U_TURN')) && (timeToTurn < 12 || distMeters < 120)) {
                newState = 'CITY_TURN';
            }
            // Prio 4: Stop & Go (Peters Fix: Darf die Abbiege-Kamera nicht überschreiben!)
            else if (speedKmh < 10 && timeToTurn > 15 && distMeters > 100) {
                newState = 'STOP_AND_GO';
            }
            // Prio 5: Cruise Control
            else {
                if (isHighway || speedKmh > 90) newState = 'CRUISE_HIGHWAY';
                else if (speedKmh > 50) newState = 'CRUISE_LAND';
                else newState = 'CRUISE_CITY';
            }

            // Die intelligente Hysterese (Peters Fix: Dynamische Wartezeiten)
            if (newState !== this.currentState) {
                if (this.pendingState !== newState) {
                    this.pendingState = newState;
                    this.stateChangeInitiatedAt = Date.now();
                } else {
                    let waitTime = 0;

                    // Manöver greifen SOFORT
                    if (!newState.includes('TURN') && !newState.includes('EXIT') && !newState.includes('ROUNDABOUT')) {
                        // Dynamische Logik: Beschleunigen vs. Abbremsen
                        const isSpeedIncrease = (newState === 'CRUISE_HIGHWAY' && this.currentState !== 'CRUISE_HIGHWAY') ||
                                                (newState === 'CRUISE_LAND' && this.currentState === 'CRUISE_CITY');
                        waitTime = isSpeedIncrease ? 8000 : 4000;
                    }

                    if (Date.now() - this.stateChangeInitiatedAt >= waitTime) {
                        this.currentState = newState;
                        this.pendingState = null;
                    }
                }
            } else {
                this.pendingState = null;
            }

            this.applyCamera(libreMap, currentCoords, heading, speedKmh);
        },

        applyCamera: function(libreMap, coords, heading, speedKmh) {
            let targetZoom = 16.5;
            let targetPitch = 45;
            // Wir bleiben bei Padding! (Peters Offset-Idee zerschießt die MapLibre 3D-Rotation)
            const targetPadding = { top: window.innerHeight * 0.45, bottom: 0, left: 0, right: 0 };

            // Peters Fix: Dynamische Duration basierend auf Speed (geclampt zwischen 800ms und 3000ms)
            let baseDuration = Math.max(800, Math.min(3000, 500 + speedKmh * 10));

switch(this.currentState) {
                case 'STOP_AND_GO':
                    targetZoom = 16.0; targetPitch = 30; baseDuration = 2000; break;
                case 'ROUNDABOUT':
                    // BOSS-FIX: Zoom entspannt lassen, nur Draufsicht (Pitch 0)
                    targetZoom = 16.5; targetPitch = 0; baseDuration = 1500; break;
                case 'HIGHWAY_EXIT':
                    targetZoom = 15.0; targetPitch = 60; baseDuration = 2000; break;
                case 'CITY_TURN':
                    // BOSS-FIX: Kein aggressiver Zoom mehr! 
                    // Wir bleiben auf 16.5 (wie CRUISE_CITY) und gehen nur in die 2D-Ansicht (Pitch 0)
                    targetZoom = 16.5; targetPitch = 0; baseDuration = 1500; break;
                case 'CRUISE_HIGHWAY':
                    targetZoom = 14.5; targetPitch = 65; baseDuration = 3000; break;
                case 'CRUISE_LAND':
                    targetZoom = 15.5; targetPitch = 55; baseDuration = 2500; break;
                case 'CRUISE_CITY':
                default:
                    targetZoom = 16.5; targetPitch = 45; baseDuration = 1500; break;
            }

            // Heading Trust System (friert Drehung ein, wenn man an der Ampel hält)
            if (speedKmh >= 10 && heading !== null) {
                this.lastHeading = heading;
            }

            libreMap.easeTo({
                center: coords,
                zoom: targetZoom,
                pitch: targetPitch,
                bearing: this.lastHeading,
                padding: targetPadding,
                duration: baseDuration,
                easing: (t) => t // Linearer Ablauf für flüssiges Live-Tracking
            });
        }
    };
// ==========================================
    // === PHASE 1: GO BUTTON & 3D LAUNCH ===
    // ==========================================
    const btnStartRoute = document.getElementById('btn-start-nav'); 

    if (btnStartRoute) {
      btnStartRoute.addEventListener('click', async () => {
            window.lastRouteIdx = 0; 
            window.navStartTime = Date.now();

          ttsAudioPlayer.src = "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU5LjI3LjEwMAAAAAAAAAAAAAAA//OEwAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";
            ttsAudioPlayer.play().catch(() => {});

            const routeUI = document.getElementById('route-overview-ui');
            if (routeUI) routeUI.classList.add('fade-out');

            const navHud = document.getElementById('navigation-hud-pill');
            if (navHud) navHud.classList.remove('hidden');

            const activeRouteIndex = RouteLogic.activeIndex;
            const distanceText = document.getElementById(`opt-dist-${activeRouteIndex}`).textContent;
            document.getElementById('hud-remaining-dist').textContent = distanceText;
            const etaText = document.getElementById(`opt-eta-${activeRouteIndex}`).textContent;
            document.getElementById('hud-arrival-time').textContent = etaText;

 if (libreMap && currentCoords) {
                // 1. Aus Punkt wird Pfeil!
                if (window.userLocationMarker) {
                    const el = window.userLocationMarker.getElement();
                    el.innerHTML = '<div class="nav-arrow-wrap"><i class="fa-solid fa-location-arrow"></i></div>';
                }

              // 2. Kamera-Setup für Navigation (ALLES FREIGEBEN!)
                libreMap.dragPan.enable();
                libreMap.scrollZoom.enable();
                libreMap.touchZoomRotate.enable(); // <-- BOSS-FIX: Anfassen erlaubt!
                libreMap.doubleClickZoom.disable();
                if (libreMap.dragRotate) libreMap.dragRotate.enable(); // <-- BOSS-FIX: Drehen erlaubt!

           libreMap.flyTo({
                    center: currentCoords, 
                    zoom: 16.5, 
                    pitch: 60,  
                    bearing: 0, 
                    // BOSS-FIX: Padding TOP drückt die Kamera-Mitte nach UNTEN!
                    padding: { top: window.innerHeight * 0.5, bottom: 0, left: 0, right: 0 }, 
                    duration: 2000, 
                    essential: true
                });
            }

            const cancelNavBtn = document.getElementById('btn-cancel-active-nav');
            if(cancelNavBtn) cancelNavBtn.classList.remove('hidden');

          const testBtn = document.getElementById('btn-test-hud');
            if(testBtn) testBtn.classList.remove('hidden');

            const topCard = document.getElementById('nav-top-card');
            if(topCard) topCard.classList.remove('hidden');

const getShortInstruction = (maneuverObj) => {
            const man = (maneuverObj.maneuver || '').toUpperCase();
            let actionText = "Geradeaus";

            // 1. ZIEL / START
            if (man.includes('ARRIVE') || man.includes('FINISH')) actionText = "Ziel erreicht";
            else if (man.includes('DEPART')) actionText = "Route folgen";

            // 2. KREISVERKEHR
            else if (man.includes('ROUNDABOUT')) {
                if (maneuverObj.roundaboutExitNumber) {
                    actionText = `Die ${maneuverObj.roundaboutExitNumber}. Ausfahrt nehmen`;
                } else {
                    actionText = "In den Kreisverkehr fahren";
                }
            }

            // 3. AUTOBAHN AUSFAHRTEN & AUFFAHRTEN
            else if (man.includes('ENTER_MOTORWAY')) actionText = "Auffahren";
            else if (man.includes('EXIT_MOTORWAY_LEFT') || man.includes('EXIT_LEFT') || man.includes('OFF_RAMP_LEFT')) actionText = "Ausfahrt links nehmen";
            else if (man.includes('EXIT_MOTORWAY_RIGHT') || man.includes('EXIT_RIGHT') || man.includes('OFF_RAMP') || man.includes('EXIT') || man.includes('TAKE_EXIT')) actionText = "Ausfahrt nehmen";

            // 4. EINFÄDELN / WECHSELN
            else if (man.includes('MERGE_LEFT') || man.includes('SWITCH_MOTORWAY_LEFT')) actionText = "Links einfädeln";
            else if (man.includes('MERGE_RIGHT') || man.includes('SWITCH_MOTORWAY_RIGHT')) actionText = "Rechts einfädeln";
            else if (man.includes('MERGE')) actionText = "Einfädeln";

            // 5. SPUR HALTEN (inklusive BEAR)
            else if (man.includes('KEEP_LEFT') || man.includes('BIFURCATION_LEFT') || man.includes('BEAR_LEFT')) actionText = "Links halten";
            else if (man.includes('KEEP_RIGHT') || man.includes('BIFURCATION_RIGHT') || man.includes('BEAR_RIGHT')) actionText = "Rechts halten";

            // 6. SCHARF ABBIEGEN / WENDEN
            else if (man.includes('U_TURN')) actionText = "Wenden";
            else if (man.includes('SHARP_LEFT')) actionText = "Scharf links abbiegen";
            else if (man.includes('SHARP_RIGHT')) actionText = "Scharf rechts abbiegen";

            // 7. NORMALES ABBIEGEN
            else if (man.includes('TURN_LEFT')) actionText = "Links abbiegen";
            else if (man.includes('TURN_RIGHT')) actionText = "Rechts abbiegen";

            // 8. SANFTES ABBIEGEN & FOLGEN
            else if (man.includes('SLIGHT_LEFT')) actionText = "Leicht links abbiegen";
            else if (man.includes('SLIGHT_RIGHT')) actionText = "Leicht rechts abbiegen";
            else if (man.includes('FOLLOW')) actionText = "Geradeaus";

            if (actionText === "Geradeaus" && man !== "STRAIGHT" && man !== "FOLLOW" && man !== "") {
                console.warn(`🚨 [FLIGHT RECORDER] Unbekanntes Manöver erkannt: "${man}"`, maneuverObj);
            }

// ====================================================
            // === BOSS-FIX: SINGLE SOURCE OF TRUTH (VOICE = HUD) ===
            // ====================================================
            let streetText = maneuverObj.street || "";
            let rn = (maneuverObj.roadNumbers && maneuverObj.roadNumbers.length > 0) ? maneuverObj.roadNumbers[0] : "";
            let directionText = maneuverObj.signpostText || maneuverObj.destination || "";

            let voiceStreet = "";

            // Trick für Google TTS: "A73" zu "A 73" machen, damit die Stimme flüssig spricht!
            let spokenRn = rn ? rn.replace(/([A-Za-z]+)(\d+)/, "$1 $2") : "";

            if (directionText) {
                // 1. SCHILD SCHLÄGT ALLES (Exakt wie die HUD-Logik!)
                if (spokenRn) {
                    // HUD zeigt: [A73] Richtung Fürth -> Stimme sagt: "auf A 73 Richtung Fürth"
                    voiceStreet = `auf ${spokenRn} Richtung ${directionText}`;
                } else {
                    voiceStreet = `in Richtung ${directionText}`;
                }
            } else {
                // 2. KEIN SCHILD (Nur normale Straße)
                // Gleicher Putz-Algorithmus wie im HUD: Doppelte "B16" entfernen
                if (rn && streetText.includes(rn)) {
                    streetText = streetText.replace(rn, '').trim();
                    if (streetText.startsWith('-') || streetText.startsWith(',')) {
                        streetText = streetText.substring(1).trim();
                    }
                }

                if (spokenRn && streetText) {
                    voiceStreet = `auf ${spokenRn} ${streetText}`;
                } else if (spokenRn) {
                    voiceStreet = `auf ${spokenRn}`;
                } else if (streetText) {
                    voiceStreet = `auf ${streetText}`;
                }
            }

            return { action: actionText, street: voiceStreet };
        };

            const formatDist = (m) => {
                if (m >= 1000) return `${(m/1000).toFixed(1).replace('.', ',')} Kilometern`;
                return `${Math.round(m/10)*10} Metern`; 
            };

const getLaneText = (maneuverObj) => {
                // Gibt es überhaupt Spuren-Daten in der offiziellen TomTom-Struktur?
                if (!maneuverObj.lanes || !Array.isArray(maneuverObj.lanes)) return "";

                // 1. Filtere NUR die Spuren heraus, auf denen der Fahrer fahren darf
                // BOSS-FIX: TomTom nutzt 'follow' (Wenn follow existiert, ist die Spur richtig)
                const validLanes = maneuverObj.lanes.filter(l => l.follow);
                const count = validLanes.length;
                if (count === 0) return "";

                // 2. Wohin zeigen diese erlaubten Spuren primär?
                let left = 0, right = 0, center = 0;
                validLanes.forEach(l => {
                    // BOSS-FIX: TomTom nutzt 'directions' (z.B. ["STRAIGHT", "RIGHT"])
                    if (l.directions && Array.isArray(l.directions)) {
                        const dirs = l.directions.map(d => d.toLowerCase());
                        if (dirs.some(d => d.includes('left'))) left++;
                        else if (dirs.some(d => d.includes('right'))) right++;
                        else center++;
                    }
                });

                // 3. Dominante Richtung und Grammatik (Singular vs. Plural) ermitteln
                let dirWord = "mittleren";
                if (left > right && left >= center) dirWord = count > 1 ? "linken" : "linke";
                else if (right > left && right >= center) dirWord = count > 1 ? "rechten" : "rechte";
                else dirWord = count > 1 ? "mittleren" : "mittlere";

                // 4. Echte Zahlwörter für die TTS-Sprachausgabe
                const numText = ["null", "eine", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht"];
                const countStr = numText[count] || count.toString();

                // 5. Finalen Satzbaustein zurückgeben
                if (count === 1) return `halten Sie sich auf der ${dirWord} Spur`;
                return `nutzen Sie die ${countStr} ${dirWord} Spuren`;
            };
            // 6. DIE PERFEKTE START-ANSAGE (Bulletproof Version)
            const searchInput = document.getElementById('tomtom-search-input');
            const destName = (searchInput && searchInput.value.trim() !== '') ? searchInput.value : "deinem Ziel";

            let welcomeSpeech = `Route nach ${destName} wird gestartet.`;

            const instructions = RouteLogic.currentInstructions || [];
            let startIdx = 0;
            while (startIdx < instructions.length && instructions[startIdx].maneuver === 'DEPART') {
                startIdx++;
            }
            RouteLogic.currentInstructionIndex = startIdx;

           const cumulativeDists = RouteLogic.routeCumulativeDistances[RouteLogic.activeIndex];
            if (startIdx < instructions.length && cumulativeDists) {
                const firstMan = instructions[startIdx];
                let distMeters = cumulativeDists[firstMan.pointIndex] - cumulativeDists[0];
                if (distMeters < 0) distMeters = 0;

                const shortInfo = getShortInstruction(firstMan);
                const laneText = getLaneText(firstMan);
                const baseActionStr = `${shortInfo.action} ${shortInfo.street}`.trim();

               const actionStr = (distMeters <= 600 && laneText) ? `${baseActionStr}, ${laneText}` : baseActionStr;

                // === BOSS-FIX: SONDERREGEL FÜR AUFFAHRTEN BEIM START ===
                const isAuffahren = firstMan.maneuver && firstMan.maneuver.includes('ENTER_MOTORWAY');

                let firstInstructionText = "";
                if (isAuffahren) {
                    // Kein Gelaber, keine Distanz. Einfach: "Auffahren auf A8."
                    firstInstructionText = actionStr + ".";
                } else if (distMeters > 5000) {
                    firstInstructionText = `Folgen Sie der Route für ${Math.round(distMeters/1000)} Kilometer.`;
                } else if (distMeters < 70) {
                    firstInstructionText = actionStr; 
                } else {
                    firstInstructionText = `In ${formatDist(distMeters)} ${actionStr}.`;
                }

                welcomeSpeech += " " + firstInstructionText;

                RouteLogic.voiceState = {
                    idx: startIdx,
                    segmentTotalDist: distMeters,
                    spokenInit: true, 
                    spoken5km: false,
                    spoken2km: distMeters <= 2000,
                    spoken500m: distMeters <= 500,
                    spoken100m: distMeters <= 100,
                    spoken50m: distMeters <= 50,
                    spokenNow: distMeters <= 15
                };

                window.voiceBlockUntil = Date.now() + 8000;
                // PETERS SAFETY HACK: Fallback, falls das GPS beim Start hängt
                RouteLogic.forceFirstInstruction = false;
                if (window.startVoiceTimeout) clearTimeout(window.startVoiceTimeout);
                window.startVoiceTimeout = setTimeout(() => {
                    RouteLogic.forceFirstInstruction = true;
                }, 3500);
            } else {
               RouteLogic.voiceState = { idx: -1 };
            }

            triggerGoogleVoice(welcomeSpeech);

            // BOSS-FEATURE: Ampel-Scan für die ersten 3km anwerfen
            scanTrafficLightsForNext3KM();

          // --- BOSS-FIX: DIE "FREE LOOK" ENGINE (V2 - SMOOTH & MULTI-TOUCH) ---

          // --- BOSS-FIX: DIE "FREE LOOK" ENGINE (V2 - SMOOTH & MULTI-TOUCH) ---
            window.isNavigating = true;
            window.userIsLookingAround = false;
            window.resumeNavTimer = null;

            const lockCamera = (e) => {
                if (!window.isNavigating) return;

                // DER MASTER-CHECK: Reagiert NUR auf echte menschliche Finger (originalEvent), 
                // NICHT auf unsere eigenen Code-Kamerafahrten!
                if (!e.originalEvent) return; 

                window.userIsLookingAround = true;
                if (window.resumeNavTimer) clearTimeout(window.resumeNavTimer);
            };

            const unlockCameraTimer = (e) => {
                if (!window.isNavigating) return;
                if (!e.originalEvent) return; 

                if (window.resumeNavTimer) clearTimeout(window.resumeNavTimer);

                // Startet den 5-Sekunden Countdown erst, wenn ALLE Finger weg sind
                window.resumeNavTimer = setTimeout(() => {
                    window.userIsLookingAround = false;

                    // Sanfter Rückflug zum Auto
                    if (libreMap && currentCoords) {
                        libreMap.flyTo({
                            center: currentCoords,
                            zoom: 16.5,  // Deinen Wunsch-Zoom beibehalten
                            pitch: 60,
                            bearing: window.lastHeading || 0,
                            padding: { top: window.innerHeight * 0.5, bottom: 0, left: 0, right: 0 },
                            duration: 1500,
                            essential: true
                        });
                    }
                }, 5000); 
            };

            // MapLibre's native Gesten-Erkennung statt roher Touch-Events
            libreMap.on('movestart', lockCamera);
            libreMap.on('moveend', unlockCameraTimer);
            // ----------------------------------------
         // ----------------------------------------
          // ----------------------------------------

          // ====================================================
            // === BOSS-FEATURE: SHADOW ENGINE (SITUATION INTELLIGENCE) ===
            // ====================================================
            const classifyManeuver = (man) => {
                if (!man) return 'STRAIGHT';
                if (man.includes('TURN_LEFT')) return 'TURN_LEFT';
                if (man.includes('TURN_RIGHT')) return 'TURN_RIGHT';
                if (man.includes('KEEP_LEFT') || man.includes('BIFURCATION_LEFT')) return 'KEEP_LEFT';
                if (man.includes('KEEP_RIGHT') || man.includes('BIFURCATION_RIGHT')) return 'KEEP_RIGHT';
                if (man.includes('EXIT') || man.includes('OFF_RAMP')) return 'EXIT';
                if (man.includes('MERGE')) return 'MERGE';
                if (man.includes('ROUNDABOUT')) return 'ROUNDABOUT';
                return 'STRAIGHT';
            };

            const getUpcomingManeuvers = (instructions, startIdx, count = 3) => {
                const result = [];
                let idx = startIdx + 1;
                while (idx < instructions.length && result.length < count) {
                    if (instructions[idx].maneuver !== 'DEPART') {
                        result.push(instructions[idx]);
                    }
                    idx++;
                }
                return result;
            };

            const detectSituation = (current, upcoming, cumulativeDists) => {
                const currType = classifyManeuver(current.maneuver);
                const nextType = upcoming[0] ? classifyManeuver(upcoming[0].maneuver) : null;

                const distToNext = upcoming[0] 
                    ? cumulativeDists[upcoming[0].pointIndex] - cumulativeDists[current.pointIndex] 
                    : Infinity;

                // Fall 1: PRE-EXIT (Ausfahrt vorbereiten)
                if ((currType === 'KEEP_LEFT' || currType === 'KEEP_RIGHT') && nextType === 'EXIT' && distToNext < 1500) {
                    return 'PRE_EXIT_SEQUENCE';
                }
                // Fall 2: DOUBLE TURN (Stadt-Chaos)
                if ((currType === 'TURN_LEFT' || currType === 'TURN_RIGHT') && (nextType === 'TURN_LEFT' || nextType === 'TURN_RIGHT') && distToNext < 300) {
                    return 'DOUBLE_TURN';
                }
                // Fall 3: MERGE + EXIT (Kurz auffahren, sofort wieder runter)
                if (currType === 'MERGE' && nextType === 'EXIT' && distToNext < 2000) {
                    return 'MERGE_EXIT';
                }
                return 'NORMAL';
            };

            const buildInstruction = (current, upcoming, situation, shortInfo) => {
                const base = `${shortInfo.action} ${shortInfo.street}`.trim();
                if (situation === 'PRE_EXIT_SEQUENCE' && upcoming[0]) {
                    const nextInfo = getShortInstruction(upcoming[0]);
                    return `${base}, um im Anschluss die ${nextInfo.action.toLowerCase()} ${nextInfo.street} zu nehmen`;
                }
                if (situation === 'DOUBLE_TURN' && upcoming[0]) {
                    const nextInfo = getShortInstruction(upcoming[0]);
                    return `${base}, danach sofort ${nextInfo.action.toLowerCase()}`;
                }
                if (situation === 'MERGE_EXIT') {
                    return `${base}, anschließend direkt die Ausfahrt nehmen`;
                }
                return base;
            };
            // ====================================================
            // 7. LIVE GPS MOTOR STARTEN
            if (navigator.geolocation) {
                if (navWatchId) navigator.geolocation.clearWatch(navWatchId);

                // ====================================================
                // === BOSS-FIX: 60FPS GHOST-GLIDE ENGINE (PFEIL-ANIMATION) ===
                // ====================================================
                if (window.MarkerAnimator && window.MarkerAnimator.animating) {
                    window.MarkerAnimator.stop();
                }

                window.MarkerAnimator = {
                    currentLng: currentCoords ? currentCoords[0] : null,
                    currentLat: currentCoords ? currentCoords[1] : null,
                    currentHeading: window.lastHeading || 0,
                    targetLng: currentCoords ? currentCoords[0] : null,
                    targetLat: currentCoords ? currentCoords[1] : null,
                    targetHeading: window.lastHeading || 0,
                    animating: true,

                    setTarget: function(lng, lat, heading) {
                        if (this.currentLng === null) {
                            this.currentLng = lng; this.currentLat = lat;
                        }
                        this.targetLng = lng;
                        this.targetLat = lat;

                        if (heading !== null) {
                            // Verhindert den 360-Grad-Kreisel-Bug (z.B. von 359° auf 1° springen)
                            let diff = heading - this.currentHeading;
                            diff = ((diff + 180) % 360 + 360) % 360 - 180;
                            this.targetHeading = this.currentHeading + diff;
                        }
                    },

                    loop: function() {
                        if (!this.animating) return;
                        requestAnimationFrame(this.loop.bind(this));

                        if (this.currentLng === null) return;

                        // Sanftes Gleiten: Zieht den Pfeil pro Frame um 10% ans echte GPS-Ziel
                        const ease = 0.1;
                        this.currentLng += (this.targetLng - this.currentLng) * ease;
                        this.currentLat += (this.targetLat - this.currentLat) * ease;
                        this.currentHeading += (this.targetHeading - this.currentHeading) * ease;

                        // Globale Koordinaten für die Kamera-Engine updaten
                        currentCoords = [this.currentLng, this.currentLat]; 

                        if (window.userLocationMarker) {
                            window.userLocationMarker.setLngLat(currentCoords);
                            window.userLocationMarker.setRotation(this.currentHeading);
                        }
                    },
                    stop: function() { this.animating = false; }
                };
                window.MarkerAnimator.loop(); // Startet den 60FPS-Maler!
                // ====================================================

                navWatchId = navigator.geolocation.watchPosition((position) => {
                    const elapsedSinceStart = Date.now() - window.navStartTime;
                    const lng = position.coords.longitude;
                    const lat = position.coords.latitude;
                    const heading = position.coords.heading; 
                    const speed = position.coords.speed; 

                    let speedKmh = speed ? Math.round(speed * 3.6) : 0;
                    const speedDisplay = document.getElementById('hud-current-speed');
                    if (speedDisplay) speedDisplay.textContent = speedKmh;

                    // --- MARKER-ZIEL SETZEN (Die 60FPS-Engine übernimmt das Zeichnen) ---
                    // Unter 5 km/h frieren wir die Drehung ein, damit der Pfeil an der Ampel nicht zittert
                    if (speedKmh > 5 && heading !== null) {
                        window.lastHeading = heading;
                        window.MarkerAnimator.setTarget(lng, lat, heading);
                    } else {
                        // Im Stand nur die Position updaten, nicht die Drehung
                        window.MarkerAnimator.setTarget(lng, lat, null);
                    }
                    // ---------------------------------------------------------
                    // --- DIE SMART CAMERA ENGINE STARTEN ---
                    let currentManeuver = null;
                    let distMeters = 0;

                    if (libreMap && elapsedSinceStart > 2500 && !window.userIsLookingAround) {

                        const activeRoutePts = RouteLogic.routePointsData[RouteLogic.activeIndex];
                        const cumulativeDists = RouteLogic.routeCumulativeDistances[RouteLogic.activeIndex];

                        if (activeRoutePts && cumulativeDists && RouteLogic.currentInstructions && RouteLogic.currentInstructions.length > 0) {
                            if (typeof window.lastRouteIdx === 'undefined') window.lastRouteIdx = 0;

                            let closestIdx = window.lastRouteIdx;
                            let minDist = Infinity;
                            const limit = Math.min(activeRoutePts.length, closestIdx + 120); 

                            for (let i = closestIdx; i < limit; i++) {
                                const d = calculateDistance(lat, lng, activeRoutePts[i][1], activeRoutePts[i][0]);
                                if (d < minDist) {
                                    minDist = d;
                                    closestIdx = i;
                                }
                            }
                            window.lastRouteIdx = closestIdx;

                            let currIdx = RouteLogic.currentInstructionIndex;
                            const instructions = RouteLogic.currentInstructions;

                            while (currIdx < instructions.length && instructions[currIdx].maneuver === 'DEPART') {
                                RouteLogic.currentInstructionIndex++;
                                currIdx = RouteLogic.currentInstructionIndex;
                            }

                            if (currIdx < instructions.length) {
                                currentManeuver = instructions[currIdx];

                          // ====================================================
                                // === BOSS-FIX: DIE PERFEKTE ASPHALT-DISTANZ ===
                                // ====================================================
                                let isPassed = closestIdx >= currentManeuver.pointIndex; 

                                // Wir nutzen ausschließlich die echte TomTom-Kurvenlänge!
                                // Keine Luftlinie, kein Vektor-Zuschlag. Nur Zielpunkt minus aktueller Punkt.
                                distMeters = cumulativeDists[currentManeuver.pointIndex] - cumulativeDists[closestIdx];

                                if (distMeters < 0 || isPassed) distMeters = 0;
                                // ====================================================


                                if (isPassed || distMeters <= 35) {
                                    RouteLogic.currentInstructionIndex++;
                                    currIdx = RouteLogic.currentInstructionIndex;

                                    while (currIdx < instructions.length && instructions[currIdx].maneuver === 'DEPART') {
                                        RouteLogic.currentInstructionIndex++;
                                        currIdx = RouteLogic.currentInstructionIndex;
                                    }

                                    if (currIdx < instructions.length) {
                                        currentManeuver = instructions[currIdx];
                                        distMeters = cumulativeDists[currentManeuver.pointIndex] - cumulativeDists[closestIdx];
                                        if (distMeters < 0) distMeters = 0;

                                        window.voiceBlockUntil = Date.now() + 5000;
                                        RouteLogic.forceFirstInstruction = false;
                                        if (window.startVoiceTimeout) clearTimeout(window.startVoiceTimeout);
                                        window.startVoiceTimeout = setTimeout(() => {
                                            RouteLogic.forceFirstInstruction = true;
                                        }, 3500);
                                    }
                                }

           // ================// ==========================================
                                // === BOSS-FIX: LOOK-AHEAD VOICE ENGINE (SHADOW MODE) ===
                                // ==========================================

                                // --- NEU: PROXIMITY SIGNPOST FILTER (Schilderklau) ---
                                let peekSchild = currIdx + 1;
                                while (peekSchild < instructions.length && instructions[peekSchild].maneuver === 'DEPART') peekSchild++;

                                if (peekSchild < instructions.length) {
                                    const nextMan = instructions[peekSchild];
                                    const distToNext = cumulativeDists[nextMan.pointIndex] - cumulativeDists[currentManeuver.pointIndex];

                                    if (distToNext <= 250 && nextMan.signpostText) {
                                        currentManeuver.signpostText = nextMan.signpostText;
                                    }
                                }
                                // ----------------------------------------------------

                                // ==========================================
                                // === BOSS-FIX: THE LANE MATCHER ===
                                // ==========================================
                                // Wir prüfen, ob es für unseren aktuellen Punkt Spuren gibt!
                                if (RouteLogic.currentLaneGuidance && RouteLogic.currentLaneGuidance.length > 0) {
                                    // 1. Sicherheitshalber das lanes-Array des aktuellen Manövers löschen, 
                                    // um Geisterspuren aus vorherigen Manövern zu vermeiden.
                                    currentManeuver.lanes = null; 

                                    // 2. Suchen wir den passenden Spur-Abschnitt für unseren aktuellen Standort (closestIdx)
                                    for (let i = 0; i < RouteLogic.currentLaneGuidance.length; i++) {
                                        const guidanceObj = RouteLogic.currentLaneGuidance[i];

                                        if (guidanceObj.lanes && guidanceObj.lanes.length > 0) {
                                            // TomTom verpackt die Start/Endpunkte in laneSections (meist nur ein Array-Element)
                                            // Optional: Wir nutzen einen kleinen "Vorlauf" (z.B. + 2 Punkte), damit die Spuren 
                                            // minimal früher im HUD aufpoppen.
                                            const section = guidanceObj.laneSections?.[0];
                                            const lookAheadIdx = closestIdx + 2; 

                                            if (section && lookAheadIdx >= section.startPointIndex && closestIdx <= section.endPointIndex) {
                                                // MATCH! Wir injizieren die Spuren aus dem Kofferraum (laneGuidance) 
                                                // in das Handschuhfach (currentManeuver), wo unser HUD-Code sie erwartet!
                                                currentManeuver.lanes = guidanceObj.lanes;
                                                break; // Sobald wir einen Match haben, beenden wir die Suche
                                            }
                                        }
                                    }
                                }
                                // ==========================================

                                // ==========================================
                                // === BOSS-FIX: DER ECHTE LANE MATCHER ===
                                // ==========================================
                         // ==========================================
                                // === BOSS-FIX: DER ECHTE LANE MATCHER ===
                                // ==========================================
                                currentManeuver.lanes = null;
                                if (RouteLogic.currentLaneSections && RouteLogic.currentLaneSections.length > 0) {
                                    // Wir scannen alle Spur-Abschnitte der Route ab
                                    for (let i = 0; i < RouteLogic.currentLaneSections.length; i++) {
                                        const section = RouteLogic.currentLaneSections[i];
                                        // Wenn das Auto (closestIdx) sich im Bereich der Spuren befindet 
                                        // (mit 3 GPS-Punkten Vorlauf, damit sie frühzeitig aufpoppen!)
                                        if (closestIdx >= section.startPointIndex - 3 && closestIdx <= section.endPointIndex) {
                                            currentManeuver.lanes = section.lanes;
                                            break;
                                        }
                                    }
                                }
                                // ==========================================

                                const shortInfo = getShortInstruction(currentManeuver);
                                const laneText = getLaneText(currentManeuver);
                                const baseActionStr = `${shortInfo.action} ${shortInfo.street}`.trim();

                                // 1. Deine alte, funktionierende UI-Sicherheit
                                let actionStr = (distMeters <= 600 && laneText) ? `${baseActionStr}, ${laneText}` : baseActionStr;

                                // 2. Die NEUE Situation Engine (Rechnet im Hintergrund)
                                const upcoming = getUpcomingManeuvers(instructions, currIdx, 3);
                                const situation = detectSituation(currentManeuver, upcoming, cumulativeDists);

                                let smartActionStr = buildInstruction(currentManeuver, upcoming, situation, shortInfo);
                                if (distMeters <= 600 && laneText) {
                                    smartActionStr += `, ${laneText}`; // Spuren anhängen
                                }

                                // 3. Cognitive Load Check (Zu viele Infos auf der Autobahn killen!)
                                if (distMeters < 100 || speedKmh > 100) {
                                    smartActionStr = shortInfo.action; // Simpler Modus
                                }

                                // 4. Fallback für dein aktuelles HUD (Damit nichts kaputt geht!)
                                if (situation === 'PRE_EXIT_SEQUENCE' && upcoming[0]) {
                                    const nextShortInfo = getShortInstruction(upcoming[0]);
                                    actionStr = `${actionStr}, um im Anschluss die ${nextShortInfo.action} ${nextShortInfo.street} zu nehmen`;
                                }

                                // 🔥 DAS IST DER FLIGHT-RECORDER 🔥
                                // Er vergleicht lautlos, was die alte Engine macht und was die neue KI denken würde
                                console.log(`🧠 [SHADOW ENGINE] Distanz: ${Math.round(distMeters)}m | Speed: ${speedKmh}kmh`);
                                console.log(`   - TomTom Original: ${currentManeuver.maneuver}`);
                                console.log(`   - Situation erkannt: ${situation}`);
                                console.log(`   - Altes HUD würde sagen: "${actionStr}"`);
                                console.log(`   - Neue KI würde sagen:   "${smartActionStr}"`);
                                // ==========================================

                                if (RouteLogic.voiceState.idx !== currIdx && elapsedSinceStart > 4000) {
                                    let trueSegDist = distMeters; 
                                    if (currIdx > 0) {
                                        let prevIdx = currIdx - 1;
                                        while (prevIdx > 0 && instructions[prevIdx].maneuver === 'DEPART') prevIdx--;
                                        if (cumulativeDists[instructions[prevIdx].pointIndex] !== undefined) {
                                            trueSegDist = cumulativeDists[currentManeuver.pointIndex] - cumulativeDists[instructions[prevIdx].pointIndex];
                                        }
                                    } else {
                                        trueSegDist = cumulativeDists[currentManeuver.pointIndex];
                                    }
                                    if (trueSegDist < distMeters || isNaN(trueSegDist)) trueSegDist = distMeters;

                                    RouteLogic.voiceState = {
                                        idx: currIdx,
                                        segmentTotalDist: trueSegDist,
                                        spokenInit: false, 
                                        spoken5km: false,
                                        spoken2km: false,  
                                        spoken500m: false,
                                        spoken100m: false,
                                        spoken50m: false,
                                        spokenNow: false
                                    };
                                }

                                let vs = RouteLogic.voiceState;
                                let textToSpeak = null;

                               if (Date.now() > window.voiceBlockUntil || RouteLogic.forceFirstInstruction) {

                                    // Erkennen, ob das aktuelle Manöver eine Auffahrt ist
                                    const isAuffahren = currentManeuver && currentManeuver.maneuver && currentManeuver.maneuver.includes('ENTER_MOTORWAY');

                                    if (!vs.spokenInit) {
                                        RouteLogic.forceFirstInstruction = false;

                                        if (isAuffahren) {
                                            // BOSS-FIX: Bei Auffahrten labern wir den Fahrer nicht voll. 
                                            // Einmaliger Hinweis ohne Distanz.
                                            textToSpeak = actionStr;
                                            // Trick 17: Wir setzen alle Countdown-Variablen auf 'true', 
                                            // damit die Engine in diesem Streckenabschnitt für immer die Klappe hält!
                                            vs.spoken5km = true; vs.spoken2km = true; vs.spoken500m = true; vs.spoken100m = true; vs.spoken50m = true; vs.spokenNow = true;
                                        } 
                                        else if (distMeters < 70) {
                                            textToSpeak = actionStr; 
                                        } else if (vs.segmentTotalDist > 5000) {
                                            textToSpeak = `Folgen Sie der Route für ${Math.round(vs.segmentTotalDist/1000)} Kilometer.`;
                                        } else {
                                            textToSpeak = `In ${formatDist(distMeters)} ${actionStr}.`;
                                        }

                                        vs.spokenInit = true;
                                    }
                                    else {
                                        // Normaler Countdown für alle anderen Manöver (z.B. Ausfahrten)
                                        if (vs.segmentTotalDist > 10000) {
                                            if (distMeters <= 5000 && distMeters > 2000 && !vs.spoken5km) { textToSpeak = `In 5 Kilometern ${actionStr}.`; vs.spoken5km = true; }
// ... (Dein restlicher Code mit den Countdowns bleibt exakt gleich) ...
                                            else if (distMeters <= 2000 && distMeters > 500 && !vs.spoken2km) { textToSpeak = `In 2 Kilometern ${actionStr}.`; vs.spoken2km = true; }
                                            else if (distMeters <= 500 && distMeters > 100 && !vs.spoken500m) { textToSpeak = `In 500 Metern ${actionStr}.`; vs.spoken500m = true; }
                                            else if (distMeters <= 100 && distMeters > 15 && !vs.spoken100m) { textToSpeak = `In 100 Metern ${actionStr}.`; vs.spoken100m = true; }
                                        }
                                        else if (vs.segmentTotalDist > 5000 && vs.segmentTotalDist <= 10000) {
                                            if (distMeters <= 2000 && distMeters > 500 && !vs.spoken2km) { textToSpeak = `In 2 Kilometern ${actionStr}.`; vs.spoken2km = true; }
                                            else if (distMeters <= 500 && distMeters > 100 && !vs.spoken500m) { textToSpeak = `In 500 Metern ${actionStr}.`; vs.spoken500m = true; }
                                            else if (distMeters <= 100 && distMeters > 15 && !vs.spoken100m) { textToSpeak = `In 100 Metern ${actionStr}.`; vs.spoken100m = true; }
                                        }
                                        else if (vs.segmentTotalDist > 800 && vs.segmentTotalDist <= 5000) {
                                            if (distMeters <= 500 && distMeters > 100 && !vs.spoken500m) { textToSpeak = `In 500 Metern ${actionStr}.`; vs.spoken500m = true; }
                                            else if (distMeters <= 100 && distMeters > 15 && !vs.spoken100m) { textToSpeak = `In 100 Metern ${actionStr}.`; vs.spoken100m = true; }
                                        }
                                        else if (vs.segmentTotalDist >= 200 && vs.segmentTotalDist <= 800) {
                                            if (distMeters <= 100 && distMeters > 15 && !vs.spoken100m) { textToSpeak = `In 100 Metern ${actionStr}.`; vs.spoken100m = true; }
                                        }
                                        else if (vs.segmentTotalDist < 200) {
                                            if (distMeters <= 50 && distMeters > 15 && !vs.spoken50m) { textToSpeak = `In 50 Metern ${actionStr}.`; vs.spoken50m = true; }
                                        }

                                        if (distMeters <= 15 && !vs.spokenNow) {
                                            textToSpeak = actionStr; 
                                            vs.spokenNow = true;
                                        }
                                    }
                                    if (textToSpeak) triggerGoogleVoice(textToSpeak);
                                }
                            }
                        }

                        // Kamera aktualisieren (Live Daten)
                        const safeDist = (typeof distMeters !== 'undefined' && distMeters !== null) ? distMeters : 9999;
                        const safeManeuver = (typeof currentManeuver !== 'undefined') ? currentManeuver : null;

                        window.SmartCameraEngine.update(
                            libreMap, 
                            currentCoords, 
                            heading, 
                            speedKmh, 
                            safeDist, 
                            safeManeuver
                        );
                    }
// BOSS-FEATURE: Live Ampel-Scanner (Drosselt sich selbst auf 15s)
                    if (window.isNavigating && speedKmh > 5) {
                        scanTrafficLightsForNext3KM();
                    }

                   // ====================================================
                    // === BOSS-FIX: DIE EINZIGE HUD-ENGINE (PHASE ENGINE V1.1) ===
                    // ====================================================

                    // 1. DIE WEICHE: Woher kommen die Daten?
                    let renderManeuver = currentManeuver; 
                    let renderDist = distMeters;

                    if (window.testScenarioIdx > 0) {
                        renderManeuver = window.NavTestScenarios[window.testScenarioIdx];
                        renderDist = renderManeuver.mockDist;
                    }

                    if (!renderManeuver) return; 

                    // === BOSS-FIX: TOMTOM LANE ADAPTER (Übersetzt TomTom auf unser HUD) ===
                    if (renderManeuver.lanes) {
                        renderManeuver.lanes = renderManeuver.lanes.map(lane => {
                            // Wenn TomTom "follow" schickt (die Richtung), machen wir daraus unser "valid = true"
                            let isValid = lane.follow ? true : false;
                            // Wir mappen die neuen "directions" auf unsere alten "indications"
                            let newIndications = lane.directions ? lane.directions : [];

                            return { ...lane, valid: isValid, indications: newIndications };
                        });
                    }

                    const shortInfo = getShortInstruction(renderManeuver);
                    const manType = renderManeuver.maneuver || '';

                    // --- 2. DIE PHASE ENGINE LOGIK ---
                    let navPhase = "CRUISE";
                    const isKeep = manType.includes('KEEP') || manType.includes('BIFURCATION');
                    const isExit = manType.includes('EXIT') || manType.includes('OFF_RAMP');
                    const isTurn = manType.includes('TURN');

                    // ERKENNUNG: Ist es eine 2-Phasen-Abfahrt? (Kombi-Spur vorhanden)
                    let isAbfahrt = false;
                    if (isExit && renderManeuver.lanes) {
                        const hasComboLane = renderManeuver.lanes.some(l => {
                            if (!l.valid || !l.indications) return false;
                            const inds = l.indications.map(i => i.toLowerCase());
                            // Wenn eine Spur "Geradeaus" UND "Rechts/Links" erlaubt, sind wir auf einer Vor-Abfahrt!
                            return inds.includes('straight') && inds.some(i => i.includes('right') || i.includes('left'));
                        });
                        if (hasComboLane) isAbfahrt = true;
                    }

                    // Phase zuweisen
                    if (isKeep) navPhase = "PRE_EXIT"; 
                    else if (isExit) navPhase = "EXIT";           
                    else if (isTurn) navPhase = "TURN";           

                    // A) Hauptaktion Text
                    let actionText = shortInfo.action;
                    // WUNSCH: Wenn es Phase 1 einer Ausfahrt ist, benennen wir es in "Halten" um!
                    if (isAbfahrt) {
                        actionText = manType.includes('LEFT') ? "Links halten" : "Rechts halten";
                    }

                    const actionEl = document.getElementById('nav-top-action');
                    if (actionEl) actionEl.textContent = actionText;

                // B) Meter-Anzeige (Distanz bei "Halten" zeigen, bei "Auffahren" verstecken)
                    const distEl = document.getElementById('nav-top-distance');
                    if (distEl) {
                        // NEU: Wir verstecken die Distanz NUR noch beim Auffahren.
                        // "Links/Rechts halten" (PRE_EXIT) kriegt seine Distanz zurück!
                        if (manType.includes('ENTER_MOTORWAY')) {
                            distEl.style.display = 'none'; 
                        } else {
                            distEl.style.display = 'block';
                            let displayDist = Math.max(0, Math.round(renderDist / 10) * 10);
                            if (displayDist >= 1000) {
                                distEl.textContent = `in ${(displayDist / 1000).toFixed(1).replace('.', ',')} km`;
                            } else {
                                distEl.textContent = `in ${displayDist} m`;
                            }
                        }
                    }

       // C) Das Haupt-Icon (Dynamische Rotation)
                    const iconEl = document.getElementById('nav-top-icon');
                    if (iconEl) {
                        let iconClass = 'fa-arrow-up'; 
                        let rotation = 'rotate(0deg)';

                        if (navPhase === "EXIT" || manType.includes('EXIT') || manType.includes('SWITCH_MOTORWAY') || manType.includes('TAKE_EXIT')) {
                            iconClass = 'fa-arrow-up'; 
                            rotation = manType.includes('LEFT') ? 'rotate(-45deg)' : 'rotate(45deg)'; 
                        }
                        else if (navPhase === "PRE_EXIT" || manType.includes('KEEP') || manType.includes('ENTER_MOTORWAY') || manType.includes('FOLLOW')) { 
                            iconClass = 'fa-arrow-up'; 
                            rotation = 'rotate(0deg)'; 
                        }
                        else if (manType.includes('TURN_LEFT') || manType.includes('SHARP_LEFT')) { iconClass = 'fa-arrow-left'; }
                        else if (manType.includes('TURN_RIGHT') || manType.includes('SHARP_RIGHT')) { iconClass = 'fa-arrow-right'; }
                        else if (manType.includes('BEAR_LEFT') || manType.includes('SLIGHT_LEFT')) { iconClass = 'fa-arrow-up'; rotation = 'rotate(-30deg)'; }
                        else if (manType.includes('BEAR_RIGHT') || manType.includes('SLIGHT_RIGHT')) { iconClass = 'fa-arrow-up'; rotation = 'rotate(30deg)'; }
                        else if (manType.includes('U_TURN')) { iconClass = 'fa-arrow-rotate-left'; }
                        else if (manType.includes('ROUNDABOUT')) { iconClass = 'fa-arrows-spin'; } 

                        iconEl.className = `fa-solid ${iconClass}`;
                        iconEl.style.transform = rotation; 
                        iconEl.style.display = 'inline-block'; 
                    }

                 // D) Schilder & Straßentexte bereinigen
                    const streetEl = document.getElementById('nav-top-street');
                    if (streetEl) {
                        streetEl.innerHTML = ''; 
                        let rn = "";

                        if (renderManeuver.roadNumbers && renderManeuver.roadNumbers.length > 0) {
                            rn = renderManeuver.roadNumbers[0];
                            let badgeClass = '';
                            if (rn.startsWith('A')) badgeClass = 'autobahn';
                            else if (rn.startsWith('B')) badgeClass = 'bundesstrasse';
                            // BOSS-FIX: Bayerische Staatsstraßen (St), Landesstraßen (L) und Kreisstraßen (K)
                            else if (rn.startsWith('St') || rn.startsWith('L') || rn.startsWith('K')) badgeClass = 'landesstrasse';

                            if (badgeClass) streetEl.innerHTML += `<span class="road-badge ${badgeClass}">${rn}</span>`;
                        }

                        let directionText = renderManeuver.signpostText || renderManeuver.destination || "";
                        let baseStreet = renderManeuver.street || "";

                        // --- BOSS-FIX: DER INTELLIGENTE TEXT-FILTER ---
                        let finalString = "";

                        if (directionText) {
                            // Wenn wir ein echtes Schild haben (z.B. "München-Ost"), 
                            // ignorieren wir die aktuelle Straße (z.B. "A9") komplett!
                            finalString = `Richtung ${directionText}`;
                        } else if (baseStreet) {
                            // Wenn es KEIN Schild gibt (z.B. Stadtverkehr auf der B16), zeigen wir die Straße.
                            // Wir putzen aber doppelte "B16" aus dem Text, falls das Badge schon "B16" ist.
                            if (rn && baseStreet.includes(rn)) {
                                baseStreet = baseStreet.replace(rn, '').trim();
                                if (baseStreet.startsWith('-') || baseStreet.startsWith(',')) {
                                    baseStreet = baseStreet.substring(1).trim();
                                }
                            }
                            finalString = baseStreet;
                        }

                        let textSpan = document.createElement('span');
                        textSpan.textContent = finalString.trim();
                        streetEl.appendChild(textSpan);
                        streetEl.style.display = 'block';

              // E) Der Spur-Assistent (TOMTOM PRO-LEVEL ARCHITECTURE)
                        let laneContainer = document.getElementById('nav-top-lanes');
                        if (!laneContainer) {
                            laneContainer = document.createElement('div');
                            laneContainer.id = 'nav-top-lanes';
                            laneContainer.className = 'lane-assist-container';
                            streetEl.parentNode.appendChild(laneContainer);
                        }

                        // 1. Sichere Variablen
                        const mType = manType || ""; 

                        // 2. Elegante Sichtbarkeits-Regel (Keine Spuren im Kreisverkehr oder beim Abbiegen)
                        const showLanes = renderManeuver?.lanes?.length > 0 && 
                                          navPhase !== "TURN" && 
                                          !mType.includes("ROUNDABOUT");

                        if (!showLanes) {
                            laneContainer.style.display = 'none';
                            // Wichtig: Container leeren, damit bei der nächsten Einblendung keine Geister-Pfeile auftauchen
                            if (laneContainer.innerHTML !== '') laneContainer.innerHTML = '';
                            return; 
                        }

                        // 3. Performance-Check: Nur neu zeichnen, wenn sich das Manöver wirklich geändert hat!
                        // (Verhindert das Flackern bei jedem GPS-Tick)
                        const currentLaneSig = renderManeuver.lanes.map(l => (l.follow ? '1' : '0') + (l.directions ? l.directions.join() : '')).join('-');
                        if (laneContainer.dataset.laneSig === currentLaneSig) {
                            // Die Spuren sind noch exakt die gleichen -> Wir müssen den DOM nicht anfassen!
                            laneContainer.style.display = 'flex';
                            return;
                        }
                        laneContainer.dataset.laneSig = currentLaneSig;

                        // 4. Frisches Rendering (mit DocumentFragment für maximale Performance)
                        laneContainer.innerHTML = ''; 
                        laneContainer.style.display = 'flex';
                        const fragment = document.createDocumentFragment();

                        renderManeuver.lanes.forEach(lane => {
                            const isValidLane = !!lane.follow; // Sauberer Boolean-Check

                            const arrowDiv = document.createElement('div');
                            arrowDiv.className = `lane-arrow ${isValidLane ? 'valid' : ''}`;

                            let faIcon = 'fa-arrow-up'; 
                            let laneRot = 0; // Wir rechnen jetzt in echten Zahlen

                            if (lane.directions && Array.isArray(lane.directions)) {
                                const dirs = lane.directions.map(d => d.toLowerCase());

                                if (navPhase === "PRE_EXIT" || mType.includes("KEEP")) {
                                    // Ruhiges UI vor der Gabelung
                                    laneRot = 0;
                                } 
                                else if (navPhase === "EXIT" || mType.includes('EXIT') || mType.includes('SWITCH_MOTORWAY')) {
                                    // Organische Winkel für Ausfahrten
                                    if (dirs.includes('sharp_right')) laneRot = 55;
                                    else if (dirs.includes('right')) laneRot = 35;
                                    else if (dirs.includes('slight_right')) laneRot = 20;
                                    else if (dirs.includes('sharp_left')) laneRot = -55;
                                    else if (dirs.includes('left')) laneRot = -35;
                                    else if (dirs.includes('slight_left')) laneRot = -20;
                                }
                            }

                            arrowDiv.innerHTML = `<i class="fa-solid ${faIcon}" style="transform: rotate(${laneRot}deg); display: inline-block;"></i>`;
                            fragment.appendChild(arrowDiv);
                        });

                        laneContainer.appendChild(fragment);
                    }
                    // ====================================================

                }, (error) => {
                    console.warn("GPS Signal verloren:", error);
                }, { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 });
            }
        });
    }
   // ==========================================
    // === NOT-AUS: DER NUKLEAR-ABBRUCH ===
    // ==========================================
    const btnCancelActiveNav = document.getElementById('btn-cancel-active-nav');
    if (btnCancelActiveNav) {
        btnCancelActiveNav.onclick = (e) => {
            e.stopPropagation();

            // BOSS-FIX: Free Look Engine hart abschalten
            window.isNavigating = false;
            window.userIsLookingAround = false;
            if (window.resumeNavTimer) clearTimeout(window.resumeNavTimer);

            // NEU: Die 60FPS Pfeil-Animation hart stoppen!
            if (window.MarkerAnimator) window.MarkerAnimator.stop();

            if (mapSettingsBtn) mapSettingsBtn.classList.add('hidden');
            if (mapSettingsOverlay) mapSettingsOverlay.classList.add('hidden');

            // 0. GPS MOTOR ABWÜRGEN
            if (navWatchId !== null) {
                navigator.geolocation.clearWatch(navWatchId);
                navWatchId = null;
            }

            const speedDisplay = document.getElementById('hud-current-speed');
            if (speedDisplay) speedDisplay.textContent = '0';

            document.getElementById('navigation-hud-pill').classList.add('hidden');
            btnCancelActiveNav.classList.add('hidden');

            const testBtn = document.getElementById('btn-test-hud');
            if(testBtn) testBtn.classList.add('hidden');
            window.testScenarioIdx = 0; // Simulator hart zurücksetzen

            // Top-Card beim Abbruch sprengen
            const topCard = document.getElementById('nav-top-card');
            if (topCard) topCard.classList.add('hidden');

            const routeUI = document.getElementById('route-overview-ui');
            if (routeUI) {
                routeUI.classList.remove('fade-out'); 
                routeUI.classList.add('hidden');
            }

            const searchInput = document.getElementById('tomtom-search-input');
            if (searchInput) {
                searchInput.value = '';
                searchInput.blur();
            }

            const bottomSheet = document.getElementById('map-bottom-sheet');
            if (bottomSheet) bottomSheet.style.display = 'flex';

            const pillV = document.querySelector('.map-controls-pill-v');
            if (pillV) pillV.style.display = 'flex';

            // Suchleiste wieder anzeigen!
            const topSearch = document.getElementById('top-search-container');
            if (topSearch) topSearch.style.display = 'flex';

            const shrinkBtnMap = document.getElementById('btn-shrink-map');
            if (shrinkBtnMap) {
                shrinkBtnMap.style.opacity = ''; 
                shrinkBtnMap.style.pointerEvents = '';
            }

            clearRoutes();

            if (libreMap && currentCoords) {
                // 1. Aus Pfeil wird wieder Punkt
                if (window.userLocationMarker) {
                    const el = window.userLocationMarker.getElement();
                    el.innerHTML = '<div class="user-pulse"></div><div class="user-dot"></div>';
                    window.userLocationMarker.setRotation(0); // Drehung resetten
                }

                // 2. Kamera wieder gerade über die Map hängen
                libreMap.dragPan.enable();
                libreMap.scrollZoom.enable();
                libreMap.flyTo({ 
                    center: currentCoords, 
                    zoom: 14, 
                    pitch: 0, 
                    bearing: 0, 
                    padding: { top: 0, bottom: 0, left: 0, right: 0 }, // Zentrierung zurücksetzen
                    duration: 1500 
                });
            }
        };
    }
  // ==========================================
    // === GOOGLE TEXT-TO-SPEECH ENGINE ===
    // ==========================================
    window.cachedGoogleTtsKey = null; // NEU: Der Turbo-Cache für den Key!

    async function triggerGoogleVoice(text) {
        try {
            // NEU: Nur aus der Datenbank laden, wenn wir ihn noch nicht im Cache haben
            if (!window.cachedGoogleTtsKey) {
                const docRef = db.collection("config").doc("api_keys");
                const docSnap = await docRef.get();
                if (!docSnap.exists) { console.error("Kein API Key in Firestore gefunden!"); return; }
                window.cachedGoogleTtsKey = docSnap.data().google_tts;
            }

            const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${window.cachedGoogleTtsKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    input: { text: text },
                    voice: { languageCode: 'de-DE', name: 'de-DE-Wavenet-F' }, 
                    audioConfig: { audioEncoding: 'MP3', pitch: 0, speakingRate: 1.0 }
                })
            });

            if (!response.ok) throw new Error("TTS API Fehler: " + response.status);
            const data = await response.json();

     ttsAudioPlayer.src = "data:audio/mp3;base64," + data.audioContent;
            ttsAudioPlayer.play().catch(e => console.warn("Audio durch Browser blockiert:", e));

        } catch (error) {
            console.error("Sprachausgabe fehlgeschlagen:", error);
        }
    }


/* ========================================== */
/* === PREIS-ALARM LOGIK (IOS TASTATUR) ===== */
/* ========================================== */
function initPriceAlarm() {
    const input = document.getElementById('alarm-price-input');

    if (!input) {
        console.warn("Preis-Alarm Input nicht gefunden.");
        return;
    }

    input.addEventListener('change', async function(e) {
        const val = input.value;

        if(!val) return; 

        // === 1. PUSH-RECHTE VON APPLE ERZWINGEN ===
        if (window.Notification && Notification.permission !== 'granted') {
            try {
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    alert("❌ Push abgelehnt. Du musst es in den iOS-Einstellungen erlauben.");
                    return;
                }
            } catch (err) {
                alert("❌ Fataler Push-Fehler (HTTPS aktiv?): " + err);
                return;
            }
        }

        // === 2. FUNKSPRUCH AN DIE SW.JS (U-BOOT) ===
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'TEST_ALARM',
                price: val,
                delay: 20000 
            });
            alert(`✅ Alarm für ${val}€ scharf! Schließe jetzt die App komplett (wegwischen).`);
        } else {
            alert("❌ Kein Service Worker gefunden! Testest du über lokales Netzwerk ohne HTTPS?");
        }
    });
}
// ==========================================
    // === BOSS-FEATURE: FLIGHT MANIFEST ENGINE ===
    // ==========================================
    const btnDebug = document.getElementById('btn-debug-manifest');
    const manifestOverlay = document.getElementById('debug-manifest-overlay');
    const manifestContent = document.getElementById('debug-manifest-content');
    const btnCloseManifest = document.getElementById('btn-close-manifest');

    // Den Button zusammen mit dem Test-Button ("T") beim Start einblenden
    const originalBtnStartRoute = document.getElementById('btn-start-nav');
    if (originalBtnStartRoute && btnDebug) {
        originalBtnStartRoute.addEventListener('click', () => {
            btnDebug.classList.remove('hidden');
        });
    }

    // Den Button beim Abbruch der Navigation wieder verstecken
    const originalBtnCancelRoute = document.getElementById('btn-cancel-active-nav');
    if (originalBtnCancelRoute && btnDebug) {
        originalBtnCancelRoute.addEventListener('click', () => {
            btnDebug.classList.add('hidden');
        });
    }

    if (btnDebug && manifestOverlay) {
        // Tracker öffnen
        btnDebug.addEventListener('click', (e) => {
            e.stopPropagation();
            manifestOverlay.classList.remove('hidden');
            renderManifest();
        });

        // Tracker schließen
        btnCloseManifest.addEventListener('click', (e) => {
            e.stopPropagation();
            manifestOverlay.classList.add('hidden');
        });
function renderManifest() {
            if (!window.RouteLogic || !window.RouteLogic.currentInstructions || window.RouteLogic.currentInstructions.length === 0) {
                manifestContent.innerHTML = '<div style="color:#ff453a;">[SYSTEM] Keine Route aktiv. Lade TomTom Daten...</div>';
                return;
            }

            const instructions = window.RouteLogic.currentInstructions;
            const currentIndex = window.RouteLogic.currentInstructionIndex || 0;

            // Wir laden die ECHTEN Spuren aus unserem neuen Filter!
            const laneSections = window.RouteLogic.currentLaneSections || [];

            let html = '';

            // === 1. RÖNTGENBLICK: DIE ECHTEN SPUREN ===
            html += `
                <div style="margin-bottom: 20px; padding: 12px; background: rgba(10, 132, 255, 0.1); border: 1px solid #0a84ff; border-radius: 8px;">
                    <h3 style="color: #0a84ff; margin-top: 0; margin-bottom: 10px; font-size: 1rem;">
                        🛣️ TOMTOM LANE SECTIONS (${laneSections.length} Abschnitte gefunden!)
                    </h3>
                    <div style="max-height: 250px; overflow-y: auto; background: rgba(0,0,0,0.5); padding: 10px; border-radius: 6px;">
                        <pre style="margin: 0; color: #64d2ff; font-size: 0.75rem; line-height: 1.3;">${JSON.stringify(laneSections, null, 2)}</pre>
                    </div>
                </div>
            `;

            // === 2. MANÖVER ===
            instructions.forEach((inst, idx) => {
                const isCurrent = idx === currentIndex;
                const rowClass = isCurrent ? 'manifest-row current-row' : 'manifest-row';

                const maneuver = inst.maneuver || 'UNKNOWN_MANEUVER';
                const street = inst.street || (inst.roadNumbers ? inst.roadNumbers.join(', ') : 'Keine Straßeninfo');
                const sign = inst.signpostText || inst.destination || 'Kein Beschilderungstext';

                const rawJson = JSON.stringify(inst, null, 2);

                html += `
                    <div class="${rowClass}" style="flex-direction: column; margin-bottom: 15px;">
                        <div style="display: flex; gap: 12px; margin-bottom: 10px;">
                            <div class="mf-idx">[${idx.toString().padStart(2, '0')}]</div>
                            <div class="mf-details">
                                <div class="mf-maneuver">${maneuver}</div>
                                <div class="mf-street">🛣️ ${street}</div>
                                <div class="mf-sign">🏁 ${sign}</div>
                            </div>
                        </div>
                        <div style="background: rgba(0,0,0,0.6); padding: 10px; border-radius: 8px; overflow-x: auto; border: 1px solid #333;">
                            <pre style="margin: 0; color: #30d158; font-size: 0.75rem; line-height: 1.3;">${rawJson}</pre>
                        </div>
                    </div>
                `;
            });

            manifestContent.innerHTML = html;

            setTimeout(() => {
                const activeRow = manifestContent.querySelector('.current-row');
                if (activeRow) {
                    activeRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 200);
        }
    }
}); // <--- DAS IST DIE EINZIGE KLAMMER DIE GANZ AM ENDE STEHEN DARF! SIE SCHLIEßT DEINE ALLERERSTE ZEILE GANZ OBEN.
