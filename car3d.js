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

    // 1. SCENE
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); 
    scene.fog = new THREE.FogExp2(0x000000, 0.06); // Nebel etwas dichter für Tiefe

    // 2. CAMERA (RESPONSIVE FIX)
    const aspect = container.clientWidth / container.clientHeight;
    const isMobile = aspect < 1.0; // Hochformat?

    camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 100);
    
    // WICHTIG: Auf Mobile weiter weg (Z=10), auf Desktop näher (Z=7.5)
    // Damit der Tunnel auch auf schmalen Screens drauf passt
    const camZ = isMobile ? 10.0 : 7.5; 
    const camY = 1.4;
    
    camera.position.set(0, camY, camZ); 
    camera.lookAt(0, 0.5, 0);

    // 3. RENDERER
    renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3; 
    container.appendChild(renderer.domElement);

    // 4. LIGHTING
    
    // Ambient (Heller, damit man Wände/Boden sieht)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); 
    scene.add(ambientLight);

    // Top Light
    const topSpot = new THREE.SpotLight(0xffffff, 8.0);
    topSpot.position.set(0, 10, 0);
    topSpot.angle = Math.PI / 3;
    topSpot.penumbra = 0.5;
    scene.add(topSpot);

    // Front Fill (Gesicht des Autos)
    const frontLight = new THREE.DirectionalLight(0xffffff, 1.5);
    frontLight.position.set(0, 1, 10);
    scene.add(frontLight);

    // Rim Light (Blau)
    const rimLight = new THREE.SpotLight(0x007aff, 20.0);
    rimLight.position.set(0, 5, -10);
    rimLight.lookAt(0, 0, 0);
    scene.add(rimLight);

    // 5. TUNNEL GEOMETRY (Optimiert für Sichtbarkeit)
    
    // Boden: Heller & Rauer (Damit er Licht fängt)
    const floorGeo = new THREE.PlaneGeometry(30, 60);
    const floorMat = new THREE.MeshStandardMaterial({ 
        color: 0x111111, // Nicht 000000, sondern Dunkelgrau
        roughness: 0.4,  // Rauer = mehr sichtbares Licht auf der Fläche
        metalness: 0.6
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    scene.add(floor);

    // Lichtstreifen Material
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    
    // Streifen an der Decke (Enger zusammen für Mobile)
    const stripGeo = new THREE.BoxGeometry(0.15, 0.05, 8); 
    
    // Tunnel Breite: 3.0 statt 3.5 (Enger, damit im Bild)
    const tunnelWidth = 3.0;

    for (let i = 0; i < 5; i++) {
        const z = (i * 5) - 10; 
        
        // Links Oben
        const l1 = new THREE.Mesh(stripGeo, lightMat);
        l1.position.set(-tunnelWidth, 3.0, z);
        l1.rotation.x = Math.PI / 2;
        scene.add(l1);

        // Rechts Oben
        const l2 = new THREE.Mesh(stripGeo, lightMat);
        l2.position.set(tunnelWidth, 3.0, z);
        l2.rotation.x = Math.PI / 2;
        scene.add(l2);
        
        // Vertikale Säulen
        const colGeo = new THREE.BoxGeometry(0.1, 4, 0.1);
        
        const v1 = new THREE.Mesh(colGeo, lightMat);
        v1.position.set(-tunnelWidth, 2.0, z);
        scene.add(v1);
        
        const v2 = new THREE.Mesh(colGeo, lightMat);
        v2.position.set(tunnelWidth, 2.0, z);
        scene.add(v2);
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

    // 7. LOAD CAR
    const loader = new GLTFLoader();
    loader.load('car.glb', (gltf) => {
        carModel = gltf.scene;
        
        const box = new THREE.Box3().setFromObject(carModel);
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(box.getSize(new THREE.Vector3()).x, box.getSize(new THREE.Vector3()).y, box.getSize(new THREE.Vector3()).z);
        
        // Auto Skalierung
        const scale = 3.8 / maxDim; 
        carModel.scale.set(scale, scale, scale);
        
        // Auto Position
        carModel.position.x = -center.x * scale;
        carModel.position.y = -box.min.y * scale; 
        carModel.position.z = -center.z * scale;

        carModel.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.envMapIntensity = 2.0; 
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

    const resizeObserver = new ResizeObserver(() => {
        if(container.clientWidth > 0 && container.clientHeight > 0) {
            const newAspect = container.clientWidth / container.clientHeight;
            camera.aspect = newAspect;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
            
            // Dynamisch Z anpassen bei Resize/Rotation
            const isMobileResize = newAspect < 1.0;
            camera.position.z = isMobileResize ? 10.0 : 7.5;
        }
    });
    resizeObserver.observe(container);
}

window.startGarage3D = init3D;
window.hideGarage3D = function() {}; 
window.showGarage3D = function() {};

setTimeout(init3D, 200);
