const GarageLogic = {
    render: function() {
        const list = document.getElementById('garage-list');
        list.innerHTML = '';
        
        const saved = JSON.parse(localStorage.getItem('driverhub_rides') || '[]');
        
        // Stats Update
        document.getElementById('total-drives').innerText = saved.length;
        let km = 0; saved.forEach(r => km += r.dist);
        document.getElementById('total-km').innerText = km.toFixed(1);
        
        if (saved.length === 0) {
            list.innerHTML = '<p style="text-align:center; color:#555; margin-top:50px;">No drives yet.</p>';
            return;
        }

        saved.reverse().forEach((ride, index) => {
            // Index muss umgedreht werden für das Löschen des korrekten Items im Original-Array
            const realIndex = saved.length - 1 - index; 

            const div = document.createElement('div');
            div.className = 'drive-card';
            div.innerHTML = `
                <div class="dc-info" onclick="GarageLogic.showDetails(${realIndex})">
                    <h4>${new Date(ride.date).toLocaleDateString()} &bull; ${new Date(ride.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</h4>
                    <p>${ride.time} Duration &bull; ${ride.avg} km/h Ø</p>
                </div>
                <div class="dc-right">
                    <span class="dc-km">${ride.dist.toFixed(2)} km</span>
                    <button class="btn-delete-drive" onclick="GarageLogic.deleteDrive(${realIndex})">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            `;
            list.appendChild(div);
        });
    },

    save: function(data) {
        const saved = JSON.parse(localStorage.getItem('driverhub_rides') || '[]');
        saved.push(data);
        localStorage.setItem('driverhub_rides', JSON.stringify(saved));
    },

    deleteDrive: function(index) {
        if(!confirm("Delete this drive?")) return;
        
        const saved = JSON.parse(localStorage.getItem('driverhub_rides') || '[]');
        saved.splice(index, 1);
        localStorage.setItem('driverhub_rides', JSON.stringify(saved));
        this.render(); // Neu laden
    },

    showDetails: function(index) {
        // HIER SPÄTER: Detail Screen öffnen mit Graphen
        // Für jetzt: Platzhalter
        const saved = JSON.parse(localStorage.getItem('driverhub_rides') || '[]');
        const r = saved[index];
        alert(`Details for Drive:\nDist: ${r.dist.toFixed(2)} km\nAvg Speed: ${r.avg} km/h\n(Graphs coming soon)`);
    }
};
