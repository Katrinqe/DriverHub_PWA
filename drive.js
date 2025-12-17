let summaryMap = null; // Map Instanz

const DriverLogic = {
    startTime: null, timerInterval: null, totalDist: 0, lastPos: null, historyPoints: [],
    
    start: function() {
        this.startTime = Date.now();
        this.totalDist = 0; this.lastPos = null; this.historyPoints = [];
        document.getElementById('hud-time').innerText = "00:00";
        document.getElementById('hud-dist').innerText = "0.00";
        document.getElementById('hud-speed').innerText = "0";

        if(this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            const diff = Date.now() - this.startTime;
            const min = Math.floor(diff / 60000);
            const sec = Math.floor((diff % 60000) / 1000);
            document.getElementById('hud-time').innerText = `${min.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
        }, 1000);
    },

    update: function(pos) {
        let speedKm = 0;
        if(pos.coords.speed && pos.coords.speed > 0) speedKm = Math.round(pos.coords.speed * 3.6);
        document.getElementById('hud-speed').innerText = speedKm;

        if (this.lastPos) {
            const dist = this.calculateDistance(this.lastPos.latitude, this.lastPos.longitude, pos.coords.latitude, pos.coords.longitude);
            if (dist > 0.005) { 
                this.totalDist += dist;
                document.getElementById('hud-dist').innerText = this.totalDist.toFixed(2);
                this.lastPos = pos.coords;
                this.historyPoints.push([pos.coords.latitude, pos.coords.longitude]);
            }
        } else {
            this.lastPos = pos.coords;
            this.historyPoints.push([pos.coords.latitude, pos.coords.longitude]);
        }
    },

    stop: function() {
        clearInterval(this.timerInterval);
        const durationHours = (Date.now() - this.startTime) / 3600000;
        const avgSpeed = durationHours > 0 ? Math.round(this.totalDist / durationHours) : 0;
        const finalTime = document.getElementById('hud-time').innerText;

        document.getElementById('sum-avg').innerText = avgSpeed;
        document.getElementById('sum-dist').innerText = this.totalDist.toFixed(2);
        document.getElementById('sum-time').innerText = finalTime;

        switchScreen('summary-screen');

        // --- MAP IN SUMMARY ZEICHNEN ---
        setTimeout(() => {
            if (!summaryMap) {
                summaryMap = L.map('summary-map', { zoomControl: false, attributionControl: false }).setView([0,0], 13);
                L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(summaryMap);
            }
            // Alte Layer löschen
            summaryMap.eachLayer(l => { if(!(l instanceof L.TileLayer)) l.remove(); });
            
            if (this.historyPoints.length > 0) {
                // Route zeichnen
                const line = L.polyline(this.historyPoints, {color: '#007aff', weight: 4}).addTo(summaryMap);
                
                // Start & Ende
                const startPt = this.historyPoints[0];
                const endPt = this.historyPoints[this.historyPoints.length - 1];

                // Grüne Start-Punkt
                L.circleMarker(startPt, {radius: 6, color: '#00ff00', fillOpacity: 1}).addTo(summaryMap);
                // Roter End-Punkt
                L.circleMarker(endPt, {radius: 6, color: '#ff0000', fillOpacity: 1}).addTo(summaryMap);

                summaryMap.fitBounds(line.getBounds(), {padding:[30,30]});
            }
            summaryMap.invalidateSize(); // Fix für Render-Fehler
        }, 100);

        // Buttons
        const btnSave = document.getElementById('btn-save');
        const btnDiscard = document.getElementById('btn-discard');

        btnSave.onclick = () => {
            GarageLogic.save({ 
                date: Date.now(), dist: this.totalDist, time: finalTime, avg: avgSpeed, path: this.historyPoints 
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
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    }
};
