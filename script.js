// --- DRIVERHUB 4.0 - CORE LOGIC ---

let map;
let watchId;

// 1. INIT beim Laden
window.addEventListener('load', () => {
    initBackgroundMap();
    initWeather();
});

// 2. BACKGROUND MAP SETUP
function initBackgroundMap() {
    // Map erstellen, aber ohne Controls (Zoom-Buttons weg)
    map = L.map('background-map', {
        zoomControl: false,
        attributionControl: false,
        dragging: false, // Map bewegt sich nicht per Hand
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false
    }).setView([51.1657, 10.4515], 13); // Default Start: Deutschland Mitte

    // Dark Mode Tiles laden
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 20
    }).addTo(map);

    // Echte Position holen & Map zentrieren
    if (navigator.geolocation) {
        // watchPosition sorgt dafür, dass die Map mitwandert, wenn du dich bewegst
        watchId = navigator.geolocation.watchPosition(pos => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            // Sanfte Animation zum Standort
            map.flyTo([lat, lng], 15, { animate: true, duration: 2 });
        }, err => {
            console.warn("GPS Fehler:", err);
            document.getElementById('loc-text').innerText = "GPS Aus";
        }, { enableHighAccuracy: true });
    }
}

// 3. WETTER & STANDORT NAME
function initWeather() {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        // A) Ort Name holen (Nominatim API)
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
            .then(r => r.json())
            .then(data => {
                // Stadt oder Dorf anzeigen
                const city = data.address.city || data.address.town || data.address.village || "Standort";
                document.getElementById('loc-text').innerText = city;
            });

        // B) Wetter holen (Open-Meteo API)
        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`)
            .then(r => r.json())
            .then(data => {
                const temp = Math.round(data.current_weather.temperature);
                const code = data.current_weather.weathercode;
                
                document.getElementById('weather-temp').innerText = temp + "°";
                
                // Icon Logik
                const icon = document.getElementById('weather-icon');
                if (code <= 1) icon.className = "fa-solid fa-sun"; // Klar
                else if (code <= 3) icon.className = "fa-solid fa-cloud-sun"; // Bewölkt
                else if (code <= 60) icon.className = "fa-solid fa-cloud-rain"; // Regen
                else icon.className = "fa-solid fa-snowflake"; // Schnee/Rest
            });
    });
}

// 4. BUTTON CLICK (Nur Test für jetzt)
document.getElementById('btn-start').addEventListener('click', () => {
    alert("Start Drive geklickt! (Nächster Schritt)");
});
