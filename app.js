let map, userMarker;
let isDriveMode = false;
let watchId = null;
let isZooming = false; 
let isAutoPanning = false; // WICHTIG: Schützt vor ungewolltem Stop
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
    
    if(typeof ExploreLogic !== 'undefined') ExploreLogic.init();
    if(typeof NaviLogic !== 'undefined') NaviLogic.init(); 

// === RESTORE ORIGINAL NAV LOGIC (VANILLA JS) ===
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
    bindNavBtn('nav-perf', showPerf);

    const navBar = document.getElementById('global-nav');
    if(navBar) {
        // 1:1 Nachbau der alten Leaflet-Blockade (L.DomEvent.disableClickPropagation)
        const stopEvents = ['click', 'dblclick', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'wheel', 'mousewheel', 'DOMMouseScroll'];
        stopEvents.forEach(ev => {
            navBar.addEventListener(ev, (e) => { e.stopPropagation(); }, { passive: false });
        });
        navBar.addEventListener('dblclick', (e) => { e.preventDefault(); });
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
    // MapLibre Initialisierung
    map = new maplibregl.Map({
        container: 'background-map',
        style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: [10.4515, 51.1657], // Wichtig: MapLibre nutzt Lng, Lat!
        zoom: 15,
        interactive: false, // Sperrt Drag, Zoom, etc. im Home-Screen
        attributionControl: false
    });

    map.on('load', () => {
        if (navigator.geolocation) {
            watchId = navigator.geolocation.watchPosition(handlePositionUpdate, 
                (err) => console.warn(err), 
                { enableHighAccuracy: true }
            );
        }
    });

    // Wenn der User zieht -> Buttons zeigen
    map.on('dragstart', () => {
        if(!isAutoPanning) showRecenterButtons();
    });

    // Wenn der User zoomt -> Buttons zeigen
    map.on('zoomstart', () => {
        if(!isAutoPanning) showRecenterButtons();
    });

    map.on('zoomend', () => {
        setTimeout(() => { isAutoPanning = false; }, 500); 
    });
    map.on('moveend', () => {
        setTimeout(() => { isAutoPanning = false; }, 500); 
    });
}

function showRecenterButtons() {
    if(isDriveMode) document.getElementById('btn-recenter').classList.remove('hidden');
    if(typeof NaviLogic !== 'undefined' && NaviLogic.isNavigating) document.getElementById('btn-nav-recenter').classList.remove('hidden');
}

function handlePositionUpdate(pos) {
    const lng = pos.coords.longitude;
    const lat = pos.coords.latitude;
    const heading = pos.coords.heading; 
    const speedKm = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;

    if (!userMarker) {
        const el = document.createElement('div');
        el.className = 'user-marker-wrap smooth';
        el.innerHTML = '<div class="user-pulse"></div><div class="user-dot"></div>';

        // Natives MapLibre Alignment, damit der Marker flach auf dem Asphalt liegt
        userMarker = new maplibregl.Marker({
            element: el,
            pitchAlignment: 'map',
            rotationAlignment: 'map'
        })
        .setLngLat([lng, lat])
        .addTo(map);
        
        map.jumpTo({ center: [lng, lat], zoom: 15 });
    } else {
        userMarker.setLngLat([lng, lat]);
    }

    const isNavi = (typeof NaviLogic !== 'undefined' && NaviLogic.isNavigating);

    // Native WebGL-Rotation des Markers (kein CSS-Hack mehr)
    if ((isDriveMode || isNavi) && heading !== null && !isNaN(heading) && speedKm > 3) {
        userMarker.setRotation(heading);
    } else {
        userMarker.setRotation(0);
    }

    if (isZooming && !isAutoPanning) return;

    if (isDriveMode) {
        DriverLogic.update(pos);
        if (document.getElementById('btn-recenter').classList.contains('hidden')) {
            isAutoPanning = true; 
            // Sanftes Kameragleiten inklusive Drehung
            map.easeTo({ 
                center: [lng, lat], 
                bearing: (speedKm > 3 && heading !== null) ? heading : map.getBearing(),
                duration: 1000, 
                easing: t => t 
            });
        }
    } else if (isNavi) {
        NaviLogic.updatePosition(pos); 
        if (document.getElementById('btn-nav-recenter').classList.contains('hidden')) {
            isAutoPanning = true;
            map.easeTo({ center: [lng, lat], duration: 1000, easing: t => t });
        }
    } else {
        const isHome = document.getElementById('home-screen').classList.contains('active');
        const isExplore = !document.getElementById('explore-screen').classList.contains('hidden');
        
        if (isHome) {
            isAutoPanning = true;
            map.jumpTo({ center: [lng, lat], zoom: 15 });
        } 
        else if (!isExplore) {
            // Distanz-Check: MapLibre nutzt Turf.js oder simple Geometrie, hier einfacher Vektor
            const currentCenter = map.getCenter();
            const dist = Math.sqrt(Math.pow(currentCenter.lng - lng, 2) + Math.pow(currentCenter.lat - lat, 2)) * 111000;
            if(dist > 50) {
                isAutoPanning = true;
                map.panTo([lng, lat], { duration: 2000 });
            }
        }
    }
}

