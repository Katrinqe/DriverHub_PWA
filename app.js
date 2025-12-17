let map, userMarker;
let isDriveMode = false;
let watchId = null;

window.addEventListener('load', () => {
    // Splash Screen Logic
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        splash.style.opacity = '0';
        setTimeout(() => splash.classList.add('hidden'), 800);
    }, 1500); // 1.5 sekunden zeigen

    initMap();
    initWeather();
    
    // Nav Logic
    document.getElementById('nav-garage').addEventListener('click', showGarage);
    document.getElementById('nav-home').addEventListener('click', hideGarage);
    document.getElementById('nav-home-from-garage').addEventListener('click', hideGarage);

    document.getElementById('btn-start').addEventListener('click', startDriveMode);
    document.getElementById('btn-stop').addEventListener('click', () => DriverLogic.stop());
    document.getElementById('btn-recenter').addEventListener('click', () => centerMapOnUser(true));
});

function initMap() {
    map = L.map('background-map', {
        zoomControl: false, attributionControl: false,
        dragging: false, // Start fest
        touchZoom: false, doubleClickZoom: false
    }).setView([51.1657, 10.4515], 14); // Start Zoom 14
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(map);

    if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(handlePositionUpdate, err => console.warn(err), { enableHighAccuracy: true });
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
        map.setView(newLatLng, 14);
    } else {
        userMarker.setLatLng(newLatLng);
    }

    if (isDriveMode) {
        DriverLogic.update(pos);
        if (document.getElementById('btn-recenter').classList.contains('hidden')) {
            map.panTo(newLatLng, { animate: true, duration: 1.0 }); // Smooth
        }
    } else {
        map.panTo(newLatLng, { animate: true, duration: 2.5 }); // Home Smooth
    }
}

function startDriveMode() {
    isDriveMode = true;
    
    document.getElementById('home-screen').classList.remove('active');
    document.getElementById('home-screen').classList.add('hidden');
    document.getElementById('drive-screen').classList.remove('hidden');
    setTimeout(() => document.getElementById('drive-screen').classList.add('active'), 10);

    // HIER IST DER FIX: MAP INTERAKTIV MACHEN
    const mapDiv = document.getElementById('background-map');
    mapDiv.classList.add('interactive'); // Erlaubt Maus-Events via CSS

    map.dragging.enable();
    map.touchZoom.enable();
    
    if(userMarker) {
        // Zoom Animation
        map.flyTo(userMarker.getLatLng(), 18, { duration: 2.0 });
    }

    DriverLogic.start();
}

function showGarage() {
    switchScreen('garage-screen');
    GarageLogic.render();
}
function hideGarage() {
    switchScreen('home-screen');
    // Map Reset
    isDriveMode = false;
    document.getElementById('background-map').classList.remove('interactive');
    map.dragging.disable();
    if(userMarker) map.flyTo(userMarker.getLatLng(), 14, { duration: 1.5 });
}

function switchScreen(id) {
    document.querySelectorAll('.screen').forEach(s => { s.classList.remove('active'); s.classList.add('hidden'); });
    document.getElementById(id).classList.remove('hidden');
    setTimeout(() => document.getElementById(id).classList.add('active'), 10);
}

function centerMapOnUser() {
    if(userMarker) {
        map.flyTo(userMarker.getLatLng(), 18, { duration: 0.8 });
        document.getElementById('btn-recenter').classList.add('hidden');
    }
}
function initWeather() { /* ... wetter code ... */ }
