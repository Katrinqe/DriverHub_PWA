const GarageLogic = {
    drives: [],

    init: function() {
        this.load();
    },

    load: function() {
        const stored = localStorage.getItem('driverhub_drives');
        if (stored) {
            try {
                this.drives = JSON.parse(stored);
            } catch(e) {
                console.error("Savegame corrupt", e);
                this.drives = [];
            }
        }
    },

    saveToStorage: function() {
        localStorage.setItem('driverhub_drives', JSON.stringify(this.drives));
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

    render: function() {
        const list = document.getElementById('garage-content');
        list.innerHTML = '';
        
        // --- 1. DASHBOARD (Bento Grid) ---
        let totalKm = 0;
        let topSpeedEver = 0;
        let totalMinutes = 0;

        this.drives.forEach(d => {
            totalKm += d.dist || 0;
            if(d.max > topSpeedEver) topSpeedEver = d.max;
            // Zeit parsen "MM:SS"
            let parts = d.time.split(':');
            if(parts.length === 2) {
                totalMinutes += parseInt(parts[0]) + (parseInt(parts[1])/60);
            }
        });

        const totalHours = Math.floor(totalMinutes / 60);
        
        const dashboard = document.createElement('div');
        dashboard.className = 'dashboard-grid';
        dashboard.innerHTML = `
            <div class="dash-card wide">
                <span class="dash-label">CAREER DISTANCE</span>
                <div><span class="dash-val">${totalKm.toFixed(1)}</span><span class="dash-unit">km</span></div>
            </div>
            <div class="dash-card">
                <span class="dash-label">TOP SPEED</span>
                <div><span class="dash-val">${topSpeedEver}</span><span class="dash-unit">km/h</span></div>
            </div>
            <div class="dash-card">
                <span class="dash-label">TIME ON ROAD</span>
                <div><span class="dash-val">${totalHours}</span><span class="dash-unit">h</span></div>
            </div>
        `;
        list.appendChild(dashboard);

        // --- 2. LISTEN (Cards) ---
        const title = document.createElement('div');
        title.className = 'ride-list-title';
        title.innerText = 'Recent Drives';
        list.appendChild(title);

        this.drives.forEach((d, index) => {
            const card = document.createElement('div');
            card.className = 'ride-card';
            
            const dateObj = new Date(d.date);
            const dateStr = dateObj.toLocaleDateString();
            const timeStr = dateObj.toLocaleTimeString().slice(0,5);
            
            // Icon Logik (Nacht/Tag)
            const hour = dateObj.getHours();
            let icon = (hour > 19 || hour < 6) ? 'fa-moon' : 'fa-sun';
            
            card.innerHTML = `
                <div class="rc-left">
                    <div class="rc-icon-box"><i class="fa-solid ${icon}"></i></div>
                    <div class="rc-info">
                        <div class="rc-title">${dateStr}</div>
                        <div class="rc-meta">${timeStr} • ${d.dist.toFixed(1)} km</div>
                    </div>
                </div>
                <div class="rc-right">
                    <span class="rc-score">${d.avg}</span>
                    <span class="rc-label">AVG KM/H</span>
                </div>
            `;
            
            card.onclick = () => { this.openDetails(d, index); };
            list.appendChild(card);
        });
    },

    openDetails: function(drive, index) {
        document.getElementById('detail-overlay').classList.remove('hidden');
        
        // --- A: KARTE MIT BUNTEM PFAD ---
        setTimeout(() => {
            const container = document.getElementById('detail-map');
            if(window.detailMapInstance) { window.detailMapInstance.remove(); window.detailMapInstance = null; }
            
            container.innerHTML = "";
            window.detailMapInstance = L.map('detail-map', { zoomControl: false, attributionControl: false });
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(window.detailMapInstance);

            if(drive.path && drive.path.length > 1) {
                const bounds = L.latLngBounds([]);
                
                // COLORED PATH LOOP
                for(let i=0; i < drive.path.length - 1; i++) {
                    const p1 = drive.path[i];
                    const p2 = drive.path[i+1];
                    const speed = p1.speed || 0;
                    
                    // Farbe berechnen
                    let color = '#ff3b30'; // Rot (langsam < 30)
                    if(speed > 80) color = '#30d158'; // Grün (schnell)
                    else if(speed > 30) color = '#ffcc00'; // Gelb (mittel)

                    const line = L.polyline([[p1.lat, p1.lng], [p2.lat, p2.lng]], {
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

        // --- B: TELEMETRIE DATEN ---
        document.getElementById('t-max').innerText = (drive.max || 0);
        document.getElementById('t-avg').innerText = drive.avg;
        document.getElementById('t-dist').innerText = drive.dist.toFixed(1) + " km";
        document.getElementById('t-time').innerText = drive.time;

        // --- C: CHART ---
        this.renderChart(drive.path);
        
        // Delete Button im Detail Screen
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
                // Downsampling für Performance
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
                    y: { display: false, beginAtZero: true } // Clean look
                },
                animation: { duration: 0 } // Performance
            }
        });
    },

    closeDetails: function() {
        document.getElementById('detail-overlay').classList.add('hidden');
    }
};
