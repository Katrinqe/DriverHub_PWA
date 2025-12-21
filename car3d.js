import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let scene, camera, renderer, carModel;
let isInitialized = false; 
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

function init3D() {
    const container = document.getElementById('hero-3d-stage');
    if (!container || container.clientWidth === 0) { requestAnimationFrame(init3D); return; }
    if (isInitialized) return;
    isInitialized = true;
    while(container.firstChild) { container.removeChild(container.firstChild); }

    // 1. SCENE
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111111); // Dunkelgrau für Tiefe

    // 2. CAMERA (Responsive)
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    const isMobile = aspect < 1.0;
    camera.position.set(0, 1.4, isMobile ? 10.0 : 7.5); 
    camera.lookAt(0, 0.5, 0);

    // 3. RENDERER
    renderer = new THREE.WebGLRenderer({ alpha: false, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // 4. LIGHTING (Neutral Studio)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    // Hauptlicht (Weiss, Schatten)
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.5);
    mainLight.position.set(5, 10, 5);
    mainLight.castShadow = true;
    scene.add(mainLight);

    // Fill von vorne
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
    fillLight.position.set(0, 1, 10);
    scene.add(fillLight);

    // Rim Light (Weiss, nicht Blau!)
    const backLight = new THREE.SpotLight(0xffffff, 3.0);
    backLight.position.set(0, 5, -5);
    backLight.lookAt(0, 0, 0);
    scene.add(backLight);

    // 5. SOLID STUDIO
    const roomWidth = 10;
    const roomHeight = 5;
    const roomLength = 25;

    // Materials
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9, metalness: 0.1, side: THREE.BackSide });
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.2 });
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    // Raum-Box
    const roomGeo = new THREE.BoxGeometry(roomWidth, roomHeight, roomLength);
    const room = new THREE.Mesh(roomGeo, wallMat);
    room.position.set(0, roomHeight / 2, -roomLength / 2 + 5);
    room.receiveShadow = true;
    scene.add(room);

    // Boden (Extra Mesh für Look)
    const floorGeo = new THREE.PlaneGeometry(roomWidth, roomLength);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.01;
    floor.receiveShadow = true;
    scene.add(floor);

    // Lichter (5 Streifen)
    const numLights = 5;
    const spacing = 4;
    for (let i = 0; i < numLights; i++) {
        const z = 2 - (i * spacing);
        const strip = new THREE.Mesh(new THREE.BoxGeometry(roomWidth - 1, 0.1, 0.4), lightMat);
        strip.position.set(0, roomHeight - 0.1, z);
        scene.add(strip);
        
        const vLeft = new THREE.Mesh(new THREE.BoxGeometry(0.1, roomHeight, 0.4), lightMat);
        vLeft.position.set(-roomWidth / 2 + 0.1, roomHeight / 2, z);
        scene.add(vLeft);
        
        const vRight = new THREE.Mesh(new THREE.BoxGeometry(0.1, roomHeight, 0.4), lightMat);
        vRight.position.set(roomWidth / 2 - 0.1, roomHeight / 2, z);
        scene.add(vRight);
    }

    // 6. INTERACTION & SCROLL BLOCK
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

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('touchstart', onTouchStart, {passive: false});
    renderer.domElement.addEventListener('touchmove', onTouchMove, {passive: false});
    renderer.domElement.addEventListener('touchend', onTouchEnd, {passive: false});

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
        carModel.position.y = -box.min.y * scale + 0.02; 
        carModel.position.z = -center.z * scale;

        carModel.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                if(child.material) {
                    child.material.envMapIntensity = 1.0;
                    child.material.roughness = 0.4;
                    child.material.metalness = 0.5;
                    child.material.needsUpdate = true;
                }
            }
        });
        scene.add(carModel);
    });

    function animate() { requestAnimationFrame(animate); renderer.render(scene, camera); }
    animate();

    const resizeObserver = new ResizeObserver(() => {
        if(container.clientWidth > 0 && container.clientHeight > 0) {
            const newAspect = container.clientWidth / container.clientHeight;
            camera.aspect = newAspect;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
            camera.position.z = (newAspect < 1.0) ? 9.5 : 7.0;
        }
    });
    resizeObserver.observe(container);
}

window.startGarage3D = init3D;
window.hideGarage3D = function() {}; 
window.showGarage3D = function() {};

setTimeout(init3D, 200);
