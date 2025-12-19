// drive.js - Free Drive Logic

const DriverLogic = {
    startTime: 0,
    timerInterval: null,
    distance: 0,
    lastPos: null,
    path: [],
    
    start: function() {
        console.log("Drive Started");
        this.startTime = Date.now();
        this.distance = 0;
        this.lastPos = null;
        this.path = [];
        
        document.getElementById('hud-time').innerText = "00:00";
        document.getElementById('hud-dist').innerText = "0.00";
        document.getElementById('hud-speed').innerText = "0";
        document.getElementById('speed-limit').classList.add('hidden');

        if(this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            const now = Date.now();
            const diff = now - this.startTime;
            const minutes = Math.floor(diff / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            document.getElementById('hud-time').innerText = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    },

    update: function(pos) {
        const speedKm = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;
        document.getElementById('hud-speed').innerText = speedKm;

        const latLng = L.latLng(pos.coords.latitude, pos.coords.longitude);
        
        if (this.lastPos) {
            const d = this.lastPos.distanceTo(latLng);
            if (d > 5) {
                this.distance += d;
                this.lastPos = latLng;
                document.getElementById('hud-dist').innerText = (this.distance / 1000).toFixed(2);
                this.path.push({lat: pos.coords.latitude, lng: pos.coords.longitude});
            }
        } else {
            this.lastPos = latLng;
            this.path.push({lat: pos.coords.latitude, lng: pos.coords.longitude});
        }

        if (!this.lastSpeedCheck || Date.now() - this.lastSpeedCheck > 5000) {
            this.lastSpeedCheck = Date.now();
            this.checkSpeedLimit(pos.coords.latitude, pos.coords.longitude);
        }
    },

    checkSpeedLimit: function(lat, lng) {
        const query = `[out:json][timeout:5];way["maxspeed"](around:25,${lat},${lng});out tags;`;
        const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
        fetch(url).then(r=>r.json()).then(data => {
            const el = document.getElementById('speed-limit');
            if(data.elements && data.elements.length > 0) {
                let max = data.elements[0].tags.maxspeed;
                if(max && !isNaN(parseInt(max))) {
                    el.querySelector('span').innerText = max;
                    el.classList.remove('hidden');
                } else { el.classList.add('hidden'); }
            } else { el.classList.add('hidden'); }
        }).catch(e => {}); 
    },

    stop: function() {
        console.log("Drive Stopped");
        if(this.timerInterval) clearInterval(this.timerInterval);
        
        const durationMs = Date.now() - this.startTime;
        const avgSpeed = (durationMs > 0 && this.distance > 0) ? Math.round((this.distance/1000) / (durationMs/3600000)) : 0;
        
        const minutes = Math.floor(durationMs / 60000);
        const seconds = Math.floor((durationMs % 60000) / 1000);
        const timeStr = `${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;

        document.getElementById('sum-avg').innerText = avgSpeed;
        document.getElementById('sum-dist').innerText = (this.distance / 1000).toFixed(2);
        document.getElementById('sum-time').innerText = timeStr;

        document.getElementById('sum-comparison-row').classList.add('hidden');

        switchScreen('summary-screen');
        
        setTimeout(() => {
            const mapContainer = document.getElementById('summary-map');
            // FIX: Map Clean Reload für Drive
            if (window.summaryMapInstance) {
                window.summaryMapInstance.remove();
                window.summaryMapInstance = null;
            }

            if(mapContainer) {
                mapContainer.innerHTML = ""; 
                window.summaryMapInstance = L.map('summary-map', { zoomControl: false, attributionControl: false }).setView([51.1657, 10.4515], 13);
                L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(window.summaryMapInstance);
                
                if (this.path.length > 1) {
                    const latLngs = this.path.map(p => [p.lat, p.lng]);
                    const line = L.polyline(latLngs, {color: '#007aff', weight: 4}).addTo(window.summaryMapInstance);
                    window.summaryMapInstance.fitBounds(line.getBounds(), {padding:[40,40]});
                }
                window.summaryMapInstance.invalidateSize();
            }
        }, 300);

        document.getElementById('btn-save').onclick = () => {
            GarageLogic.save({ 
                date: Date.now(), 
                dist: (this.distance / 1000), 
                time: timeStr, 
                avg: avgSpeed, 
                path: this.path 
            });
            showGarage();
        };
        document.getElementById('btn-discard').onclick = () => {
            showHome();
        };
    }
};
