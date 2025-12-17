let detailMapInstance = null;
let speedChartInstance = null;
let scrubMarker = null; // Der Marker, der sich bewegt

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

        // Stats
        let maxSpeed = 0;
        if(ride.path && ride.path.length > 0) {
            ride.path.forEach(p => { if((p.speed||0) > maxSpeed) maxSpeed = p.speed; });
        }

        document.getElementById('det-date').innerText = new Date(ride.date).toLocaleString();
        document.getElementById('det-dist').innerText = ride.dist.toFixed(2) + " km";
        document.getElementById('det-avg').innerText = ride.avg + " km/h";
        document.getElementById('det-max').innerText = maxSpeed + " km/h";
        document.getElementById('det-time').innerText = ride.time;

        // --- MAP SETUP ---
        if (!detailMapInstance) {
            detailMapInstance = L.map('detail-map', { zoomControl: false, attributionControl: false }).setView([0,0], 13);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(detailMapInstance);
        }
        
        detailMapInstance.eachLayer(l => { if(!(l instanceof L.TileLayer)) l.remove(); });
        scrubMarker = null; // Reset

        if (ride.path && ride.path.length > 0) {
            const isRichData = ride.path[0].lat !== undefined;
            const startPt = isRichData ? [ride.path[0].lat, ride.path[0].lng] : ride.path[0];
            const endPt = isRichData ? [ride.path[ride.path.length-1].lat, ride.path[ride.path.length-1].lng] : ride.path[ride.path.length-1];

            L.circleMarker(startPt, {radius: 6, color: '#32cd32', fillOpacity: 1, fillColor: '#32cd32'}).addTo(detailMapInstance);
            L.circleMarker(endPt, {radius: 6, color: '#ff3b30', fillOpacity: 1, fillColor: '#ff3b30'}).addTo(detailMapInstance);

            const latLngs = [];
            if (isRichData) {
                // Bunte Segmente zeichnen
                for(let i=0; i < ride.path.length - 1; i++) {
                    const p1 = ride.path[i];
                    const p2 = ride.path[i+1];
                    const s = ((p1.speed||0) + (p2.speed||0)) / 2;
                    let c = '#00ff00';
                    if (s > 30) c = '#ffff00';
                    if (s > 50) c = '#ff3b30'; // Rot
                    if (s > 100) c = '#bf5af2'; // Lila
                    
                    L.polyline([[p1.lat, p1.lng], [p2.lat, p2.lng]], {color: c, weight: 4}).addTo(detailMapInstance);
                    latLngs.push([p1.lat, p1.lng]);
                }
                latLngs.push([ride.path[ride.path.length-1].lat, ride.path[ride.path.length-1].lng]);
            } else {
                const line = L.polyline(ride.path, {color: '#007aff', weight: 4}).addTo(detailMapInstance);
                detailMapInstance.fitBounds(line.getBounds(), {padding:[30,30]});
                return; // Alte Daten -> Kein Chart Scrubbing möglich
            }
            if(latLngs.length > 0) detailMapInstance.fitBounds(L.polyline(latLngs).getBounds(), {padding:[30,30]});
            
            // Marker für Scrubbing initialisieren (erstmal unsichtbar)
            scrubMarker = L.circleMarker(startPt, {
                radius: 8, color: '#fff', weight: 3, fillOpacity: 0.5, fillColor: '#fff'
            });
        }
        
        setTimeout(() => detailMapInstance.invalidateSize(), 200);

        // --- CHART SETUP ---
        const ctx = document.getElementById('speedChart').getContext('2d');
        if (speedChartInstance) speedChartInstance.destroy();

        let labels = [];
        let dataPoints = [];
        
        if (ride.path && ride.path.length > 0) {
            const hasTime = ride.path[0].time !== undefined;
            const startTime = hasTime ? ride.path[0].time : 0;

            ride.path.forEach((p, i) => {
                // X-Achse: Zeit formatieren (MM:SS)
                if (hasTime) {
                    const diff = p.time - startTime;
                    const m = Math.floor(diff / 60000);
                    const s = Math.floor((diff % 60000) / 1000);
                    labels.push(`${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`);
                } else {
                    labels.push(i); // Fallback alte Daten
                }
                dataPoints.push(p.speed || 0);
            });
        }

        speedChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Speed',
                    data: dataPoints,
                    borderWidth: 2,
                    pointRadius: 0, // Keine Punkte im Normalzustand
                    pointHoverRadius: 6, // Punkt beim Hovern
                    fill: true,
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    // HIER: Gradient Line Logic (Farbe ändert sich nach Wert)
                    segment: {
                        borderColor: ctx => {
                            const v = ctx.p0.parsed.y;
                            if (v < 30) return '#32cd32'; // Grün
                            if (v < 60) return '#ffff00'; // Gelb
                            if (v < 100) return '#ff3b30'; // Rot
                            return '#bf5af2'; // Lila
                        }
                    }
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        displayColors: false,
                        callbacks: {
                            label: (ctx) => `${ctx.parsed.y} km/h`
                        }
                    }
                },
                scales: {
                    x: { 
                        display: true, // Achse anzeigen
                        ticks: { 
                            maxTicksLimit: 6, // Nicht zu viele Labels
                            color: '#666',
                            font: { size: 10 }
                        },
                        grid: { display: false }
                    },
                    y: { 
                        display: false, // Y Achse stört nur
                        beginAtZero: true 
                    }
                },
                // --- INTERAKTION MIT MAP ---
                onHover: (e, elements) => {
                    if (!elements || elements.length === 0 || !scrubMarker) return;
                    
                    const idx = elements[0].index; // Welcher Punkt wurde berührt?
                    const point = ride.path[idx]; // Hole Koordinaten
                    
                    if (point && point.lat) {
                        const latLng = [point.lat, point.lng];
                        
                        // Marker auf Map hinzufügen (falls noch nicht da)
                        if (!detailMapInstance.hasLayer(scrubMarker)) {
                            scrubMarker.addTo(detailMapInstance);
                        }
                        // Marker bewegen
                        scrubMarker.setLatLng(latLng);
                    }
                }
            }
        });
    },

    closeDetails: function() {
        document.getElementById('detail-overlay').classList.add('hidden');
    }
};
