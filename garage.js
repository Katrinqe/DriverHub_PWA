const GarageLogic = {
    // ÄNDERUNG 1: Daten sofort beim Start aus dem Speicher laden
    drives: JSON.parse(localStorage.getItem('driverhub_drives')) || [],

    render: function() {
        const list = document.getElementById('garage-list');
        list.innerHTML = '';
        
        let totalKm = 0;
        this.drives.forEach((d, index) => {
            // ... (Hier bleibt alles gleich wie vorher, lass den render-Code so) ...
            // Falls du den render-Code nicht kopieren willst, sag Bescheid, 
            // aber du musst hier nichts ändern.
            
            // --- HIER NUR ZUR ORIENTIERUNG, NICHTS ÄNDERN ---
            totalKm += d.dist;
            const card = document.createElement('div');
            card.className = 'drive-card';
            
            const dateObj = new Date(d.date);
            const dateStr = dateObj.toLocaleDateString() + ", " + dateObj.toLocaleTimeString().slice(0,5);

            card.innerHTML = `
                <div class="dc-info">
                    <h4>${dateStr}</h4>
                    <p>${d.time} min | Avg: ${d.avg} km/h</p>
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <div class="dc-km">${d.dist.toFixed(2)} km</div>
                    <button class="btn-delete-drive" data-idx="${index}"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            
            card.onclick = (e) => {
                if(!e.target.closest('.btn-delete-drive')) this.openDetails(d);
            };
            
            // Delete Handler
            const delBtn = card.querySelector('.btn-delete-drive');
            delBtn.onclick = (e) => {
                e.stopPropagation();
                this.deleteDrive(index);
            };

            list.appendChild(card);
            // ------------------------------------------------
        });

        document.getElementById('total-drives').innerText = this.drives.length;
        document.getElementById('total-km').innerText = totalKm.toFixed(1);
    },

    save: function(driveData) {
        // driveData enthält { date, dist, time, avg, max, path }
        this.drives.unshift(driveData);
        
        // ÄNDERUNG 2: Sofort speichern
        this.saveToStorage();
        
        this.render();
    },

    deleteDrive: function(index) {
        if(confirm("Delete this drive?")) {
            this.drives.splice(index, 1);
            
            // ÄNDERUNG 3: Sofort speichern nach Löschen
            this.saveToStorage();
            
            this.render();
        }
    },
    
    // NEUE HILFSFUNKTION
    saveToStorage: function() {
        localStorage.setItem('driverhub_drives', JSON.stringify(this.drives));
    },


    openDetails: function(drive) {
        document.getElementById('detail-overlay').classList.remove('hidden');
        
        const dateObj = new Date(drive.date);
        document.getElementById('det-date').innerText = dateObj.toLocaleDateString() + ", " + dateObj.toLocaleTimeString();
        
        document.getElementById('det-dist').innerText = drive.dist.toFixed(2) + " km";
        document.getElementById('det-avg').innerText = drive.avg + " km/h";
        
        // FIX: Max Speed anzeigen (Fallback wenn nicht vorhanden)
        const maxSpd = drive.max || 0;
        document.getElementById('det-max').innerText = maxSpd + " km/h";
        
        document.getElementById('det-time').innerText = drive.time;

        // Map
        setTimeout(() => {
            const container = document.getElementById('detail-map');
            if(window.detailMapInstance) { window.detailMapInstance.remove(); window.detailMapInstance = null; }
            
            container.innerHTML = "";
            window.detailMapInstance = L.map('detail-map', { zoomControl: false, attributionControl: false });
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(window.detailMapInstance);

            if(drive.path && drive.path.length > 0) {
                const latLngs = drive.path.map(p => [p.lat, p.lng]);
                const line = L.polyline(latLngs, {color: '#30d158', weight: 4}).addTo(window.detailMapInstance);
                window.detailMapInstance.fitBounds(line.getBounds(), {padding:[20,20]});
            } else {
                window.detailMapInstance.setView([51.1657, 10.4515], 6);
            }
        }, 100);

        // CHART FIX
        this.renderChart(drive.path);
    },

    renderChart: function(path) {
        const ctx = document.getElementById('speedChart').getContext('2d');
        
        if (window.speedChartInstance) {
            window.speedChartInstance.destroy();
        }

        // Daten vorbereiten
        // Wir nehmen jeden n-ten Punkt, damit der Graph nicht überladen ist, falls Path sehr lang ist
        const dataPoints = [];
        const labels = [];
        
        if(path && path.length > 0) {
            path.forEach((p, i) => {
                // Nur jeden 5. Punkt nehmen wenn sehr viele Daten, sonst alle
                if (path.length < 100 || i % 5 === 0) {
                    dataPoints.push(p.speed || 0); // Speed nutzen
                    labels.push(""); // Leere Labels für sauberen Look
                }
            });
        }

        window.speedChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Speed (km/h)',
                    data: dataPoints,
                    borderColor: '#30d158',
                    backgroundColor: 'rgba(48, 209, 88, 0.1)',
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { display: false },
                    y: { 
                        beginAtZero: true,
                        grid: { color: '#333' },
                        ticks: { color: '#888' }
                    }
                }
            }
        });
    },

    closeDetails: function() {
        document.getElementById('detail-overlay').classList.add('hidden');
    }
};
