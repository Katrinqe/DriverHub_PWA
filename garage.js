let detailMapInstance = null;
let speedChartInstance = null;

const GarageLogic = {
    render: function() {
        const list = document.getElementById('garage-list');
        list.innerHTML = '';
        const saved = JSON.parse(localStorage.getItem('driverhub_rides') || '[]');
        
        document.getElementById('total-drives').innerText = saved.length;
        let km = 0; saved.forEach(r => km += r.dist);
        document.getElementById('total-km').innerText = km.toFixed(1);

        if (saved.length === 0) { list.innerHTML = '<p style="text-align:center; color:#555; margin-top:50px;">No drives yet.</p>'; return; }

        saved.reverse().forEach((ride, index) => {
            const realIndex = saved.length - 1 - index;
            const div = document.createElement('div');
            div.className = 'drive-card';
            div.innerHTML = `
                <div class="dc-info" onclick="GarageLogic.showDetails(${realIndex})">
                    <h4>${new Date(ride.date).toLocaleDateString()}</h4>
                    <p>${ride.time} &bull; ${ride.avg} km/h Ø</p>
                </div>
                <div class="dc-right">
                    <span class="dc-km">${ride.dist.toFixed(2)} km</span>
                    <button class="btn-delete-drive" onclick="GarageLogic.deleteDrive(${realIndex}, event)"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            list.appendChild(div);
        });
    },

    save: function(data) {
        try {
            const saved = JSON.parse(localStorage.getItem('driverhub_rides') || '[]');
            saved.push(data);
            localStorage.setItem('driverhub_rides', JSON.stringify(saved));
            return true;
        } catch (e) { alert("Error saving"); return false; }
    },

    deleteDrive: function(index, event) {
        if(event) event.stopPropagation();
        if(!confirm("Delete drive?")) return;
        const saved = JSON.parse(localStorage.getItem('driverhub_rides') || '[]');
        saved.splice(index, 1);
        localStorage.setItem('driverhub_rides', JSON.stringify(saved));
        this.render();
    },

    showDetails: function(index) {
        const saved = JSON.parse(localStorage.getItem('driverhub_rides') || '[]');
        const ride = saved[index];
        if(!ride) return;

        const overlay = document.getElementById('detail-overlay');
        overlay.classList.remove('hidden');

        // 1. MAX SPEED BERECHNEN
        let maxSpeed = 0;
        if(ride.path && ride.path.length > 0) {
            ride.path.forEach(p => {
                let s = p.speed !== undefined ? p.speed : 0;
                if(s > maxSpeed) maxSpeed = s;
            });
        }

        // Stats füllen
        document.getElementById('det-date').innerText = new Date(ride.date).toLocaleString();
        document.getElementById('det-dist').innerText = ride.dist.toFixed(2) + " km";
        document.getElementById('det-avg').innerText = ride.avg + " km/h";
        document.getElementById('det-max').innerText = maxSpeed + " km/h"; // NEU
        document.getElementById('det-time').innerText = ride.time;

        // --- MAP RENDERN ---
        if (!detailMapInstance) {
            detailMapInstance = L.map('detail-map', { zoomControl: false, attributionControl: false }).setView([0,0], 13);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(detailMapInstance);
        }
        
        // Layer leeren
        detailMapInstance.eachLayer(l => { if(!(l instanceof L.TileLayer)) l.remove(); });

        if (ride.path && ride.path.length > 0) {
            const isRichData = ride.path[0].lat !== undefined; // Check: Neue Datenstruktur?
            
            // Start & End Punkt
            const startPt = isRichData ? [ride.path[0].lat, ride.path[0].lng] : ride.path[0];
            const endPt = isRichData ? [ride.path[ride.path.length-1].lat, ride.path[ride.path.length-1].lng] : ride.path[ride.path.length-1];

            L.circleMarker(startPt, {radius: 6, color: '#32cd32', fillOpacity: 1, fillColor: '#32cd32'}).addTo(detailMapInstance);
            L.circleMarker(endPt, {radius: 6, color: '#ff3b30', fillOpacity: 1, fillColor: '#ff3b30'}).addTo(detailMapInstance);

            // Linie zeichnen
            if (isRichData) {
                // Bunte Segmente
                const latLngs = [];
                for(let i=0; i < ride.path.length - 1; i++) {
                    const p1 = ride.path[i];
                    const p2 = ride.path[i+1];
                    const segmentSpeed = (p1.speed + p2.speed) / 2;
                    
                    let color = '#00ff00';
                    if (segmentSpeed > 30) color = '#ffff00';
                    if (segmentSpeed > 50) color = '#ff0000';
                    if (segmentSpeed > 100) color = '#bf5af2';

                    L.polyline([[p1.lat, p1.lng], [p2.lat, p2.lng]], {color: color, weight: 4}).addTo(detailMapInstance);
                    latLngs.push([p1.lat, p1.lng]);
                }
                // Fallback: Wenn nur 1 Punkt, array trotzdem füllen für fitBounds
                if(latLngs.length === 0) latLngs.push([ride.path[0].lat, ride.path[0].lng]);
                else latLngs.push([ride.path[ride.path.length-1].lat, ride.path[ride.path.length-1].lng]);

                detailMapInstance.fitBounds(L.polyline(latLngs).getBounds(), {padding:[30,30]});
            } else {
                // Alte Daten (Blaue Linie)
                const line = L.polyline(ride.path, {color: '#007aff', weight: 4}).addTo(detailMapInstance);
                detailMapInstance.fitBounds(line.getBounds(), {padding:[30,30]});
            }
        } else {
            // Wenn keine Route da ist (0 Punkte) -> Zeige Berlin oder 0,0
            detailMapInstance.setView([51.16, 10.45], 6);
        }
        
        setTimeout(() => detailMapInstance.invalidateSize(), 200);

        // --- GRAPH ---
        const ctx = document.getElementById('speedChart').getContext('2d');
        if (speedChartInstance) speedChartInstance.destroy();

        let labels = [];
        let dataPoints = [];
        
        if (ride.path && ride.path.length > 0) {
            // Check ob Speed-Daten vorhanden sind
            const hasSpeed = ride.path[0].speed !== undefined;
            if(hasSpeed) {
                ride.path.forEach((p, i) => {
                    labels.push(i);
                    dataPoints.push(p.speed);
                });
            } else {
                // Keine Speed Daten (alte Fahrten)
                dataPoints = Array(ride.path.length).fill(0);
                labels = ride.path.map((_, i) => i);
            }
        }

        speedChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Speed (km/h)',
                    data: dataPoints,
                    borderColor: '#007aff',
                    backgroundColor: 'rgba(0, 122, 255, 0.1)',
                    borderWidth: 2,
                    tension: 0.4, 
                    pointRadius: 0, 
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
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { color: '#666' }
                    }
                }
            }
        });
    },

    closeDetails: function() {
        document.getElementById('detail-overlay').classList.add('hidden');
    }
};
