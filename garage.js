const GarageLogic = {
    drives: [],
    carName: "My Car", // Default Name

    init: function() {
        this.load();
    },

    load: function() {
        // Fahrten laden
        const storedDrives = localStorage.getItem('driverhub_drives');
        if (storedDrives) {
            try { this.drives = JSON.parse(storedDrives); } 
            catch(e) { this.drives = []; }
        }
        
        // Auto Name laden
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

    deleteDrive: function(index) {
        if(confirm("Delete this drive?")) {
            this.drives.splice(index, 1);
            this.saveToStorage();
            this.render();
        }
    },

    // HELPER: Generiert einen SVG Pfad aus den GPS Daten für die Mini-Map
    generateRouteSVG: function(path) {
        if (!path || path.length < 2) return "";

        // Bounds finden
        let minLat = 999, maxLat = -999, minLng = 999, maxLng = -999;
        path.forEach(p => {
            if(p.lat < minLat) minLat = p.lat;
            if(p.lat > maxLat) maxLat = p.lat;
            if(p.lng < minLng) minLng = p.lng;
            if(p.lng > maxLng) maxLng = p.lng;
        });

        // Koordinaten auf 0-100 Box normalisieren
        const width = maxLng - minLng;
        const height = maxLat - minLat;
        // Schutz vor Division durch 0
        if(width === 0 || height === 0) return "M0,50 L100,50";

        let d = "";
        path.forEach((p, i) => {
            // Y muss invertiert werden für SVG
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
        
        // --- CALC STATS ---
        let totalKm = 0;
        let topSpeedEver = 0;
        this.drives.forEach(d => {
            totalKm += d.dist || 0;
            if(d.max > topSpeedEver) topSpeedEver = d.max;
        });

        // --- 1. HERO WINDOW (Das "gemeinsame Fenster") ---
        const hero = document.createElement('div');
        hero.className = 'garage-hero-card';
        
        // Input für Name
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'car-name-input';
        nameInput.value = this.carName;
        nameInput.oninput = (e) => { this.saveCarName(e.target.value); };
        
        // Stats Row
        const statsRow = document.createElement('div');
        statsRow.className = 'hero-stats-row';
        statsRow.innerHTML = `
            <div class="hs-item">
                <span class="hs-val">${totalKm.toFixed(1)}</span>
                <span class="hs-label">TOTAL KM</span>
            </div>
            <div class="hs-divider"></div>
            <div class="hs-item">
                <span class="hs-val">${topSpeedEver}</span>
                <span class="hs-label">TOP KM/H</span>
            </div>
        `;

        // 3D Container (Inside Hero)
        const carStage = document.createElement('div');
        carStage.id = 'car-canvas-container';
        carStage.className = 'hero-3d-stage';

        hero.appendChild(nameInput);
        hero.appendChild(statsRow);
        hero.appendChild(carStage);
        
        list.appendChild(hero);

        // --- 2. DRIVE LIST ---
        const title = document.createElement('div');
        title.className = 'ride-list-title';
        title.innerText = 'Drives Log';
        list.appendChild(title);

        this.drives.forEach((d, index) => {
            const card = document.createElement('div');
            card.className = 'ride-card-v2';
            
            const dateObj = new Date(d.date);
            const dateStr = dateObj.toLocaleDateString();
            const timeStr = dateObj.toLocaleTimeString().slice(0,5);
            
            // Mini Map SVG generieren
            const miniMap = this.generateRouteSVG(d.path);

            card.innerHTML = `
                <div class="rc2-map-preview">
                    ${miniMap}
                </div>
                <div class="rc2-details">
                    <div class="rc2-header">
                        <span class="rc2-date">${dateStr}</span>
                        <span class="rc2-time">${timeStr}</span>
                    </div>
                    <div class="rc2-stats-grid">
                        <div><i class="fa-solid fa-gauge-high"></i> ${d.max || 0} km/h</div>
                        <div><i class="fa-solid fa-route"></i> ${d.dist.toFixed(1)} km</div>
                        <div><i class="fa-solid fa-stopwatch"></i> ${d.time}</div>
                    </div>
                </div>
            `;
            
            card.onclick = () => { this.openDetails(d, index); };
            list.appendChild(card);
        });

        // 3D Starten (da Container jetzt existiert)
        setTimeout(() => {
            if(window.startGarage3D) window.startGarage3D();
        }, 100);
    },

    openDetails: function(drive, index) {
        document.getElementById('detail-overlay').classList.remove('hidden');
        
        // Map Logic wie gehabt ...
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
            } else {
                window.detailMapInstance.setView([51.1657, 10.4515], 6);
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
    }
};