function startDriveMode() {
    // Sicherer Aufruf (verhindert Absturz, falls Funktion nicht existiert)
    if(typeof ExploreLogic !== 'undefined' && typeof ExploreLogic.leave === 'function') ExploreLogic.leave();
    if(typeof NaviLogic !== 'undefined' && typeof NaviLogic.cancelRoute === 'function') NaviLogic.cancelRoute(); 
    
    isDriveMode = true;
    switchScreen('drive-screen');
    document.getElementById('global-nav').classList.add('hidden');
    
    document.getElementById('btn-recenter').classList.add('hidden');
    document.getElementById('global-top-fade').classList.remove('visible');

    if (map) {
        map.dragPan.enable();
        map.scrollZoom.enable();
        map.doubleClickZoom.enable();
        map.touchZoomRotate.enable();

        if(userMarker) {
            isAutoPanning = true; 
            map.jumpTo({ center: userMarker.getLngLat(), zoom: 18 });
        }
    }
    if (typeof DriverLogic !== 'undefined' && typeof DriverLogic.start === 'function') DriverLogic.start();
}

function centerMapOnUser() {
    if(userMarker) {
        isAutoPanning = true; 
        map.easeTo({ center: userMarker.getLngLat(), zoom: 18, duration: 1000 });
        
        document.getElementById('btn-recenter').classList.add('hidden');
        const navRecenter = document.getElementById('btn-nav-recenter');
        if(navRecenter) navRecenter.classList.add('hidden');
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
   // FIX: Die neuen Render-Funktionen aufrufen
    if(window.GarageLogic) {
        GarageLogic.renderCars(); // Baut den Slider
        GarageLogic.renderList(); // Baut die History-Liste
    }
}

function showExplore() {
    switchScreen('explore-screen');
    updateNav('explore');
    
    document.getElementById('global-top-fade').classList.add('visible');
    
    if (map) map.jumpTo({ bearing: 0, pitch: 0 });
    
    if(typeof ExploreLogic !== 'undefined' && typeof ExploreLogic.enter === 'function') ExploreLogic.enter();
}

function updateNav(activeId) {
    document.getElementById('global-nav').classList.remove('hidden');
    
    const homeBtn = document.getElementById('nav-home');
    const exploreBtn = document.getElementById('nav-explore');
    const garageBtn = document.getElementById('nav-garage');
    const perfBtn = document.getElementById('nav-perf'); // NEU

    homeBtn.classList.remove('active-home');
    exploreBtn.classList.remove('active-map');
    garageBtn.classList.remove('active-garage');
    if(perfBtn) perfBtn.classList.remove('active-perf'); // NEU

    if(activeId === 'home') homeBtn.classList.add('active-home');
    if(activeId === 'explore') exploreBtn.classList.add('active-map');
    if(activeId === 'garage') garageBtn.classList.add('active-garage');
    if(activeId === 'perf' && perfBtn) perfBtn.classList.add('active-perf'); // NEU
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

function showPerf() {
    // 1. Andere Modi beenden
    if(typeof ExploreLogic !== 'undefined') ExploreLogic.leave();
    if(typeof NaviLogic !== 'undefined') NaviLogic.cancelRoute();

    // 2. Map Effekte zurücksetzen (falls man von Home kommt)
    document.getElementById('global-top-fade').classList.remove('visible');
    document.getElementById('background-map').classList.remove('map-locked');
    document.getElementById('background-map').classList.remove('map-smooth-rotate');

    // 3. Screen wechseln
    switchScreen('performance-screen');
    updateNav('perf'); // Macht den Button rot
    // 4. Dem Spezialisten Bescheid sagen
    if(window.PerfLogic) {
        // urze Verzögerung, damit der Screen sicher sichtbar ist
        setTimeout(() => PerfLogic.onScreenShow(), 50);
    }
} 


