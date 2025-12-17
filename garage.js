let detailMapInstance = null;
let speedChartInstance = null;
let scrubMarker = null;

const GarageLogic = {
    render: function() {
        const list = document.getElementById('garage-list');
        list.innerHTML = '';
        // Fehler abfangen, falls localStorage leer oder kaputt ist
        let saved = [];
        try {
            saved = JSON.parse(localStorage.getItem('driverhub_rides') || '[]');
        } catch (e) {
            console.error("Savegame defekt", e);
            saved = [];
        }
        
        document.getElementById('total-drives').innerText = saved.length;
        let km = 0; saved.forEach(r => km += (r.dist || 0));
        document.getElementById('total-km').innerText = km.toFixed(1);

        if (saved.length === 0) { 
            list.innerHTML = '<p style="text-align:center; color:#555; margin-top:50px;">No drives yet.</p>'; 
            return; 
        }

        saved.reverse().forEach((ride, index) => {
            const realIndex = saved.length - 1 - index;
            const distDisplay = ride.dist ? ride.dist.toFixed(2) : "0.00";
            const avgDisplay = ride.avg ? ride.avg : "0";
            
            const div = document.createElement('div');
            div.className = 'drive-card';
            div.innerHTML = `
                <div class="dc-info" onclick="GarageLogic.showDetails(${realIndex})">
                    <h4>${new Date(ride.date).toLocaleDateString()}</h4>
                    <p>${ride.time} &bull; ${avgDisplay} km/h Ø</p>
                </div>
                <div class="dc-right">
                    <span class="dc-km">${distDisplay} km</span>
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

        // Stats sicher berechnen
        let maxSpeed = 0;
        if(ride.path && ride.path.length > 0) {
            ride.path.forEach(p => { if((p.speed||0) > maxSpeed) maxSpeed = p.speed; });
        }

        document.getElementById('det-date').innerText = new Date(ride.date).toLocaleString();
        document.getElementById('det-dist').innerText = (ride.dist ? ride.dist.toFixed(2) : "0.00") + " km";
        document.getElementById('det-avg').innerText = (ride.avg || 0) + " km/h";
        document.getElementById('det-max').innerText = maxSpeed + " km/h";
        document.getElementById('det-time').innerText = ride.time || "00:00";

        // --- MAP SETUP ---
        if (!detailMapInstance) {
            detailMapInstance = L.map('detail-map', { zoomControl: false, attributionControl: false }).setView([51.1657, 10.4515], 6);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(detailMapInstance);
        }
        
        // Alte Layer entfernen
        detailMapInstance.eachLayer(l => { if(!(l instanceof L.TileLayer)) l.remove(); });
        scrubMarker = null;

        // --- SAFE RENDER LOGIC (DER AFRICA FIX) ---
        if (ride.path && ride.path.length > 0) {
            // Checken ob Datenformat passt (alt vs neu)
            const isRichData = ride.path[0].lat !== undefined;
            
            // Startpunkt holen
            const startPoint = isRichData ? [ride.path[0].lat, ride.path[0].lng] : ride.path[0];
            
            // Szenario A: Wir haben nur EINEN Punkt (Starten -> Warten -> Stoppen)
            if (ride.path.length === 1) {
                L.circleMarker(startPoint, {radius: 6, color: '#32cd32', fillOpacity: 1, fillColor: '#32cd32'}).addTo(detailMapInstance);
                // WICHTIG: Kein fitBounds auf einen Punkt, sondern setView!
                detailMapInstance.setView(startPoint, 16);
            } 
            // Szenario B: Wir haben eine echte Route (>1 Punkt)
            else {
                const endPoint = isRichData ? [ride.path[ride.path.length-1].lat, ride.path[ride.path.length-1].lng] : ride.path[ride.path.length-1];

                L.circleMarker(startPoint, {radius: 6, color: '#32cd32', fillOpacity: 1, fillColor: '#32cd32'}).addTo(detailMapInstance);
                L.circleMarker(endPoint, {radius: 6, color: '#ff3b30', fillOpacity: 1, fillColor: '#ff3b30'}).addTo(detailMapInstance);

                const latLngs = [];
                if (isRichData) {
                    // Bunte Linie zeichnen
                    for(let i=0; i < ride.path.length - 1; i++) {
                        const p1 = ride.path[i];
                        const p2 = ride.path[i+1];
                        const s = ((p1.speed||0) + (p2.speed||0)) / 2;
                        let c = '#00ff00';
                        if (s > 30) c = '#ffff00';
                        if (s > 50) c = '#ff3b30'; 
                        if (s > 100) c = '#bf5af2'; 
                        
                        L.polyline([[p1.lat, p1.lng], [p2.lat, p2.lng]], {color: c, weight: 4}).addTo(detailMapInstance);
                        latLngs.push([p1.lat, p1.lng]);
                    }
                    latLngs.push([ride.path[ride.path.length-1].lat, ride.path[ride.path.length-1].lng]);
                } else {
                    // Fallback für ganz alte Daten
                    const line = L.polyline(ride.path, {color: '#007aff', weight: 4}).addTo(detailMapInstance);
                    latLngs.push(...ride.path);
                }

                // Karte auf die Linie zentrieren
                if(latLngs.length > 0) {
                    detailMapInstance.fitBounds(L.polyline(latLngs).getBounds(), {padding:[30,30]});
                }
                
                // Scrub Marker vorbereiten
                scrubMarker = L.circleMarker(startPoint, {
                    radius: 8, color: '#fff', weight: 3, fillOpacity: 0.5, fillColor: '#fff'
                });
            }
        } else {
            // Szenario C: Gar keine Punkte (Sofort Start/Stop gedrückt)
            // Wir bleiben einfach beim Deutschland-Zoom oder wo die Karte zuletzt war.
            // Oder wir versuchen User Position zu holen falls möglich (aber hier schwierig da async)
        }
        
        setTimeout(() => detailMapInstance.invalidateSize(), 200);

        // --- CHART SETUP ---
        const ctx = document.getElementById('speedChart').getContext('2d');
        if (speedChartInstance) speedChartInstance.destroy();

        // Wenn keine Punkte da sind, leeren Chart anzeigen
        if (!ride.path || ride.path.length === 0) {
            speedChartInstance = new Chart(ctx, { type: 'line', data: { labels:[], datasets:[] } });
            return;
        }

        let labels = [];
        let dataPoints = [];
        
        const hasTime = ride.path[0].time !== undefined;
        const startTime = hasTime ? ride.path[0].time : 0;

        ride.path.forEach((p, i) => {
            if (hasTime) {
                const diff = p.time - startTime;
                const m = Math.floor(diff / 60000);
                const s = Math.floor((diff % 60000) / 1000);
                labels.push(`${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`);
            } else {
                labels.push(i); 
            }
            dataPoints.push(p.speed || 0);
        });

        speedChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Speed',
                    data: dataPoints,
                    borderWidth: 2,
                    pointRadius: 0, 
                    pointHoverRadius: 6, 
                    fill: true,
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    segment: {
                        borderColor: ctx => {
                            const v = ctx.p0.parsed.y;
                            if (v < 30) return '#32cd32'; 
                            if (v < 60) return '#ffff00'; 
                            if (v < 100) return '#ff3b30'; 
                            return '#bf5af2'; 
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
                        display: true, 
                        ticks: { maxTicksLimit: 6, color: '#666', font: { size: 10 } },
                        grid: { display: false }
                    },
                    y: { display: false, beginAtZero: true }
                },
                onHover: (e, elements) => {
                    if (!elements || elements.length === 0 || !scrubMarker) return;
                    // Nur bewegen wenn wir mehr als 1 Punkt haben
                    if (ride.path.length > 1) {
                        const idx = elements[0].index; 
                        const point = ride.path[idx]; 
                        if (point && point.lat) {
                            const latLng = [point.lat, point.lng];
                            if (!detailMapInstance.hasLayer(scrubMarker)) {
                                scrubMarker.addTo(detailMapInstance);
                            }
                            scrubMarker.setLatLng(latLng);
                        }
                    }
                }
            }
        });
    },

    closeDetails: function() {
        document.getElementById('detail-overlay').classList.add('hidden');
    }
};
