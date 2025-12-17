let summaryMap = null; // Globale Variable für die Karte

const DriverLogic = {
    startTime: null, 
    timerInterval: null, 
    totalDist: 0, 
    lastPos: null, 
    historyPoints: [], 
    
    // START
    start: function() {
        this.startTime = Date.now();
        this.totalDist = 0; 
        this.lastPos = null; 
        this.historyPoints = []; // Liste leeren!
        
        document.getElementById('hud-time').innerText = "00:00";
        document.getElementById('hud-dist').innerText = "0.00";
        document.getElementById('hud-speed').innerText = "0";

        if(this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            const diff = Date.now() - this.startTime;
            const min = Math.floor(diff / 60000);
            const sec = Math.floor((diff % 60000) / 1000);
            document.getElementById('hud-time').innerText = 
                `${min.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
        }, 1000);
    },

    // UPDATE
    update: function(pos) {
        let speedKm = 0;
        if(pos.coords.speed && pos.coords.speed > 0) {
            speedKm = Math.round(pos.coords.speed * 3.6);
        }
        document.getElementById('hud-speed').innerText = speedKm;

        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        if (this.lastPos) {
            const dist = this.calculateDistance(
                this.lastPos.latitude, this.lastPos.longitude,
                lat, lng
            );
            
            // Nur speichern wenn wir uns bewegen (Rauschen filtern)
            if (dist > 0.005) { 
                this.totalDist += dist;
                document.getElementById('hud-dist').innerText = this.totalDist.toFixed(2);
                this.lastPos = pos.coords;
                this.historyPoints.push([lat, lng]);
            }
        } else {
            // Erster Punkt
            this.lastPos = pos.coords;
            this.historyPoints.push([lat, lng]); 
        }
    },

    // STOP
    stop: function() {
        clearInterval(this.timerInterval);
        const durationHours = (Date.now() - this.startTime) / 3600000;
        const avgSpeed = durationHours > 0 ? Math.round(this.totalDist / durationHours) : 0;
        const finalTime = document.getElementById('hud-time').innerText;

        document.getElementById('sum-avg').innerText = avgSpeed;
        document.getElementById('sum-dist').innerText = this.totalDist.toFixed(2);
        document.getElementById('sum-time').innerText = finalTime;

        switchScreen('summary-screen');

        // --- KARTE RENDERN (Mit Verzögerung für Animation) ---
        setTimeout(() => {
            // 1. Container Hard-Reset (Verhindert Fehler beim 2. Mal)
            const mapContainer = document.getElementById('summary-map');
            
            // Wenn schon eine Karte da war -> weg damit
            if (summaryMap) {
                summaryMap.off();
                summaryMap.remove();
                summaryMap = null;
            }
            
            // Container HTML leeren (Sicherheitshalber)
            if(mapContainer) {
                mapContainer.innerHTML = "";
            }

            // 2. Mittelpunkt bestimmen
            let center = [51.1657, 10.4515]; // Fallback
            
            if (this.historyPoints.length > 0) {
                // Wenn wir gefahren sind -> Letzter Punkt
                center = this.historyPoints[this.historyPoints.length - 1];
            } else if (typeof userMarker !== 'undefined' && userMarker) {
                // Wenn wir SOFORT gestoppt haben -> Nimm den blauen Punkt (User Position)
                center = userMarker.getLatLng();
            }

            // 3. Neue Karte erstellen
            summaryMap = L.map('summary-map', { 
                zoomControl: false, 
                attributionControl: false,
                dragging: false, 
                touchZoom: false,
                doubleClickZoom: false,
                scrollWheelZoom: false
            }).setView(center, 15);
            
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                detectRetina: true
            }).addTo(summaryMap);
            
            // 4. Route zeichnen
            if (this.historyPoints.length > 0) {
                // Blaue Linie
                if (this.historyPoints.length > 1) {
                    const line = L.polyline(this.historyPoints, {color: '#007aff', weight: 4}).addTo(summaryMap);
                    summaryMap.fitBounds(line.getBounds(), {padding:[40,40]});
                } else {
                    summaryMap.setView(center, 16);
                }

                const startPt = this.historyPoints[0];
                const endPt = this.historyPoints[this.historyPoints.length - 1];

                // Start (Grün)
                L.circleMarker(startPt, {radius: 6, color: '#32cd32', fillOpacity: 1, fillColor: '#32cd32'}).addTo(summaryMap);
                // Ende (Rot)
                L.circleMarker(endPt, {radius: 6, color: '#ff3b30', fillOpacity: 1, fillColor: '#ff3b30'}).addTo(summaryMap);
            } else {
                // Wenn gar keine Punkte (0m gefahren): Zeige einfach aktuellen Standort
                L.circleMarker(center, {radius: 6, color: '#007aff', fillOpacity: 1, fillColor: '#007aff'}).addTo(summaryMap);
            }

            summaryMap.invalidateSize();
        }, 350); // Timing wichtig!

        // Buttons binden
        const btnSave = document.getElementById('btn-save');
        const btnDiscard = document.getElementById('btn-discard');

        // Alte Listener entfernen (indem wir .onclick überschreiben)
        btnSave.onclick = () => {
            GarageLogic.save({ 
                date: Date.now(), 
                dist: this.totalDist, 
                time: finalTime, 
                avg: avgSpeed, 
                path: this.historyPoints 
            });
            showGarage();
        };

        btnDiscard.onclick = () => {
            hideGarage();
        };
    },

    calculateDistance: function(lat1, lon1, lat2, lon2) {
        const R = 6371; 
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }
};
