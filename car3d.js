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

    // 1. SCENE
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); // Hartes Schwarz
    // Kein Nebel, wir wollen das Studio klar sehen

    // 2. CAMERA
    // Wir setzen sie erstmal "sicher" in die Mitte
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.set(0, 1.5, 8.0); // Zentraler Blick
    camera.lookAt(0, 0.8, 0);

    // 3. RENDERER
    renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2; 
    container.appendChild(renderer.domElement);

    // 4. LIGHTING
    // Wir brauchen Licht, falls das Studio selbst keine "leuchtenden" Materialien hat
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    const topLight = new THREE.DirectionalLight(0xffffff, 2.0);
    topLight.position.set(0, 10, 0);
    scene.add(topLight);

    const frontLight = new THREE.DirectionalLight(0xffffff, 1.0);
    frontLight.position.set(0, 1, 10);
    scene.add(frontLight);

    // 5. INTERACTION (Nur Auto drehen)
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

    // 6. LOADER
    const loader = new GLTFLoader();

    // A: STUDIO LADEN
    loader.load('studio.glb', (gltf) => {
        studioModel = gltf.scene;
        
        // AUTO-FIX: Studio Größe normalisieren
        const box = new THREE.Box3().setFromObject(studioModel);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        
        // Wir wollen, dass der Tunnel ca. 15 Einheiten breit ist
        const targetWidth = 15.0; 
        const scale = targetWidth / size.x;
        
        studioModel.scale.set(scale, scale, scale);
        
        // Zentrieren: Boden auf 0
        studioModel.position.x = -center.x * scale;
        studioModel.position.y = -box.min.y * scale - 0.05; // Leicht unter 0
        studioModel.position.z = -center.z * scale;

        // MATERIAL FIXER: Gehe durch alle Teile des Studios
        studioModel.traverse((child) => {
            if (child.isMesh) {
                // Wenn das Material sehr hell ist (wahrscheinlich Lichter), lassen wir es leuchten
                if(child.material.color.r > 0.8 && child.material.color.g > 0.8 && child.material.color.b > 0.8) {
                    child.material.emissive = new THREE.Color(0xffffff);
                    child.material.emissiveIntensity = 2.0;
                } else {
                    // Alles andere (Wände/Boden) machen wir dunkel und leicht glänzend
                    // Damit überschreiben wir "graue" Farben aus der Datei
                    child.material.color.setHex(0x111111); // Dunkelgrau
                    child.material.roughness = 0.2;
                    child.material.metalness = 0.5;
                }
                child.material.needsUpdate = true;
            }
        });

        scene.add(studioModel);
        console.log("Studio loaded & fixed");
    }, undefined, (e) => console.error("Studio Error:", e));

    // B: AUTO LADEN
    loader.load('car.glb', (gltf) => {
        carModel = gltf.scene;
        
        const box = new THREE.Box3().setFromObject(carModel);
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(box.getSize(new THREE.Vector3()).x, box.getSize(new THREE.Vector3()).y, box.getSize(new THREE.Vector3()).z);
        
        // Auto anpassen (relativ zur Kamera)
        const scale = 3.8 / maxDim; 
        carModel.scale.set(scale, scale, scale);
        
        carModel.position.x = -center.x * scale;
        carModel.position.y = -box.min.y * scale; // Exakt auf 0 (Studioboden ist bei -0.05)
        carModel.position.z = -center.z * scale;

        carModel.traverse((child) => {
            if (child.isMesh && child.material) {
                child.material.envMapIntensity = 2.5; 
                child.material.needsUpdate = true;
            }
        });
        scene.add(carModel);
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
            const aspect = container.clientWidth / container.clientHeight;
            camera.aspect = aspect;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
            
            // Kamera anpassen bei Hochformat (weiter weg)
            if(aspect < 1.0) {
                camera.position.z = 10.0;
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

setTimeout(init3D, 200);
