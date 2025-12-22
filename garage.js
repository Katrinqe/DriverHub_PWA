/* =========================================
   GARAGE LOGIC (VERSION 5.0 - DURATION & GRAPH FIX)
   ========================================= */

const GarageLogic = {
    detailMap: null, 

    // 1. LISTE RENDERN
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
            item.className = "drive-card"; 
            item.innerHTML = `
                <div class="dc-info">
                    <h4>${dateStr} • ${timeStr}</h4>
                    <p>Dauer: ${ride.time} min</p>
                </div>
                <div style="display:flex; align-items:center; gap:15px;">
                    <div class="dc-km">${ride.dist.toFixed(2)} km</div>
                    <button class="btn-delete-drive" data-index="${index}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;

            // Klick auf Karte -> Details
            item.onclick = (e) => {
                if(e.target.closest('.btn-delete-drive')) return;
                this.openDetailView(ride);
            };

            // Löschen
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
        
        const stats = document.querySelectorAll('.g-stat span');
        if(stats.length >= 2) {
            stats[0].innerText = rides.length;      
            stats[1].innerText = totalDist.toFixed(1); 
        }
    },

    // 2. DETAIL VIEW ÖFFNEN (JETZT MIT DAUER!)
    openDetailView: function(ride) {
        const overlay = document.getElementById('detail-overlay');
        if(!overlay) return;

        overlay.classList.remove('hidden'); 
        overlay.style.display = 'flex'; 

        // Header Text
        const d = new Date(ride.date);
        const headerTitle = overlay.querySelector('.detail-header h3');
        if(headerTitle) headerTitle.innerText = d.toLocaleDateString();

        // --- HIER IST DAS UPDATE: DAUER ANZEIGEN ---
        const statLabels = overlay.querySelectorAll('.d-stat-box .label');
        const statValues = overlay.querySelectorAll('.d-stat-box .val');
        
        if(statValues.length >= 3) {
            // Box 1: DAUER (statt Avg)
            if(statLabels[0]) statLabels[0].innerText = "DURATION";
            statValues[0].innerText = ride.time; // Zeigt z.B. "00:15"

            // Box 2: MAX SPEED
            if(statLabels[1]) statLabels[1].innerText = "MAX SPEED";
            statValues[1].innerText = ride.max + " km/h";

            // Box 3: DISTANCE
            if(statLabels[2]) statLabels[2].innerText = "DISTANCE";
            statValues[2].innerText = ride.dist.toFixed(2) + " km";
        }

        // Close Button
        const closeBtn = overlay.querySelector('.close-detail-btn');
        if(closeBtn) {
            closeBtn.onclick = () => {
                overlay.style.display = 'none';
                if(this.detailMap) { this.detailMap.remove(); this.detailMap = null; }
            };
        }

        // Map & Graph laden
        setTimeout(() => {
            this.initDetailMap(ride);
            this.drawChart(ride);
        }, 150); 
    },

    // 3. MAP FIX
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

    // 4. GRAPH ZEICHNEN
    drawChart: function(ride) {
        const container = document.querySelector('.chart-container');
        if(!container) return;
        
        container.innerHTML = "";
        
        // Wenn keine Speed Daten da sind (weil du nicht gelaufen bist)
        const speeds = ride.path ? ride.path.map(p => p.speed) : [];
        if (speeds.length < 2 || Math.max(...speeds) === 0) {
            container.innerHTML = `
                <div style="height:100%; display:flex; align-items:center; justify-content:center; flex-direction:column;">
                    <i class="fa-solid fa-chart-line" style="color:#333; font-size:2rem; margin-bottom:10px;"></i>
                    <p style="color:#555; font-size:0.8rem;">Keine Bewegung erkannt (Flatline)</p>
                </div>`;
            return;
        }

        // Daten reduzieren (Performance)
        let dataPoints = speeds;
        if(dataPoints.length > 100) {
            const step = Math.ceil(dataPoints.length / 100);
            dataPoints = dataPoints.filter((_, i) => i % step === 0);
        }

        const maxVal = Math.max(...dataPoints, 10); 
        const width = container.clientWidth || 300;
        const height = 150; 
        const padding = 5;

        let points = "";
        const stepX = (width - (padding*2)) / (dataPoints.length - 1);
        
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
