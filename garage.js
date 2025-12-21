const GarageLogic = {
    drives: [],
    carName: "NISSAN GT", // Beispiel Name

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
        // Wenn History offen ist, neu rendern, sonst Garage Hero lassen
        if(document.getElementById('history-overlay').classList.contains('active')) {
            this.renderHistory();
        }
    },

    deleteDrive: function(index, e) {
        if(e) e.stopPropagation();
        if(confirm("Delete this drive?")) {
            this.drives.splice(index, 1);
            this.saveToStorage();
            this.renderHistory(); // Refresh List
        }
    },

    generateRouteSVG: function(path) {
        if (!path || path.length < 2) return "";
        // ... (SVG Code bleibt gleich wie V94)
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
            if(i === 0) d += `M${x},${y}`; else d += ` L${x},${y}`;
        });
        return `<svg viewBox="-10 -10 120 120" class="mini-route-svg"><path d="${d}" fill="none" stroke="#30d158" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" /><circle cx="${((path[0].lng - minLng)/width)*100}" cy="${100-((path[0].lat-minLat)/height)*100}" r="8" fill="#fff" /><circle cx="${((path[path.length-1].lng - minLng)/width)*100}" cy="${100-((path[path.length-1].lat-minLat)/height)*100}" r="8" fill="#bf5af2" /></svg>`;
    },

    // --- MAIN RENDER (HERO ONLY) ---
    render: function() {
        const list = document.getElementById('garage-content');
        list.innerHTML = '';
        
        let totalKm = 0;
        let topSpeedEver = 0;
        this.drives.forEach(d => {
            totalKm += d.dist || 0;
            if(d.max > topSpeedEver) topSpeedEver = d.max;
        });

        // 1. Studio Wrap
        const studioWrap = document.createElement('div');
        studioWrap.className = 'studio-stage-wrap';
        
        // 3D Container
        const carStage = document.createElement('div');
        carStage.id = 'hero-3d-stage';
        carStage.className = 'hero-3d-stage'; // CSS V95
        studioWrap.appendChild(carStage);
        
        // UI Overlay (Name, Stats, Button)
        const uiOverlay = document.createElement('div');
        uiOverlay.className = 'studio-ui-overlay';
        
        // Name Input
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'studio-car-name';
        nameInput.value = this.carName;
        nameInput.oninput = (e) => { this.saveCarName(e.target.value); };
        
        // Stats
        const statsBox = document.createElement('div');
        statsBox.className = 'studio-stats';
        statsBox.innerHTML = `
            <div class="ss-item"><span class="ss-val">${topSpeedEver}</span><span class="ss-label">MAX</span></div>
            <div class="ss-item"><span class="ss-val">${totalKm.toFixed(0)}</span><span class="ss-label">KM</span></div>
            <div class="ss-item"><span class="ss-val">--</span><span class="ss-label">0-100</span></div>
        `;

        // History Button
        const btnHist = document.createElement('div');
        btnHist.className = 'btn-view-history';
        btnHist.innerHTML = `VIEW DRIVE HISTORY <i class="fa-solid fa-chevron-up"></i>`;
        btnHist.onclick = () => { this.openHistory(); };

        uiOverlay.appendChild(nameInput);
        uiOverlay.appendChild(document.createElement('div')); // Spacer
        uiOverlay.appendChild(statsBox);
        uiOverlay.appendChild(btnHist);

        studioWrap.appendChild(uiOverlay);
        list.appendChild(studioWrap);

        // 3D Init
        setTimeout(() => {
            if(window.startGarage3D) window.startGarage3D();
        }, 150);
    },

    // --- HISTORY OVERLAY LOGIC ---
    openHistory: function() {
        this.renderHistory();
        document.getElementById('history-overlay').classList.add('active');
        // Hide Car to save performance? Optional.
    },

    closeHistory: function() {
        document.getElementById('history-overlay').classList.remove('active');
    },

    renderHistory: function() {
        const list = document.getElementById('history-list');
        list.innerHTML = '';

        this.drives.forEach((d, index) => {
            const card = document.createElement('div');
            card.className = 'ride-card-v3';
            
            const dateObj = new Date(d.date);
            const dateStr = dateObj.toLocaleDateString();
            const timeStr = dateObj.toLocaleTimeString().slice(0,5);
            const miniMap = this.generateRouteSVG(d.path);
            const mapId = 'hist-map-' + index;

            card.innerHTML = `
                <div class="mini-map-container" id="${mapId}">${miniMap}</div>
                <div class="rc3-info">
                    <div class="rc3-left"><h4>${dateStr}</h4><p>${timeStr}</p></div>
                    <div class="rc3-right">
                        <div class="rc3-stat"><span>${d.max || 0}</span><small>KM/H</small></div>
                        <button class="btn-list-delete" onclick="GarageLogic.deleteDrive(${index}, event)"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `;
            card.onclick = () => { 
                this.closeHistory(); // Overlay zu
                this.openDetails(d, index); // Details auf
            };
            list.appendChild(card);
        });
        
        // Maps init (Optional, SVG is faster)
        // this.initHistoryMaps(); 
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
                    const p1 = drive.path[i]; const p2 = drive.path[i+1];
                    let color = '#ff3b30'; 
                    if(p1.speed > 80) color = '#30d158'; else if(p1.speed > 30) color = '#ffcc00'; 
                    L.polyline([[p1.lat, p1.lng], [p2.lat, p2.lng]], {color: color, weight: 4}).addTo(window.detailMapInstance);
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
            if(confirm("Delete?")) {
                this.drives.splice(index, 1);
                this.saveToStorage();
                this.closeDetails();
                this.openHistory(); // Zurück zur Liste
            }
        };
    },

    renderChart: function(path) {
        const ctx = document.getElementById('speedChart').getContext('2d');
        if (window.speedChartInstance) window.speedChartInstance.destroy();
        const dataPoints = []; const labels = [];
        if(path) {
            path.forEach((p, i) => {
                if (path.length < 200 || i % 5 === 0) {
                    dataPoints.push(p.speed || 0); labels.push("");
                }
            });
        }
        window.speedChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    data: dataPoints, borderColor: '#30d158', backgroundColor: 'rgba(48, 209, 88, 0.15)', borderWidth: 2, pointRadius: 0, fill: true, tension: 0.3
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { display: false, beginAtZero: true } }, animation: { duration: 0 } }
        });
    },

    closeDetails: function() {
        document.getElementById('detail-overlay').classList.add('hidden');
        document.getElementById('global-nav').classList.remove('hidden');
        if(window.showGarage3D) window.showGarage3D();
    }
};
