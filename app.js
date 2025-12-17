let map, userMarker;
let isDriveMode = false;
let watchId = null;

window.addEventListener('load', () => {
    initMap();
    initWeather();
    
    // NAVIGATION
    document.getElementById('nav-garage').addEventListener('click', showGarage);
    document.getElementById('nav-home').addEventListener('click', hideGarage);
    document.getElementById('nav-home-from-garage').addEventListener('click', hideGarage);

    // DRIVE BUTTONS
    document.getElementById('btn-start').addEventListener('click', startDriveMode);
    
    // WICHTIG: Stop Button Listener
    document.getElementById('btn-stop').addEventListener('click', () => {
        DriverLogic.stop();
    });

    document.getElementById('btn-recenter').addEventListener('click', () => centerMapOnUser(true));
});

function initMap() {
    map = L.map('background-map', {
        zoomControl: false, attributionControl: false,
        dragging: false, // Home: Fest
        touchZoom: false, doubleClickZoom: false
    }).setView([51.1657, 10.4515], 15); // Start Zoom 15 (Weit)
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(map);

    if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(handlePositionUpdate, err => console.warn(err), {
            enableHighAccuracy: true
        });
    }

    map.on('dragstart', () => {
        if(isDriveMode) document.getElementById('btn-recenter').classList.remove('hidden');
    });
}

function handlePositionUpdate(pos) {
    const newLatLng = L.latLng(pos.coords.latitude, pos.coords.longitude);

    if (!userMarker) {
        const icon = L.divIcon({ className: 'user-marker-wrap', html: '<div class="user-pulse"></div><div class="user-dot"></div>', iconSize: [40,40], iconAnchor: [20,20] });
        userMarker = L.marker(newLatLng, {icon: icon}).addTo(map);
        map.setView(newLatLng, 15);
    } else {
        userMarker.setLatLng(newLatLng);
    }

    if (isDriveMode) {
        DriverLogic.update(pos);
        if (document.getElementById('btn-recenter').classList.contains('hidden')) {
            map.panTo(newLatLng, { animate: true, duration: 1.0 });
        }
    } else {
        // Home Mode: Sanft folgen ohne Zoom-Änderung
        map.panTo(newLatLng, { animate: true, duration: 2.0 });
    }
}

function startDriveMode() {
    isDriveMode = true;
    
    document.getElementById('home-screen').classList.remove('active');
    document.getElementById('home-screen').classList.add('hidden');
    document.getElementById('drive-screen').classList.remove('hidden');
    setTimeout(() => document.getElementById('drive-screen').classList.add('active'), 10);

    // Map freigeben & reinzoomen
    map.dragging.enable();
    map.touchZoom.enable();
    map.doubleClickZoom.enable();
    
    if(userMarker) {
        // ZOOM IN EFFEKT
        map.flyTo(userMarker.getLatLng(), 18, { duration: 1.5 });
    }

    DriverLogic.start();
}

function centerMapOnUser() {
    if(userMarker) {
        map.flyTo(userMarker.getLatLng(), 18, { duration: 0.8 });
        document.getElementById('btn-recenter').classList.add('hidden');
    }
}

function showGarage() {
    document.querySelectorAll('.screen').forEach(s => {s.classList.remove('active'); s.classList.add('hidden')});
    document.getElementById('garage-screen').classList.remove('hidden');
    setTimeout(() => document.getElementById('garage-screen').classList.add('active'), 10);
    GarageLogic.render();
}

function hideGarage() {
    document.querySelectorAll('.screen').forEach(s => {s.classList.remove('active'); s.classList.add('hidden')});
    document.getElementById('home-screen').classList.remove('hidden');
    setTimeout(() => document.getElementById('home-screen').classList.add('active'), 10);
    
    isDriveMode = false;
    map.dragging.disable();
    // Zoom zurücksetzen auf Home-Level
    if(userMarker) map.flyTo(userMarker.getLatLng(), 15, { duration: 1.5 });
}

function initWeather() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
        const lat = pos.coords.latitude; const lng = pos.coords.longitude;
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
        .then(r=>r.json()).then(d=>{document.getElementById('loc-text').innerText = d.address.city || "Standort";});
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`)
        .then(r=>r.json()).then(d=>{document.getElementById('weather-temp').innerText = Math.round(d.current_weather.temperature) + "°";});
    });
}
