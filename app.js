let map, userMarker;
let isDriveMode = false;
let watchId = null;

window.addEventListener('load', () => {
    // Splash Screen
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
    // ZoomSnap 0 für flüssigeren Zoom
    map = L.map('background-map', {
        zoomControl: false, attributionControl: false,
        dragging: false, touchZoom: false, doubleClickZoom: false,
        zoomSnap: 0, 
        zoomDelta: 0.5
    }).setView([51.1657, 10.4515], 14);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { 
        maxZoom: 20,
        detectRetina: true // Schärfer auf Handys
    }).addTo(map);

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

    if (!userMarker) {
        const icon = L.divIcon({ className: 'user-marker-wrap', html: '<div class="user-pulse"></div><div class="user-dot"></div>', iconSize: [40,40], iconAnchor: [20,20] });
        userMarker = L.marker(newLatLng, {icon: icon}).addTo(map);
        map.setView(newLatLng, 14);
    } else {
        userMarker.setLatLng(newLatLng);
    }

    if (isDriveMode) {
        DriverLogic.update(pos);
        // SMART FOLLOW: Ruckeln verhindern
        if (document.getElementById('btn-recenter').classList.contains('hidden')) {
            const dist = map.getCenter().distanceTo(newLatLng);
            // Nur bewegen wenn > 10m Abweichung, aber dann sanft (panTo)
            if (dist > 10) { 
                map.panTo(newLatLng, { animate: true, duration: 1.0, easeLinearity: 0.25 });
            }
        }
    } else {
        // Home Mode: Folgt sehr langsam
        const dist = map.getCenter().distanceTo(newLatLng);
        if(dist > 50) map.panTo(newLatLng, { animate: true, duration: 2.0 });
    }
}

function startDriveMode() {
    isDriveMode = true;
    switchScreen('drive-screen');
    map.dragging.enable();
    map.touchZoom.enable();
    map.doubleClickZoom.enable();
    
    // ZOOM FIX: Statt flyTo (Kurve) nutzen wir setView mit Duration oder flachere Kurve
    if(userMarker) {
        // easeLinearity 0.5 macht die Kurve flacher -> weniger Ruckeln
        // Duration 1.2 ist schneller -> weniger Ruckeln
        map.flyTo(userMarker.getLatLng(), 18, { 
            animate: true, 
            duration: 1.2, 
            easeLinearity: 0.5 
        });
    }
    DriverLogic.start();
}

function centerMapOnUser(force) {
    if(userMarker) {
        map.flyTo(userMarker.getLatLng(), 18, { duration: 0.8 });
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
    
    // Fallback Timer falls API hängt
    const weatherTimeout = setTimeout(() => {
        document.getElementById('loc-text').innerText = "Standort";
        document.getElementById('weather-temp').innerText = "--°";
    }, 5000);

    navigator.geolocation.getCurrentPosition(pos => {
        const lat = pos.coords.latitude; const lng = pos.coords.longitude;
        
        // Wetter API (Open Meteo)
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`)
        .then(r=>r.json()).then(d=>{
            clearTimeout(weatherTimeout);
            document.getElementById('weather-temp').innerText = Math.round(d.current_weather.temperature) + "°";
        })
        .catch(e => console.log("Weather Error", e));

        // Location API (Nominatim)
        // WICHTIG: Nominatim braucht oft User-Agent Header oder blockt
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
        .then(r=>r.json()).then(d=>{
            const city = d.address.city || d.address.town || d.address.village || "Standort";
            document.getElementById('loc-text').innerText = city;
        })
        .catch(e => {
            console.log("Loc Error", e);
            document.getElementById('loc-text').innerText = "Standort";
        });
    });
}
