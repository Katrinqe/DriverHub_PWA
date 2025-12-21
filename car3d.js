import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene, camera, renderer, carModel;
let isInitialized = false; 
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

function init3D() {
    const container = document.getElementById('hero-3d-stage');
    
    // Safety check
    if (!container || container.clientWidth === 0) { 
        requestAnimationFrame(init3D); 
        return; 
    }

    if (isInitialized) return;
    isInitialized = true;

    // Clean up
    while(container.firstChild) { container.removeChild(container.firstChild); }

    // 1. SCENE (Pitch Black)
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); 
    // Nebel: Schwarz, linear, damit der Tunnel hinten sanft verschwindet
    scene.fog = new THREE.Fog(0x000000, 10, 40);

    // 2. CAMERA
    const aspect = container.clientWidth / container.clientHeight;
    const isMobile = aspect < 1.0; 

    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    
    // Position: Zentral und weit genug weg für den Tunnel-Effekt
    // Mobile: Weiter weg (Z=11), Desktop (Z=8)
    const camZ = isMobile ? 11.0 : 8.0; 
    const camY = 1.3; // Augenhöhe
    
    camera.position.set(0, camY, camZ); 
    camera.lookAt(0, 0.6, 0); // Blick leicht über den Boden

    // 3. RENDERER
    renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // ToneMapping für "Neon"-Look (Helle Lichter, dunkle Schatten)
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2; 
    container.appendChild(renderer.domElement);

    // 4. LIGHTING
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.1); // Fast aus
    scene.add(ambientLight);

    // Top Light (Sonne von oben für Reflexionen auf Dach/Haube)
    const topLight = new THREE.DirectionalLight(0xffffff, 1.5);
    topLight.position.set(0, 10, 5);
    scene.add(topLight);

    // Front Fill (Damit man den Grill sieht)
    const frontLight = new THREE.DirectionalLight(0xffffff, 1.0);
    frontLight.position.set(0, 0.5, 10);
    scene.add(frontLight);

    // 5. TUNNEL ARCHITECTURE (Die "Rippen" aus Bild 1)
    
    // A. Boden (Spiegelnd Schwarz - Der wichtigste Teil!)
    const floorGeo = new THREE.PlaneGeometry(30, 100);
    const floorMat = new THREE.MeshStandardMaterial({ 
        color: 0x000000, 
        roughness: 0.05, // EXTREM glatt für Spiegelung
        metalness: 0.2
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    scene.add(floor);

    // B. Das Neon-Gitter (Architektur)
    // Wir bauen 20 Rahmen (Säule L + Säule R + Balken Oben)
    const neonMat = new THREE.MeshBasicMaterial({ color: 0xffffff }); // Weißes Licht
    
    const tunnelWidth = 4.5;  // Breite
    const tunnelHeight = 3.5; // Höhe
    const numFrames = 20;     // Anzahl der Rippen
    const spacing = 3.0;      // Abstand dazwischen

    for (let i = 0; i < numFrames; i++) {
        // Wir fangen bei Z=5 an (hinter der Kamera) und gehen bis Z=-55
        const z = 5 - (i * spacing); 

        // 1. Säule Links (Dünner Streifen)
        const pillarGeo = new THREE.BoxGeometry(0.05, tunnelHeight, 0.05);
        const leftPillar = new THREE.Mesh(pillarGeo, neonMat);
        leftPillar.position.set(-tunnelWidth, tunnelHeight / 2, z);
        scene.add(leftPillar);

        // 2. Säule Rechts
        const rightPillar = new THREE.Mesh(pillarGeo, neonMat);
        rightPillar.position.set(tunnelWidth, tunnelHeight / 2, z);
        scene.add(rightPillar);

        // 3. Deckenbalken (Verbindet die Säulen)
        // Etwas breiter als der Tunnel, damit es "aufliegt"
        const beamGeo = new THREE.BoxGeometry(tunnelWidth * 2.1, 0.05, 0.05);
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

    // Touch: PREVENT DEFAULT WICHTIG!
    const onTouchStart = (e) => { 
        e.preventDefault(); 
        isDragging = true; 
        previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY }; 
    };
    const onTouchMove = (e) => {
        e.preventDefault(); 
        if(isDragging && carModel) {
            const deltaMove = { x: e.touches[0].clientX - previousMousePosition.x };
            carModel.rotation.y += deltaMove.x * 0.01;
            previousMousePosition = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
    };
    const onTouchEnd = (e) => { e.preventDefault(); isDragging = false; };

    // Event Listener
    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseup', onMouseUp);
    container.addEventListener('touchstart', onTouchStart, {passive: false});
    container.addEventListener('touchmove', onTouchMove, {passive: false});
    container.addEventListener('touchend', onTouchEnd, {passive: false});

    // 7. CAR LOAD
    const loader = new GLTFLoader();
    loader.load('car.glb', (gltf) => {
        carModel = gltf.scene;
        
        const box = new THREE.Box3().setFromObject(carModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        
        // Scale
        const scale = 3.8 / maxDim; 
        carModel.scale.set(scale, scale, scale);
        
        // Position
        carModel.position.x = -center.x * scale;
        carModel.position.y = -box.min.y * scale; // Boden
        carModel.position.z = -center.z * scale;

        // Material Tuning (Damit der Lack die Streifen spiegelt!)
        carModel.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.envMapIntensity = 2.0; 
                child.material.roughness = 0.2; // Glanz
                child.material.metalness = 0.7; // Metall
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
            
            // Mobile Zoom Logic
            if(newAspect < 1.0) {
                camera.position.z = 11.0; 
            } else {
                camera.position.z = 8.0; 
            }
        }
    });
    resizeObserver.observe(container);
}

window.startGarage3D = init3D;
window.hideGarage3D = function() {}; 
window.showGarage3D = function() {};

// Starte
setTimeout(init3D, 200);
