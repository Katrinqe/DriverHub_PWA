let map, userMarker;
let isDriveMode = false;
let watchId = null;
let isZooming = false; 
let isAutoPanning = false; 
let currentRotation = 0; 
let pressTimer = null;
const LONG_PRESS_DURATION = 1500; 

window.addEventListener('load', () => {
    setTimeout(() => {
        const s = document.getElementById('splash-screen');
        if(s) { s.style.opacity = '0'; setTimeout(() => s.classList.add('hidden'), 800); }
    }, 1500);

    initMap();
    initWeather();
    
    const fade = document.getElementById('global-top-fade');
    if(fade) fade.classList.add('visible');
    
    if(typeof GarageLogic !== 'undefined') GarageLogic.init();
    if(typeof ExploreLogic !== 'undefined') ExploreLogic.init();
    if(typeof NaviLogic !== 'undefined') NaviLogic.init(); 

    function bindNavBtn(id, actionFn) {
        const btn = document.getElementById(id);
        if(!btn) return;
        btn.addEventListener('click', (e) => { e.stopPropagation(); actionFn(); });
        btn.addEventListener('dblclick', (e) => { e.preventDefault(); e.stopPropagation(); });
        btn.addEventListener('touchstart', (e) => { e.stopPropagation(); }, {passive: false});
    }

    bindNavBtn('nav-home', showHome);
    bindNavBtn('nav-garage', showGarage);
    bindNavBtn('nav-explore', showExplore);

    const navBar = document.getElementById('global-nav');
    if(navBar) {
        L.DomEvent.disableClickPropagation(navBar);
        L.DomEvent.disableScrollPropagation(navBar);
        navBar.addEventListener('dblclick', (e) => { e.stopPropagation(); e.preventDefault(); });
    }

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
        zoomSnap: 0, zoomDelta: 0.5,
        tap: false 
    }).setView([51.1657, 10.4515], 15);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { 
        maxZoom: 20,
        keepBuffer: 20, 
        updateWhenIdle: false 
    }).addTo(map);

    if (navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(handlePositionUpdate, 
            (err) => console.warn(err), 
            { enableHighAccuracy: true }
        );
    }

    map.on('dragstart', () => {
        if(!isAutoPanning) showRecenterButtons();
    });

    map.on('zoomstart', () => {
        if(!isAutoPanning) {
            showRecenterButtons();
            if(userMarker && userMarker.getElement()) {
                userMarker.getElement().classList.remove('smooth');
            }
        }
    });

    map.on('zoomend moveend', () => {
        setTimeout(() => { isAutoPanning = false; }, 500); 
        
        if(userMarker && userMarker.getElement()) {
            userMarker.getElement().classList.add('smooth');
        }
    });
}

function showRecenterButtons() {
    if(isDriveMode) document.getElementById('btn-recenter').classList.remove('hidden');
    if(typeof NaviLogic !== 'undefined' && NaviLogic.isNavigating) document.getElementById('btn-nav-recenter').classList.remove('hidden');
}

function handlePositionUpdate(pos) {
    const newLatLng = L.latLng(pos.coords.latitude, pos.coords.longitude);
    const heading = pos.coords.heading; 
    const speedKm = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;

    if (!userMarker) {
        const icon = L.divIcon({ className: 'user-marker-wrap', html: '<div class="user-pulse"></div><div class="user-dot"></div>', iconSize: [40,40], iconAnchor: [20,20] });
        userMarker = L.marker(newLatLng, {icon: icon}).addTo(map);
        setTimeout(() => { if(userMarker.getElement()) userMarker.getElement().classList.add('smooth'); }, 100);
        map.setView(newLatLng, 15, {animate: false});
    } else {
        userMarker.setLatLng(newLatLng);
        if(userMarker.getElement() && !isZooming) userMarker.getElement().classList.add('smooth');
    }

    const mapEl = document.getElementById('background-map');
    const isNavi = (typeof NaviLogic !== 'undefined' && NaviLogic.isNavigating);

    if (isDriveMode || isNavi) {
        if (heading !== null && !isNaN(heading) && speedKm > 3) {
            let targetRot = -heading; 
            let diff = targetRot - currentRotation;
            while (diff < -180) diff += 360;
            while (diff > 180) diff -= 360;
            currentRotation += diff; 
            if(mapEl) mapEl.style.transform = `translate(-50%, -50%) rotate(${currentRotation}deg)`;
        }
    } else {
        if (currentRotation !== 0) {
            currentRotation = 0;
            if(mapEl) mapEl.style.transform = `translate(-50%, -50%) rotate(0deg)`;
        }
    }

    if (isZooming && !isAutoPanning) return;

    if (isDriveMode) {
        DriverLogic.update(pos);
        if (document.getElementById('btn-recenter').classList.contains('hidden')) {
            isAutoPanning = true; 
            map.panTo(newLatLng, { animate: true, duration: 1.0 });
        }
    } else if (isNavi) {
        NaviLogic.updatePosition(pos); 
        if (document.getElementById('btn-nav-recenter').classList.contains('hidden')) {
            isAutoPanning = true;
            map.panTo(newLatLng, { animate: true, duration: 1.0 });
        }
    } else {
        const isHome = document.getElementById('home-screen').classList.contains('active');
        const isExplore = !document.getElementById('explore-screen').classList.contains('hidden');
        
        if (isHome) {
            isAutoPanning = true;
            map.setView(newLatLng, 15, { animate: false });
        } 
        else if (!isExplore) {
            const dist = map.getCenter().distanceTo(newLatLng);
            if(dist > 50) {
                isAutoPanning = true;
                map.panTo(newLatLng, { animate: true, duration: 2.0 });
            }
        }
    }
}

