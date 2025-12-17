let summaryMap = null;
let lastSpeedCheck = 0; // Timestamp, damit wir die API nicht überlasten

const DriverLogic = {
    startTime: null, timerInterval: null, totalDist: 0, lastPos: null, historyPoints: [],
    
    start: function() {
        this.startTime = Date.now();
        this.totalDist = 0; this.lastPos = null; this.historyPoints = [];
        document.getElementById('hud-time').innerText = "00:00";
        document.getElementById('hud-dist').innerText = "0.00";
        document.getElementById('hud-speed').innerText = "0";
        
        // Schild erst mal verstecken
        document.getElementById('speed-limit').classList.add('hidden');

        if(this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            const diff = Date.now() - this.startTime;
            const min = Math.floor(diff / 60000);
            const sec = Math.floor((diff % 60000) / 1000);
            document.getElementById('hud-time').innerText = 
                `${min.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
        }, 1000);
    },

    update: function(pos) {
        let speedKm = 0;
        if(pos.coords.speed && pos.coords.speed > 0) speedKm = Math.round(pos.coords.speed * 3.6);
        document.getElementById('hud-speed').innerText = speedKm;

        const lat = pos.coords.latitude; const lng = pos.coords.longitude;

        // --- ECHTE API ABFRAGE (Alle 10-15 Sekunden) ---
        // Wir nutzen Overpass API (OpenStreetMap)
        const now = Date.now();
        if (now - lastSpeedCheck > 12000) { // Alle 12 Sekunden checken
            lastSpeedCheck = now;
            this.fetchRealSpeedLimit(lat, lng);
        }

        if (this.lastPos) {
            const dist = this.calculateDistance(this.lastPos.latitude, this.lastPos.longitude, lat, lng);
            if (dist > 0.005) { 
                this.totalDist += dist;
                document.getElementById('hud-dist').innerText = this.totalDist.toFixed(2);
                this.lastPos = pos.coords;
                this.historyPoints.push({lat: lat, lng: lng, speed: speedKm});
            }
        } else {
            this.lastPos = pos.coords;
            this.historyPoints.push({lat: lat, lng: lng, speed: speedKm}); 
        }
    },

    // DIE ECHTE ABFRAGE
    fetchRealSpeedLimit: function(lat, lng) {
        // Query: Suche Straßen im Umkreis von 25m mit "maxspeed" Tag
        const query = `
            [out:json];
            way(around:25,${lat},${lng})["maxspeed"];
            out tags;
        `;
        const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

        fetch(url)
            .then(r => r.json())
            .then(data => {
                const sign = document.getElementById('speed-limit');
                const span = sign.querySelector('span');

                if (data.elements && data.elements.length > 0) {
                    // Wir nehmen das erste Ergebnis (meistens die Straße auf der man ist)
                    let maxSpeed = data.elements[0].tags.maxspeed;
                    
                    // Fallback für Text-Werte (Deutschland)
                    if (maxSpeed === "DE:urban") maxSpeed = "50";
                    if (maxSpeed === "DE:rural") maxSpeed = "100";
                    if (maxSpeed === "DE:zone:30") maxSpeed = "30";

                    // Zahl extrahieren
                    const cleanSpeed = parseInt(maxSpeed);

                    if (!isNaN(cleanSpeed)) {
                        span.innerText = cleanSpeed;
                        sign.classList.remove('hidden');
                        sign.style.opacity = '1';
                    } else if (maxSpeed === "none") {
                        // Keine Begrenzung (Autobahn) -> Ausblenden
                        sign.classList.add('hidden');
                        sign.style.opacity = '0';
                    }
                } else {
                    // Kein Schild gefunden in OSM -> Ausblenden
                    sign.classList.add('hidden');
                    sign.style.opacity = '0';
                }
            })
            .catch(err => {
                console.log("Overpass API Error (evtl. offline oder timeout)", err);
            });
    },

    stop: function() {
        clearInterval(this.timerInterval);
        const durationHours = (Date.now() - this.startTime) / 3600000;
        const avgSpeed = durationHours > 0 ? Math.round(this.totalDist / durationHours) : 0;
        const finalTime = document.getElementById('hud-time').innerText;

        document.getElementById('sum-avg').innerText = avgSpeed;
        document.getElementById('sum-dist').innerText = this.totalDist.toFixed(2);
        document.getElementById('sum-time').innerText = finalTime;
        
        // Schild weg
        document.getElementById('speed-limit').classList.add('hidden');

        switchScreen('summary-screen');

        setTimeout(() => {
            const latLngs = this.historyPoints.map(p => [p.lat, p.lng]);
            let center = [51.1657, 10.4515];
            if (latLngs.length > 0) center = latLngs[latLngs.length - 1];
            else if (typeof userMarker !== 'undefined' && userMarker) center = userMarker.getLatLng();

            const mapContainer = document.getElementById('summary-map');
            if (summaryMap) { summaryMap.off(); summaryMap.remove(); summaryMap = null; }
            if(mapContainer) mapContainer.innerHTML = "";

            summaryMap = L.map('summary-map', { zoomControl: false, attributionControl: false, dragging: false, touchZoom: false, doubleClickZoom: false, scrollWheelZoom: false }).setView(center, 15);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { detectRetina: true }).addTo(summaryMap);
            
            if (latLngs.length > 0) {
                if (latLngs.length > 1) {
                    const line = L.polyline(latLngs, {color: '#007aff', weight: 4}).addTo(summaryMap);
                    summaryMap.fitBounds(line.getBounds(), {padding:[40,40]});
                } else { summaryMap.setView(center, 16); }
                L.circleMarker(latLngs[0], {radius: 6, color: '#32cd32', fillOpacity: 1, fillColor: '#32cd32'}).addTo(summaryMap);
                L.circleMarker(latLngs[latLngs.length-1], {radius: 6, color: '#ff3b30', fillOpacity: 1, fillColor: '#ff3b30'}).addTo(summaryMap);
            } else { L.circleMarker(center, {radius: 6, color: '#007aff', fillOpacity: 1, fillColor: '#007aff'}).addTo(summaryMap); }
            summaryMap.invalidateSize();
        }, 350);

        const btnSave = document.getElementById('btn-save');
        const btnDiscard = document.getElementById('btn-discard');

        btnSave.onclick = () => {
            GarageLogic.save({ date: Date.now(), dist: this.totalDist, time: finalTime, avg: avgSpeed, path: this.historyPoints });
            showGarage();
        };
        btnDiscard.onclick = () => { hideGarage(); };
    },

    calculateDistance: function(lat1, lon1, lat2, lon2) {
        const R = 6371; 
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }
};
