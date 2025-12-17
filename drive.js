// --- DRIVE.JS: Tracking & Logic ---

const DriverLogic = {
    startTime: null,
    timerInterval: null,
    totalDist: 0, // km
    lastPos: null,
    historyPoints: [], // Für Map Path später
    
    start: function() {
        this.startTime = Date.now();
        this.totalDist = 0;
        this.lastPos = null;
        this.historyPoints = [];
        
        // UI Reset
        document.getElementById('hud-time').innerText = "00:00";
        document.getElementById('hud-dist').innerText = "0.00";
        document.getElementById('hud-speed').innerText = "0";
        document.getElementById('speed-limit-ui').classList.add('hidden'); // Limit erst bei Bewegung

        // Timer starten
        this.timerInterval = setInterval(() => {
            const diff = Date.now() - this.startTime;
            const min = Math.floor(diff / 60000);
            const sec = Math.floor((diff % 60000) / 1000);
            document.getElementById('hud-time').innerText = 
                `${min.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
        }, 1000);

        document.getElementById('btn-stop').onclick = () => this.stop();
    },

    update: function(pos) {
        // 1. Speed (vom GPS in m/s -> km/h)
        let speedKm = 0;
        if(pos.coords.speed && pos.coords.speed > 0) {
            speedKm = Math.round(pos.coords.speed * 3.6);
        }
        document.getElementById('hud-speed').innerText = speedKm;

        // 2. Distanz Berechnung (Haversine Formel für Genauigkeit)
        if (this.lastPos) {
            const dist = this.calculateDistance(
                this.lastPos.latitude, this.lastPos.longitude,
                pos.coords.latitude, pos.coords.longitude
            );
            
            // Nur addieren wenn Bewegung > 5 Meter (Rauschunterdrückung)
            if (dist > 0.005) { 
                this.totalDist += dist;
                document.getElementById('hud-dist').innerText = this.totalDist.toFixed(2);
                this.lastPos = pos.coords;
                this.historyPoints.push([pos.coords.latitude, pos.coords.longitude]);
            }
        } else {
            this.lastPos = pos.coords;
        }

        // 3. Speed Limit Check (Dummy für API)
        this.checkSpeedLimit(pos.coords.latitude, pos.coords.longitude);
    },

    stop: function() {
        clearInterval(this.timerInterval);
        isDriveMode = false;
        
        // Berechnung Durchschnitt
        const durationHours = (Date.now() - this.startTime) / 3600000;
        const avgSpeed = durationHours > 0 ? Math.round(this.totalDist / durationHours) : 0;

        // Daten ins Summary füllen
        document.getElementById('sum-avg').innerText = avgSpeed + " km/h";
        document.getElementById('sum-dist').innerText = this.totalDist.toFixed(2) + " km";
        document.getElementById('sum-time').innerText = document.getElementById('hud-time').innerText;

        // Screen wechseln
        switchScreen('summary-screen');

        // Save/Discard Logik
        document.getElementById('btn-save').onclick = () => {
            GarageLogic.save({
                date: Date.now(),
                dist: this.totalDist,
                time: document.getElementById('hud-time').innerText,
                avg: avgSpeed,
                path: this.historyPoints
            });
            showGarage();
        };
        document.getElementById('btn-discard').onclick = () => {
            switchScreen('home-screen');
        };
    },

    calculateDistance: function(lat1, lon1, lat2, lon2) {
        const R = 6371; // Erdradius km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    },

    checkSpeedLimit: function(lat, lng) {
        // HIER MÜSSTE EINE API HIN (z.B. Overpass Turbo)
        // Kostenlose APIs sind sehr langsam oder ungenau.
        // Mockup Funktion:
        const limitUI = document.getElementById('speed-limit-ui');
        // Zeige Limit zufällig an für Testzwecke (später echte API)
        /* limitUI.classList.remove('hidden');
        document.getElementById('limit-val').innerText = "50";
        */
    }
};
