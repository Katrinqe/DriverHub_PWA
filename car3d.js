import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene, camera, renderer, carModel;
let isInitialized = false; 
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

function init3D() {
    const container = document.getElementById('hero-3d-stage');
    
    // Safety check: Warten bis Container existiert
    if (!container || container.clientWidth === 0) { 
        requestAnimationFrame(init3D); 
        return; 
    }

    if (isInitialized) return;
    isInitialized = true;

    // Canvas aufräumen
    while(container.firstChild) { container.removeChild(container.firstChild); }

    // 1. SCENE (Tiefschwarz)
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); 
    // Nebel: Damit der Tunnel hinten weich im Schwarz verschwindet
    scene.fog = new THREE.FogExp2(0x000000, 0.03);

    // 2. CAMERA (Responsive Logic)
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    
    // Start-Position (wird unten im Resize-Observer nochmal korrigiert)
    camera.position.set(0, 1.4, 7.0); 
    camera.lookAt(0, 0.5, 0);

    // 3. RENDERER
    renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5; 
    container.appendChild(renderer.domElement);

    // 4. LIGHTING (Auto Inszenierung)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.1); 
    scene.add(ambientLight);

    // Hauptlicht von oben (simuliert die Tunnel-Deckenleuchten)
    const topLight = new THREE.DirectionalLight(0xffffff, 2.0);
    topLight.position.set(0, 10, 2);
    scene.add(topLight);

    // Front Fill (damit die Front nicht schwarz absäuft)
    const frontLight = new THREE.DirectionalLight(0xffffff, 1.2);
    frontLight.position.set(0, 0.5, 10);
    scene.add(frontLight);

    // Rim Light (Kühles Blau von hinten für die Silhouette)
    const rimLight = new THREE.SpotLight(0x4488ff, 15.0);
    rimLight.position.set(0, 5, -5);
    rimLight.lookAt(0, 0, 0);
    scene.add(rimLight);

    // 5. TUNNEL ARCHITECTURE (Der "Screenshot Look" per Code)
    
    // A. Boden (Spiegelnd Schwarz)
    const floorGeo = new THREE.PlaneGeometry(40, 100);
    const floorMat = new THREE.MeshStandardMaterial({ 
        color: 0x050505, 
        roughness: 0.1, 
        metalness: 0.5
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    scene.add(floor);

    // B. Das Gitter (Tiles)
    // Erzeugt die grauen Linien auf dem Boden (wie im Screenshot)
    const grid = new THREE.GridHelper(60, 30, 0x333333, 0x111111);
    grid.position.y = 0.0;
    grid.material.transparent = true;
    grid.material.opacity = 0.2; 
    scene.add(grid);

    // C. Die Neon-Rahmen (Portale)
    // Wir bauen 15 Rahmen hintereinander
    const neonMat = new THREE.MeshBasicMaterial({ color: 0xffffff }); 
    
    const tunnelWidth = 4.0;  
    const tunnelHeight = 3.5; 
    const numFrames = 15;     
    const spacing = 3.0;      

    for (let i = 0; i < numFrames; i++) {
        // Wir fangen leicht HINTER der Kamera an (z=5) und gehen tief rein (z=-40)
        const z = 5 - (i * spacing); 

        // 1. Säule Links
        const pillarGeo = new THREE.BoxGeometry(0.1, tunnelHeight, 0.1);
        const leftPillar = new THREE.Mesh(pillarGeo, neonMat);
        leftPillar.position.set(-tunnelWidth, tunnelHeight / 2, z);
        scene.add(leftPillar);

        // 2. Säule Rechts
        const rightPillar = new THREE.Mesh(pillarGeo, neonMat);
        rightPillar.position.set(tunnelWidth, tunnelHeight / 2, z);
        scene.add(rightPillar);

        // 3. Deckenbalken
        const beamGeo = new THREE.BoxGeometry(tunnelWidth * 2, 0.1, 0.1);
        const topBeam = new THREE.Mesh(beamGeo, neonMat);
        topBeam.position.set(0, tunnelHeight, z);
        scene.add(topBeam);
    }

    // 6. INTERACTION (Nur Auto drehen)
    const onMouseDown = (e) => { isDragging = true; previousMousePosition = { x: e.offsetX, y: e.offsetY }; };
    const onMouseMove = (e) => {
        if(isDragging && carModel) {
            const deltaMove = { x: e.offsetX - previousMousePosition.x };
            carModel.rotation.y += deltaMove.x * 0.01; 
            previousMousePosition = { x: e.offsetX, y: e.offsetY };
        }
    };
    const onMouseUp = () => { isDragging = false; };

    const onTouchStart = (e) => { isDragging = true; previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
    const onTouchMove = (e) => {
        if(isDragging && carModel) {
            const deltaMove = { x: e.touches[0].clientX - previousMousePosition.x };
            carModel.rotation.y += deltaMove.x * 0.01;
            previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
    };
    const onTouchEnd = () => { isDragging = false; };

    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseup', onMouseUp);
    container.addEventListener('touchstart', onTouchStart, {passive: false});
    container.addEventListener('touchmove', onTouchMove, {passive: false});
    container.addEventListener('touchend', onTouchEnd);

    // 7. CAR LOAD
    const loader = new GLTFLoader();
    loader.load('car.glb', (gltf) => {
        carModel = gltf.scene;
        
        const box = new THREE.Box3().setFromObject(carModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        
        // Scale (3.8 ist ein guter Wert für diese Tunnelgröße)
        const scale = 3.8 / maxDim; 
        carModel.scale.set(scale, scale, scale);
        
        // Position
        carModel.position.x = -center.x * scale;
        carModel.position.y = -box.min.y * scale; // Exakt auf 0
        carModel.position.z = -center.z * scale;

        // Material Tuning
        carModel.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.envMapIntensity = 2.5; // Spiegelt den Tunnel!
                child.material.roughness = 0.2; 
                child.material.metalness = 0.7;
                child.material.needsUpdate = true;
            }
        });
        scene.add(carModel);
    });

    // Loop
    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }
    animate();

    // RESIZE & MOBILE CHECK
    const resizeObserver = new ResizeObserver(() => {
        if(container.clientWidth > 0 && container.clientHeight > 0) {
            const newAspect = container.clientWidth / container.clientHeight;
            camera.aspect = newAspect;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
            
            // INTELLIGENTER ZOOM:
            // Wenn Hochformat (Mobile) -> Kamera weiter weg (Z=11)
            // Wenn Querformat (Desktop) -> Kamera näher ran (Z=7)
            if(newAspect < 1.0) {
                camera.position.z = 11.0; 
            } else {
                camera.position.z = 7.0; 
            }
        }
    });
    resizeObserver.observe(container);
}

window.startGarage3D = init3D;
// Leere Funktionen für UI Calls, damit nichts abstürzt
window.hideGarage3D = function() {}; 
window.showGarage3D = function() {};

// Starte
setTimeout(init3D, 200);
