/* =========================================
   GARAGE LOGIC (MATCHING HTML DETAIL IDs)
   ========================================= */

const GarageLogic = {
    detailMap: null, 

    // LISTE BAUEN
    renderList: function() {
        const listContainer = document.getElementById('garage-list');
        if (!listContainer) return;

        listContainer.innerHTML = "";
        const rides = JSON.parse(localStorage.getItem('driverhub_rides')) || [];
        
        this.updateHeaderStats(rides);

        if (rides.length === 0) {
            listContainer.innerHTML = `<div style="text-align:center; padding:50px; color:#555;">Keine Fahrten gespeichert.</div>`;
            return;
        }

        rides.forEach((ride, index) => {
            const dateObj = new Date(ride.date);
            const dateStr = dateObj.toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit'});
            const timeStr = dateObj.toLocaleTimeString('de-DE', {hour: '2-digit', minute:'2-digit'});

            const item = document.createElement('div');
            item.className = "drive-card"; // Dein Style aus CSS
            item.innerHTML = `
                <div class="dc-info">
                    <h4>${dateStr} • ${timeStr}</h4>
                    <p>Dauer: ${ride.time} min</p>
                </div>
                <div style="display:flex; align-items:center; gap:15px;">
                    <div class="dc-km">${ride.dist.toFixed(1)} km</div>
                    <button class="btn-delete-drive" data-index="${index}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;

            // Klick Event
            item.onclick = (e) => {
                if(e.target.closest('.btn-delete-drive')) return;
                this.openDetailView(ride);
            };

            // Delete Event
            item.querySelector('.btn-delete-drive').onclick = (e) => {
                e.stopPropagation();
                this.deleteRide(index);
            };

            listContainer.appendChild(item);
        });
    },

    updateHeaderStats: function(rides) {
        let totalDist = 0;
        rides.forEach(r => totalDist += r.dist);
        
        // IDs aus HTML: total-drives, total-km
        if(document.getElementById('total-drives')) document.getElementById('total-drives').innerText = rides.length;
        if(document.getElementById('total-km')) document.getElementById('total-km').innerText = totalDist.toFixed(1);
    },

    // DETAILS ÖFFNEN
    openDetailView: function(ride) {
        const overlay = document.getElementById('detail-overlay');
        if(!overlay) return;

        overlay.classList.remove('hidden'); 
        overlay.style.display = 'flex'; 

        // Datum ID aus HTML: det-date
        const d = new Date(ride.date);
        if(document.getElementById('det-date')) {
            document.getElementById('det-date').innerText = d.toLocaleDateString() + " " + d.toLocaleTimeString();
        }

        // Stats IDs aus HTML: det-dist, det-avg, det-max, det-time
        if(document.getElementById('det-dist')) document.getElementById('det-dist').innerText = ride.dist.toFixed(2) + " km";
        if(document.getElementById('det-avg')) document.getElementById('det-avg').innerText = ride.avg + " km/h";
        if(document.getElementById('det-max')) document.getElementById('det-max').innerText = ride.max + " km/h";
        if(document.getElementById('det-time')) document.getElementById('det-time').innerText = ride.time;

        // Map & Chart initialisieren
        setTimeout(() => {
            this.initDetailMap(ride);
            this.drawChart(ride);
        }, 150); 
    },

    closeDetails: function() {
        const overlay = document.getElementById('detail-overlay');
        if(overlay) overlay.classList.add('hidden');
        if(this.detailMap) { this.detailMap.remove(); this.detailMap = null; }
    },

    initDetailMap: function(ride) {
        const mapContainer = document.getElementById('detail-map');
        if(!mapContainer) return;
        mapContainer.innerHTML = ""; 

        if (this.detailMap) { this.detailMap.remove(); this.detailMap = null; }

        this.detailMap = L.map('detail-map', { 
            zoomControl: false, attributionControl: false, dragging: true 
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(this.detailMap);
        this.detailMap.invalidateSize();

        if (ride.path && ride.path.length > 0) {
            const latLngs = ride.path.map(p => [p.lat, p.lng]);
            const polyline = L.polyline(latLngs, { color: '#bf5af2', weight: 4 }).addTo(this.detailMap);
            this.detailMap.fitBounds(polyline.getBounds(), {padding: [30,30]});
        } else {
            this.detailMap.setView([51.16, 10.45], 6);
        }
    },

    drawChart: function(ride) {
        // Wir nutzen hier direkt den Container, um das SVG reinzubauen.
        // Die HTML hat zwar ein Canvas, aber das SVG ist robuster ohne Chart.js Config.
        const container = document.querySelector('.chart-container');
        if(!container) return;
        
        container.innerHTML = ""; // Canvas rauswerfen, SVG rein
        
        const speeds = ride.path ? ride.path.map(p => p.speed) : [];
        // Wenn nur Nullen da sind (Stillstand), zeige trotzdem einen Strich
        const maxVal = Math.max(...speeds, 10); 
        
        // Daten reduzieren bei langen Fahrten
        let dataPoints = speeds;
        if(dataPoints.length > 100) {
            const step = Math.ceil(dataPoints.length / 100);
            dataPoints = dataPoints.filter((_, i) => i % step === 0);
        }

        const width = container.clientWidth || 300;
        const height = 150; 
        const padding = 5;

        let points = "";
        const stepX = (width - (padding*2)) / (Math.max(dataPoints.length - 1, 1));
        
        dataPoints.forEach((val, i) => {
            const x = padding + (i * stepX);
            const y = height - padding - ((val / maxVal) * (height - (padding*2)));
            points += `${x},${y} `;
        });

        const svgHTML = `
        <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
            <defs>
                <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stop-color="#bf5af2" stop-opacity="0.4"/>
                    <stop offset="100%" stop-color="#bf5af2" stop-opacity="0"/>
                </linearGradient>
            </defs>
            <polygon points="${padding},${height} ${points} ${width-padding},${height}" fill="url(#chartGradient)" />
            <polyline points="${points}" fill="none" stroke="#bf5af2" stroke-width="2" vector-effect="non-scaling-stroke"/>
        </svg>`;

        container.style.position = 'relative'; 
        container.innerHTML = svgHTML;
    },

    save: function(data) {
        let rides = JSON.parse(localStorage.getItem('driverhub_rides')) || [];
        rides.unshift(data);
        localStorage.setItem('driverhub_rides', JSON.stringify(rides));
        this.renderList();
    },

    deleteRide: function(index) {
        if(confirm("Fahrt löschen?")) {
            let rides = JSON.parse(localStorage.getItem('driverhub_rides')) || [];
            rides.splice(index, 1);
            localStorage.setItem('driverhub_rides', JSON.stringify(rides));
            this.renderList();
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    GarageLogic.renderList();
});
