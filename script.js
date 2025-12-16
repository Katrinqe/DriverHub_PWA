// --- DRIVERHUB 4.0 - CORE LOGIC ---

let map;
let userMarker = null; // Speichert unseren blauen Punkt

window.addEventListener('load', () => {
    initBackgroundMap();
    initWeather();
});

function initBackgroundMap() {
    map = L.map('background-map', {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false
    }).setView([51.1657, 10.4515], 13);

    // Dark Mode Tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 20
    }).addTo(map);

    if (navigator.geolocation) {
        navigator.geolocation.watchPosition(updateUserLocation, err => {
            console.warn("GPS Fehler:", err);
            document.getElementById('loc-text').innerText = "GPS Aus";
        }, { enableHighAccuracy: true });
    }
}

function updateUserLocation(pos) {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const newLatLng = [lat, lng];

    // 1. Wenn Marker noch nicht existiert -> Erstellen
    if (!userMarker) {
        // Wir bauen ein Custom Icon aus HTML/CSS
        const customIcon = L.divIcon({
            className: 'user-marker-wrap', // Klasse für CSS
            html: '<div class="user-pulse"></div><div class="user-dot"></div>',
            iconSize: [40, 40], // Größe des gesamten Containers (für Pulse)
            iconAnchor: [20, 20] // Mitte des Icons
        });

        userMarker = L.marker(newLatLng, { icon: customIcon }).addTo(map);
    } else {
        // 2. Wenn Marker schon da -> Nur verschieben
        userMarker.setLatLng(newLatLng);
    }

    // Map sanft hinterherziehen
    map.flyTo(newLatLng, 15, { animate: true, duration: 2 });
}

function initWeather() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
            .then(r => r.json())
            .then(data => {
                const city = data.address.city || data.address.town || "Standort";
                document.getElementById('loc-text').innerText = city;
            });

        fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`)
            .then(r => r.json())
            .then(data => {
                const t = Math.round(data.current_weather.temperature);
                const c = data.current_weather.weathercode;
                document.getElementById('weather-temp').innerText = t + "°";
                const icon = document.getElementById('weather-icon');
                if (c <= 1) icon.className = "fa-solid fa-sun";
                else if (c <= 3) icon.className = "fa-solid fa-cloud-sun";
                else icon.className = "fa-solid fa-cloud";
            });
    });
}

document.getElementById('btn-start').addEventListener('click', () => {
    alert("Klick! Hier würde es losgehen.");
});
