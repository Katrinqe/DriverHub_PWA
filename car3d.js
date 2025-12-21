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

    // Clean
    while(container.firstChild) { container.removeChild(container.firstChild); }

    // 1. SCENE
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); // Schwarz
    // Nebel erst GANZ hinten, damit der Raum riesig wirkt
    scene.fog = new THREE.Fog(0x000000, 15, 40);

    // 2. CAMERA (MOBILE FIX)
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 100);
    
    // WICHTIG: Auf dem Handy (Hochformat) müssen wir viel weiter weg,
    // damit die Wände links und rechts ins Bild passen!
    const isMobile = aspect < 1.0;
    
    if (isMobile) {
        camera.position.set(0, 1.5, 13.0); // Weit weg am Handy
    } else {
        camera.position.set(0, 1.4, 8.0);  // Normal am Desktop
    }
    camera.lookAt(0, 0.5, 0);

    // 3. RENDERER
    renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true; // Echte Schatten!
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 4. LICHT (Physisch)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2); 
    scene.add(ambientLight);

    // Deckenlicht (Sonne)
    const topLight = new THREE.DirectionalLight(0xffffff, 1.0);
    topLight.position.set(0, 10, 0);
    topLight.castShadow = true;
    topLight.shadow.mapSize.width = 2048;
    topLight.shadow.mapSize.height = 2048;
    scene.add(topLight);

    // Front-Licht (Damit der Grill nicht schwarz ist)
    const frontLight = new THREE.DirectionalLight(0xffffff, 0.5);
    frontLight.position.set(0, 1, 10);
    scene.add(frontLight);

    // 5. DER RAUM (ARCHITEKTUR)
    
    // Materialien
    const floorMat = new THREE.MeshStandardMaterial({ 
        color: 0x111111, // Dunkelgrau
        roughness: 0.1,  // Poliert (spiegelt leicht)
        metalness: 0.1   // Kein Metall, eher Stein/Lack
    });

    const wallMat = new THREE.MeshStandardMaterial({ 
        color: 0x050505, // Fast Schwarz
        roughness: 0.9,  // Matte Wände
        side: THREE.DoubleSide
    });

    const lightStripMat = new THREE.MeshBasicMaterial({ color: 0xffffff }); // Leuchtend Weiß

    // Maße
    const tWidth = 6.0;  // Breite des Tunnels
    const tHeight = 4.0; // Höhe
    const tLen = 40.0;   // Länge

    // A. BODEN (Massive Platte)
    const floorGeo = new THREE.PlaneGeometry(tWidth + 2, tLen);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0; 
    floor.receiveShadow = true;
    scene.add(floor);

    // B. WÄNDE (Links & Rechts) - Massiv
    const wallGeo = new THREE.PlaneGeometry(tLen, tHeight);
    
    const leftWall = new THREE.Mesh(wallGeo, wallMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-tWidth/2, tHeight/2, 0);
    leftWall.receiveShadow = true;
    scene.add(leftWall);

    const rightWall = new THREE.Mesh(wallGeo, wallMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(tWidth/2, tHeight/2, 0);
    rightWall.receiveShadow = true;
    scene.add(rightWall);

    // C. DECKE
    const ceilGeo = new THREE.PlaneGeometry(tWidth + 2, tLen);
    const ceiling = new THREE.Mesh(ceilGeo, wallMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = tHeight;
    scene.add(ceiling);

    // D. LICHT-RAHMEN (Physische Geometrie)
    // Wir bauen echte Balken, keine Linien
    const numFrames = 12;
    const spacing = 3.0;
    const stripThick = 0.2; // Dicke der Lichtbalken

    for(let i=0; i<numFrames; i++) {
        const z = 8 - (i * spacing); // Startet vor dem Auto, geht nach hinten

        // Decken-Licht
        const beamGeo = new THREE.BoxGeometry(tWidth, 0.1, stripThick);
        const beam = new THREE.Mesh(beamGeo, lightStripMat);
        beam.position.set(0, tHeight - 0.05, z);
        scene.add(beam);

        // Linke Säule (Licht)
        const colGeo = new THREE.BoxGeometry(0.1, tHeight, stripThick);
        const colL = new THREE.Mesh(colGeo, lightStripMat);
        colL.position.set(-tWidth/2 + 0.05, tHeight/2, z);
        scene.add(colL);

        // Rechte Säule (Licht)
        const colR = new THREE.Mesh(colGeo, lightStripMat);
        colR.position.set(tWidth/2 - 0.05, tHeight/2, z);
        scene.add(colR);
    }

    // 6. INTERACTION & SCROLL LOCK
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
        e.preventDefault(); 
        isDragging = true; 
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

    // 7. CAR LOAD
    const loader = new GLTFLoader();
    loader.load('car.glb', (gltf) => {
        carModel = gltf.scene;
        
        const box = new THREE.Box3().setFromObject(carModel);
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(box.getSize(new THREE.Vector3()).x, box.getSize(new THREE.Vector3()).y, box.getSize(new THREE.Vector3()).z);
        
        const scale = 3.5 / maxDim; // Etwas kleiner, damit Platz im Raum ist
        carModel.scale.set(scale, scale, scale);
        
        carModel.position.x = -center.x * scale;
        carModel.position.y = -box.min.y * scale + 0.01; // Auf den Boden
        carModel.position.z = -center.z * scale;

        carModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                if(child.material) {
                    child.material.envMapIntensity = 2.0; 
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
            
            // Kamera-Zoom Logic für Mobile
            if(newAspect < 1.0) {
                camera.position.z = 13.0; // Weiter weg
            } else {
                camera.position.z = 8.0; // Normal
            }
        }
    });
    resizeObserver.observe(container);
}

window.startGarage3D = init3D;
window.hideGarage3D = function() {}; 
window.showGarage3D = function() {};

setTimeout(init3D, 200);
