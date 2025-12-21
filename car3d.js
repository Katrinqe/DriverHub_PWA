import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene, camera, renderer, carModel;
let isInitialized = false; 
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

function init3D() {
    const container = document.getElementById('hero-3d-stage');
    
    if (!container || container.clientWidth === 0) { 
        requestAnimationFrame(init3D); 
        return; 
    }

    if (isInitialized) return;
    isInitialized = true;

    while(container.firstChild) { container.removeChild(container.firstChild); }

    // 1. SCENE (Deep Black)
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); 
    // Nebel, damit der Tunnel hinten "ins Nichts" läuft (wie im Screenshot)
    scene.fog = new THREE.FogExp2(0x000000, 0.05);

    // 2. CAMERA
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    
    // Check Mobile vs Desktop für Zoom
    const isMobile = aspect < 1.0;
    const camZ = isMobile ? 10.5 : 7.0; 
    
    camera.position.set(0, 1.3, camZ); 
    camera.lookAt(0, 0.5, 0);

    // 3. RENDERER
    renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.8; // Helles Neon-Licht
    container.appendChild(renderer.domElement);

    // 4. LIGHTING
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2); 
    scene.add(ambientLight);

    // Top Light (Sonne)
    const topLight = new THREE.DirectionalLight(0xffffff, 2.0);
    topLight.position.set(0, 10, 0);
    scene.add(topLight);

    // Front Fill
    const frontLight = new THREE.DirectionalLight(0xffffff, 1.5);
    frontLight.position.set(0, 0.5, 10);
    scene.add(frontLight);

    // Rim Light (Weiß/Bläulich für Kanten)
    const rimLight = new THREE.SpotLight(0xaaddff, 10.0);
    rimLight.position.set(0, 5, -5);
    rimLight.lookAt(0, 0, 0);
    scene.add(rimLight);

    // 5. STUDIO ARCHITECTURE (Nachbau des Screenshots)
    
    // A. Boden (Spiegel)
    const floorGeo = new THREE.PlaneGeometry(40, 100);
    const floorMat = new THREE.MeshStandardMaterial({ 
        color: 0x020202, // Fast Schwarz
        roughness: 0.1,  // Stark spiegelnd
        metalness: 0.8
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    scene.add(floor);

    // B. Das Gitter (Die "Tiles" aus dem Bild)
    // 60x60 Grid, Farbe Dunkelgrau
    const grid = new THREE.GridHelper(80, 80, 0x444444, 0x222222);
    grid.position.y = 0.0;
    grid.material.transparent = true;
    grid.material.opacity = 0.4; // Sichtbar aber nicht dominant
    scene.add(grid);

    // C. Die Neon-Rahmen (High Density)
    const neonMat = new THREE.MeshBasicMaterial({ color: 0xffffff }); 
    
    const tunnelWidth = 4.2;  
    const tunnelHeight = 3.5; 
    const numFrames = 25; // VIEL MEHR RAHMEN (Dichte!)
    const spacing = 1.5;  // Enger zusammen

    for (let i = 0; i < numFrames; i++) {
        // Startet hinter der Kamera und geht weit rein
        const z = 6 - (i * spacing); 

        // Rahmen Geometrie (Sehr dünn, wie Laser)
        const thickness = 0.05;

        // 1. Säule Links
        const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(thickness, tunnelHeight, thickness), neonMat);
        leftPillar.position.set(-tunnelWidth, tunnelHeight / 2, z);
        scene.add(leftPillar);

        // 2. Säule Rechts
        const rightPillar = new THREE.Mesh(new THREE.BoxGeometry(thickness, tunnelHeight, thickness), neonMat);
        rightPillar.position.set(tunnelWidth, tunnelHeight / 2, z);
        scene.add(rightPillar);

        // 3. Deckenbalken
        const topBeam = new THREE.Mesh(new THREE.BoxGeometry(tunnelWidth * 2, thickness, thickness), neonMat);
        topBeam.position.set(0, tunnelHeight, z);
        scene.add(topBeam);
    }

    // 6. INTERACTION
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
        
        // Scale
        const scale = 3.6 / maxDim; 
        carModel.scale.set(scale, scale, scale);
        
        carModel.position.x = -center.x * scale;
        carModel.position.y = -box.min.y * scale; 
        carModel.position.z = -center.z * scale;

        // REFLEXIONEN MAXIMIEREN
        carModel.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.envMapIntensity = 3.5; // Lack saugt das Neonlicht auf
                child.material.roughness = 0.1; 
                child.material.metalness = 0.8;
                child.material.needsUpdate = true;
            }
        });
        scene.add(carModel);
    });

    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }
    animate();

    const resizeObserver = new ResizeObserver(() => {
        if(container.clientWidth > 0 && container.clientHeight > 0) {
            const newAspect = container.clientWidth / container.clientHeight;
            camera.aspect = newAspect;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
            
            // Zoom Logic
            if(newAspect < 1.0) {
                camera.position.z = 10.5; // Mobile: Weiter weg
            } else {
                camera.position.z = 7.0; // Desktop: Nah
            }
        }
    });
    resizeObserver.observe(container);
}

window.startGarage3D = init3D;
window.hideGarage3D = function() {}; 
window.showGarage3D = function() {};

setTimeout(init3D, 200);
