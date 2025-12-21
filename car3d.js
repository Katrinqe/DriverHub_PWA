import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene, camera, renderer, carModel, studioModel;
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

    // 1. Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); 

    // 2. Camera - Etwas weiter weg, damit das große Studio reinpasst
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 1.5, 7.0); 
    camera.lookAt(0, 0.5, 0);

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0; 
    container.appendChild(renderer.domElement);

    // 4. Lights - Nur Akzente, das Studio soll selbst leuchten
    const spotLight = new THREE.SpotLight(0xffffff, 5.0);
    spotLight.position.set(5, 5, 5);
    scene.add(spotLight);

    const blueLight = new THREE.SpotLight(0x007aff, 10.0);
    blueLight.position.set(-5, 0, 5);
    scene.add(blueLight);

    // 5. Interaction (Auto drehen)
    const onMouseDown = (e) => { isDragging = true; previousMousePosition = { x: e.offsetX, y: e.offsetY }; };
    const onMouseMove = (e) => {
        if(isDragging && carModel) {
            const deltaMove = { x: e.offsetX - previousMousePosition.x };
            carModel.rotation.y += deltaMove.x * 0.01; 
            previousMousePosition = { x: e.offsetX, y: e.offsetY };
        }
    };
    const onMouseUp = () => { isDragging = false; };

    // Touch
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

    // STUDIO LADEN
    loader.load('studio.glb', (gltf) => {
        studioModel = gltf.scene;
        
        // MASSIVE SKALIERUNG - Meistens sind diese Modelle winzig
        const scale = 20.0; 
        studioModel.scale.set(scale, scale, scale);
        studioModel.position.set(0, -0.5, 0); // Bodenhöhe
        
        // MATERIAL FIX: ALLES LEUCHTEND MACHEN
        studioModel.traverse((child) => {
            if (child.isMesh) {
                // Wenn das Material hell ist, machen wir es emittierend (leuchtend)
                if(child.material.color.r > 0.5) {
                    child.material.emissive = new THREE.Color(0xffffff);
                    child.material.emissiveIntensity = 1.0;
                } else {
                    // Boden Schwarz
                    child.material.color.setHex(0x050505);
                    child.material.roughness = 0.2;
                    child.material.metalness = 0.8;
                }
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
        carModel.position.y = -box.min.y * scale - 0.5; // Bodenhöhe
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

// Global Hook
window.startGarage3D = init3D;
// Fix: UI-Funktionen leer lassen, damit GarageLogic nicht abstürzt
window.hideGarage3D = function() {}; 
window.showGarage3D = function() {};

// Starte sofort
setTimeout(init3D, 200);
