let map, userMarker;
let isDriveMode = false;
let watchId = null;
let isZooming = false; 
let currentRotation = 0; 

// Variablen für Long-Press
let pressTimer = null;
const LONG_PRESS_DURATION = 1500; 

window.addEventListener('load', () => {
    setTimeout(() => {
        const s = document.getElementById('splash-screen');
        if(s) { s.style.opacity = '0'; setTimeout(() => s.classList.add('hidden'), 800); }
    }, 1500);

    initMap();
    initWeather();
    
    if(typeof ExploreLogic !== 'undefined') ExploreLogic.init();

    // BUTTON WIRING
    document.getElementById('nav-home').onclick = showHome;
    document.getElementById('nav-home-from-garage').onclick = showHome;
    document.getElementById('nav-home-from-explore').onclick = showHome;
    
    document.getElementById('nav-garage').onclick = showGarage;
    document.getElementById('nav-garage-from-explore').onclick = showGarage;
    
    document.getElementById('nav-explore').onclick = showExplore;
    document.getElementById('nav-explore-from-garage').onclick = showExplore;
    document.getElementById('nav-explore-active').onclick = showExplore;

    document.getElementById('btn-start').onclick = startDriveMode;
    document.getElementById('btn-recenter').onclick = () => centerMapOnUser(true);

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

    // --- FIX FÜR SCHWIMMENDEN PUNKT ---
    // Wenn User interagiert (Zoom/Pan), schalten wir die CSS-Animation aus
    map.on('zoomstart movestart', () => {
        isZooming = true;
        if(userMarker && userMarker.getElement()) {
            userMarker.getElement().classList.remove('smooth');
        }
        if(isDriveMode) document.getElementById('btn-recenter').classList.remove('hidden');
    });

    // Wenn Interaktion fertig, Animation wieder an
    map.on('zoomend moveend', () => {
        isZooming = false;
        if(userMarker && userMarker.getElement()) {
            userMarker.getElement().classList.add('smooth');
        }
    });
}

function handlePositionUpdate(pos) {
    const newLatLng = L.latLng(pos.coords.latitude, pos.coords.longitude);
    const heading = pos.coords.heading; 
    const speedKm = pos.coords.speed ? pos.coords.speed * 3.6 : 0;

    if (!userMarker) {
        const icon = L.divIcon({ className: 'user-marker-wrap', html: '<div class="user-pulse"></div><div class="user-dot"></div>', iconSize: [40,40], iconAnchor: [20,20] });
        userMarker = L.marker(newLatLng, {icon: icon}).addTo(map);
        // Initial einmal 'smooth' hinzufügen
        setTimeout(() => { if(userMarker.getElement()) userMarker.getElement().classList.add('smooth'); }, 100);
        map.setView(newLatLng, 14);
    } else {
        userMarker.setLatLng(newLatLng);
        // Sicherstellen dass Klasse da ist (falls sie mal verloren ging)
        if(userMarker.getElement() && !isZooming) userMarker.getElement().classList.add('smooth');
    }

    const mapEl = document.getElementById('background-map');
    
    if (isDriveMode) {
        if (heading !== null && !isNaN(heading) && speedKm > 5) {
            let targetRot = -heading; 
            let diff = targetRot - currentRotation;
            while (diff < -180) diff += 360;
            while (diff > 180) diff -= 360;
            currentRotation += diff; 
            if(mapEl) mapEl.style.transform = `rotate(${currentRotation}deg)`;
        }
    } else {
        if (currentRotation !== 0) {
            currentRotation = 0;
            if(mapEl) mapEl.style.transform = `rotate(0deg)`;
        }
    }

    if (isZooming) return;

    if (isDriveMode) {
        DriverLogic.update(pos);
        if (document.getElementById('btn-recenter').classList.contains('hidden')) {
            const dist = map.getCenter().distanceTo(newLatLng);
            if (dist > 5) map.panTo(newLatLng, { animate: true, duration: 1.0 });
        }
    } else {
        const isExplore = !document.getElementById('explore-screen').classList.contains('hidden');
        if (!isExplore) {
            const dist = map.getCenter().distanceTo(newLatLng);
            // Home Screen folgt locker
            if(dist > 50) map.panTo(newLatLng, { animate: true, duration: 2.0 });
        }
    }
}

function startDriveMode() {
    if(typeof ExploreLogic !== 'undefined') ExploreLogic.leave();
    
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

function showHome() {
    if(typeof ExploreLogic !== 'undefined') ExploreLogic.leave();
    
    switchScreen('home-screen');
    isDriveMode = false;
    
    const mapEl = document.getElementById('background-map');
    currentRotation = 0;
    if(mapEl) mapEl.style.transform = `rotate(0deg)`;
    
    map.dragging.disable();
    
    // --- HOME PAGE RESET ---
    // Hier erzwingen wir den Zoom 14 und die User-Position
    // Egal wo wir in Explore waren, Home ist immer gleich.
    if(userMarker) {
        map.setView(userMarker.getLatLng(), 14, { animate: true, duration: 1.5 });
    }
}

function showGarage() { 
    if(typeof ExploreLogic !== 'undefined') ExploreLogic.leave();
    switchScreen('garage-screen'); 
    GarageLogic.render(); 
}

function showExplore() {
    switchScreen('explore-screen');
    if(typeof ExploreLogic !== 'undefined') ExploreLogic.enter();
}

function switchScreen(id) {
    const activeScreens = document.querySelectorAll('.screen.active');
    activeScreens.forEach(s => {
        s.classList.remove('active');
        s.classList.add('fading-out');
        setTimeout(() => {
            s.classList.remove('fading-out');
            s.classList.add('hidden');
        }, 350); 
    });

    const nextScreen = document.getElementById(id);
    nextScreen.classList.remove('hidden');
    setTimeout(() => {
        nextScreen.classList.add('active');
    }, 20);
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
