const DriverLogic = {
    interval: null,
    startTime: 0,
    startDist: 0,
    currentSpeed: 0,
    maxSpeed: 0, // NEU: Max Speed Tracker
    path: [], // Pfad speichern

    start: function() {
        this.startTime = Date.now();
        this.startDist = 0;
        this.path = [];
        this.maxSpeed = 0; // Reset
        
        document.getElementById('hud-time').innerText = "00:00";
        document.getElementById('hud-dist').innerText = "0.00";
        document.getElementById('hud-speed').innerText = "0";

        if(this.interval) clearInterval(this.interval);
        this.interval = setInterval(() => {
            this.updateTime();
        }, 1000);
    },

    update: function(pos) {
        if (!this.startTime) return;
        
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        // Speed in km/h
        const speed = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;
        this.currentSpeed = speed;

        // NEU: Max Speed berechnen
        if (speed > this.maxSpeed) {
            this.maxSpeed = speed;
        }

        // Pfad speichern (mit Speed)
        this.path.push({
            lat: lat,
            lng: lng,
            speed: speed,
            time: Date.now()
        });

        // Distanz berechnen (einfach summieren aus Path)
        if (this.path.length > 1) {
            const last = this.path[this.path.length - 2];
            const curr = this.path[this.path.length - 1];
            const p1 = L.latLng(last.lat, last.lng);
            const p2 = L.latLng(curr.lat, curr.lng);
            this.startDist += p1.distanceTo(p2) / 1000; // in km
        }

        // Update UI
        document.getElementById('hud-speed').innerText = this.currentSpeed;
        document.getElementById('hud-dist').innerText = this.startDist.toFixed(2);
        
        this.checkSpeedLimit(lat, lng);
    },

    updateTime: function() {
        const diff = Date.now() - this.startTime;
        const totalSec = Math.floor(diff / 1000);
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        document.getElementById('hud-time').innerText = 
            `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    },

    checkSpeedLimit: function(lat, lng) {
        // Einfacher Check alle paar Sekunden via Overpass (optional, hier vereinfacht)
        if (Math.random() > 0.95) { // Nicht zu oft aufrufen
             // Hier könnte Logik stehen, aktuell Dummy oder via navi.js Logik
        }
    },

    stop: function() {
        clearInterval(this.interval);
        const durationMs = Date.now() - this.startTime;
        const durationMin = Math.floor(durationMs / 60000);
        const durationSec = Math.floor((durationMs % 60000) / 1000);
        const timeStr = `${durationMin.toString().padStart(2,'0')}:${durationSec.toString().padStart(2,'0')}`;
        
        // Avg Speed berechnen
        const avgSpeed = (durationMs > 0 && this.startDist > 0) ? Math.round(this.startDist / (durationMs/3600000)) : 0;

        // Summary anzeigen
        NaviLogic.recordStats = {
            dist: this.startDist,
            startTime: this.startTime,
            path: this.path,
            maxSpeed: this.maxSpeed // NEU: MaxSpeed übergeben
        };
        
        // UI für Summary setzen (wird eigentlich in navi.js showSummary gemacht, aber hier manuell füllen)
        document.getElementById('sum-avg').innerText = avgSpeed;
        document.getElementById('sum-dist').innerText = this.startDist.toFixed(2);
        document.getElementById('sum-time').innerText = timeStr;
        document.getElementById('sum-comparison-row').classList.add('hidden'); // Kein Vergleich bei Free Drive

        // Wechsel zu Summary
        switchScreen('summary-screen');
        document.getElementById('global-nav').classList.remove('hidden'); // Nav wieder da
        
        // Map Reset
        const mapEl = document.getElementById('background-map');
        mapEl.classList.remove('map-smooth-rotate');
        mapEl.classList.add('map-locked'); // Lock für Summary
        if(mapEl) mapEl.style.transform = `translate(-50%, -50%) rotate(0deg)`;

        // Summary Map zeichnen
        setTimeout(() => {
            const mapContainer = document.getElementById('summary-map');
            if (window.summaryMapInstance) { window.summaryMapInstance.remove(); window.summaryMapInstance = null; }
            mapContainer.innerHTML = "";
            window.summaryMapInstance = L.map('summary-map', { zoomControl: false, attributionControl: false }).setView([51.1657, 10.4515], 13);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(window.summaryMapInstance);
            if (this.path.length > 1) {
                const latLngs = this.path.map(p => [p.lat, p.lng]);
                const line = L.polyline(latLngs, {color: '#bf5af2', weight: 4}).addTo(window.summaryMapInstance);
                window.summaryMapInstance.fitBounds(line.getBounds(), {padding:[40,40]});
            }
        }, 300);

        // Save Logic update
        document.getElementById('btn-save').onclick = () => {
            GarageLogic.save({ 
                date: Date.now(), 
                dist: this.startDist, 
                time: timeStr, 
                avg: avgSpeed, 
                max: this.maxSpeed, // NEU
                path: this.path 
            });
            showGarage();
        };
        document.getElementById('btn-discard').onclick = showHome;
    }
};
