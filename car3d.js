import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene, camera, renderer, carModel, studioModel;
let isInitialized = false; 
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

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
    scene.background = new THREE.Color(0x000000); // Schwarz als Basis

    // 2. CAMERA (Initial Setup)
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.set(0, 1.5, 8.0); 
    camera.lookAt(0, 0.5, 0);

    // 3. RENDERER
    renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    // Wichtig für GLB Dateien: Korrekte Farben und Schatten
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace; 
    container.appendChild(renderer.domElement);

    // 4. LIGHTING (Fallback, falls das Studio dunkel ist)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); 
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(5, 10, 5);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 1.0);
    fillLight.position.set(0, 2, 10); // Von vorne
    scene.add(fillLight);

    // 5. INTERACTION
    const onMouseDown = (e) => { isDragging = true; previousMousePosition = { x: e.offsetX, y: e.offsetY }; };
    const onMouseMove = (e) => {
        if(isDragging && carModel) {
            const deltaMove = { x: e.offsetX - previousMousePosition.x };
            carModel.rotation.y += deltaMove.x * 0.01; 
            previousMousePosition = { x: e.offsetX, y: e.offsetY };
        }
    };
    const onMouseUp = () => { isDragging = false; };

    const onTouchStart = (e) => { 
        e.preventDefault(); isDragging = true; 
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

    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseup', onMouseUp);
    container.addEventListener('touchstart', onTouchStart, {passive: false});
    container.addEventListener('touchmove', onTouchMove, {passive: false});
    container.addEventListener('touchend', onTouchEnd, {passive: false});

    // 6. LOADER SYSTEM
    const loader = new GLTFLoader();

    // A. STUDIO LADEN
    loader.load('studio.glb', (gltf) => {
        studioModel = gltf.scene;
        
        // --- STUDIO NORMALISIERUNG ---
        // Wir messen das Studio aus und zwingen es auf eine brauchbare Größe
        const box = new THREE.Box3().setFromObject(studioModel);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // Zielbreite: 15 Einheiten (Standardgröße für Three.js Szene)
        // Das verhindert, dass es riesig (10000km) oder winzig (1cm) ist
        let scaleFactor = 15.0 / size.x;
        // Safety check falls size 0
        if(!isFinite(scaleFactor) || scaleFactor === 0) scaleFactor = 1.0;

        studioModel.scale.set(scaleFactor, scaleFactor, scaleFactor);
        
        // Positionieren: Boden auf Y=0, Mitte auf X=0
        studioModel.position.x = -center.x * scaleFactor;
        studioModel.position.y = -box.min.y * scaleFactor; // Boden auf 0
        studioModel.position.z = -center.z * scaleFactor;

        // Materialien fixen (Schatten an, DoubleSide für Wände)
        studioModel.traverse((child) => {
            if (child.isMesh) {
                child.receiveShadow = true;
                if(child.material) {
                    child.material.side = THREE.DoubleSide; // Damit man Wände auch von innen sieht
                    child.material.needsUpdate = true;
                }
            }
        });

        scene.add(studioModel);
        console.log("Studio loaded & scaled by:", scaleFactor);

        // B. AUTO LADEN (Erst wenn Studio da ist, wegen Referenz)
        loader.load('car.glb', (carGltf) => {
            carModel = carGltf.scene;
            
            const carBox = new THREE.Box3().setFromObject(carModel);
            const carCenter = carBox.getCenter(new THREE.Vector3());
            const carSize = carBox.getSize(new THREE.Vector3());
            
            // Auto auf ca 4 Einheiten Breite skalieren (passt gut in den 15er Tunnel)
            const maxDim = Math.max(carSize.x, carSize.y, carSize.z);
            const carScale = 4.0 / maxDim; 
            
            carModel.scale.set(carScale, carScale, carScale);
            
            // Position
            carModel.position.x = -carCenter.x * carScale;
            carModel.position.y = -carBox.min.y * carScale; // Auf den Boden stellen
            carModel.position.z = -carCenter.z * carScale;

            // Auto Material Boost
            carModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if(child.material) {
                        child.material.envMapIntensity = 2.0;
                    }
                }
            });
            scene.add(carModel);
        });

    }, undefined, (error) => {
        console.error("Studio Error:", error);
    });

    // Animation
    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }
    animate();

    // Resize & Kamera Logic
    const resizeObserver = new ResizeObserver(() => {
        if(container.clientWidth > 0 && container.clientHeight > 0) {
            const newAspect = container.clientWidth / container.clientHeight;
            camera.aspect = newAspect;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
            
            // Mobile Anpassung: Weiter weg, wenn hochkant
            if(newAspect < 1.0) {
                camera.position.set(0, 1.6, 12.0);
            } else {
                camera.position.set(0, 1.4, 8.0);
            }
            camera.lookAt(0, 0.5, 0);
        }
    });
    resizeObserver.observe(container);
}

window.startGarage3D = init3D;
window.hideGarage3D = function() {}; 
window.showGarage3D = function() {};

setTimeout(init3D, 200);
