let detailMapInstance = null;
let speedChartInstance = null; // Chart Instanz

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

        // Stats füllen
        document.getElementById('det-date').innerText = new Date(ride.date).toLocaleString();
        document.getElementById('det-dist').innerText = ride.dist.toFixed(2) + " km";
        document.getElementById('det-avg').innerText = ride.avg + " km/h";
        document.getElementById('det-time').innerText = ride.time;

        // --- 1. MAP (BUNTE SEGMENTE) ---
        if (!detailMapInstance) {
            detailMapInstance = L.map('detail-map', { zoomControl: false, attributionControl: false }).setView([0,0], 13);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(detailMapInstance);
        }
        
        // Alte Layer weg
        detailMapInstance.eachLayer(l => { if(!(l instanceof L.TileLayer)) l.remove(); });

        if (ride.path && ride.path.length > 0) {
            // Wir müssen checken, ob 'path' Objekte {lat,lng,speed} oder nur Arrays [lat,lng] sind (wegen alter Speicherungen)
            const isRichData = ride.path[0].lat !== undefined;

            if (isRichData) {
                // NEU: Bunte Segmente
                const latLngs = [];
                for(let i=0; i < ride.path.length - 1; i++) {
                    const p1 = ride.path[i];
                    const p2 = ride.path[i+1];
                    const segmentSpeed = (p1.speed + p2.speed) / 2;
                    
                    // Farbe berechnen
                    let color = '#00ff00'; // Grün (Langsam)
                    if (segmentSpeed > 30) color = '#ffff00'; // Gelb
                    if (segmentSpeed > 50) color = '#ff0000'; // Rot (Schnell)
                    if (segmentSpeed > 100) color = '#bf5af2'; // Lila (Raser)

                    L.polyline([[p1.lat, p1.lng], [p2.lat, p2.lng]], {color: color, weight: 4}).addTo(detailMapInstance);
                    latLngs.push([p1.lat, p1.lng]);
                }
                latLngs.push([ride.path[ride.path.length-1].lat, ride.path[ride.path.length-1].lng]); // Letzter Punkt
                
                if(latLngs.length > 0) detailMapInstance.fitBounds(L.polyline(latLngs).getBounds(), {padding:[30,30]});
            } else {
                // FALLBACK für alte Daten (nur Blaue Linie)
                const line = L.polyline(ride.path, {color: '#007aff', weight: 4}).addTo(detailMapInstance);
                detailMapInstance.fitBounds(line.getBounds(), {padding:[30,30]});
            }
        }
        setTimeout(() => detailMapInstance.invalidateSize(), 200);

        // --- 2. GRAPH (CHART.JS) ---
        const ctx = document.getElementById('speedChart').getContext('2d');
        if (speedChartInstance) speedChartInstance.destroy(); // Alten Chart löschen

        // Daten vorbereiten
        let labels = [];
        let dataPoints = [];
        
        if (ride.path && ride.path.length > 0 && ride.path[0].speed !== undefined) {
            ride.path.forEach((p, i) => {
                labels.push(i); // Einfach Index als X-Achse
                dataPoints.push(p.speed);
            });
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
                    tension: 0.4, // Weiche Kurve
                    pointRadius: 0, // Keine Punkte
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { display: false }, // Keine X-Achse
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
