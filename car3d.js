import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene, camera, renderer, carModel, studioModel;
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

    // 1. SCENE
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); // Schwarz

    // 2. CAMERA
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    
    // Wir positionieren die Kamera "sicher"
    const isMobile = aspect < 1.0;
    // Auf Mobile weiter weg (Z=12), Desktop (Z=8)
    camera.position.set(0, 1.5, isMobile ? 12.0 : 8.0); 
    camera.lookAt(0, 0.5, 0);

    // 3. RENDERER
    renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    // Wichtig für korrekte Darstellung von GLB Dateien
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace; 
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 4. LIGHTING (Backup Licht, falls das Studio dunkel ist)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); 
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight.position.set(5, 10, 5);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 1.0);
    fillLight.position.set(0, 2, 10);
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

    // A. STUDIO LADEN (Das Original!)
    loader.load('studio.glb', (gltf) => {
        studioModel = gltf.scene;
        
        // --- AUTO-FIXING START ---
        
        // 1. Messen wie groß das Ding wirklich ist
        const box = new THREE.Box3().setFromObject(studioModel);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // 2. Skalierungsfaktor berechnen (Wir wollen Breite ca. 15 Einheiten)
        // Das verhindert, dass wir "im" Boden stehen oder es winzig ist
        let scaleFactor = 15.0 / size.x;
        if (!isFinite(scaleFactor) || scaleFactor === 0) scaleFactor = 1.0;

        studioModel.scale.set(scaleFactor, scaleFactor, scaleFactor);
        
        // 3. Zentrieren (Boden auf 0 setzen)
        studioModel.position.x = -center.x * scaleFactor;
        studioModel.position.y = -box.min.y * scaleFactor - 0.01; 
        studioModel.position.z = -center.z * scaleFactor;

        // 4. Material-Rettung (Damit es nicht durchsichtig/schwarz ist)
        studioModel.traverse((child) => {
            if (child.isMesh) {
                child.receiveShadow = true;
                
                // Wir zwingen Wände dazu, doppelseitig zu sein (keine unsichtbaren Rückwände)
                if (child.material) {
                    child.material.side = THREE.DoubleSide;
                    // Wenn das Material sehr dunkel ist, hellen wir es auf, damit man was sieht
                    if (child.material.color && (child.material.color.r + child.material.color.g + child.material.color.b) < 0.1) {
                         child.material.color.setHex(0x222222); 
                    }
                    child.material.needsUpdate = true;
                }
            }
        });

        scene.add(studioModel);
        console.log("Studio loaded and fixed. Scale:", scaleFactor);

        // B. AUTO LADEN (Erst wenn Studio da ist)
        loader.load('car.glb', (carGltf) => {
            carModel = carGltf.scene;
            
            const carBox = new THREE.Box3().setFromObject(carModel);
            const carCenter = carBox.getCenter(new THREE.Vector3());
            const carSize = carBox.getSize(new THREE.Vector3());
            
            // Auto Größe anpassen (sollte ca 4 Einheiten breit sein in unserem 15er Studio)
            const carMax = Math.max(carSize.x, carSize.z);
            const carScale = 4.5 / carMax; 
            
            carModel.scale.set(carScale, carScale, carScale);
            
            carModel.position.x = -carCenter.x * carScale;
            carModel.position.y = -carBox.min.y * carScale; // Auf den Boden
            carModel.position.z = -carCenter.z * carScale;

            carModel.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if(child.material) {
                        child.material.envMapIntensity = 2.5; // Glanz!
                        child.material.needsUpdate = true;
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

    // Resize
    const resizeObserver = new ResizeObserver(() => {
        if(container.clientWidth > 0 && container.clientHeight > 0) {
            const newAspect = container.clientWidth / container.clientHeight;
            camera.aspect = newAspect;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
            
            if(newAspect < 1.0) camera.position.z = 12.0;
            else camera.position.z = 8.0;
        }
    });
    resizeObserver.observe(container);
}

window.startGarage3D = init3D;
window.hideGarage3D = function() {}; 
window.showGarage3D = function() {};

setTimeout(init3D, 200);
