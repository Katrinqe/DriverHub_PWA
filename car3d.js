import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

let scene, camera, renderer, carModel, controls;
let isInitialized = false;

function init3D() {
    const container = document.getElementById('hero-3d-stage');
    
    // Warten bis Container da ist
    if (!container || container.clientWidth === 0) { 
        requestAnimationFrame(init3D); 
        return; 
    }

    if (isInitialized) return;
    isInitialized = true;

    // Aufräumen
    while(container.firstChild) { container.removeChild(container.firstChild); }

    // 1. SCENE
    scene = new THREE.Scene();
    // Transparent, damit der CSS-Gradient (blaue Aura) durchscheint!
    scene.background = null; 

    // 2. CAMERA
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    camera.position.set(3.5, 1.5, 3.5); // Schöner schräger Winkel am Start

    // 3. RENDERER
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); // Alpha true für Transparenz
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // 4. CONTROLS (Der "Drehteller")
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; // Weiches Nachlaufen
    controls.dampingFactor = 0.05;
    controls.enableZoom = false; // Kein Zoomen, feste Größe
    controls.enablePan = false;  // Kein Verschieben
    
    // LIMITS: Damit man nicht aufs Dach gucken kann
    // 90 Grad = Pi/2. Wir lassen nur ganz leichten Spielraum um die Horizontale.
    controls.minPolarAngle = Math.PI / 2 - 0.1; 
    controls.maxPolarAngle = Math.PI / 2 + 0.1; 
    
    controls.autoRotate = true; // Dreht sich leicht von selbst
    controls.autoRotateSpeed = 0.5;

    // 5. LIGHTING (Showroom Setup)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); 
    scene.add(ambientLight);

    // Hauptlicht von vorne-oben-rechts
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    keyLight.position.set(5, 10, 7);
    scene.add(keyLight);

    // Blaues Rim-Light von hinten (passend zur Aura)
    const rimLight = new THREE.SpotLight(0x007aff, 5.0);
    rimLight.position.set(-5, 2, -5);
    rimLight.lookAt(0, 0, 0);
    scene.add(rimLight);

    // 6. CAR LOAD
    const loader = new GLTFLoader();
    loader.load('car.glb', (gltf) => {
        carModel = gltf.scene;
        
        // Auto-Scale Logic
        const box = new THREE.Box3().setFromObject(carModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        // Skaliere das Auto so, dass es ca. 4 Einheiten breit ist
        const maxDim = Math.max(size.x, size.z);
        const scale = 4.0 / maxDim; 
        
        carModel.scale.set(scale, scale, scale);
        
        // Zentrieren (Boden auf 0)
        carModel.position.x = -center.x * scale;
        carModel.position.y = -box.min.y * scale; 
        carModel.position.z = -center.z * scale;

        // Material Boost für Glanz
        carModel.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.envMapIntensity = 1.5;
            }
        });

        scene.add(carModel);

    }, undefined, (e) => console.error(e));

    // Animation Loop
    function animate() {
        requestAnimationFrame(animate);
        controls.update(); // Wichtig für Damping & AutoRotate
        renderer.render(scene, camera);
    }
    animate();

    // Resize Handler
    const resizeObserver = new ResizeObserver(() => {
        if(container.clientWidth > 0 && container.clientHeight > 0) {
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        }
    });
    resizeObserver.observe(container);
}

// Logic für Namen speichern & Stats laden
window.GarageLogic = {
    init: function() {
        // Name laden
        const savedName = localStorage.getItem('my_ride_name');
        const input = document.getElementById('custom-car-name');
        if(savedName && input) input.value = savedName;
        
        // Input Listener
        if(input) {
            input.addEventListener('input', (e) => {
                localStorage.setItem('my_ride_name', e.target.value);
            });
        }

        // Stats berechnen (Fake oder aus echten Daten wenn vorhanden)
        this.updateStats();
        
        // 3D Starten
        init3D();
    },

    updateStats: function() {
        // Hier greifen wir auf die gespeicherten Fahrten zu (falls vorhanden)
        const storedDrives = localStorage.getItem('driverhub_drives');
        let drives = [];
        if(storedDrives) {
            try { drives = JSON.parse(storedDrives); } catch(e){}
        }

        let maxSpeed = 0;
        let totalDist = 0;

        drives.forEach(d => {
            if(d.max > maxSpeed) maxSpeed = d.max;
            totalDist += (d.dist || 0);
        });

        document.getElementById('stat-max-speed').innerText = Math.round(maxSpeed);
        document.getElementById('stat-total-km').innerText = totalDist.toFixed(0);
        // 0-100 bleibt erstmal Platzhalter, da schwer zu messen ohne GPS-Logik
    },

    toggleHistory: function() {
        alert("History Coming Soon"); // Platzhalter für jetzt
    }
};

// Start trigger
setTimeout(() => {
    if(window.GarageLogic) window.GarageLogic.init();
}, 500);
