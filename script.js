// --- DRIVERHUB 4.0 - FINAL CORE ---

// --- DRIVERHUB 4.0 - FINAL CORE ---
let map;
let userMarker = null;

window.addEventListener('load', () => {
    // 1. Das U-Boot (Service Worker) beim Browser anmelden
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('Service Worker registriert!'))
        .catch(err => console.error('Service Worker Fehler:', err));
    }

    initBackgroundMap();
    initWeather();
    
    // 2. Den Preis-Alarm und den Funkspruch aktivieren
    initPriceAlarm(); 
});
function initBackgroundMap() {
    map = L.map('background-map', {
        zoomControl: false, attributionControl: false,
        dragging: false, scrollWheelZoom: false, doubleClickZoom: false, touchZoom: false
    }).setView([51.1657, 10.4515], 13);

    // Dark Tiles laden
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(map);

    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(updateUserLocation, 
            err => console.warn(err), 
            { enableHighAccuracy: true, maximumAge: 1000, timeout: 5000 }
        );
    }
}

function updateUserLocation(pos) {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const newLatLng = L.latLng(lat, lng);

    if (!userMarker) {
        const customIcon = L.divIcon({
            className: 'user-marker-wrap',
            html: '<div class="user-pulse"></div><div class="user-dot"></div>',
            iconSize: [40, 40], iconAnchor: [20, 20]
        });
        userMarker = L.marker(newLatLng, { icon: customIcon }).addTo(map);
        map.setView(newLatLng, 15);
        return; 
    }

    // Anti-Ruckel: Nur bewegen wenn > 10m Differenz
    const currentPos = userMarker.getLatLng();
    if (currentPos.distanceTo(newLatLng) < 10) return; 

    userMarker.setLatLng(newLatLng);
    map.panTo(newLatLng, { animate: true, duration: 1.5 });
}

function initWeather() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
        const lat = pos.coords.latitude; const lng = pos.coords.longitude;
        
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
            .then(r => r.json()).then(d => {
                document.getElementById('loc-text').innerText = d.address.city || d.address.town || "Standort";
            });

        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`)
            .then(r => r.json()).then(d => {
                document.getElementById('weather-temp').innerText = Math.round(d.current_weather.temperature) + "°";
                const c = d.current_weather.weathercode;
                const i = document.getElementById('weather-icon');
                if (c <= 1) i.className = "fa-solid fa-sun";
                else if (c <= 3) i.className = "fa-solid fa-cloud-sun";
                else i.className = "fa-solid fa-cloud";
            });
    });
}

document.getElementById('btn-start').addEventListener('click', () => alert("Start!"));

// --- DRIVERHUB 4.0 - FINAL CORE ---
let map;
let userMarker = null;

window.addEventListener('load', () => {
    // 1. Das U-Boot (Service Worker) beim Browser anmelden
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('Service Worker registriert!'))
        .catch(err => console.error('Service Worker Fehler:', err));
    }

    initBackgroundMap();
    initWeather();
    
    // 2. Den Preis-Alarm und den Funkspruch aktivieren
    initPriceAlarm(); 
});

// ... (HIER BLEIBT DEIN GANZER RESTLICHER KARTEN-CODE EXAKT WIE ER IST) ...

// === GANZ UNTEN IN DER DATEI HINZUFÜGEN ===
function initPriceAlarm() {
    const input = document.getElementById('alarm-price-input');
    if (!input) return;

    // Feuert, sobald du einen Preis eingibst und "Enter" drückst (oder daneben tippst)
    input.addEventListener('change', async function(e) {
        const val = e.target.value;

        // HIER passiert die Apple-Abfrage für die Benachrichtigungen!
        if (window.Notification && Notification.permission !== 'granted') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                console.log('Push-Rechte abgelehnt.');
                return;
            }
        }

        // HIER funkt das Cockpit das U-Boot an!
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'TEST_ALARM',
                price: val,
                delay: 20000 // 20.000 Millisekunden = 20 Sekunden
            });
            console.log('Funkspruch an sw.js gesendet! Timer läuft.');
        } else {
            console.log('Kein U-Boot gefunden. Lade die Seite einmal komplett neu.');
        }
    });
}
