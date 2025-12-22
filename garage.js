/* =========================================
   GARAGE LOGIC (VERSION 4.0 - MAP FIX & CHART)
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
            listContainer.innerHTML = `<div style="text-align:center; padding:50px; color:#555;">Garage is empty.</div>`;
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
                    <p>${ride.time} min • Max ${ride.max} km/h</p>
                </div>
                <div style="display:flex; align-items:center; gap:15px;">
                    <div class="dc-km">${ride.dist.toFixed(1)} km</div>
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
            stats[0].innerText = rides.length;      // Anzahl
            stats[1].innerText = totalDist.toFixed(0); // KM
        }
    },

    // 2. DETAIL VIEW ÖFFNEN
    openDetailView: function(ride) {
        const overlay = document.getElementById('detail-overlay');
        if(!overlay) return;

        // Overlay anzeigen
        overlay.classList.remove('hidden'); 
        overlay.style.display = 'flex'; // Sicherstellen

        // Header Text
        const d = new Date(ride.date);
        const headerTitle = overlay.querySelector('.detail-header h3');
        if(headerTitle) headerTitle.innerText = d.toLocaleDateString() + " - " + d.toLocaleTimeString();

        // Stats Boxen füllen
        const statValues = overlay.querySelectorAll('.d-stat-box .val');
        if(statValues.length >= 3) {
            statValues[0].innerText = ride.avg + " km/h";
            statValues[1].innerText = ride.max + " km/h";
            statValues[2].innerText = ride.dist.toFixed(1) + " km";
        }

        // Close Button
        const closeBtn = overlay.querySelector('.close-detail-btn');
        if(closeBtn) {
            closeBtn.onclick = () => {
                overlay.style.display = 'none';
                if(this.detailMap) { this.detailMap.remove(); this.detailMap = null; }
            };
        }

        // WICHTIG: Kurze Verzögerung für Map & Graph, damit das Overlay erst offen ist (Layout-Fix)
        setTimeout(() => {
            this.initDetailMap(ride);
            this.drawChart(ride);
        }, 100); 
    },

    // 3. MAP FIX (Graue Felder beheben)
    initDetailMap: function(ride) {
        const mapContainer = document.getElementById('detail-map');
        if(!mapContainer) return;
        
        mapContainer.innerHTML = ""; // Reset HTML

        if (this.detailMap) {
            this.detailMap.remove();
            this.detailMap = null;
        }

        // Karte erstellen
        this.detailMap = L.map('detail-map', { 
            zoomControl: false, 
            attributionControl: false,
            dragging: true 
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(this.detailMap);

        // Map Größe neu berechnen (WICHTIG GEGEN GRAUE FLÄCHEN)
        this.detailMap.invalidateSize();

        if (ride.path && ride.path.length > 0) {
            const latLngs = ride.path.map(p => [p.lat, p.lng]);
            const polyline = L.polyline(latLngs, { color: '#bf5af2', weight: 4 }).addTo(this.detailMap);
            
            // Zoom auf die Strecke
            this.detailMap.fitBounds(polyline.getBounds(), {padding: [30,30]});
        } else {
            // Fallback wenn keine Route da ist
            this.detailMap.setView([51.16, 10.45], 6);
        }
    },

    // 4. GRAPH ZEICHNEN (SVG Generierung)
    drawChart: function(ride) {
        const container = document.querySelector('.chart-container');
        if(!container) return;
        
        // Reset
        container.innerHTML = "";
        
        if (!ride.path || ride.path.length < 2) {
            container.innerHTML = "<p style='text-align:center; color:#555; font-size:0.8rem; padding-top:20px;'>No data for chart</p>";
            return;
        }

        // Daten vorbereiten
        // Wir nehmen nur jeden n-ten Punkt, wenn es zu viele sind (Performance)
        let dataPoints = ride.path;
        if(dataPoints.length > 100) {
            const step = Math.ceil(dataPoints.length / 100);
            dataPoints = dataPoints.filter((_, i) => i % step === 0);
        }

        const speeds = dataPoints.map(p => p.speed);
        const maxVal = Math.max(...speeds, 10); // Mindestens 10kmh Skala
        
        // SVG Größe
        const width = container.clientWidth || 300;
        const height = 150; // Fest, passend zum CSS Container
        const padding = 5;

        // Punkte berechnen
        let points = "";
        const stepX = (width - (padding*2)) / (speeds.length - 1);
        
        speeds.forEach((val, i) => {
            const x = padding + (i * stepX);
            // Y muss umgedreht werden (0 ist oben im SVG)
            const y = height - padding - ((val / maxVal) * (height - (padding*2)));
            points += `${x},${y} `;
        });

        // SVG Bauen
        // Gradient Fill
        const svgHTML = `
        <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
            <defs>
                <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stop-color="#007aff" stop-opacity="0.4"/>
                    <stop offset="100%" stop-color="#007aff" stop-opacity="0"/>
                </linearGradient>
            </defs>
            <polygon points="${padding},${height} ${points} ${width-padding},${height}" fill="url(#chartGradient)" />
            <polyline points="${points}" fill="none" stroke="#007aff" stroke-width="2" vector-effect="non-scaling-stroke"/>
        </svg>
        <div style="position:absolute; top:5px; left:10px; font-size:0.6rem; color:#666;">Speed (km/h)</div>
        `;

        container.style.position = 'relative'; // Damit Label passt
        container.innerHTML = svgHTML;
    },

    save: function(data) {
        let rides = JSON.parse(localStorage.getItem('driverhub_rides')) || [];
        rides.unshift(data);
        localStorage.setItem('driverhub_rides', JSON.stringify(rides));
        this.renderList();
    },

    deleteRide: function(index) {
        if(confirm("Delete?")) {
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
