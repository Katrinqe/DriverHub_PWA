let map, userMarker;
let isDriveMode = false;
let watchId = null;

window.addEventListener('load', () => {
    // Splash Screen ausblenden
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if(splash) {
            splash.style.opacity = '0';
            setTimeout(() => splash.classList.add('hidden'), 800);
        }
    }, 1500);

    initMap();
    initWeather();

    // Buttons verbinden
    document.getElementById('nav-garage').onclick = showGarage;
    document.getElementById('nav-home').onclick = hideGarage;
    document.getElementById('nav-home-from-garage').onclick = hideGarage;
    document.getElementById('btn-start').onclick = startDriveMode;
    document.getElementById('btn-stop').onclick = () => DriverLogic.stop(); // Stop via Drive Logic
    document.getElementById('btn-recenter').onclick = () => centerMapOnUser();
});

function initMap() {
    // Karte initialisieren (Snap 0 für smootheren Zoom)
    map = L.map('background-map', {
        zoomControl: false, attributionControl: false,
        dragging: false, touchZoom: false, doubleClickZoom: false,
        zoomSnap: 0, zoomDelta: 0.5
    }).setView([51.1657, 10.4515], 14);

    // Hardware-beschleunigte Tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { 
        maxZoom: 20, 
        detectRetina: true 
    }).addTo(map);

    // GPS Starten
    startGPS();

    // Event für manuelles Bewegen
    map.on('dragstart', () => {
        if(isDriveMode) document.getElementById('btn-recenter').classList.remove('hidden');
    });
}

// Hilfsfunktion: GPS Starten
function startGPS() {
    if (navigator.geolocation) {
        // Falls schon an, erst ausmachen
        if(watchId) navigator.geolocation.clearWatch(watchId);
        
        watchId = navigator.geolocation.watchPosition(handlePositionUpdate, 
            (err) => console.warn(err), 
            { enableHighAccuracy: true, maximumAge: 0 }
        );
    }
}

// Hilfsfunktion: GPS Stoppen (Wichtig für Zoom!)
function stopGPS() {
    if(watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
}

function handlePositionUpdate(pos) {
    const newLatLng = L.latLng(pos.coords.latitude, pos.coords.longitude);

    // 1. Marker erstellen oder schieben
    if (!userMarker) {
        const icon = L.divIcon({ className: 'user-marker-wrap', html: '<div class="user-pulse"></div><div class="user-dot"></div>', iconSize: [40,40], iconAnchor: [20,20] });
        userMarker = L.marker(newLatLng, {icon: icon}).addTo(map);
        map.setView(newLatLng, 14);
    } else {
        userMarker.setLatLng(newLatLng);
    }

    // 2. Map-Bewegung (Nur wenn GPS an ist)
    if (isDriveMode) {
        DriverLogic.update(pos);
        
        // Smart Follow: Nur bewegen wenn wir nicht gerade zoomen oder manuell schieben
        if (document.getElementById('btn-recenter').classList.contains('hidden')) {
            const dist = map.getCenter().distanceTo(newLatLng);
            // Toleranz 10m
            if (dist > 10) { 
                map.panTo(newLatLng, { animate: true, duration: 1.0, easeLinearity: 0.2 });
            }
        }
    } else {
        // Home Mode: Langsam folgen
        const dist = map.getCenter().distanceTo(newLatLng);
        if(dist > 50) map.panTo(newLatLng, { animate: true, duration: 2.0 });
    }
}

function startDriveMode() {
    isDriveMode = true;
    switchScreen('drive-screen');

    // 1. Map interaktiv machen
    map.dragging.enable();
    map.touchZoom.enable();
    map.doubleClickZoom.enable();
    
    // 2. DER ZOOM FIX: GPS TÖTEN
    stopGPS(); 

    if(userMarker) {
        // 3. In absoluter Ruhe zoomen (Kein Ruckeln möglich, da kein GPS funkt)
        map.flyTo(userMarker.getLatLng(), 18, { 
            animate: true, 
            duration: 2.0, // Schön langsam
            easeLinearity: 0.2 
        });
    }

    // 4. GPS erst wieder einschalten, wenn Animation fertig ist (nach 2.2 sek)
    setTimeout(() => {
        startGPS();
        DriverLogic.start(); // Tracking starten
    }, 2200);
}

function centerMapOnUser() {
    if(userMarker) {
        // Auch beim Recenter: Kurz GPS aus für Smoothness
        stopGPS();
        map.flyTo(userMarker.getLatLng(), 18, { duration: 1.0 });
        document.getElementById('btn-recenter').classList.add('hidden');
        
        setTimeout(() => startGPS(), 1100);
    }
}

function showGarage() { switchScreen('garage-screen'); GarageLogic.render(); }

function hideGarage() { 
    switchScreen('home-screen'); 
    isDriveMode = false;
    map.dragging.disable();
    // Reset Zoom
    if(userMarker) {
        stopGPS();
        map.flyTo(userMarker.getLatLng(), 14, { duration: 1.5 });
        setTimeout(() => startGPS(), 1600);
    }
}

function switchScreen(id) {
    document.querySelectorAll('.screen').forEach(s => { s.classList.remove('active'); s.classList.add('hidden'); });
    const t = document.getElementById(id);
    t.classList.remove('hidden');
    setTimeout(() => t.classList.add('active'), 10);
}

function initWeather() {
    if (!navigator.geolocation) return;
    
    // Fallback Timer
    const weatherTimeout = setTimeout(() => {
        const el = document.getElementById('loc-text'); if(el) el.innerText = "Standort";
        const el2 = document.getElementById('weather-temp'); if(el2) el2.innerText = "--°";
    }, 4000);

    navigator.geolocation.getCurrentPosition(pos => {
        const lat = pos.coords.latitude; const lng = pos.coords.longitude;
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`)
        .then(r=>r.json()).then(d=>{
            clearTimeout(weatherTimeout);
            const el = document.getElementById('weather-temp');
            if(el) el.innerText = Math.round(d.current_weather.temperature) + "°";
        }).catch(e => console.log(e));

        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
        .then(r=>r.json()).then(d=>{
            const city = d.address.city || d.address.town || "Standort";
            const el = document.getElementById('loc-text');
            if(el) el.innerText = city;
        }).catch(e => console.log(e));
    });
}
