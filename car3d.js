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
    // Nebel etwas dichter, damit das Ende des Tunnels weicher ist
    scene.fog = new THREE.FogExp2(0x000000, 0.08);

    // 2. CAMERA - ZENTRIERT (X=0)!
    camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 100);
    // X=0 für Symmetrie, Y=1.4 für Augenhöhe, Z=7.5 für Abstand
    camera.position.set(0, 1.4, 7.5); 
    camera.lookAt(0, 0.5, 0);

    // 3. RENDERER
    renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2; 
    container.appendChild(renderer.domElement);

    // 4. LIGHTING (Optimiert für Sichtbarkeit)
    
    // Ambient (Grundhelligkeit gegen schwarze Löcher)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); 
    scene.add(ambientLight);

    // Top Light (Sonne von oben)
    const topSpot = new THREE.SpotLight(0xffffff, 8.0);
    topSpot.position.set(0, 10, 0);
    topSpot.angle = Math.PI / 3;
    topSpot.penumbra = 0.5;
    scene.add(topSpot);

    // FRONT FILL (Damit man die Front sieht!)
    const frontLight = new THREE.DirectionalLight(0xffffff, 2.0);
    frontLight.position.set(0, 1, 10); // Direkt von der Kamera aus
    scene.add(frontLight);

    // Rim Light (Blau von hinten für Kontur - Symmetrisch)
    const rimLight = new THREE.SpotLight(0x007aff, 20.0);
    rimLight.position.set(0, 5, -10); // Mittig hinten
    rimLight.lookAt(0, 0, 0);
    scene.add(rimLight);

    // 5. TUNNEL GEOMETRY (SYMMETRISCH)
    
    // Boden (Matter, dunkler Asphalt-Look)
    const floorGeo = new THREE.PlaneGeometry(30, 60);
    const floorMat = new THREE.MeshStandardMaterial({ 
        color: 0x050505, 
        roughness: 0.3, // Weniger Spiegelung (war 0.1)
        metalness: 0.5  // Weniger Metall (war 0.8)
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    scene.add(floor);

    // Lichtstreifen Material (Weiß Leuchtend)
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    
    // Streifen an der Decke (Länger und breiter)
    const stripGeo = new THREE.BoxGeometry(0.15, 0.05, 8); // 8m lang
    
    // Loop für Tiefe
    for (let i = 0; i < 5; i++) {
        const z = (i * 5) - 10; // -10, -5, 0, 5, 10
        
        // Links Oben
        const l1 = new THREE.Mesh(stripGeo, lightMat);
        l1.position.set(-3.5, 3.0, z); // Breiterer Tunnel (3.5m)
        l1.rotation.x = Math.PI / 2;
        scene.add(l1);

        // Rechts Oben
        const l2 = new THREE.Mesh(stripGeo, lightMat);
        l2.position.set(3.5, 3.0, z);
        l2.rotation.x = Math.PI / 2;
        scene.add(l2);
        
        // Vertikale Säulen (Neon Style)
        const colGeo = new THREE.BoxGeometry(0.1, 4, 0.1);
        
        const v1 = new THREE.Mesh(colGeo, lightMat);
        v1.position.set(-3.5, 2.0, z);
        scene.add(v1);
        
        const v2 = new THREE.Mesh(colGeo, lightMat);
        v2.position.set(3.5, 2.0, z);
        scene.add(v2);
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

    // 7. LOAD CAR
    const loader = new GLTFLoader();
    loader.load('car.glb', (gltf) => {
        carModel = gltf.scene;
        
        const box = new THREE.Box3().setFromObject(carModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        
        // Auto Skalierung
        const scale = 3.8 / maxDim; 
        carModel.scale.set(scale, scale, scale);
        
        // Auto Position (Mitte)
        carModel.position.x = -center.x * scale;
        carModel.position.y = -box.min.y * scale; 
        carModel.position.z = -center.z * scale;

        // Auto Material Boost
        carModel.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.envMapIntensity = 2.0; 
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

    const resizeObserver = new ResizeObserver(() => {
        if(container.clientWidth > 0 && container.clientHeight > 0) {
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        }
    });
    resizeObserver.observe(container);
}

window.startGarage3D = init3D;
window.hideGarage3D = function() {}; 
window.showGarage3D = function() {};

setTimeout(init3D, 200);
