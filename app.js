let map, userMarker;
let isDriveMode = false;
let watchId = null;
let isZooming = false; 
let currentRotation = 0; 

// Variablen für Long-Press (Stop Button)
let pressTimer = null;
const LONG_PRESS_DURATION = 1500; 

window.addEventListener('load', () => {
    // Splash Screen Logik
    setTimeout(() => {
        const s = document.getElementById('splash-screen');
        if(s) { s.style.opacity = '0'; setTimeout(() => s.classList.add('hidden'), 800); }
    }, 1500);

    initMap();
    initWeather();
    
    // Explore Modul laden, falls vorhanden
    if(typeof ExploreLogic !== 'undefined') ExploreLogic.init();

    // --- BUTTON WIRING ---
    
    // Home Button (von überall)
    document.getElementById('nav-home').onclick = showHome;
    document.getElementById('nav-home-from-garage').onclick = showHome;
    document.getElementById('nav-home-from-explore').onclick = showHome;
    
    // Garage Button
    document.getElementById('nav-garage').onclick = showGarage;
    document.getElementById('nav-garage-from-explore').onclick = showGarage;
    
    // Explore / Map Button
    document.getElementById('nav-explore').onclick = showExplore;
    document.getElementById('nav-explore-from-garage').onclick = showExplore;
    document.getElementById('nav-explore-active').onclick = showExplore;

    // Drive Start & Recenter
    document.getElementById('btn-start').onclick = startDriveMode;
    document.getElementById('btn-recenter').onclick = () => centerMapOnUser(true);

    // Stop Button mit Long-Press Logik
    const btnStop = document.getElementById('btn-stop');
    function startPress(e) {
        if (e.type === 'touchstart') e.preventDefault(); 
        btnStop.classList.add('holding'); 
        pressTimer = setTimeout(() => { DriverLogic.stop(); resetPress(); }, LONG_PRESS_DURATION);
    }
    function resetPress() {
        if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
        btnStop.classList.remove('holding'); 
    }
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
    const heading = pos.coords.heading; 
    const speedKm = pos.coords.speed ? pos.coords.speed * 3.6 : 0;

    // Marker Update (Animation passiert via CSS Transition)
    if (!userMarker) {
        const icon = L.divIcon({ className: 'user-marker-wrap', html: '<div class="user-pulse"></div><div class="user-dot"></div>', iconSize: [40,40], iconAnchor: [20,20] });
        userMarker = L.marker(newLatLng, {icon: icon}).addTo(map);
        map.setView(newLatLng, 14);
    } else {
        userMarker.setLatLng(newLatLng);
    }

    // --- MAP ROTATION LOGIC ---
    const mapEl = document.getElementById('background-map');
    
    if (isDriveMode) {
        // Nur rotieren wenn wir fahren (> 5 km/h) um Zittern zu vermeiden
        if (heading !== null && !isNaN(heading) && speedKm > 5) {
            let targetRot = -heading; 
            // Shortest Path Berechnung für sanfte Drehung
            let diff = targetRot - currentRotation;
            while (diff < -180) diff += 360;
            while (diff > 180) diff -= 360;
            currentRotation += diff; 
            if(mapEl) mapEl.style.transform = `rotate(${currentRotation}deg)`;
        }
    } else {
        // Im Home/Explore Mode immer genordet (0°)
        if (currentRotation !== 0) {
            currentRotation = 0;
            if(mapEl) mapEl.style.transform = `rotate(0deg)`;
        }
    }

    if (isZooming) return;

    // --- TRACKING LOGIC ---
    if (isDriveMode) {
        DriverLogic.update(pos);
        // Wenn Recenter aktiv ist (Button hidden), folge dem User hart
        if (document.getElementById('btn-recenter').classList.contains('hidden')) {
            const dist = map.getCenter().distanceTo(newLatLng);
            if (dist > 5) map.panTo(newLatLng, { animate: true, duration: 1.0 });
        }
    } else {
        // Wenn wir NICHT im Drive Mode sind...
        const isExplore = !document.getElementById('explore-screen').classList.contains('hidden');
        
        // ...und NICHT im Explore Mode sind (also Home Screen):
        if (!isExplore) {
            // Nur sanft folgen, wenn der Abstand zu groß wird
            const dist = map.getCenter().distanceTo(newLatLng);
            if(dist > 50) map.panTo(newLatLng, { animate: true, duration: 2.0 });
        }
        // Im Explore Mode machen wir gar nichts automatisch (User hat Kontrolle)
    }
}

function startDriveMode() {
    if(typeof ExploreLogic !== 'undefined') ExploreLogic.leave(); // Aufräumen falls nötig
    
    isDriveMode = true;
    switchScreen('drive-screen');
    map.dragging.enable();
    map.touchZoom.enable();
    
    // Beim Start einmal reinzoomen und zentrieren
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

function showHome() {
    if(typeof ExploreLogic !== 'undefined') ExploreLogic.leave();
    
    switchScreen('home-screen');
    isDriveMode = false;
    
    // Reset Rotation
    const mapEl = document.getElementById('background-map');
    currentRotation = 0;
    if(mapEl) mapEl.style.transform = `rotate(0deg)`;
    
    map.dragging.disable();
    
    // FIX: Kein harter Zoom (setView), nur sanftes Zurückgleiten (panTo)
    // Wir behalten den Zoom-Level bei, den der User evtl. eingestellt hat
    if(userMarker) {
        map.panTo(userMarker.getLatLng(), { animate: true, duration: 1.5 });
    }
}

function showGarage() { 
    if(typeof ExploreLogic !== 'undefined') ExploreLogic.leave();
    switchScreen('garage-screen'); 
    GarageLogic.render(); 
}

function showExplore() {
    switchScreen('explore-screen');
    // Explore Logic aktivieren (Map freigeben etc.)
    if(typeof ExploreLogic !== 'undefined') ExploreLogic.enter();
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
