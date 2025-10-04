import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// Scene & Camera
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xaaaaaa);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(0, 2, 6);

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.8));
const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
dirLight.position.set(5,10,7);
dirLight.castShadow = true;
scene.add(dirLight);

// OrbitControls for zoom/pan/rotate
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
controls.screenSpacePanning = false;
controls.minDistance = 1;
controls.maxDistance = 50;
controls.maxPolarAngle = Math.PI / 2;

// Room
const roomGroup = new THREE.Group();
scene.add(roomGroup);

const loader = new OBJLoader();
loader.load('/RoomObj.obj', (obj) => {
    const box = new THREE.Box3().setFromObject(obj);
    const center = box.getCenter(new THREE.Vector3());
    obj.position.sub(center);
    const size = box.getSize(new THREE.Vector3()).length();
    if(size>100) obj.scale.setScalar(0.1);

    // Gradient color effect
    obj.traverse((child) => {
        if(child.isMesh){
            const geom = child.geometry;
            const colors = [];
            const color1 = new THREE.Color(0xff0000);
            const color2 = new THREE.Color(0x00ff00);
            const color3 = new THREE.Color(0x0000ff);
            const color4 = new THREE.Color(0xffff00);

            for (let i=0; i<geom.attributes.position.count; i++){
                const t = i / geom.attributes.position.count;
                const color = new THREE.Color();
                color.lerpColors(color1, color2, t);
                color.lerp(color3, t*0.5);
                color.lerp(color4, t*0.25);
                colors.push(color.r, color.g, color.b);
            }

            geom.setAttribute('color', new THREE.Float32BufferAttribute(colors,3));

            child.material = new THREE.MeshStandardMaterial({
                vertexColors: true,
                roughness: 0.5,
                metalness: 0.0
            });
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    roomGroup.add(obj);
});

// UI Elements
const camPosEl = document.getElementById('camera-pos');
const camRotEl = document.getElementById('camera-rot');
document.getElementById('reset-camera').addEventListener('click', ()=>{
    camera.position.set(0,2,6);
    yaw = 0;
    controls.target.set(0,0,0);
    controls.update();
});

// Hand-held room rotation
let isDragging = false;
let prevX = 0;
renderer.domElement.addEventListener('mousedown', (e)=>{ isDragging=true; prevX=e.clientX; });
renderer.domElement.addEventListener('mouseup', ()=>{ isDragging=false; });
renderer.domElement.addEventListener('mousemove', (e)=>{
    if(!isDragging) return;
    const deltaX = e.clientX - prevX;
    prevX = e.clientX;
    roomGroup.rotation.y += deltaX * 0.01;
});

// WASD / Arrow movement
const move = {forward:false, backward:false, left:false, right:false, up:false, down:false, rotLeft:false, rotRight:false};
document.addEventListener('keydown', (e)=>{
    switch(e.code){
        case 'KeyW': move.forward=true; break;
        case 'KeyS': move.backward=true; break;
        case 'KeyA': move.left=true; break;
        case 'KeyD': move.right=true; break;
        case 'ArrowUp': move.up=true; break;
        case 'ArrowDown': move.down=true; break;
        case 'ArrowLeft': move.rotLeft=true; break;
        case 'ArrowRight': move.rotRight=true; break;
    }
});
document.addEventListener('keyup', (e)=>{
    switch(e.code){
        case 'KeyW': move.forward=false; break;
        case 'KeyS': move.backward=false; break;
        case 'KeyA': move.left=false; break;
        case 'KeyD': move.right=false; break;
        case 'ArrowUp': move.up=false; break;
        case 'ArrowDown': move.down=false; break;
        case 'ArrowLeft': move.rotLeft=false; break;
        case 'ArrowRight': move.rotRight=false; break;
    }
});

// Quaternion-based yaw rotation
let yaw = 0;

// Animate
const clock = new THREE.Clock();
function animate(){
    const delta = clock.getDelta();
    const speed = 5;
    const rotSpeed = 2.0; // radians/sec

    // Update yaw for Left/Right arrow
    if(move.rotLeft) yaw += rotSpeed * delta;
    if(move.rotRight) yaw -= rotSpeed * delta;

    // Apply quaternion rotation
    const quat = new THREE.Quaternion();
    quat.setFromEuler(new THREE.Euler(0, yaw, 0, 'YXZ'));
    camera.quaternion.copy(quat);

    // Movement vector relative to camera
    const direction = new THREE.Vector3();
    if(move.forward) direction.z -= 1;
    if(move.backward) direction.z += 1;
    if(move.left) direction.x -= 1;
    if(move.right) direction.x += 1;
    direction.normalize();

    if(direction.length()>0){
        const moveVec = new THREE.Vector3();
        camera.getWorldDirection(moveVec);
        moveVec.y = 0;
        moveVec.normalize();
        const right = new THREE.Vector3().crossVectors(camera.up, moveVec).normalize();
        camera.position.addScaledVector(moveVec, direction.z*speed*delta);
        camera.position.addScaledVector(right, direction.x*speed*delta);
    }

    // Vertical movement
    if(move.up) camera.position.y += speed*delta;
    if(move.down) camera.position.y -= speed*delta;

    // Update controls target to camera view direction
    controls.target.copy(camera.position.clone().add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(5)));
    controls.update();

    // Update UI
    camPosEl.innerText = `x:${camera.position.x.toFixed(2)} y:${camera.position.y.toFixed(2)} z:${camera.position.z.toFixed(2)}`;
    camRotEl.innerText = `rotY:${yaw.toFixed(2)}`;

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
}

animate();

// Resize
window.addEventListener('resize', ()=>{
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
