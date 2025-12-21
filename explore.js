window.ExploreLogic = {
    // --- STATE ---
    activeFilter: null, // 'gas', 'cam', 'parking'
    mapInstance: null,
    markers: [],
    
    // Gas Filter State
    gasType: 'e10', // default
    gasRadius: 10,
    gasBrand: 'all',

    init: function() {
        console.log("Explore Logic Init");
        // Bind Filter Chips manually if needed
        const btnGas = document.getElementById('filter-gas');
        if(btnGas) btnGas.onclick = () => this.toggleGasFilter();
        
        const btnCam = document.getElementById('filter-cam');
        if(btnCam) btnCam.onclick = () => this.toggleCams();
        
        const btnPark = document.getElementById('filter-parking');
        if(btnPark) btnPark.onclick = () => this.toggleParking();
    },

    // --- GAS FILTER MODAL ---
    toggleGasFilter: function() {
        const modal = document.getElementById('gas-filter-modal');
        if(!modal) return;
        
        if (modal.classList.contains('hidden')) {
            modal.classList.remove('hidden');
            modal.classList.add('active'); // For CSS transitions
            this.activeFilter = 'gas';
            // Highlight chip
            document.getElementById('filter-gas').classList.add('active');
            // Refresh results immediately
            this.updateGasResults();
        } else {
            this.closeFilter();
        }
    },

    closeFilter: function() {
        const modal = document.getElementById('gas-filter-modal');
        if(modal) {
            modal.classList.add('hidden');
            modal.classList.remove('active');
        }
        document.getElementById('filter-gas').classList.remove('active');
        this.activeFilter = null;
    },

    // --- FILTER SETTINGS ---
    setFuelFilter: function(type) {
        this.gasType = type;
        // Update Buttons UI
        ['e10','e5','diesel'].forEach(t => {
            const btn = document.getElementById('btn-type-'+t);
            if(btn) {
                if(t === type) btn.classList.add('active');
                else btn.classList.remove('active');
            }
        });
        this.updateGasResults();
    },

    updateRadiusDisplay: function(val) {
        this.gasRadius = val;
        const disp = document.getElementById('rad-disp');
        if(disp) disp.innerText = val;
        // Debounce actual search? For now just update on let go or every change
        this.updateGasResults(); 
    },

    setBrandFilter: function(brand, btnElement) {
        this.gasBrand = brand;
        // Reset all active classes in that row
        const parent = btnElement.parentNode;
        const btns = parent.getElementsByClassName('filter-btn');
        for(let btn of btns) btn.classList.remove('active');
        btnElement.classList.add('active');
        this.updateGasResults();
    },

    // --- RESULTS LOGIC (FAKE DATA) ---
    updateGasResults: function() {
        const list = document.getElementById('filter-results'); // ID CHECK: In HTML V121 it was filter-results (NOT gas-results-list)
        if(!list) return; // Silent fail if ID mismatch in HTML
        
        list.innerHTML = ''; // Clear

        // Mock Data Generator
        const brands = ['Aral', 'Shell', 'Esso', 'Total', 'Jet', 'Hem', 'Avanti'];
        const count = 5;

        for(let i=0; i<count; i++) {
            // Random filtering
            let brand = brands[Math.floor(Math.random() * brands.length)];
            if(this.gasBrand !== 'all' && this.gasBrand.toLowerCase() !== brand.toLowerCase()) continue;

            let price = (1.60 + Math.random() * 0.20).toFixed(2);
            let dist = (Math.random() * this.gasRadius).toFixed(1);
            
            // Create Item
            const item = document.createElement('div');
            item.className = 'filter-res-item';
            item.innerHTML = `
                <div class="fri-left">
                    <h4>${brand}</h4>
                    <p>${dist} km away</p>
                </div>
                <div class="fri-right">
                    <span class="fri-price">${price}</span>
                </div>
            `;
            // CLICK HANDLER -> TOTEM
            item.onclick = () => {
                this.openTotem(brand, price, dist);
            };
            list.appendChild(item);
        }
    },

    // --- TOTEM OVERLAY ---
    openTotem: function(brand, basePrice, dist) {
        const overlay = document.getElementById('gas-totem-overlay');
        if(!overlay) return;

        // Set Content
        const h2 = document.getElementById('totem-brand');
        if(h2) h2.innerText = brand;
        
        // Header Color Logic
        const header = document.getElementById('totem-brand-header');
        if(header) {
            header.className = 'totem-header'; // reset
            header.classList.add(brand.toLowerCase()); // e.g. .aral
        }

        // Set Prices (Fake variation)
        const pE10 = parseFloat(basePrice);
        const pE5 = pE10 + 0.06;
        const pDiesel = pE10 - 0.15;

        document.getElementById('price-e10').innerText = pE10.toFixed(2);
        document.getElementById('price-e5').innerText = pE5.toFixed(2);
        document.getElementById('price-diesel').innerText = pDiesel.toFixed(2);

        // Show
        overlay.classList.remove('hidden');
    },

    closeTotem: function() {
        const overlay = document.getElementById('gas-totem-overlay');
        if(overlay) overlay.classList.add('hidden');
    },

    selectFuel: function(type) {
        // Just visual selection in totem
        ['e10','e5','diesel'].forEach(t => {
            document.getElementById('row-'+t).classList.remove('selected');
        });
        document.getElementById('row-'+type).classList.add('selected');
    },

    // --- OTHER FILTERS ---
    toggleCams: function() {
        // Toggle Filter Chip Visual
        const btn = document.getElementById('filter-cam');
        btn.classList.toggle('active');
        // Logic to show/hide markers on map would go here
    },

    toggleParking: function() {
        const btn = document.getElementById('filter-parking');
        btn.classList.toggle('active');
    }
};

// Global Init Trigger
document.addEventListener('DOMContentLoaded', () => {
    if(window.ExploreLogic) window.ExploreLogic.init();
});
