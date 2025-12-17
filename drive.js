// --- DRIVE.JS ---

const DriverLogic = {
    startTime: null,
    timerInterval: null,
    totalDist: 0, 
    lastPos: null,
    historyPoints: [],
    
    // START
    start: function() {
        console.log("Drive started");
        this.startTime = Date.now();
        this.totalDist = 0;
        this.lastPos = null;
        this.historyPoints = [];
        
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

    // UPDATE (GPS)
    update: function(pos) {
        // Speed
        let speedKm = 0;
        if(pos.coords.speed && pos.coords.speed > 0) {
            speedKm = Math.round(pos.coords.speed * 3.6);
        }
        document.getElementById('hud-speed').innerText = speedKm;

        // Distanz
        if (this.lastPos) {
            const dist = this.calculateDistance(
                this.lastPos.latitude, this.lastPos.longitude,
                pos.coords.latitude, pos.coords.longitude
            );
            
            // Filter gegen GPS-Zittern (ab 5 Meter Bewegung)
            if (dist > 0.005) { 
                this.totalDist += dist;
                document.getElementById('hud-dist').innerText = this.totalDist.toFixed(2);
                
                this.lastPos = pos.coords;
                // Pfad speichern für Garage
                this.historyPoints.push([pos.coords.latitude, pos.coords.longitude]);
            }
        } else {
            this.lastPos = pos.coords;
            // Ersten Punkt auch speichern
            this.historyPoints.push([pos.coords.latitude, pos.coords.longitude]);
        }
    },

    // STOP (Hier ist der Save-Fix)
    stop: function() {
        console.log("Drive stopped");
        clearInterval(this.timerInterval);
        isDriveMode = false;
        
        // Berechnungen für Summary
        const durationHours = (Date.now() - this.startTime) / 3600000;
        const avgSpeed = durationHours > 0 ? Math.round(this.totalDist / durationHours) : 0;
        const finalTime = document.getElementById('hud-time').innerText;

        // UI füllen
        document.getElementById('sum-avg').innerText = avgSpeed;
        document.getElementById('sum-dist').innerText = this.totalDist.toFixed(2);
        document.getElementById('sum-time').innerText = finalTime;

        // Screen wechseln
        switchScreen('summary-screen');

        // --- BUTTON LOGIK FIX ---
        const btnSave = document.getElementById('btn-save');
        const btnDiscard = document.getElementById('btn-discard');

        // Wir nutzen .onclick, um sicher alle alten Events zu überschreiben
        btnSave.onclick = () => {
            console.log("Save Button clicked");
            GarageLogic.save({
                date: Date.now(),
                dist: this.totalDist,
                time: finalTime,
                avg: avgSpeed,
                path: this.historyPoints
            });
            // Zur Garage wechseln
            showGarage();
        };

        btnDiscard.onclick = () => {
            console.log("Discard clicked");
            hideGarage(); // Geht zurück zu Home
        };
    },

    // Mathe Helfer
    calculateDistance: function(lat1, lon1, lat2, lon2) {
        const R = 6371; 
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
};
