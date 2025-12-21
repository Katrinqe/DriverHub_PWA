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

    // 1. SCENE
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505); // Sehr dunkles Grau, fast Schwarz
    // Nebel beginnt erst ganz hinten, damit man den Raum sieht
    scene.fog = new THREE.Fog(0x050505, 15, 30);

    // 2. CAMERA
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    
    // Position für gute Perspektive im Raum
    const isMobile = aspect < 1.0;
    const camZ = isMobile ? 9.5 : 7.0; 
    camera.position.set(0, 1.3, camZ); 
    camera.lookAt(0, 0.5, 0);

    // 3. RENDERER
    renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0; // Natürlicheres Licht
    renderer.shadowMap.enabled = true; // Schatten aktivieren für Realismus!
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 4. LIGHTING (Neutral & Real)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); 
    scene.add(ambientLight);

    // Hauptlicht (Decke, wirft Schatten)
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
    keyLight.position.set(5, 10, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    // Fill Light von vorne (sanft)
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
    fillLight.position.set(0, 2, 10);
    scene.add(fillLight);

    // KEIN BLAUES RIM LIGHT MEHR! Nur ein weißes Spitzlicht von hinten oben
    const backLight = new THREE.SpotLight(0xffffff, 5.0);
    backLight.position.set(0, 5, -5);
    backLight.lookAt(0, 0, 0);
    scene.add(backLight);

    // 5. SOLID ROOM ARCHITECTURE
    const roomLength = 40;
    const roomWidth = 12;
    const roomHeight = 5;

    // Materialien
    const wallMat = new THREE.MeshStandardMaterial({ 
        color: 0x111111, // Dunkle Wand
        roughness: 0.8,  // Rau (Beton-artig)
        metalness: 0.1 
    });

    const floorMat = new THREE.MeshStandardMaterial({ 
        color: 0x080808, 
        roughness: 0.2, // Leicht glänzend (Polierter Beton)
        metalness: 0.2
    });

    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff }); 

    // A. Boden
    const floorGeo = new THREE.PlaneGeometry(roomWidth, roomLength);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.01;
    floor.receiveShadow = true;
    scene.add(floor);

    // B. Decke
    const ceilGeo = new THREE.BoxGeometry(roomWidth, 0.2, roomLength);
    const ceiling = new THREE.Mesh(ceilGeo, wallMat);
    ceiling.position.set(0, roomHeight, -5);
    scene.add(ceiling);

    // C. Wände (Links & Rechts)
    const wallGeo = new THREE.BoxGeometry(0.5, roomHeight, roomLength);
    
    const leftWall = new THREE.Mesh(wallGeo, wallMat);
    leftWall.position.set(-roomWidth/2, roomHeight/2, -5);
    leftWall.receiveShadow = true;
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(wallGeo, wallMat);
    rightWall.position.set(roomWidth/2, roomHeight/2, -5);
    rightWall.receiveShadow = true;
    scene.add(rightWall);

    // D. Lichter (Eingelassen in Decke und Wände)
    const numLights = 8;
    const lightSpacing = 4;

    for (let i = 0; i < numLights; i++) {
        const z = 5 - (i * lightSpacing);

        // Deckenstreifen (Quer)
        const stripGeo = new THREE.BoxGeometry(roomWidth - 1, 0.1, 0.2);
        const strip = new THREE.Mesh(stripGeo, lightMat);
        strip.position.set(0, roomHeight - 0.1, z);
        scene.add(strip);

        // Vertikale Streifen an den Wänden
        const vGeo = new THREE.BoxGeometry(0.1, roomHeight, 0.2);
        
        const vLeft = new THREE.Mesh(vGeo, lightMat);
        vLeft.position.set(-roomWidth/2 + 0.3, roomHeight/2, z);
        scene.add(vLeft);

        const vRight = new THREE.Mesh(vGeo, lightMat);
        vRight.position.set(roomWidth/2 - 0.3, roomHeight/2, z);
        scene.add(vRight);
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
        const maxDim = Math.max(box.getSize(new THREE.Vector3()).x, box.getSize(new THREE.Vector3()).y, box.getSize(new THREE.Vector3()).z);
        
        const scale = 3.8 / maxDim; 
        carModel.scale.set(scale, scale, scale);
        
        carModel.position.x = -center.x * scale;
        carModel.position.y = -box.min.y * scale; 
        carModel.position.z = -center.z * scale;

        carModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                if(child.material) {
                    child.material.envMapIntensity = 1.0; // Normaler Glanz
                    child.material.roughness = 0.4; // Etwas weniger Spiegelung für Realismus
                    child.material.metalness = 0.6;
                    child.material.needsUpdate = true;
                }
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
            
            // Mobile Anpassung
            if(newAspect < 1.0) {
                camera.position.z = 9.5; 
            } else {
                camera.position.z = 7.0; 
            }
        }
    });
    resizeObserver.observe(container);
}

window.startGarage3D = init3D;
window.hideGarage3D = function() {}; 
window.showGarage3D = function() {};

setTimeout(init3D, 200);
