const DriverLogic = {

    interval: null,

    startTime: 0,

    startDist: 0,

    currentSpeed: 0,

    maxSpeed: 0, 

    path: [], 

    lastSpeedCheck: 0, // NEU: Damit wir nicht spammen



    start: function() {

        this.startTime = Date.now();

        this.startDist = 0;

        this.path = [];

        this.maxSpeed = 0; 

        this.lastSpeedCheck = 0;

        

        document.getElementById('hud-time').innerText = "00:00";

        document.getElementById('hud-dist').innerText = "0.00";

        document.getElementById('hud-speed').innerText = "0";

        document.getElementById('speed-limit').classList.add('hidden'); // Reset Schild



        if(this.interval) clearInterval(this.interval);

        this.interval = setInterval(() => {

            this.updateTime();

        }, 1000);

    },



    update: function(pos) {

        if (!this.startTime) return;

        

        const lat = pos.coords.latitude;

        const lng = pos.coords.longitude;

        const speed = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;

        this.currentSpeed = speed;



        if (speed > this.maxSpeed) {

            this.maxSpeed = speed;

        }



        this.path.push({

            lat: lat,

            lng: lng,

            speed: speed,

            time: Date.now()

        });



        if (this.path.length > 1) {

            const last = this.path[this.path.length - 2];

            const curr = this.path[this.path.length - 1];

            const p1 = L.latLng(last.lat, last.lng);

            const p2 = L.latLng(curr.lat, curr.lng);

            this.startDist += p1.distanceTo(p2) / 1000; 

        }



        document.getElementById('hud-speed').innerText = this.currentSpeed;

        document.getElementById('hud-dist').innerText = this.startDist.toFixed(2);

        

        // FIX: Nur alle 5 Sekunden abfragen

        if (Date.now() - this.lastSpeedCheck > 5000) {

            this.lastSpeedCheck = Date.now();

            this.checkSpeedLimit(lat, lng);

        }

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

        // FIX: Echte Abfrage wiederhergestellt

        const query = `[out:json][timeout:5];way["maxspeed"](around:25,${lat},${lng});out tags;`;

        const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

        

        fetch(url).then(r => r.json()).then(data => {

            const el = document.getElementById('speed-limit');

            if(data.elements && data.elements.length > 0) {

                let max = data.elements[0].tags.maxspeed;

                // Filtern von "none" oder komischen Werten

                if(max && !isNaN(parseInt(max))) {

                    el.querySelector('span').innerText = max;

                    el.classList.remove('hidden');

                } else { 

                    el.classList.add('hidden'); 

                }

            } else { 

                el.classList.add('hidden'); 

            }

        }).catch(e => { 

            console.log("Speed Limit Error", e);

            // Bei Fehler einfach ausblenden

            document.getElementById('speed-limit').classList.add('hidden');

        });

    },



    stop: function() {

        clearInterval(this.interval);

        const durationMs = Date.now() - this.startTime;

        const durationMin = Math.floor(durationMs / 60000);

        const durationSec = Math.floor((durationMs % 60000) / 1000);

        const timeStr = `${durationMin.toString().padStart(2,'0')}:${durationSec.toString().padStart(2,'0')}`;

        

        const avgSpeed = (durationMs > 0 && this.startDist > 0) ? Math.round(this.startDist / (durationMs/3600000)) : 0;



        NaviLogic.recordStats = {

            dist: this.startDist,

            startTime: this.startTime,

            path: this.path,

            maxSpeed: this.maxSpeed 

        };

        

        document.getElementById('sum-avg').innerText = avgSpeed;

        document.getElementById('sum-dist').innerText = this.startDist.toFixed(2);

        document.getElementById('sum-time').innerText = timeStr;

        document.getElementById('sum-comparison-row').classList.add('hidden'); 



        switchScreen('summary-screen');

        

        document.getElementById('global-nav').classList.add('hidden'); 

        

        const mapEl = document.getElementById('background-map');

        mapEl.classList.remove('map-smooth-rotate');

        mapEl.classList.add('map-locked'); 

        if(mapEl) mapEl.style.transform = `translate(-50%, -50%) rotate(0deg)`;



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



        document.getElementById('btn-save').onclick = () => {

            GarageLogic.save({ 

                date: Date.now(), 

                dist: this.startDist, 

                time: timeStr, 

                avg: avgSpeed, 

                max: this.maxSpeed, 

                path: this.path 

            });

            showGarage(); 

        };

        document.getElementById('btn-discard').onclick = showHome; 

    }

};
