let summaryMap = null; // Map Instanz global halten

const DriverLogic = {
    startTime: null, 
    timerInterval: null, 
    totalDist: 0, 
    lastPos: null, 
    historyPoints: [], // Hier speichern wir die Route [lat, lng]
    
    // START
    start: function() {
        this.startTime = Date.now();
        this.totalDist = 0; 
        this.lastPos = null; 
        this.historyPoints = []; // Reset
        
        // UI Reset
        document.getElementById('hud-time').innerText = "00:00";
        document.getElementById('hud-dist').innerText = "0.00";
        document.getElementById('hud-speed').innerText = "0";

        // Timer starten
        if(this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            const diff = Date.now() - this.startTime;
            const min = Math.floor(diff / 60000);
            const sec = Math.floor((diff % 60000) / 1000);
            document.getElementById('hud-time').innerText = 
                `${min.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
        }, 1000);
    },

    // UPDATE (Wird vom GPS in app.js aufgerufen)
    update: function(pos) {
        // 1. Speed
        let speedKm = 0;
        if(pos.coords.speed && pos.coords.speed > 0) {
            speedKm = Math.round(pos.coords.speed * 3.6);
        }
        document.getElementById('hud-speed').innerText = speedKm;

        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        // 2. Distanz & History
        if (this.lastPos) {
            const dist = this.calculateDistance(
                this.lastPos.latitude, this.lastPos.longitude,
                lat, lng
            );
            
            // Bewegung erkannt (> 5 Meter)
            if (dist > 0.005) { 
                this.totalDist += dist;
                document.getElementById('hud-dist').innerText = this.totalDist.toFixed(2);
                
                this.lastPos = pos.coords;
                this.historyPoints.push([lat, lng]);
            }
        } else {
            // ERSTER PUNKT (Start)
            this.lastPos = pos.coords;
            this.historyPoints.push([lat, lng]); // WICHTIG: Startpunkt sofort speichern!
        }
    },

    // STOP & SUMMARY MAP
    stop: function() {
        clearInterval(this.timerInterval);
        const durationHours = (Date.now() - this.startTime) / 3600000;
        const avgSpeed = durationHours > 0 ? Math.round(this.totalDist / durationHours) : 0;
        const finalTime = document.getElementById('hud-time').innerText;

        // Daten ins HTML schreiben
        document.getElementById('sum-avg').innerText = avgSpeed;
        document.getElementById('sum-dist').innerText = this.totalDist.toFixed(2);
        document.getElementById('sum-time').innerText = finalTime;

        // Screen wechseln
        switchScreen('summary-screen');

        // --- KARTE RENDERN ---
        // Kurzer Timeout, damit der Container sichtbar ist (sonst Render-Fehler)
        setTimeout(() => {
            // 1. Koordinaten bestimmen
            // Wenn keine Punkte da sind (Fehler), nimm Standard (Berlin), sonst den letzten bekannten Punkt
            let center = [51.1657, 10.4515]; 
            if (this.historyPoints.length > 0) {
                center = this.historyPoints[this.historyPoints.length - 1];
            } else if (this.lastPos) {
                center = [this.lastPos.latitude, this.lastPos.longitude];
            }

            // 2. Map initialisieren (falls noch nicht da)
            if (!summaryMap) {
                summaryMap = L.map('summary-map', { 
                    zoomControl: false, 
                    attributionControl: false,
                    dragging: false, // Statische Map
                    touchZoom: false,
                    doubleClickZoom: false,
                    scrollWheelZoom: false
                }).setView(center, 15);
                
                L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                    detectRetina: true
                }).addTo(summaryMap);
            } else {
                // Map recyceln: Alles löschen & neu zentrieren
                summaryMap.eachLayer(l => { if(!(l instanceof L.TileLayer)) l.remove(); });
                summaryMap.setView(center, 15);
            }
            
            // 3. Route & Marker zeichnen
            if (this.historyPoints.length > 0) {
                const startPt = this.historyPoints[0];
                const endPt = this.historyPoints[this.historyPoints.length - 1];

                // Blaue Linie (nur wenn > 1 Punkt)
                if (this.historyPoints.length > 1) {
                    const line = L.polyline(this.historyPoints, {color: '#007aff', weight: 4}).addTo(summaryMap);
                    // Zoom auf die Strecke
                    summaryMap.fitBounds(line.getBounds(), {padding:[40,40]});
                } else {
                    // Nur 1 Punkt: Einfach zentrieren
                    summaryMap.setView(startPt, 16);
                }

                // Start (Grün) & Ende (Rot)
                L.circleMarker(startPt, {radius: 6, color: '#32cd32', fillOpacity: 1, fillColor: '#32cd32'}).addTo(summaryMap);
                L.circleMarker(endPt, {radius: 6, color: '#ff3b30', fillOpacity: 1, fillColor: '#ff3b30'}).addTo(summaryMap);
            }

            summaryMap.invalidateSize(); // WICHTIG: Map neu berechnen
        }, 100);

        // Buttons binden
        const btnSave = document.getElementById('btn-save');
        const btnDiscard = document.getElementById('btn-discard');

        btnSave.onclick = () => {
            GarageLogic.save({ 
                date: Date.now(), 
                dist: this.totalDist, 
                time: finalTime, 
                avg: avgSpeed, 
                path: this.historyPoints // Pfad mit speichern!
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
