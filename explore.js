// FIX: Dein echter API Key
const TANKERKOENIG_API_KEY = '448a2db3-bf39-415e-a763-8f889d8b31dd'; 

let exploreLayers = { gas: null, cam: null, parking: null };
let exploreState = { gas: false, cam: false, parking: false };

let cachedGasStations = []; 
let currentFuelType = 'e10'; 
let gasPressTimer = null;
let currentBrandFilter = 'all';
let currentRadiusFilter = 10;

const ExploreLogic = {
    moveTimeout: null,

    init: function() {
        console.log("Explore Init");
        if (typeof L === 'undefined') return;

        if (!exploreLayers.gas) exploreLayers.gas = L.layerGroup();
        if (!exploreLayers.cam) exploreLayers.cam = L.layerGroup();
        if (!exploreLayers.parking) exploreLayers.parking = L.layerGroup();

        this.setupGasButton();
        this.setupButton('filter-cam', 'cam');
        this.setupButton('filter-parking', 'parking');

        const btnRecenter = document.getElementById('btn-explore-recenter');
        if(btnRecenter) {
            btnRecenter.onclick = () => {
                if(map && userMarker) {
                    map.setView(userMarker.getLatLng(), 15, { animate: true, duration: 1.0 });
                }
            };
        }
    },

    setupButton: function(id, type) {
        const btn = document.getElementById(id);
        if (btn) {
            btn.onclick = () => {
                btn.classList.toggle('active');
                exploreState[type] = !exploreState[type];
                this.toggleLayer(type, exploreState[type]);
            };
        }
    },

    setupGasButton: function() {
        const btn = document.getElementById('filter-gas');
        if(!btn) return;

        const start = (e) => {
            if(e.type === 'touchstart') e.preventDefault();
            btn.classList.add('holding');
            gasPressTimer = setTimeout(() => {
                btn.classList.remove('holding');
                this.openFilter();
            }, 800); 
        };

        const end = () => {
            if (gasPressTimer) {
                clearTimeout(gasPressTimer);
                gasPressTimer = null;
                if(btn.classList.contains('holding')) {
                    btn.classList.remove('holding');
                    btn.classList.toggle('active');
                    exploreState.gas = !exploreState.gas;
                    this.toggleLayer('gas', exploreState.gas);
                }
            }
        };

        btn.addEventListener('mousedown', start);
        btn.addEventListener('touchstart', start);
        btn.addEventListener('mouseup', end);
        btn.addEventListener('mouseleave', end);
        btn.addEventListener('touchend', end);
    },

    resetAll: function() {
        exploreState.gas = false;
        exploreState.cam = false;
        exploreState.parking = false;
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        if(exploreLayers.gas) exploreLayers.gas.clearLayers();
        if(exploreLayers.cam) exploreLayers.cam.clearLayers();
        if(exploreLayers.parking) exploreLayers.parking.clearLayers();
        if(map) {
            if(map.hasLayer(exploreLayers.gas)) map.removeLayer(exploreLayers.gas);
            if(map.hasLayer(exploreLayers.cam)) map.removeLayer(exploreLayers.cam);
            if(map.hasLayer(exploreLayers.parking)) map.removeLayer(exploreLayers.parking);
        }
    },

    enter: function() {
        if(map) {
            map.dragging.enable();
            map.touchZoom.enable();
            map.doubleClickZoom.enable();
            map.scrollWheelZoom.enable();
            
            const mapEl = document.getElementById('background-map');
            if(mapEl) mapEl.style.transform = `translate(-50%, -50%) rotate(0deg)`;

            if(exploreState.gas) { exploreLayers.gas.addTo(map); this.fetchData('gas'); }
            if(exploreState.cam) { exploreLayers.cam.addTo(map); this.fetchData('cam'); }
            if(exploreState.parking) { exploreLayers.parking.addTo(map); this.fetchData('parking'); }

            map.on('moveend', this.onMapMove);
        }
    },

    leave: function() {
        if (this.moveTimeout) {
            clearTimeout(this.moveTimeout);
            this.moveTimeout = null;
        }

        if(map) {
            map.dragging.disable();
            map.touchZoom.disable();
            map.scrollWheelZoom.disable();

            if(exploreLayers.gas) exploreLayers.gas.remove();
            if(exploreLayers.cam) exploreLayers.cam.remove();
            if(exploreLayers.parking) exploreLayers.parking.remove();
            
            map.off('moveend', this.onMapMove);
        }
    },

    toggleLayer: function(type, isActive) {
        if (isActive) { 
            if(exploreLayers[type]) exploreLayers[type].addTo(map);
            this.fetchData(type); 
        } 
        else { 
            if(exploreLayers[type]) {
                exploreLayers[type].clearLayers();
                exploreLayers[type].remove();
            }
        }
    },

    onMapMove: function() {
        if (this.moveTimeout) clearTimeout(this.moveTimeout);
        this.moveTimeout = setTimeout(() => {
            if (exploreState.gas) ExploreLogic.fetchData('gas');
            if (exploreState.cam) ExploreLogic.fetchData('cam');
            if (exploreState.parking) ExploreLogic.fetchData('parking');
        }, 1500);
    },

   fetchData: function(type) {
        if (!map) return;
        const center = map.getCenter();
        let radius = 3000; 
        
        if (type === 'gas') {
            radius = currentRadiusFilter * 1000;
        } else {
            if (map.getZoom() < 12) radius = 15000; 
            else if (map.getZoom() > 14) radius = 5000; 
            else radius = 8000;
        }

        const loader = document.getElementById('map-loading');
        if(loader) loader.classList.add('visible');

        // ==========================================================
        // NEU: LIVE-PREISE DIREKT VON TANKERKÖNIG FÜR DIE GANZE MAP
        // ==========================================================
    if (type === 'gas') {
            let tkRadius = radius / 1000;
            if (tkRadius > 25) tkRadius = 25; 

            const tkUrl = `https://creativecommons.tankerkoenig.de/json/list.php?lat=${center.lat}&lng=${center.lng}&rad=${tkRadius}&sort=dist&type=all&apikey=${TANKERKOENIG_API_KEY}`;
            
            fetch(tkUrl)
                .then(r => r.json())
                .then(data => {
                    if(loader) loader.classList.remove('visible');
                    
                    // WENN TANKERKÖNIG SEINEN SEGEN GIBT:
                    if (data.ok && data.stations) {
                        cachedGasStations = data.stations.map(st => {
                            return {
                                lat: st.lat,
                                lon: st.lng,
                                center: { lat: st.lat, lon: st.lng },
                                tags: { name: (st.brand ? st.brand + " " : "") + st.name },
                                realData: st,
                            simPrices: {
    e10: (typeof st.e10 === 'number') ? (Math.floor(st.e10 * 100) / 100).toFixed(2) : "-.--",
    e5: (typeof st.e5 === 'number') ? (Math.floor(st.e5 * 100) / 100).toFixed(2) : "-.--",
    diesel: (typeof st.diesel === 'number') ? (Math.floor(st.diesel * 100) / 100).toFixed(2) : "-.--",
    isOpen: st.isOpen
},
                                _tempDist: st.dist
                            };
                        });
                        
                        this.redrawGasMarkers();
                        if(!document.getElementById('gas-filter-modal').classList.contains('hidden')) {
                            this.filterGasStations(); 
                        }
                    } 
                    // WENN TANKERKÖNIG UNS BLOCKIERT:
                    else {
                        console.error("Tankerkönig API Fehler:", data.message);
                        alert("Tankerkönig blockiert: " + (data.message || "Key ungültig oder zu viele Anfragen!"));
                    }
                }).catch(err => {
                    if(loader) loader.classList.remove('visible');
                    console.error("Tankerkönig Fetch Error:", err);
                });
                
            return; 
        }
        // ==========================================================


        // --- OVERPASS API FÜR BLITZER & PARKPLÄTZE BLEIBT WIE GEHABT ---
        let query = "";
        let endTag = "out center;"; 

        if (type === 'cam') query = `[out:json][timeout:25];node["highway"="speed_camera"](around:${radius},${center.lat},${center.lng});out;`;
        else if (type === 'parking') query = `[out:json][timeout:25];nwr["amenity"="parking"](around:${radius},${center.lat},${center.lng});${endTag}`;

        const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;

        fetch(url)
            .then(r => r.json())
            .then(data => {
                if(loader) loader.classList.remove('visible');
                
                if(exploreLayers[type]) exploreLayers[type].clearLayers();
                if (!data.elements) return;
                this.renderGenericMarkers(type, data.elements);
            })
            .catch(err => {
                if(loader) loader.classList.remove('visible');
                console.log("Overpass API Error:", err);
            });
    },

    redrawGasMarkers: function() {
        if(!exploreState.gas) return; 
        exploreLayers.gas.clearLayers();
        
        cachedGasStations.forEach(el => {
            let lat = el.lat; let lon = el.lon;
            if (el.center) { lat = el.center.lat; lon = el.center.lon; }
            if (!lat || !lon) return; 

            const name = (el.tags && el.tags.name) ? el.tags.name : "Tankstelle";
            const brandClass = this.getBrandClass(name);
            
            let displayName = name.replace(/Tankstelle|Station/gi, "").trim();
            if (displayName.length > 10) displayName = displayName.substring(0, 9) + "..";
            if (displayName === "") displayName = "TANK";

            if (!el.simPrices) {
                // Dummy-Werte als Platzhalter, falls noch nicht geklickt
                const baseE10 = 1.70 + (Math.random() * 0.14 - 0.07);
                el.simPrices = {
                    e10: baseE10.toFixed(2),
                    diesel: (1.60 + (Math.random() * 0.14 - 0.07)).toFixed(2),
                    e5: (baseE10 + 0.06).toFixed(2),
                    isOpen: true 
                };
            }

            if (el.realData) el.simPrices.isOpen = el.realData.isOpen;

            let displayPrice = el.simPrices[currentFuelType];
            const closedClass = (el.simPrices.isOpen === false) ? 'closed' : '';

            const html = `
                <div class="price-marker-wrap ${closedClass}">
                    <div class="pm-brand-bar ${brandClass}">${displayName}</div>
                    <div class="pm-content">
                        <div class="pm-price">${displayPrice}</div>
                        <div class="pm-fuel-label">${currentFuelType.toUpperCase()}</div>
                    </div>
                </div>
            `;

            const icon = L.divIcon({
                className: 'custom-div-icon',
                html: html,
                iconSize: [60, 45], 
                iconAnchor: [30, 45] 
            });

            const marker = L.marker([lat, lon], {icon: icon});
            marker.on('click', () => { this.openTotem(name, lat, lon, el); });
            exploreLayers.gas.addLayer(marker);
        });
    },

    renderGenericMarkers: function(type, elements) {
        if(!exploreState[type]) return; 
        elements.forEach(el => {
            let lat = el.lat; let lon = el.lon;
            if (el.center) { lat = el.center.lat; lon = el.center.lon; }
            if (!lat || !lon) return;

            let iconHtml = ''; let className = '';
            if (type === 'cam') { iconHtml = '<i class="fa-solid fa-camera"></i>'; className = 'icon-cam'; }
            else if (type === 'parking') { iconHtml = '<i class="fa-solid fa-square-parking"></i>'; className = 'icon-parking'; }

            const icon = L.divIcon({
                className: 'custom-div-icon', 
                html: `<div class="custom-map-icon ${className}">${iconHtml}</div>`,
                iconSize: [30, 30], iconAnchor: [15, 15]
            });

            const marker = L.marker([lat, lon], {icon: icon});
            if (el.tags && el.tags.name) marker.bindPopup(`<b>${el.tags.name}</b>`);
            exploreLayers[type].addLayer(marker);
        });
    },

    getBrandClass: function(name) {
        const n = name.toLowerCase();
        if(n.includes('aral')) return 'aral';
        if(n.includes('shell')) return 'shell';
        if(n.includes('esso')) return 'esso';
        if(n.includes('total')) return 'total';
        if(n.includes('jet')) return 'jet';
        if(n.includes('hem')) return 'hem';
        if(n.includes('avanti')) return 'avanti';
        return ''; 
    },

    openFilter: function() {
        document.getElementById('gas-filter-modal').classList.add('active'); 
        document.getElementById('gas-filter-modal').classList.remove('hidden');
        
        document.getElementById('btn-type-e10').classList.remove('active');
        document.getElementById('btn-type-e5').classList.remove('active');
        document.getElementById('btn-type-diesel').classList.remove('active');
        document.getElementById('btn-type-' + currentFuelType).classList.add('active');

        this.filterGasStations();
    },

    closeFilter: function() {
        document.getElementById('gas-filter-modal').classList.remove('active');
        setTimeout(() => document.getElementById('gas-filter-modal').classList.add('hidden'), 300);
    },

    updateRadiusDisplay: function(val) {
        document.getElementById('rad-disp').innerText = val;
        currentRadiusFilter = parseInt(val);
        this.fetchData('gas');
    },

    setBrandFilter: function(brand, btn) {
        currentBrandFilter = brand;
        document.querySelectorAll('.filter-grid .filter-btn').forEach(b => {
            if(!b.id) b.classList.remove('active'); 
        });
        btn.classList.add('active');
        this.filterGasStations();
    },

    setFuelFilter: function(type) {
        currentFuelType = type;
        document.getElementById('btn-type-e10').classList.remove('active');
        document.getElementById('btn-type-e5').classList.remove('active');
        document.getElementById('btn-type-diesel').classList.remove('active');
        document.getElementById('btn-type-' + type).classList.add('active');
        this.redrawGasMarkers(); 
        this.filterGasStations();
    },

    filterGasStations: function() {
        if(!map || !userMarker) return;
        const userLatLng = userMarker.getLatLng();
        const listContainer = document.getElementById('filter-results');
        listContainer.innerHTML = '';

        let results = cachedGasStations.filter(el => {
            let lat = el.lat; let lon = el.lon;
            if (el.center) { lat = el.center.lat; lon = el.center.lon; }
            if (!lat || !lon) return false;

            const stationLatLng = L.latLng(lat, lon);
            const distKm = userLatLng.distanceTo(stationLatLng) / 1000;
            el._tempDist = distKm;

            if (distKm > currentRadiusFilter) return false;

            if (currentBrandFilter !== 'all') {
                const name = (el.tags && el.tags.name) ? el.tags.name.toLowerCase() : "";
                if (!name.includes(currentBrandFilter)) return false;
            }
            return true;
        });

        results.sort((a, b) => {
            const priceA = parseFloat(a.simPrices[currentFuelType]);
            const priceB = parseFloat(b.simPrices[currentFuelType]);
            return priceA - priceB;
        });

        if (results.length === 0) {
            listContainer.innerHTML = '<div style="color:#666; text-align:center; padding:20px; font-size:0.8rem;">No stations found.</div>';
            return;
        }

        results.forEach(el => {
            const name = (el.tags && el.tags.name) ? el.tags.name : "Station";
            const price = el.simPrices[currentFuelType];
            const dist = el._tempDist.toFixed(1);
            let lat = el.lat; let lon = el.lon;
            if (el.center) { lat = el.center.lat; lon = el.center.lon; }

            const div = document.createElement('div');
            div.className = 'filter-res-item';
            div.innerHTML = `
                <div class="fri-left">
                    <h4>${name}</h4>
                    <p>${dist} km</p>
                </div>
                <div class="fri-price">${price}</div>
            `;
            
            div.onclick = () => {
                this.closeFilter();
                map.setView([lat, lon], 16, {animate: true});
                setTimeout(() => this.openTotem(name, lat, lon, el), 500);
            };

            listContainer.appendChild(div);
        });
    },

    openTotem: function(name, lat, lng, elementRef) {
        const overlay = document.getElementById('gas-totem-overlay');
        const brandHeader = document.getElementById('totem-brand-header');
        const brandTitle = document.getElementById('totem-brand');
        
        brandHeader.className = 'totem-header ' + this.getBrandClass(name);
        brandTitle.innerText = name;
        
        document.getElementById('totem-status').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> LOADING';
        overlay.classList.remove('hidden');

        if (TANKERKOENIG_API_KEY && TANKERKOENIG_API_KEY.length > 10) {
            // FIX: LIVE API CALL
            const url = `https://creativecommons.tankerkoenig.de/json/list.php?lat=${lat}&lng=${lng}&rad=1.0&sort=dist&type=all&apikey=${TANKERKOENIG_API_KEY}`;
            fetch(url).then(r => r.json()).then(data => {
                if (data.ok && data.stations && data.stations.length > 0) {
                    const station = data.stations[0];
                    if(elementRef) {
                        elementRef.realData = station; 
                        elementRef.simPrices.isOpen = station.isOpen; 
                     if(station.diesel) elementRef.simPrices.diesel = (Math.floor(station.diesel * 100) / 100).toFixed(2);
if(station.e10) elementRef.simPrices.e10 = (Math.floor(station.e10 * 100) / 100).toFixed(2);
if(station.e5) elementRef.simPrices.e5 = (Math.floor(station.e5 * 100) / 100).toFixed(2);
                    }
                    this.updateTotemUI(station.isOpen, station.diesel, station.e10, station.e5);
                    this.redrawGasMarkers(); 
                } else { 
                    // Fallback
                    this.updateTotemUI(true, elementRef.simPrices.diesel, elementRef.simPrices.e10, elementRef.simPrices.e5); 
                }
            }).catch(e => {
                console.log("Tankerkoenig Error", e);
                this.updateTotemUI(true, elementRef.simPrices.diesel, elementRef.simPrices.e10, elementRef.simPrices.e5);
            });
        } else {
            setTimeout(() => {
                this.updateTotemUI(true, elementRef.simPrices.diesel, elementRef.simPrices.e10, elementRef.simPrices.e5);
            }, 300);
        }
    },

   updateTotemUI: function(isOpen, diesel, e10, e5) {
        const statusEl = document.getElementById('totem-status');
        if (isOpen) {
            statusEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> OPEN';
            statusEl.style.color = '#30d158';
        } else {
            statusEl.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> CLOSED';
            statusEl.style.color = '#ff3b30';
        }
        
        // FIX: Auch im Detail-Fenster (Totem) gnadenlos abschneiden statt runden!
        document.getElementById('price-diesel').innerText = diesel ? (Math.floor(Number(diesel) * 100) / 100).toFixed(2) : "-.--";
        document.getElementById('price-e10').innerText = e10 ? (Math.floor(Number(e10) * 100) / 100).toFixed(2) : "-.--";
        document.getElementById('price-e5').innerText = e5 ? (Math.floor(Number(e5) * 100) / 100).toFixed(2) : "-.--";
        
        this.updateTotemSelectionUI();
    },

    selectFuel: function(type) {
        currentFuelType = type;
        this.updateTotemSelectionUI();
        this.redrawGasMarkers(); 
    },

    updateTotemSelectionUI: function() {
        document.querySelectorAll('.price-row').forEach(r => r.classList.remove('selected'));
        document.getElementById('row-' + currentFuelType).classList.add('selected');
    },

    closeTotem: function() {
        document.getElementById('gas-totem-overlay').classList.add('hidden');
    }
};
