let map, userMarker;
let isDriveMode = false;
let watchId = null;
let isZooming = false; 

// Variablen für Long-Press
let pressTimer = null;
const LONG_PRESS_DURATION = 1500; // 1.5 Sekunden halten

window.addEventListener('load', () => {
    setTimeout(() => {
        const s = document.getElementById('splash-screen');
        if(s) { s.style.opacity = '0'; setTimeout(() => s.classList.add('hidden'), 800); }
    }, 1500);

    initMap();
    initWeather();

    document.getElementById('nav-garage').onclick = showGarage;
    document.getElementById('nav-home').onclick = hideGarage;
    document.getElementById('nav-home-from-garage').onclick = hideGarage;
    document.getElementById('btn-start').onclick = startDriveMode;
    document.getElementById('btn-recenter').onclick = () => centerMapOnUser(true);

    // --- STOP BUTTON LONG PRESS LOGIC ---
    const btnStop = document.getElementById('btn-stop');

    function startPress(e) {
        // Verhindert Rechtsklick Menü am Handy
        if (e.type === 'touchstart') e.preventDefault(); 
        
        btnStop.classList.add('holding'); // Startet CSS Animation
        
        pressTimer = setTimeout(() => {
            // Wenn Zeit abgelaufen -> STOPPEN
            DriverLogic.stop();
            resetPress(); // Reset UI
        }, LONG_PRESS_DURATION);
    }

    function resetPress() {
        if (pressTimer) {
            clearTimeout(pressTimer);
            pressTimer = null;
        }
        btnStop.classList.remove('holding'); // Stoppt Animation
    }

    // Events für Maus & Touch
    btnStop.addEventListener('mousedown', startPress);
    btnStop.addEventListener('touchstart', startPress);
    
    btnStop.addEventListener('mouseup', resetPress);
    btnStop.addEventListener('mouseleave', resetPress);
    btnStop.addEventListener('touchend', resetPress);
});

function initMap() {
    map = L.map('background-map', {
        zoomControl: false, attributionControl: false,
        dragging: false, touchZoom: false, doubleClickZoom: false,
        zoomSnap: 0, zoomDelta: 0.5 
    }).setView([51.1657, 10.4515], 14);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(map);

    if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(handlePositionUpdate, 
            (err) => console.warn(err), 
            { enableHighAccuracy: true }
        );
    }

    map.on('dragstart', () => { if(isDriveMode) document.getElementById('btn-recenter').classList.remove('hidden'); });
    map.on('zoomstart', () => { isZooming = true; });
    map.on('zoomend', () => { isZooming = false; });
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

    if (isZooming) return;

    if (isDriveMode) {
        DriverLogic.update(pos);
        if (document.getElementById('btn-recenter').classList.contains('hidden')) {
            const dist = map.getCenter().distanceTo(newLatLng);
            if (dist > 10) map.panTo(newLatLng, { animate: true, duration: 1.0 });
        }
    } else {
        const dist = map.getCenter().distanceTo(newLatLng);
        if(dist > 50) map.panTo(newLatLng, { animate: true, duration: 2.0 });
    }
}

function startDriveMode() {
    isDriveMode = true;
    switchScreen('drive-screen');
    map.dragging.enable();
    map.touchZoom.enable();
    
    if(userMarker) {
        map.setView(userMarker.getLatLng(), 18, { animate: true, duration: 1.5 });
    }
    DriverLogic.start();
}

function centerMapOnUser() {
    if(userMarker) {
        map.setView(userMarker.getLatLng(), 18, { animate: true, duration: 1.0 });
        document.getElementById('btn-recenter').classList.add('hidden');
    }
}

function showGarage() { switchScreen('garage-screen'); GarageLogic.render(); }
function hideGarage() { 
    switchScreen('home-screen'); 
    isDriveMode = false;
    map.dragging.disable();
    if(userMarker) map.setView(userMarker.getLatLng(), 14, { animate: true, duration: 1.5 });
}

function switchScreen(id) {
    document.querySelectorAll('.screen').forEach(s => { s.classList.remove('active'); s.classList.add('hidden'); });
    const t = document.getElementById(id);
    t.classList.remove('hidden');
    setTimeout(() => t.classList.add('active'), 10);
}

function initWeather() {
    if (!navigator.geolocation) return;
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
            const el = document.getElementById('loc-text'); if(el) el.innerText = city;
        }).catch(e => console.log(e));
    });
}
