let detailMapInstance = null; // Globale Var für die Mini Map

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
                    <button class="btn-delete-drive" onclick="GarageLogic.deleteDrive(${realIndex})"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            list.appendChild(div);
        });
    },

    deleteDrive: function(index) {
        if(!confirm("Delete?")) return;
        const saved = JSON.parse(localStorage.getItem('driverhub_rides') || '[]');
        saved.splice(index, 1);
        localStorage.setItem('driverhub_rides', JSON.stringify(saved));
        this.render();
    },

    showDetails: function(index) {
        const saved = JSON.parse(localStorage.getItem('driverhub_rides') || '[]');
        const ride = saved[index];
        
        document.getElementById('detail-overlay').classList.remove('hidden');
        document.getElementById('det-date').innerText = new Date(ride.date).toLocaleString();
        document.getElementById('det-dist').innerText = ride.dist.toFixed(2) + " km";
        document.getElementById('det-avg').innerText = ride.avg + " km/h";
        document.getElementById('det-time').innerText = ride.time;

        // MAP RENDERN
        if (!detailMapInstance) {
            detailMapInstance = L.map('detail-map', {zoomControl:false}).setView([0,0], 13);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(detailMapInstance);
        }
        
        // Linie zeichnen
        // Vorherige Layer löschen
        detailMapInstance.eachLayer((layer) => { if(layer instanceof L.Polyline && !(layer instanceof L.TileLayer)) { layer.remove(); } });

        if (ride.path && ride.path.length > 0) {
            const line = L.polyline(ride.path, {color: '#007aff', weight: 4}).addTo(detailMapInstance);
            detailMapInstance.fitBounds(line.getBounds(), {padding:[50,50]});
        }
        
        setTimeout(() => detailMapInstance.invalidateSize(), 200); // Fix für Render Bug
    },

    closeDetails: function() {
        document.getElementById('detail-overlay').classList.add('hidden');
    }
};
