let map, userMarker;
let isDriveMode = false;
let watchId = null;

window.addEventListener('load', () => {
    // Splash
    setTimeout(() => {
        document.getElementById('splash-screen').style.opacity = '0';
        setTimeout(() => document.getElementById('splash-screen').classList.add('hidden'), 800);
    }, 1500);

    initMap();
    initWeather();

    document.getElementById('nav-garage').onclick = showGarage;
    document.getElementById('nav-home').onclick = hideGarage;
    document.getElementById('nav-home-from-garage').onclick = hideGarage;
    document.getElementById('btn-start').onclick = startDriveMode;
    document.getElementById('btn-stop').onclick = () => DriverLogic.stop();
    document.getElementById('btn-recenter').onclick = () => centerMapOnUser(true);
});

function initMap() {
    map = L.map('background-map', {
        zoomControl: false, attributionControl: false,
        dragging: false, 
        touchZoom: false, doubleClickZoom: false
    }).setView([51.1657, 10.4515], 14);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(map);

    if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(handlePositionUpdate, 
        (err) => { console.warn(err); }, 
        { enableHighAccuracy: true });
    }

    map.on('dragstart', () => {
        if(isDriveMode) document.getElementById('btn-recenter').classList.remove('hidden');
    });
}

function handlePositionUpdate(pos) {
    const newLatLng = L.latLng(pos.coords.latitude, pos.coords.longitude);

    // Marker Update (Immer sofort)
    if (!userMarker) {
        const icon = L.divIcon({ className: 'user-marker-wrap', html: '<div class="user-pulse"></div><div class="user-dot"></div>', iconSize: [40,40], iconAnchor: [20,20] });
        userMarker = L.marker(newLatLng, {icon: icon}).addTo(map);
        map.setView(newLatLng, 14);
    } else {
        userMarker.setLatLng(newLatLng);
    }

    // Logic for Map Movement
    if (isDriveMode) {
        DriverLogic.update(pos);

        // ANTI-RUCKEL LOGIK: Nur bewegen, wenn User nicht manuell schiebt
        if (document.getElementById('btn-recenter').classList.contains('hidden')) {
            const center = map.getCenter();
            const dist = center.distanceTo(newLatLng);
            
            // Toleranz: Nur nachziehen wenn > 15m Abweichung von der Mitte
            if (dist > 15) {
                map.panTo(newLatLng, { animate: true, duration: 1.0 });
            }
        }
    } else {
        // Home Mode: Nur grob folgen
        const center = map.getCenter();
        if (center.distanceTo(newLatLng) > 50) {
            map.panTo(newLatLng, { animate: true, duration: 2.0 });
        }
    }
}

function startDriveMode() {
    isDriveMode = true;
    switchScreen('drive-screen');

    // Map Interaktivität AN
    map.dragging.enable();
    map.touchZoom.enable();
    
    // Zoom Animation
    if(userMarker) map.flyTo(userMarker.getLatLng(), 18, { duration: 1.5 });
    
    DriverLogic.start();
}

function centerMapOnUser(force) {
    if(userMarker) {
        map.flyTo(userMarker.getLatLng(), 18, { duration: 1.0 });
        document.getElementById('btn-recenter').classList.add('hidden');
    }
}

function showGarage() { switchScreen('garage-screen'); GarageLogic.render(); }
function hideGarage() { 
    switchScreen('home-screen'); 
    isDriveMode = false;
    map.dragging.disable();
    if(userMarker) map.flyTo(userMarker.getLatLng(), 14, { duration: 1.5 });
}

function switchScreen(id) {
    document.querySelectorAll('.screen').forEach(s => { s.classList.remove('active'); s.classList.add('hidden'); });
    const t = document.getElementById(id);
    t.classList.remove('hidden');
    setTimeout(() => t.classList.add('active'), 10);
}

function initWeather() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
        const lat = pos.coords.latitude; const lng = pos.coords.longitude;
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
        .then(r=>r.json()).then(d=>{document.getElementById('loc-text').innerText = d.address.city || d.address.town || "Standort";})
        .catch(e => console.log(e));
        
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`)
        .then(r=>r.json()).then(d=>{document.getElementById('weather-temp').innerText = Math.round(d.current_weather.temperature) + "°";})
        .catch(e => console.log(e));
    });
}
