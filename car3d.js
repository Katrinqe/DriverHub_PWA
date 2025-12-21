import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene, camera, renderer, carModel, studioModel;
let isInitialized = false; 
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

function init3D() {
    const container = document.getElementById('hero-3d-stage');
    
    // Safety check: Nur laden wenn sichtbar
    if (!container || container.clientWidth === 0) { 
        requestAnimationFrame(init3D); 
        return; 
    }

    if (isInitialized) return;
    isInitialized = true;

    // Clean up
    while(container.firstChild) { container.removeChild(container.firstChild); }

    // 1. Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); // Schwarz

    // 2. Camera - Festgenagelt!
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
    // Position IM Tunnel
    camera.position.set(2.8, 1.2, 4.5); 
    camera.lookAt(0, 0.5, 0);

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0; 
    container.appendChild(renderer.domElement);

    // 4. Custom Lighting (Kein Ambient, nur Spots für Drama)
    // Deckenlichter simulieren
    const topLight1 = new THREE.RectAreaLight(0xffffff, 5.0, 10, 0.2);
    topLight1.position.set(0, 4, 0);
    topLight1.lookAt(0, 0, 0);
    scene.add(topLight1);

    const topLight2 = new THREE.RectAreaLight(0xffffff, 5.0, 10, 0.2);
    topLight2.position.set(0, 4, -5);
    topLight2.lookAt(0, 0, -5);
    scene.add(topLight2);

    // Rim Light (Blau von hinten)
    const rimLight = new THREE.SpotLight(0x007aff, 50.0);
    rimLight.position.set(-5, 2, -5);
    rimLight.lookAt(0, 0, 0);
    scene.add(rimLight);

    // 5. Interaction (Auto drehen, NICHT Kamera)
    const onMouseDown = (e) => { isDragging = true; previousMousePosition = { x: e.offsetX, y: e.offsetY }; };
    const onMouseMove = (e) => {
        if(isDragging && carModel) {
            const deltaMove = { x: e.offsetX - previousMousePosition.x };
            carModel.rotation.y += deltaMove.x * 0.01; // Dreht das Auto
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

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('touchstart', onTouchStart, {passive: false});
    renderer.domElement.addEventListener('touchmove', onTouchMove, {passive: false});
    renderer.domElement.addEventListener('touchend', onTouchEnd);


    // 6. Loader
    const loader = new GLTFLoader();

    // STUDIO LADEN - UND SCHWARZ FÄRBEN
    loader.load('studio.glb', (gltf) => {
        studioModel = gltf.scene;
        studioModel.scale.set(1, 1, 1);
        studioModel.position.set(0, -0.5, 0);
        
        // MATERIAL OVERRIDE: ALLES SCHWARZ MACHEN
        studioModel.traverse((child) => {
            if (child.isMesh) {
                // Erzwinge schwarzes, glänzendes Material
                child.material = new THREE.MeshStandardMaterial({
                    color: 0x050505, // Fast Schwarz
                    roughness: 0.1,  // Sehr glatt
                    metalness: 0.8   // Metallisch
                });
            }
        });
        scene.add(studioModel);
    });

    // AUTO LADEN
    loader.load('car.glb', (gltf) => {
        carModel = gltf.scene;
        
        const box = new THREE.Box3().setFromObject(carModel);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        
        const scale = 3.5 / maxDim; 
        carModel.scale.set(scale, scale, scale);
        
        carModel.position.x = -center.x * scale;
        carModel.position.y = -box.min.y * scale - 0.5; // Bodenhöhe anpassen
        carModel.position.z = -center.z * scale;

        carModel.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.envMapIntensity = 2.0; 
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
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        }
    });
    resizeObserver.observe(container);
}

// Helper (bleiben gleich)
function hideCar() {
    const el = document.getElementById('hero-3d-stage');
    if(el) el.style.opacity = '0';
}
function showCar() {
    const el = document.getElementById('hero-3d-stage');
    if(el) el.style.opacity = '1';
    init3D();
}

window.startGarage3D = init3D;
window.hideGarage3D = hideCar;
window.showGarage3D = showCar;
