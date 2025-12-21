const GarageLogic = {
    drives: [],
    carName: "MY CAR",

    init: function() {
        this.load();
    },

    load: function() {
        const storedDrives = localStorage.getItem('driverhub_drives');
        if (storedDrives) {
            try { this.drives = JSON.parse(storedDrives); } 
            catch(e) { this.drives = []; }
        }
        
        const storedName = localStorage.getItem('driverhub_car_name');
        if (storedName) {
            this.carName = storedName;
        }
    },

    saveToStorage: function() {
        localStorage.setItem('driverhub_drives', JSON.stringify(this.drives));
    },

    saveCarName: function(newName) {
        this.carName = newName;
        localStorage.setItem('driverhub_car_name', newName);
    },

    save: function(driveData) {
        this.drives.unshift(driveData);
        this.saveToStorage();
        this.render();
    },

    deleteDrive: function(index, e) {
        if(e) e.stopPropagation();
        if(confirm("Delete this drive?")) {
            this.drives.splice(index, 1);
            this.saveToStorage();
            this.render();
        }
    },

    generateRouteSVG: function(path) {
        if (!path || path.length < 2) return "";

        let minLat = 999, maxLat = -999, minLng = 999, maxLng = -999;
        path.forEach(p => {
            if(p.lat < minLat) minLat = p.lat;
            if(p.lat > maxLat) maxLat = p.lat;
            if(p.lng < minLng) minLng = p.lng;
            if(p.lng > maxLng) maxLng = p.lng;
        });

        const width = maxLng - minLng;
        const height = maxLat - minLat;
        if(width === 0 || height === 0) return "M0,50 L100,50";

        let d = "";
        path.forEach((p, i) => {
            const x = ((p.lng - minLng) / width) * 100;
            const y = 100 - ((p.lat - minLat) / height) * 100;
            if(i === 0) d += `M${x},${y}`;
            else d += ` L${x},${y}`;
        });
        
        return `<svg viewBox="-10 -10 120 120" class="mini-route-svg">
                    <path d="${d}" fill="none" stroke="#30d158" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" />
                    <circle cx="${((path[0].lng - minLng)/width)*100}" cy="${100-((path[0].lat-minLat)/height)*100}" r="8" fill="#fff" />
                    <circle cx="${((path[path.length-1].lng - minLng)/width)*100}" cy="${100-((path[path.length-1].lat-minLat)/height)*100}" r="8" fill="#bf5af2" />
                </svg>`;
    },

    render: function() {
        const list = document.getElementById('garage-content');
        list.innerHTML = '';
        
        let totalKm = 0;
        let topSpeedEver = 0;
        this.drives.forEach(d => {
            totalKm += d.dist || 0;
            if(d.max > topSpeedEver) topSpeedEver = d.max;
        });

        // --- SHOWROOM CONTAINER ---
        const showroom = document.createElement('div');
        showroom.className = 'showroom-container';

        // Name
        const nameBg = document.createElement('input');
        nameBg.type = 'text';
        nameBg.className = 'showroom-name-input';
        nameBg.value = this.carName;
        nameBg.oninput = (e) => { this.saveCarName(e.target.value); };
        showroom.appendChild(nameBg);

        // 3D Stage
        const carStage = document.createElement('div');
        carStage.id = 'hero-3d-stage';
        carStage.className = 'hero-3d-stage';
        showroom.appendChild(carStage);

        // Floating Stats
        const floatStats = document.createElement('div');
        floatStats.className = 'floating-stats';
        floatStats.innerHTML = `
            <div class="fs-item">
                <span class="fs-val">${topSpeedEver}</span>
                <span class="fs-label">MAX</span>
            </div>
            <div class="fs-line"></div>
            <div class="fs-item">
                <span class="fs-val">${totalKm.toFixed(0)}</span>
                <span class="fs-label">KM</span>
            </div>
            <div class="fs-line"></div>
            <div class="fs-item">
                <span class="fs-val">--</span>
                <span class="fs-label">0-100</span>
            </div>
        `;
        showroom.appendChild(floatStats);

        list.appendChild(showroom);

        // --- LOGBOOK ---
        const logbook = document.createElement('div');
        logbook.className = 'logbook-container';
        
        const title = document.createElement('div');
        title.className = 'logbook-title';
        title.innerText = 'DRIVE LOG';
        logbook.appendChild(title);

        this.drives.forEach((d, index) => {
            const entry = document.createElement('div');
            entry.className = 'logbook-entry';
            
            const dateObj = new Date(d.date);
            const dateStr = dateObj.toLocaleDateString(undefined, {day:'2-digit', month:'2-digit'});
            
            const miniMap = this.generateRouteSVG(d.path);
            const mapId = 'mini-map-' + index;

            entry.innerHTML = `
                <div class="lb-line">
                    <div class="lb-dot"></div>
                    <div class="lb-vertical"></div>
                </div>
                <div class="lb-content">
                    <div class="lb-card" onclick="GarageLogic.openDetails(null, ${index})">
                        <div class="lb-map-box" id="${mapId}">
                            ${miniMap}
                        </div>
                        <div class="lb-info">
                            <div class="lb-head">
                                <span class="lb-date">${dateStr}</span>
                                <span class="lb-speed">${d.max || 0} <small>km/h</small></span>
                            </div>
                            <div class="lb-sub">
                                <span>${d.dist.toFixed(1)} km</span>
                                <span>${d.time} min</span>
                            </div>
                        </div>
                        <button class="lb-delete" onclick="GarageLogic.deleteDrive(${index}, event)">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>
            `;
            
            entry.querySelector('.lb-card').onclick = () => { this.openDetails(d, index); };

            logbook.appendChild(entry);
        });

        list.appendChild(logbook);

        setTimeout(() => {
            if(window.startGarage3D) window.startGarage3D();
            this.initMiniMaps(); 
        }, 150);
    },

    initMiniMaps: function() {
        this.drives.forEach((d, index) => {
            const elId = 'mini-map-' + index;
            const el = document.getElementById(elId);
            if(!el) return;
            el.innerHTML = ""; 

            const m = L.map(elId, {
                zoomControl: false, attributionControl: false,
                dragging: false, touchZoom: false, doubleClickZoom: false, 
                scrollWheelZoom: false, boxZoom: false, keyboard: false
            });
            
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(m);

            if(d.path && d.path.length > 1) {
                const latLngs = d.path.map(p => [p.lat, p.lng]);
                const line = L.polyline(latLngs, {color: '#30d158', weight: 3}).addTo(m);
                m.fitBounds(line.getBounds(), {padding:[5,5]});
            } else {
                m.setView([51.1657, 10.4515], 10);
            }
        });
    },

    openDetails: function(drive, index) {
        if(window.hideGarage3D) window.hideGarage3D();
        document.getElementById('global-nav').classList.add('hidden'); 
        document.getElementById('detail-overlay').classList.remove('hidden');
        
        setTimeout(() => {
            const container = document.getElementById('detail-map');
            if(window.detailMapInstance) { window.detailMapInstance.remove(); window.detailMapInstance = null; }
            
            container.innerHTML = "";
            window.detailMapInstance = L.map('detail-map', { zoomControl: false, attributionControl: false });
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(window.detailMapInstance);

            if(drive.path && drive.path.length > 1) {
                const bounds = L.latLngBounds([]);
                for(let i=0; i < drive.path.length - 1; i++) {
                    const p1 = drive.path[i];
                    const p2 = drive.path[i+1];
                    const speed = p1.speed || 0;
                    
                    let color = '#ff3b30'; 
                    if(speed > 80) color = '#30d158'; 
                    else if(speed > 30) color = '#ffcc00'; 

                    L.polyline([[p1.lat, p1.lng], [p2.lat, p2.lng]], {
                        color: color, 
                        weight: 4, 
                        opacity: 0.9 
                    }).addTo(window.detailMapInstance);
                    bounds.extend([p1.lat, p1.lng]);
                }
                window.detailMapInstance.fitBounds(bounds, {padding:[30,30]});
            }
        }, 100);

        document.getElementById('t-max').innerText = (drive.max || 0);
        document.getElementById('t-avg').innerText = drive.avg;
        document.getElementById('t-dist').innerText = drive.dist.toFixed(1) + " km";
        document.getElementById('t-time').innerText = drive.time;

        this.renderChart(drive.path);
        
        const delBtn = document.getElementById('btn-detail-delete');
        delBtn.onclick = () => {
            if(confirm("Delete this drive?")) {
                this.drives.splice(index, 1);
                this.saveToStorage();
                this.render();
                this.closeDetails();
            }
        };
    },

    renderChart: function(path) {
        const ctx = document.getElementById('speedChart').getContext('2d');
        if (window.speedChartInstance) window.speedChartInstance.destroy();

        const dataPoints = [];
        const labels = [];
        if(path) {
            path.forEach((p, i) => {
                if (path.length < 200 || i % 5 === 0) {
                    dataPoints.push(p.speed || 0);
                    labels.push("");
                }
            });
        }

        window.speedChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    data: dataPoints,
                    borderColor: '#30d158',
                    backgroundColor: 'rgba(48, 209, 88, 0.15)',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { display: false },
                    y: { display: false, beginAtZero: true } 
                },
                animation: { duration: 0 } 
            }
        });
    },

    closeDetails: function() {
        document.getElementById('detail-overlay').classList.add('hidden');
        document.getElementById('global-nav').classList.remove('hidden');
        if(window.showGarage3D) window.showGarage3D();
    }
};
