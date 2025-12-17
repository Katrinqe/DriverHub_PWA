// --- APP.JS: Main Controller ---
let map, userMarker;
let isDriveMode = false;
let watchId = null;

// Initialisierung
window.addEventListener('load', () => {
    initMap();
    initWeather();
    
    // Buttons verbinden
    document.getElementById('btn-start').addEventListener('click', startDriveMode);
    document.getElementById('btn-garage-home').addEventListener('click', showGarage);
    document.getElementById('btn-close-garage').addEventListener('click', hideGarage);
    document.getElementById('btn-recenter').addEventListener('click', () => {
        centerMapOnUser(true);
    });
});

function initMap() {
    map = L.map('background-map', {
        zoomControl: false, attributionControl: false,
        dragging: true, // Erlauben, damit man sich umschauen kann
        touchZoom: true,
        doubleClickZoom: false
    }).setView([51.1657, 10.4515], 13);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(map);

    // Globales GPS Tracking starten (für Home & Drive)
    if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(handlePositionUpdate, err => console.warn(err), {
            enableHighAccuracy: true, maximumAge: 0
        });
    }

    // Wenn User Map bewegt -> Recenter Button zeigen
    map.on('dragstart', () => {
        if(isDriveMode) document.getElementById('btn-recenter').classList.remove('hidden');
    });
}

function handlePositionUpdate(pos) {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const speed = pos.coords.speed; // m/s
    const newLatLng = L.latLng(lat, lng);

    // Marker Update
    if (!userMarker) {
        const icon = L.divIcon({ className: 'user-marker-wrap', html: '<div class="user-pulse"></div><div class="user-dot"></div>', iconSize: [40,40], iconAnchor: [20,20] });
        userMarker = L.marker(newLatLng, {icon: icon}).addTo(map);
        map.setView(newLatLng, 16);
    } else {
        userMarker.setLatLng(newLatLng);
    }

    // Logik verteilen
    if (isDriveMode) {
        // Wenn Drive Mode: An Drive.js weitergeben
        DriverLogic.update(pos);
        
        // Auto-Follow nur wenn Button "hidden" ist (also User nicht weggezogen hat)
        if (document.getElementById('btn-recenter').classList.contains('hidden')) {
            map.panTo(newLatLng, { animate: true, duration: 1.0 }); // Smooth Pan
        }
    } else {
        // Home Mode: Nur sanft folgen wenn nicht manuell verschoben
        // (Hier vereinfacht: folgt immer leicht)
       // map.panTo(newLatLng, { animate: true, duration: 2.0 });
    }
}

function centerMapOnUser(force = false) {
    if(userMarker) {
        map.flyTo(userMarker.getLatLng(), 17, { duration: 1 });
        document.getElementById('btn-recenter').classList.add('hidden');
    }
}

// Screen Management
function switchScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active', 'hidden'));
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    
    const target = document.getElementById(id);
    target.classList.remove('hidden');
    setTimeout(() => target.classList.add('active'), 10);
}

function startDriveMode() {
    isDriveMode = true;
    switchScreen('drive-screen');
    centerMapOnUser(true);
    DriverLogic.start(); // Start Tracking
}

function showGarage() {
    switchScreen('garage-screen');
    document.getElementById('garage-bg').classList.remove('hidden');
    GarageLogic.render(); // Laden
}

function hideGarage() {
    switchScreen('home-screen');
    document.getElementById('garage-bg').classList.add('hidden');
}

// Wetter (kopiert aus altem Script)
function initWeather() {
    // ... (Code bleibt gleich, Platzhalter der Übersicht halber) ...
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
        const lat = pos.coords.latitude; const lng = pos.coords.longitude;
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
        .then(r=>r.json()).then(d=>{document.getElementById('loc-text').innerText = d.address.city || "Road";});
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`)
        .then(r=>r.json()).then(d=>{document.getElementById('weather-temp').innerText = Math.round(d.current_weather.temperature) + "°";});
    });
}
