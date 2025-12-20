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

    render: function() {
        const list = document.getElementById('garage-content');
        list.innerHTML = '';
        
        let totalKm = 0;
        let topSpeedEver = 0;
        this.drives.forEach(d => {
            totalKm += d.dist || 0;
            if(d.max > topSpeedEver) topSpeedEver = d.max;
        });

        // --- NAME INPUT (FREE FLOATING) ---
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'garage-name-input';
        nameInput.value = this.carName;
        nameInput.oninput = (e) => { this.saveCarName(e.target.value); };
        list.appendChild(nameInput);

        // --- SPACER FÜR 3D AUTO ---
        const spacer = document.createElement('div');
        spacer.className = 'garage-car-spacer';
        list.appendChild(spacer);

        // --- STATS ROW (FLAT) ---
        const statsRow = document.createElement('div');
        statsRow.className = 'stats-row-flat';
        statsRow.innerHTML = `
            <div class="stat-flat">
                <span class="val">${topSpeedEver}</span>
                <span class="label">TOP KM/H</span>
            </div>
            <div class="stat-flat">
                <span class="val">${totalKm.toFixed(1)}</span>
                <span class="label">TOTAL KM</span>
            </div>
            <div class="stat-flat">
                <span class="val">--</span>
                <span class="label">0-100</span>
            </div>
        `;
        list.appendChild(statsRow);

        // --- DRIVE LIST TITLE ---
        const title = document.createElement('div');
        title.className = 'ride-list-title';
        title.innerText = 'RECENT DRIVES';
        list.appendChild(title);

        // --- DRIVE LIST ITEMS ---
        this.drives.forEach((d, index) => {
            const card = document.createElement('div');
            card.className = 'ride-card-v3';
            
            const dateObj = new Date(d.date);
            const dateStr = dateObj.toLocaleDateString();
            const timeStr = dateObj.toLocaleTimeString().slice(0,5);
            
            // Container für echte Map
            const mapId = 'mini-map-' + index;

            card.innerHTML = `
                <div class="mini-map-container" id="${mapId}"></div>
                <div class="rc3-info">
                    <div class="rc3-left">
                        <h4>${dateStr}</h4>
                        <p>${timeStr}</p>
                    </div>
                    <div class="rc3-right">
                        <div class="rc3-stat">
                            <span>${d.max || 0}</span>
                            <small>KM/H</small>
                        </div>
                        <button class="btn-list-delete" onclick="GarageLogic.deleteDrive(${index}, event)">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
            
            card.onclick = () => { this.openDetails(d, index); };
            list.appendChild(card);
        });

        // 3D & Maps initialisieren
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
            
            // Check if map already exists (Leaflet property)
            if(el._leaflet_id) return; 

            const m = L.map(elId, {
                zoomControl: false, attributionControl: false,
                dragging: false, touchZoom: false, doubleClickZoom: false, 
                scrollWheelZoom: false, boxZoom: false, keyboard: false
            });
            
            // Dark Layer
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(m);

            if(d.path && d.path.length > 1) {
                const latLngs = d.path.map(p => [p.lat, p.lng]);
                const line = L.polyline(latLngs, {color: '#30d158', weight: 3}).addTo(m);
                m.fitBounds(line.getBounds(), {padding:[10,10]});
            } else {
                m.setView([51.1657, 10.4515], 10);
            }
        });
    },

    openDetails: function(drive, index) {
        if(window.hideGarage3D) window.hideGarage3D();
        document.getElementById('global-nav').classList.add('hidden'); // Nav weg!
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
        document.getElementById('global-nav').classList.remove('hidden'); // Nav wieder da
        if(window.showGarage3D) window.showGarage3D();
    }
};
