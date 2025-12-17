let map, userMarker;
let isDriveMode = false;
let watchId = null;
let isAnimating = false; // WICHTIG: Verhindert Ruckeln bei Animationen

window.addEventListener('load', () => {
    // Splash Screen Logik
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if(splash) {
            splash.style.opacity = '0';
            setTimeout(() => splash.classList.add('hidden'), 800);
        }
    }, 1500);

    initMap();
    initWeather();

    // Event Listener
    document.getElementById('nav-garage').onclick = showGarage;
    document.getElementById('nav-home').onclick = hideGarage;
    document.getElementById('nav-home-from-garage').onclick = hideGarage;
    document.getElementById('btn-start').onclick = startDriveMode;
    document.getElementById('btn-stop').onclick = () => DriverLogic.stop();
    document.getElementById('btn-recenter').onclick = () => centerMapOnUser();
});

function initMap() {
    map = L.map('background-map', {
        zoomControl: false, attributionControl: false,
        dragging: false, touchZoom: false, doubleClickZoom: false,
        zoomSnap: 0, zoomDelta: 0.5 
    }).setView([51.1657, 10.4515], 14);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { 
        maxZoom: 20, detectRetina: true 
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
    // WICHTIG: Wenn wir gerade zoomen (Start Animation), GPS ignorieren!
    // Das verhindert das Ruckeln.
    if (isAnimating) return;

    const newLatLng = L.latLng(pos.coords.latitude, pos.coords.longitude);

    if (!userMarker) {
        const icon = L.divIcon({ className: 'user-marker-wrap', html: '<div class="user-pulse"></div><div class="user-dot"></div>', iconSize: [40,40], iconAnchor: [20,20] });
        userMarker = L.marker(newLatLng, {icon: icon}).addTo(map);
        map.setView(newLatLng, 14); // Initialer Set ohne Animation
    } else {
        userMarker.setLatLng(newLatLng);
    }

    if (isDriveMode) {
        DriverLogic.update(pos);
        
        // Smart Follow
        if (document.getElementById('btn-recenter').classList.contains('hidden')) {
            const dist = map.getCenter().distanceTo(newLatLng);
            // Nur bewegen wenn > 10m Abweichung
            if (dist > 10) { 
                map.panTo(newLatLng, { animate: true, duration: 1.0, easeLinearity: 0.25 });
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
    
    map.dragging.enable();
    map.touchZoom.enable();
    map.doubleClickZoom.enable();
    
    if(userMarker) {
        // SPERRE AKTIVIEREN
        isAnimating = true;

        // Start Animation (FlyTo)
        map.flyTo(userMarker.getLatLng(), 18, { 
            animate: true, 
            duration: 2.0, // 2 Sekunden Zeit lassen = Flüssiger
            easeLinearity: 0.1 // Weniger "Kurve", mehr direkter Zoom
        });

        // Nach 2.1 Sekunden Sperre aufheben
        setTimeout(() => {
            isAnimating = false;
        }, 2100);
    }
    
    DriverLogic.start();
}

function centerMapOnUser() {
    if(userMarker) {
        // Auch hier kurz sperren für flüssigen Recenter
        isAnimating = true;
        map.flyTo(userMarker.getLatLng(), 18, { duration: 1.0 });
        setTimeout(() => { isAnimating = false; }, 1100);
        
        document.getElementById('btn-recenter').classList.add('hidden');
    }
}

function showGarage() { switchScreen('garage-screen'); GarageLogic.render(); }
function hideGarage() { 
    switchScreen('home-screen'); 
    isDriveMode = false;
    map.dragging.disable();
    if(userMarker) {
        isAnimating = true;
        map.flyTo(userMarker.getLatLng(), 14, { duration: 1.5 });
        setTimeout(() => isAnimating = false, 1600);
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
    const weatherTimeout = setTimeout(() => {
        const el = document.getElementById('loc-text');
        if(el) el.innerText = "Standort";
        const el2 = document.getElementById('weather-temp');
        if(el2) el2.innerText = "--°";
    }, 5000);

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
