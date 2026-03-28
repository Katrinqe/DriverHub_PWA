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
                const city = d.address.city || d.address.town || "Standort";
                const el = document.getElementById('loc-text');
                if (el) el.innerText = city;
            });

        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`)
            .then(r => r.json()).then(d => {
                const elTemp = document.getElementById('weather-temp');
                if (elTemp) elTemp.innerText = Math.round(d.current_weather.temperature) + "°";
                
                const c = d.current_weather.weathercode;
                const i = document.getElementById('weather-icon');
                if (i) {
                    if (c <= 1) i.className = "fa-solid fa-sun";
                    else if (c <= 3) i.className = "fa-solid fa-cloud-sun";
                    else i.className = "fa-solid fa-cloud";
                }
            });
    });
}

const btnStart = document.getElementById('btn-start');
if (btnStart) {
    btnStart.addEventListener('click', () => alert("Start!"));
}

function initPriceAlarm() {
    const btn = document.querySelector('.btn-radar-set');
    const input = document.getElementById('alarm-price-input');
    
    if (!btn || !input) return;

    // Wir feuern jetzt durch einen ECHTEN KLICK auf den Button!
    btn.addEventListener('click', async function(e) {
        e.preventDefault();
        const val = input.value;
        
        if(!val) {
            alert("⚠️ Bitte erst einen Preis eingeben!");
            return;
        }

        // === 1. PUSH-RECHTE ERZWINGEN ===
        if (window.Notification && Notification.permission !== 'granted') {
            try {
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    alert("❌ Push abgelehnt. Du musst es in den iOS-Einstellungen erlauben.");
                    return;
                }
            } catch (err) {
                alert("❌ Fataler Push-Fehler (HTTPS aktiv?): " + err);
                return;
            }
        }

        // === 2. FUNKSPRUCH AN DAS U-BOOT ===
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'TEST_ALARM',
                price: val,
                delay: 20000 
            });
            // Dieses Pop-up MUSS jetzt kommen!
            alert(`✅ Alarm für ${val}€ scharf! Schließe jetzt die App komplett (wegwischen).`);
        } else {
            alert("❌ Kein Service Worker gefunden! Testest du über HTTP (ohne S)?");
        }
    });
}
