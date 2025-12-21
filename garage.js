const GarageLogic = {
    detailMap: null,
    speedChart: null,

    init: function() {
        console.log("Garage Logic Initialized");
        this.loadList();
        this.updateGlobalStats();
    },
    

    // 1. LISTE LADEN & ANZEIGEN
    loadList: function() {
        const listContainer = document.getElementById('history-list');
        if (!listContainer) return;

        listContainer.innerHTML = ''; // Leeren

        // Daten aus Speicher holen
        let drives = [];
        try {
            drives = JSON.parse(localStorage.getItem('driverhub_drives') || "[]");
        } catch (e) {
            console.error("Corrupt Data", e);
            drives = [];
        }

        if (drives.length === 0) {
            listContainer.innerHTML = '<div style="text-align:center; color:#555; margin-top:30px;">NO DRIVES YET</div>';
            return;
        }

        // Karten für jede Fahrt erstellen
        drives.forEach(drive => {
            const card = document.createElement('div');
            card.className = 'ride-card-v3';
            
            // Formatierung
            const dist = (drive.dist || 0).toFixed(1);
            const max = Math.round(drive.max || 0);
            
            card.innerHTML = `
                <div class="rc3-info" onclick="GarageLogic.openDetail(${drive.id})">
                    <div class="rc3-left">
                        <h4>${drive.date}</h4>
                        <p>${drive.timestamp || ''}</p>
                    </div>
                    <div class="rc3-right">
                        <div class="rc3-stat">
                            <span>${dist}</span>
                            <small>KM</small>
                        </div>
                        <div class="rc3-stat">
                            <span>${max}</span>
                            <small>KM/H</small>
                        </div>
                    </div>
                </div>
                <button class="btn-list-delete" onclick="GarageLogic.deleteDrive(${drive.id}, event)">
                    <i class="fa-solid fa-trash"></i>
                </button>
            `;
            listContainer.appendChild(card);
        });

        this.updateGlobalStats(drives);
    },

    // 2. GLOBALE STATS BERECHNEN (Für den Garage Screen)
    updateGlobalStats: function(drives) {
        if (!drives) {
            try { drives = JSON.parse(localStorage.getItem('driverhub_drives') || "[]"); } catch(e) {}
        }

        let totalDist = 0;
        let globalMax = 0;

        drives.forEach(d => {
            totalDist += (d.dist || 0);
            if (d.max > globalMax) globalMax = d.max;
        });

        // Werte in die HTML Stats Boxen schreiben
        const elMax = document.getElementById('stat-max-speed');
        const elTotal = document.getElementById('stat-total-km');
        
        if (elMax) elMax.innerText = Math.round(globalMax);
        if (elTotal) elTotal.innerText = totalDist.toFixed(0);
    },

    // 3. HISTORY TOGGLE (Overlay öffnen/schließen)
    toggleHistory: function() {
        const overlay = document.getElementById('history-overlay');
        const list = document.getElementById('history-list');
        
        if (overlay.classList.contains('active')) {
            overlay.classList.remove('active');
        } else {
            // Liste vor dem Öffnen aktualisieren
            this.loadList();
            overlay.classList.add('active');
        }
    },

    // 4. DETAIL ANSICHT ÖFFNEN
    openDetail: function(id) {
        let drives = JSON.parse(localStorage.getItem('driverhub_drives') || "[]");
        const drive = drives.find(d => d.id === id);
        
        if (!drive) return;

        // Overlay öffnen
        document.getElementById('detail-overlay').classList.remove('hidden');

        // Texte setzen
        document.getElementById('det-date').innerText = drive.date + ' - ' + (drive.timestamp || '');
        document.getElementById('det-dist').innerText = (drive.dist || 0).toFixed(2) + ' km';
        document.getElementById('det-max').innerText = (drive.max || 0) + ' km/h';
        document.getElementById('det-avg').innerText = (drive.avg || 0) + ' km/h';
        document.getElementById('det-time').innerText = drive.duration || '00:00';

        // Delete Button ID setzen
        const btnDel = document.getElementById('btn-detail-delete');
        if(btnDel) {
            btnDel.onclick = () => {
                this.deleteDrive(id);
                this.closeDetails();
            };
        }

        // MAP RENDERN
        setTimeout(() => {
            if (!this.detailMap) {
                this.detailMap = L.map('detail-map', { zoomControl: false }).setView([51.16, 10.45], 6);
                L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(this.detailMap);
            }
            this.detailMap.invalidateSize();

            // Linie zeichnen
            // Alte Layer entfernen (simplifiziert)
            this.detailMap.eachLayer((layer) => {
                if (!!layer.toGeoJSON) {
                    this.detailMap.removeLayer(layer);
                }
            });
            // Tiles wieder hinzufügen (da sie oben entfernt wurden)
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(this.detailMap);

            if (drive.path && drive.path.length > 0) {
                const latLngs = drive.path.map(p => [p.lat, p.lng]);
                const poly = L.polyline(latLngs, { color: '#007aff', weight: 4 }).addTo(this.detailMap);
                this.detailMap.fitBounds(poly.getBounds(), { padding: [50, 50] });
            }
        }, 100);

        // CHART RENDERN
        this.renderChart(drive.path);
    },

    closeDetails: function() {
        document.getElementById('detail-overlay').classList.add('hidden');
    },

    deleteDrive: function(id, event) {
        if (event) event.stopPropagation(); // Damit sich Detail nicht öffnet
        
        if (!confirm("Delete this drive?")) return;

        let drives = JSON.parse(localStorage.getItem('driverhub_drives') || "[]");
        drives = drives.filter(d => d.id !== id);
        localStorage.setItem('driverhub_drives', JSON.stringify(drives));
        
        this.loadList(); // Refresh UI
    },

    renderChart: function(pathData) {
        const ctx = document.getElementById('speedChart');
        if (!ctx) return;

        if (this.speedChart) this.speedChart.destroy();

        if (!pathData || pathData.length === 0) return;

        // Daten reduzieren für Performance (jeder 5. Punkt)
        const speeds = pathData.filter((_, i) => i % 5 === 0).map(p => p.speed);
        const labels = speeds.map((_, i) => i);

        this.speedChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Speed',
                    data: speeds,
                    borderColor: '#007aff',
                    backgroundColor: 'rgba(0, 122, 255, 0.1)',
                    borderWidth: 2,
                    pointRadius: 0,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { display: false },
                    y: { 
                        grid: { color: '#333' },
                        ticks: { color: '#888' }
                    }
                }
            }
        });
    }
};

// Auto Init
document.addEventListener('DOMContentLoaded', () => {
    GarageLogic.init();
});
