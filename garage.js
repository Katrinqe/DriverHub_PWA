// --- GARAGE.JS ---
const GarageLogic = {
    render: function() {
        const list = document.getElementById('garage-list');
        list.innerHTML = '<p style="text-align:center; color:#666; margin-top:50px;">Garage loading...</p>';
        
        // Stats laden (Mockup)
        const saved = JSON.parse(localStorage.getItem('driverhub_rides') || '[]');
        document.getElementById('total-drives').innerText = saved.length;
        
        let km = 0;
        saved.forEach(r => km += r.dist);
        document.getElementById('total-km').innerText = km.toFixed(1);
        
        list.innerHTML = '';
        saved.reverse().forEach((ride, index) => {
            const div = document.createElement('div');
            div.className = 'drive-item'; // Style aus deiner alten CSS oder wir fügen ihn hinzu
            div.style.padding = "15px";
            div.style.borderBottom = "1px solid #333";
            div.innerHTML = `
                <div>
                    <h4 style="margin:0; font-size:1rem;">Drive ${new Date(ride.date).toLocaleDateString()}</h4>
                    <span style="color:#666; font-size:0.8rem;">${ride.time} min</span>
                </div>
                <div style="text-align:right;">
                    <span style="color:#007aff; font-weight:700;">${ride.dist.toFixed(2)} km</span>
                </div>
            `;
            list.appendChild(div);
        });
    },

    save: function(data) {
        const saved = JSON.parse(localStorage.getItem('driverhub_rides') || '[]');
        saved.push(data);
        localStorage.setItem('driverhub_rides', JSON.stringify(saved));
    }
};
