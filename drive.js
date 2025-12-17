const DriverLogic = {
    startTime: null,
    timerInterval: null,
    totalDist: 0, 
    lastPos: null,
    historyPoints: [],
    
    start: function() {
        this.startTime = Date.now();
        this.totalDist = 0;
        this.lastPos = null;
        this.historyPoints = [];
        
        document.getElementById('hud-time').innerText = "00:00";
        document.getElementById('hud-dist').innerText = "0.00";
        document.getElementById('hud-speed').innerText = "0";

        this.timerInterval = setInterval(() => {
            const diff = Date.now() - this.startTime;
            const min = Math.floor(diff / 60000);
            const sec = Math.floor((diff % 60000) / 1000);
            document.getElementById('hud-time').innerText = 
                `${min.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
        }, 1000);
    },

    update: function(pos) {
        // 1. Speed
        let speedKm = 0;
        if(pos.coords.speed && pos.coords.speed > 0) {
            speedKm = Math.round(pos.coords.speed * 3.6);
        }
        document.getElementById('hud-speed').innerText = speedKm;

        // 2. Distanz
        if (this.lastPos) {
            const dist = this.calculateDistance(
                this.lastPos.latitude, this.lastPos.longitude,
                pos.coords.latitude, pos.coords.longitude
            );
            // Schwelle gegen GPS-Rauschen (5m)
            if (dist > 0.005) { 
                this.totalDist += dist;
                document.getElementById('hud-dist').innerText = this.totalDist.toFixed(2);
                this.lastPos = pos.coords;
                this.historyPoints.push([pos.coords.latitude, pos.coords.longitude]);
            }
        } else {
            this.lastPos = pos.coords;
        }
    },

    stop: function() {
        clearInterval(this.timerInterval);
        isDriveMode = false;
        
        // Berechnung
        const durationHours = (Date.now() - this.startTime) / 3600000;
        const avgSpeed = durationHours > 0 ? Math.round(this.totalDist / durationHours) : 0;

        // Summary Füllen
        document.getElementById('sum-avg').innerText = avgSpeed;
        document.getElementById('sum-dist').innerText = this.totalDist.toFixed(2);
        document.getElementById('sum-time').innerText = document.getElementById('hud-time').innerText;

        // UI Wechsel
        document.getElementById('drive-screen').classList.remove('active', 'hidden');
        document.getElementById('drive-screen').classList.add('hidden');
        
        document.getElementById('summary-screen').classList.remove('hidden');
        setTimeout(() => document.getElementById('summary-screen').classList.add('active'), 10);

        // Save Logik
        // Clone Node um alte Listener zu entfernen
        let oldSave = document.getElementById('btn-save');
        let newSave = oldSave.cloneNode(true);
        oldSave.parentNode.replaceChild(newSave, oldSave);
        
        newSave.addEventListener('click', () => {
            GarageLogic.save({
                date: Date.now(),
                dist: this.totalDist,
                time: document.getElementById('hud-time').innerText,
                avg: avgSpeed
            });
            showGarage();
        });

        // Discard Logik
        let oldDisc = document.getElementById('btn-discard');
        let newDisc = oldDisc.cloneNode(true);
        oldDisc.parentNode.replaceChild(newDisc, oldDisc);
        
        newDisc.addEventListener('click', () => {
            hideGarage(); // Geht zurück zu Home
        });
    },

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
