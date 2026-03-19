document.addEventListener('DOMContentLoaded', () => {
    const btnNewExplore = document.getElementById('nav-new-explore');
    const newExploreScreen = document.getElementById('new-explore-screen');
    const allNavItems = document.querySelectorAll('.nav-item');
    const mapContainerId = 'maplibre-snippet';
    
    // Globale MapLibre Instanz
    let libreMap = null;

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
        // Sicherstellen, dass der Container leer ist (für Hot-Reloads)
        const mapContainer = document.getElementById(mapContainerId);
        
        // 2. MapLibre Karte initialisieren
        libreMap = new maplibregl.Map({
            container: mapContainerId,
            style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json', // Ein kostenloser, sehr geiler Dark Style
            center: coords,
            zoom: 14, // Ein schöner Zoom für einen Ausschnitt
            
            // FÜR DIESEN TASK: KEINE INTERAKTIONER ERLAUBEN
            interactive: false, // User kann nicht scrollen/zoomen/drehen
            attributionControl: false // Die Map-Zuweisung unten rechts ausblenden
        });

 // Optischen Mittelpunkt verschieben (für visuelles Balancing)
        libreMap.on('load', () => {
            // setPadding verschiebt das mathematische Zentrum der Karte.
            // right: 150 bedeutet: "Tu so, als wäre rechts eine 150px breite Wand."
            // Dadurch weicht die Karte (und dein Marker) automatisch nach LINKS aus.
            libreMap.setPadding({
                right: 150,
                bottom: 30
            });
        });
        // 3. Einen Marker für den Standort hinzufügen (wenn wir einen haben)
  // 3. Einen Marker für den Standort hinzufügen (wenn wir einen haben)
        if (hasLocation) {
            // Eigenes HTML-Element für den DriverHub-Marker erstellen
            const customMarkerElement = document.createElement('div');
            customMarkerElement.className = 'user-marker-wrap';
            customMarkerElement.innerHTML = `
                <div class="user-pulse"></div>
                <div class="user-dot"></div>
            `;

            // Den Custom-Marker zur Karte hinzufügen
            new maplibregl.Marker({
                element: customMarkerElement
            })
            .setLngLat(coords)
            .addTo(libreMap);
        }

        // 4. Ein Resize-Handling nach kurzer Zeit
        // Manchmal braucht WebGL einen Moment, um die Container-Größe richtig zu berechnen
        setTimeout(() => {
            if (libreMap) libreMap.resize();
        }, 100);
    }
});
