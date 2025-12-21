import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene, camera, renderer, carModel;
let isInitialized = false; 
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

function init3D() {
    const container = document.getElementById('hero-3d-stage');
    
    // Warten bis Container da und sichtbar
    if (!container || container.clientWidth === 0) { 
        requestAnimationFrame(init3D); 
        return; 
    }

    if (isInitialized) return;
    isInitialized = true;

    // Aufräumen
    while(container.firstChild) { container.removeChild(container.firstChild); }

    // 1. SCENE SETUP (Zwingend Schwarz!)
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); 
    // Leichter Nebel, damit der Tunnel hinten im Schwarz verschwindet (Infinity Look)
    scene.fog = new THREE.FogExp2(0x000000, 0.05);

    // 2. CAMERA
    camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(3.5, 1.2, 4.5); // Klassischer Showroom Winkel
    camera.lookAt(0, 0.5, 0);

    // 3. RENDERER
    renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5; // Hell genug für Details
    container.appendChild(renderer.domElement);

    // 4. LIGHTING (Custom Studio Setup)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2); 
    scene.add(ambientLight);

    // Key Light (Sonne von oben links)
    const spotLight = new THREE.SpotLight(0xffffff, 10.0);
    spotLight.position.set(5, 8, 5);
    spotLight.angle = Math.PI / 4;
    spotLight.penumbra = 0.5;
    scene.add(spotLight);

    // Rim Light (Blau von hinten für Kontur)
    const rimLight = new THREE.SpotLight(0x007aff, 15.0);
    rimLight.position.set(-5, 2, -5);
    rimLight.lookAt(0, 0, 0);
    scene.add(rimLight);

    // 5. PROCEDURAL TUNNEL (Der "Sketchfab Look" per Code)
    // Boden (Spiegelnd)
    const floorGeo = new THREE.PlaneGeometry(20, 40);
    const floorMat = new THREE.MeshStandardMaterial({ 
        color: 0x050505, roughness: 0.1, metalness: 0.8 
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    scene.add(floor);

    // Lichtstreifen an der Decke (Loops)
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const stripGeo = new THREE.BoxGeometry(0.1, 0.1, 6); // Lange Streifen
    
    // Wir bauen 3 Reihen Lichter links und rechts
    for (let i = 0; i < 6; i++) {
        const z = (i * 3) - 8; // Verteilung in die Tiefe
        
        // Links Oben
        const l1 = new THREE.Mesh(stripGeo, lightMat);
        l1.position.set(-3, 2.5, z);
        l1.rotation.x = Math.PI / 2;
        scene.add(l1);

        // Rechts Oben
        const l2 = new THREE.Mesh(stripGeo, lightMat);
        l2.position.set(3, 2.5, z);
        l2.rotation.x = Math.PI / 2;
        scene.add(l2);
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

    // Touch Support
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


    // 7. LOADER (Nur das Auto)
    const loader = new GLTFLoader();
    loader.load('car.glb', (gltf) => {
        carModel = gltf.scene;
        
        const box = new THREE.Box3().setFromObject(carModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        
        // Auto anpassen
        const scale = 3.8 / maxDim; 
        carModel.scale.set(scale, scale, scale);
        
        carModel.position.x = -center.x * scale;
        carModel.position.y = -box.min.y * scale; // Exakt auf 0 setzen
        carModel.position.z = -center.z * scale;

        // Material Boost
        carModel.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.envMapIntensity = 2.5; // Starker Glanz durch Lichter
                child.material.needsUpdate = true;
            }
        });
        scene.add(carModel);
    });

    // Animation Loop
    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }
    animate();

    // Resize
    const resizeObserver = new ResizeObserver(() => {
        if(container.clientWidth > 0 && container.clientHeight > 0) {
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        }
    });
    resizeObserver.observe(container);
}

// Global Hooks
window.startGarage3D = init3D;
window.hideGarage3D = function() {}; 
window.showGarage3D = function() {};

// Sofortstart
setTimeout(init3D, 200);