function startDriveMode() {
    if(typeof ExploreLogic !== 'undefined') ExploreLogic.leave();
    if(typeof NaviLogic !== 'undefined') NaviLogic.cancelRoute(); 
    isDriveMode = true;
    switchScreen('drive-screen');
    document.getElementById('global-nav').classList.add('hidden');
    
    document.getElementById('btn-recenter').classList.add('hidden');

    document.getElementById('global-top-fade').classList.remove('visible');
    document.getElementById('background-map').classList.remove('map-locked');
    document.getElementById('background-map').classList.add('map-smooth-rotate');

    map.dragging.enable();
    map.touchZoom.enable();
    map.doubleClickZoom.enable();
    map.scrollWheelZoom.enable();

    if(userMarker) {
        isAutoPanning = true;
        map.setView(userMarker.getLatLng(), 18, { animate: false });
    }
    DriverLogic.start();
}

function centerMapOnUser() {
    if(userMarker) {
        isAutoPanning = true;
        map.setView(userMarker.getLatLng(), 18, { animate: true, duration: 1.0 });
        
        document.getElementById('btn-recenter').classList.add('hidden');
        document.getElementById('btn-nav-recenter').classList.add('hidden');
    }
}

function showHome() {
    if(document.getElementById('home-screen').classList.contains('active')) return;

    if(typeof ExploreLogic !== 'undefined') ExploreLogic.leave();
    if(typeof NaviLogic !== 'undefined') NaviLogic.cancelRoute();
    
    document.getElementById('global-top-fade').classList.add('visible');

    const mapEl = document.getElementById('background-map');
    mapEl.classList.remove('map-smooth-rotate');
    mapEl.classList.add('map-locked'); 

    currentRotation = 0;
    mapEl.style.transform = `translate(-50%, -50%) rotate(0deg)`;
    
    map.stop();
    map.dragging.disable();
    map.touchZoom.disable();
    map.doubleClickZoom.disable();
    map.scrollWheelZoom.disable();
    map.boxZoom.disable();
    map.keyboard.disable();
    if (map.tap) map.tap.disable();

    if(userMarker) {
        if(userMarker.getElement()) userMarker.getElement().classList.remove('smooth');
        isAutoPanning = true;
        map.setView(userMarker.getLatLng(), 15, { animate: false });
        setTimeout(() => { if(userMarker.getElement()) userMarker.getElement().classList.add('smooth'); }, 100);
    }

    switchScreen('home-screen');
    updateNav('home');
    isDriveMode = false;
}

function showGarage() { 
    if(typeof ExploreLogic !== 'undefined') ExploreLogic.leave();
    if(typeof NaviLogic !== 'undefined') NaviLogic.cancelRoute();
    
    document.getElementById('global-top-fade').classList.remove('visible');

    document.getElementById('background-map').classList.remove('map-locked');
    document.getElementById('background-map').classList.remove('map-smooth-rotate');
    
    switchScreen('garage-screen'); 
    updateNav('garage');
    GarageLogic.render(); 
    
    // FIX: 3D Auto starten
    if(window.startGarage3D) {
        setTimeout(() => { window.startGarage3D(); }, 100);
    }
}

function showExplore() {
    switchScreen('explore-screen');
    updateNav('explore');
    
    document.getElementById('global-top-fade').classList.add('visible');

    document.getElementById('background-map').classList.remove('map-locked');
    document.getElementById('background-map').classList.remove('map-smooth-rotate');
    
    const mapEl = document.getElementById('background-map');
    if(mapEl) mapEl.style.transform = `translate(-50%, -50%) rotate(0deg)`;
    
    if(typeof ExploreLogic !== 'undefined') ExploreLogic.enter();
}

function updateNav(activeId) {
    document.getElementById('global-nav').classList.remove('hidden');
    const homeBtn = document.getElementById('nav-home');
    const exploreBtn = document.getElementById('nav-explore');
    const garageBtn = document.getElementById('nav-garage');
    homeBtn.classList.remove('active-home');
    exploreBtn.classList.remove('active-map');
    garageBtn.classList.remove('active-garage');
    if(activeId === 'home') homeBtn.classList.add('active-home');
    if(activeId === 'explore') exploreBtn.classList.add('active-map');
    if(activeId === 'garage') garageBtn.classList.add('active-garage');
}

function switchScreen(id) {
    const nextScreen = document.getElementById(id);
    if (nextScreen.classList.contains('active')) return;
    const activeScreens = document.querySelectorAll('.screen.active');
    activeScreens.forEach(s => {
        s.classList.remove('active');
        s.classList.add('fading-out');
        setTimeout(() => {
            s.classList.remove('fading-out');
            s.classList.add('hidden');
        }, 350); 
    });
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
