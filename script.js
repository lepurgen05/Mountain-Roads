"use strict";

/* =========================================================
   MOUNTAIN ROADS
   Original browser driving game
   Three.js + HTML/CSS/JavaScript
   ========================================================= */

let THREE = null;

/* =========================================================
   GAME STATE
   ========================================================= */

const GAME = {
    running: false,
    paused: false,

    speed: 0,
    maxSpeed: 110,

    distance: 0,
    score: 0,

    fuel: 100,
    condition: 100,

    steering: 0,

    timeOfDay: 8.0,
    weather: "Clear",
    location: "Mountain Pass",

    cameraMode: 0,
    roadOffset: 0,

    trafficEnabled: true,
    dayNightEnabled: true,
    weatherEnabled: true,
    cameraShake: true,

    quality: "high",

    masterVolume: 70,
    musicVolume: 50,
    engineVolume: 70
};

/* =========================================================
   THREE OBJECTS
   ========================================================= */

let scene = null;
let camera = null;
let renderer = null;

let sunLight = null;
let moonLight = null;
let ambientLight = null;

let playerCar = null;
let roadGroup = null;
let worldGroup = null;
let trafficGroup = null;
let mountainGroup = null;
let treeGroup = null;
let villageGroup = null;
let riverGroup = null;

let roadSegments = [];
let trafficCars = [];

let lastFrameTime = 0;
let animationFrame = 0;

let roadCurve = 0;
let roadCurveTarget = 0;

let engineRunning = false;

/* =========================================================
   HELPERS
   ========================================================= */

const $ = id => document.getElementById(id);

function on(id, event, handler) {
    const element = $(id);

    if (element) {
        element.addEventListener(event, handler);
    }
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function random(min, max) {
    return min + Math.random() * (max - min);
}

function randomInt(min, max) {
    return Math.floor(random(min, max + 1));
}

/* =========================================================
   THREE.JS LOADING
   ========================================================= */

async function loadThree() {

    if (THREE) {
        return THREE;
    }

    try {

        const module =
            await import(
                "https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js"
            );

        THREE = module;
        window.THREE = THREE;

        return THREE;

    } catch (error) {

        console.error("Three.js failed to load:", error);

        showError(
            "Three.js could not be loaded. Please make sure you are opening the game through a web server such as Netlify, Cloudflare Pages, or localhost."
        );

        throw error;
    }
}

/* =========================================================
   ERROR SCREEN
   ========================================================= */

function showError(message) {

    console.error(message);

    const errorScreen = $("error-screen");
    const errorText = $("error-text");

    if (errorText) {
        errorText.textContent = message;
    }

    if (errorScreen) {
        errorScreen.classList.add("active");
    }
}

/* =========================================================
   INITIALIZE THREE
   ========================================================= */

function initializeThree() {

    console.log("Initializing Mountain Roads 3D engine...");

    const container =
        $("canvas-container") ||
        $("game-container");

    if (!container) {
        throw new Error(
            "Canvas container was not found."
        );
    }

    /* -----------------------------------------------------
       Scene
       ----------------------------------------------------- */

    scene = new THREE.Scene();

    scene.background =
        new THREE.Color(0x87b8e6);

    scene.fog =
        new THREE.Fog(
            0x87b8e6,
            80,
            650
        );

    /* -----------------------------------------------------
       Camera
       ----------------------------------------------------- */

    camera =
        new THREE.PerspectiveCamera(
            65,
            1,
            0.1,
            1500
        );

    camera.position.set(
        0,
        5,
        12
    );

    camera.lookAt(
        0,
        2,
        -35
    );

    /* -----------------------------------------------------
       Renderer
       ----------------------------------------------------- */

    renderer =
        new THREE.WebGLRenderer({
            antialias: GAME.quality !== "low",
            alpha: false,
            powerPreference: "high-performance"
        });

    renderer.setPixelRatio(
        Math.min(window.devicePixelRatio || 1, 2)
    );

    renderer.setSize(
        Math.max(container.clientWidth, 1),
        Math.max(container.clientHeight, 1),
        false
    );

    renderer.outputColorSpace =
        THREE.SRGBColorSpace;

    renderer.shadowMap.enabled =
        GAME.quality !== "low";

    renderer.shadowMap.type =
        THREE.PCFSoftShadowMap;

    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";

    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    /* -----------------------------------------------------
       Lights
       ----------------------------------------------------- */

    ambientLight =
        new THREE.HemisphereLight(
            0xbfdcff,
            0x35412e,
            1.8
        );

    scene.add(ambientLight);

    sunLight =
        new THREE.DirectionalLight(
            0xfff0cf,
            2.4
        );

    sunLight.position.set(
        100,
        180,
        80
    );

    sunLight.castShadow =
        GAME.quality !== "low";

    if (sunLight.shadow) {

        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;

        sunLight.shadow.camera.near = 1;
        sunLight.shadow.camera.far = 500;

        sunLight.shadow.camera.left = -200;
        sunLight.shadow.camera.right = 200;
        sunLight.shadow.camera.top = 200;
        sunLight.shadow.camera.bottom = -200;
    }

    scene.add(sunLight);

    moonLight =
        new THREE.DirectionalLight(
            0x7394d8,
            0.25
        );

    moonLight.position.set(
        -100,
        100,
        -100
    );

    scene.add(moonLight);

    /* -----------------------------------------------------
       World
       ----------------------------------------------------- */

    worldGroup =
        new THREE.Group();

    scene.add(worldGroup);

    createSky();
    createGround();
    createRoad();
    createMountains();
    createForest();
    createVillages();
    createRiver();
    createPlayerCar();
    createTraffic();

    /* -----------------------------------------------------
       Resize
       ----------------------------------------------------- */

    window.addEventListener(
        "resize",
        resizeRenderer
    );

    resizeRenderer();

    /* -----------------------------------------------------
       Initial render
       ----------------------------------------------------- */

    renderer.render(
        scene,
        camera
    );

    console.log(
        "Mountain Roads 3D engine initialized."
    );
}

/* =========================================================
   RESIZE
   ========================================================= */

function resizeRenderer() {

    if (!renderer || !camera) {
        return;
    }

    const container =
        $("canvas-container") ||
        $("game-container");

    if (!container) {
        return;
    }

    const width =
        Math.max(
            container.clientWidth || window.innerWidth,
            1
        );

    const height =
        Math.max(
            container.clientHeight || window.innerHeight,
            1
        );

    camera.aspect =
        width / height;

    camera.updateProjectionMatrix();

    renderer.setSize(
        width,
        height,
        false
    );
}

/* =========================================================
   SKY
   ========================================================= */

function createSky() {

    const skyGeometry =
        new THREE.SphereGeometry(
            900,
            32,
            16
        );

    const skyMaterial =
        new THREE.MeshBasicMaterial({
            color: 0x78a9d8,
            side: THREE.BackSide
        });

    const sky =
        new THREE.Mesh(
            skyGeometry,
            skyMaterial
        );

    sky.name = "Sky";

    worldGroup.add(sky);
}

/* =========================================================
   GROUND
   ========================================================= */

function createGround() {

    const geometry =
        new THREE.PlaneGeometry(
            1800,
            1800,
            40,
            40
        );

    const material =
        new THREE.MeshStandardMaterial({
            color: 0x526943,
            roughness: 1
        });

    const ground =
        new THREE.Mesh(
            geometry,
            material
        );

    ground.rotation.x =
        -Math.PI / 2;

    ground.position.y = -0.3;

    ground.receiveShadow = true;

    worldGroup.add(ground);
}

/* =========================================================
   ROAD
   ========================================================= */

function createRoad() {

    roadGroup =
        new THREE.Group();

    worldGroup.add(
        roadGroup
    );

    roadSegments = [];

    const roadMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x292b2d,
            roughness: 0.95
        });

    const edgeMaterial =
        new THREE.MeshStandardMaterial({
            color: 0xe9e4c7,
            roughness: 0.7
        });

    const centerMaterial =
        new THREE.MeshStandardMaterial({
            color: 0xf1d55c,
            roughness: 0.7
        });

    for (
        let i = 0;
        i < 90;
        i++
    ) {

        const z =
            -i * 10;

        const curve =
            Math.sin(i * 0.11) * 8 +
            Math.sin(i * 0.037) * 15;

        const road =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    15,
                    0.35,
                    10.5
                ),
                roadMaterial
            );

        road.position.set(
            curve,
            0,
            z
        );

        road.receiveShadow = true;

        roadGroup.add(road);

        /* Edge lines */

        const leftEdge =
            new THREE.Mesh(
                new THREE.BoxGeometry(
                    0.22,
                    0.04,
                    9.5
                ),
                edgeMaterial
            );

        leftEdge.position.set(
            curve - 6.9,
            0.21,
            z
        );

        roadGroup.add(leftEdge);

        const rightEdge =
            leftEdge.clone();

        rightEdge.position.x =
            curve + 6.9;

        roadGroup.add(rightEdge);

        /* Center line */

        if (i % 2 === 0) {

            const center =
                new THREE.Mesh(
                    new THREE.BoxGeometry(
                        0.22,
                        0.045,
                        5.0
                    ),
                    centerMaterial
                );

            center.position.set(
                curve,
                0.23,
                z
            );

            roadGroup.add(center);
        }

        roadSegments.push({
            mesh: road,
            z,
            curve
        });
    }
}

/* =========================================================
   MOUNTAINS
   ========================================================= */

function createMountains() {

    mountainGroup =
        new THREE.Group();

    worldGroup.add(
        mountainGroup
    );

    const colors = [
        0x465a48,
        0x3d5142,
        0x56654b,
        0x35483e,
        0x637057
    ];

    for (
        let i = 0;
        i < 42;
        i++
    ) {

        const side =
            i % 2 === 0
                ? -1
                : 1;

        const distance =
            random(
                80,
                190
            );

        const geometry =
            new THREE.ConeGeometry(
                random(25, 65),
                random(70, 170),
                7
            );

        const material =
            new THREE.MeshStandardMaterial({
                color:
                    colors[
                        randomInt(
                            0,
                            colors.length - 1
                        )
                    ],
                roughness: 1
            });

        const mountain =
            new THREE.Mesh(
                geometry,
                material
            );

        mountain.position.set(
            side * distance,
            random(30, 60),
            random(-500, 50)
        );

        mountain.rotation.y =
            random(0, Math.PI);

        mountain.castShadow = true;
        mountain.receiveShadow = true;

        mountainGroup.add(
            mountain
        );
    }
}

/* =========================================================
   TREES / FOREST
   ========================================================= */

function createForest() {

    treeGroup =
        new THREE.Group();

    worldGroup.add(
        treeGroup
    );

    for (
        let i = 0;
        i < 150;
        i++
    ) {

        const side =
            Math.random() < 0.5
                ? -1
                : 1;

        const x =
            side *
            random(
                18,
                85
            );

        const z =
            random(
                -700,
                40
            );

        createTree(
            x,
            z,
            random(
                0.8,
                1.8
            )
        );
    }
}

function createTree(
    x,
    z,
    scale = 1
) {

    const tree =
        new THREE.Group();

    /* Trunk */

    const trunk =
        new THREE.Mesh(
            new THREE.CylinderGeometry(
                0.25 * scale,
                0.4 * scale,
                3 * scale,
                6
            ),
            new THREE.MeshStandardMaterial({
                color: 0x654832
            })
        );

    trunk.position.y =
        1.5 * scale;

    trunk.castShadow = true;

    tree.add(trunk);

    /* Leaves */

    const leaves =
        new THREE.Mesh(
            new THREE.ConeGeometry(
                2.1 * scale,
                5.5 * scale,
                8
            ),
            new THREE.MeshStandardMaterial({
                color: 0x31563a,
                roughness: 1
            })
        );

    leaves.position.y =
        5 * scale;

    leaves.castShadow = true;

    tree.add(leaves);

    tree.position.set(
        x,
        0,
        z
    );

    treeGroup.add(
        tree
    );
}

/* =========================================================
   VILLAGES
   ========================================================= */

function createVillages() {

    villageGroup =
        new THREE.Group();

    worldGroup.add(
        villageGroup
    );

    for (
        let i = 0;
        i < 8;
        i++
    ) {

        const side =
            i % 2 === 0
                ? -1
                : 1;

        const baseZ =
            -80 -
            i * 85;

        for (
            let h = 0;
            h < randomInt(3, 6);
            h++
        ) {

            createHouse(
                side *
                random(
                    28,
                    60
                ),
                baseZ +
                random(
                    -18,
                    18
                )
            );
        }
    }
}

function createHouse(
    x,
    z
) {

    const house =
        new THREE.Group();

    const body =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                5,
                3.5,
                5
            ),
            new THREE.MeshStandardMaterial({
                color:
                    Math.random() > 0.5
                        ? 0xb78b62
                        : 0x9e7659
            })
        );

    body.position.y =
        1.75;

    body.castShadow = true;

    house.add(body);

    const roof =
        new THREE.Mesh(
            new THREE.ConeGeometry(
                4.2,
                2.5,
                4
            ),
            new THREE.MeshStandardMaterial({
                color: 0x4b3028
            })
        );

    roof.rotation.y =
        Math.PI / 4;

    roof.position.y =
        4.5;

    roof.castShadow = true;

    house.add(roof);

    house.position.set(
        x,
        0,
        z
    );

    villageGroup.add(
        house
    );
}

/* =========================================================
   RIVER
   ========================================================= */

function createRiver() {

    riverGroup =
        new THREE.Group();

    worldGroup.add(
        riverGroup
    );

    const waterMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x2d7da3,
            transparent: true,
            opacity: 0.78,
            roughness: 0.15,
            metalness: 0.1
        });

    for (
        let i = 0;
        i < 35;
        i++
    ) {

        const water =
            new THREE.Mesh(
                new THREE.PlaneGeometry(
                    10,
                    25
                ),
                waterMaterial
            );

        water.rotation.x =
            -Math.PI / 2;

        water.position.set(
            45 +
            Math.sin(i * 0.4) * 8,
            -0.05,
            -i * 20
        );

        riverGroup.add(
            water
        );
    }
}

/* =========================================================
   PLAYER CAR
   ========================================================= */

function createPlayerCar() {

    playerCar =
        new THREE.Group();

    /* Body */

    const body =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                3.2,
                1.1,
                5.2
            ),
            new THREE.MeshStandardMaterial({
                color: 0xc62828,
                roughness: 0.55,
                metalness: 0.15
            })
        );

    body.position.y =
        1.05;

    body.castShadow = true;

    playerCar.add(body);

    /* Cabin */

    const cabin =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                2.45,
                1.25,
                2.6
            ),
            new THREE.MeshStandardMaterial({
                color: 0x263746,
                roughness: 0.3,
                metalness: 0.1
            })
        );

    cabin.position.set(
        0,
        1.95,
        -0.25
    );

    cabin.castShadow = true;

    playerCar.add(cabin);

    /* Front bumper */

    const bumper =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                3.25,
                0.35,
                0.3
            ),
            new THREE.MeshStandardMaterial({
                color: 0x171717
            })
        );

    bumper.position.set(
        0,
        0.75,
        -2.7
    );

    playerCar.add(
        bumper
    );

    /* Wheels */

    const wheelMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.9
        });

    const wheelPositions = [
        [-1.55, 0.55, -1.65],
        [1.55, 0.55, -1.65],
        [-1.55, 0.55, 1.65],
        [1.55, 0.55, 1.65]
    ];

    wheelPositions.forEach(
        position => {

            const wheel =
                new THREE.Mesh(
                    new THREE.CylinderGeometry(
                        0.65,
                        0.65,
                        0.45,
                        16
                    ),
                    wheelMaterial
                );

            wheel.rotation.z =
                Math.PI / 2;

            wheel.position.set(
                position[0],
                position[1],
                position[2]
            );

            wheel.castShadow = true;

            playerCar.add(
                wheel
            );
        }
    );

    /* Headlights */

    const headlightMaterial =
        new THREE.MeshStandardMaterial({
            color: 0xfff4c2,
            emissive: 0xffeeb0,
            emissiveIntensity: 2
        });

    const leftLight =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                0.55,
                0.25,
                0.1
            ),
            headlightMaterial
        );

    leftLight.position.set(
        -0.9,
        1.15,
        -2.67
    );

    playerCar.add(
        leftLight
    );

    const rightLight =
        leftLight.clone();

    rightLight.position.x =
        0.9;

    playerCar.add(
        rightLight
    );

    playerCar.position.set(
        0,
        0.2,
        5
    );

    scene.add(
        playerCar
    );
}

/* =========================================================
   TRAFFIC
   ========================================================= */

function createTraffic() {

    trafficGroup =
        new THREE.Group();

    worldGroup.add(
        trafficGroup
    );

    trafficCars = [];

    for (
        let i = 0;
        i < 12;
        i++
    ) {

        const car =
            createTrafficCar();

        car.position.set(
            random(
                -4,
                4
            ),
            0.2,
            -50 -
            i * random(
                35,
                65
            )
        );

        trafficGroup.add(
            car
        );

        trafficCars.push({
            mesh: car,
            speed: random(
                25,
                60
            )
        });
    }
}

function createTrafficCar() {

    const car =
        new THREE.Group();

    const colors = [
        0x2e5da8,
        0xd68a27,
        0xeeeeee,
        0x3c7d4c,
        0x7d3e9b,
        0x555555
    ];

    const body =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                2.8,
                1,
                4.6
            ),
            new THREE.MeshStandardMaterial({
                color:
                    colors[
                        randomInt(
                            0,
                            colors.length - 1
                        )
                    ]
            })
        );

    body.position.y =
        1;

    body.castShadow = true;

    car.add(body);

    const cabin =
        new THREE.Mesh(
            new THREE.BoxGeometry(
                2.2,
                1,
                2.2
            ),
            new THREE.MeshStandardMaterial({
                color: 0x253342
            })
        );

    cabin.position.set(
        0,
        1.8,
        0
    );

    car.add(cabin);

    return car;
}

/* =========================================================
   GAME START
   ========================================================= */

function startGame() {

    if (!renderer) {
        console.error(
            "Renderer has not initialized."
        );
        return;
    }

    GAME.running = true;
    GAME.paused = false;

    GAME.speed = 0;
    GAME.distance = 0;
    GAME.score = 0;
    GAME.fuel = 100;
    GAME.condition = 100;

    GAME.timeOfDay = 8;

    lastFrameTime =
        performance.now();

    hideAllScreens();

    const gameScreen =
        $("game-screen");

    if (gameScreen) {
        gameScreen.classList.add(
            "active"
        );
    }

    engineRunning = true;

    updateHUD();

    cancelAnimationFrame(
        animationFrame
    );

    animationFrame =
        requestAnimationFrame(
            gameLoop
        );
}

/* =========================================================
   GAME LOOP
   ========================================================= */

function gameLoop(timestamp) {

    if (!GAME.running) {
        return;
    }

    animationFrame =
        requestAnimationFrame(
            gameLoop
        );

    if (!lastFrameTime) {
        lastFrameTime = timestamp;
    }

    let delta =
        (timestamp -
            lastFrameTime) /
        1000;

    lastFrameTime =
        timestamp;

    delta =
        clamp(
            delta,
            0,
            0.05
        );

    if (GAME.paused) {

        renderScene();

        return;
    }

    updateDriving(
        delta
    );

    updateRoad(
        delta
    );

    updateTraffic(
        delta
    );

    updateDayNight(
        delta
    );

    updateWeather(
        delta
    );

    updateCamera(
        delta
    );

    updateHUD();

    renderScene();
}

/* =========================================================
   RENDER
   ========================================================= */

function renderScene() {

    if (
        renderer &&
        scene &&
        camera
    ) {

        renderer.render(
            scene,
            camera
        );
    }
}

/* =========================================================
   DRIVING
   ========================================================= */

const keys = {
    forward: false,
    backward: false,
    left: false,
    right: false
};

function updateDriving(delta) {

    let acceleration = 0;

    if (keys.forward) {
        acceleration += 38;
    }

    if (keys.backward) {
        acceleration -= 45;
    }

    if (!keys.forward &&
        !keys.backward) {

        acceleration -=
            GAME.speed *
            0.65;
    }

    GAME.speed +=
        acceleration *
        delta;

    GAME.speed =
        clamp(
            GAME.speed,
            0,
            GAME.maxSpeed
        );

    let steeringTarget = 0;

    if (keys.left) {
        steeringTarget = -1;
    }

    if (keys.right) {
        steeringTarget = 1;
    }

    GAME.steering =
        lerp(
            GAME.steering,
            steeringTarget,
            delta * 7
        );

    /* Steering */

    if (playerCar) {

        playerCar.position.x +=
            GAME.steering *
            GAME.speed *
            0.018 *
            delta;

        playerCar.position.x =
            clamp(
                playerCar.position.x,
                -5,
                5
            );

        playerCar.rotation.y =
            -GAME.steering *
            0.16;
    }

    /* Fuel */

    if (GAME.speed > 2) {

        GAME.fuel -=
            delta *
            (
                0.015 +
                GAME.speed /
                9000
            );
    }

    GAME.fuel =
        clamp(
            GAME.fuel,
            0,
            100
        );

    if (GAME.fuel <= 0) {

        GAME.speed =
            Math.max(
                0,
                GAME.speed -
                20 *
                delta
            );
    }

    /* Distance */

    GAME.distance +=
        GAME.speed *
        delta /
        3.6;

    GAME.score =
        Math.floor(
            GAME.distance * 2 +
            GAME.speed
        );

    /* Condition */

    if (
        Math.abs(
            playerCar?.position.x || 0
        ) > 4.7 &&
        GAME.speed > 35
    ) {

        GAME.condition -=
            delta * 0.8;
    }

    GAME.condition =
        clamp(
            GAME.condition,
            0,
            100
        );

    if (GAME.condition <= 0) {
        endGame();
    }
}

/* =========================================================
   ROAD MOVEMENT
   ========================================================= */

function updateRoad(delta) {

    if (!roadGroup) {
        return;
    }

    const movement =
        GAME.speed *
        delta *
        0.28;

    roadSegments.forEach(
        segment => {

            segment.mesh.position.z +=
                movement;

            if (
                segment.mesh.position.z >
                30
            ) {

                segment.mesh.position.z -=
                    900;
            }
        }
    );

    roadGroup.children.forEach(
        child => {

            if (
                child !== undefined
            ) {
                child.position.z +=
                    movement;
            }

            if (
                child.position.z >
                30
            ) {
                child.position.z -=
                    900;
            }
        }
    );

    roadCurveTarget =
        Math.sin(
            GAME.distance *
            0.008
        ) * 0.8;

    roadCurve =
        lerp(
            roadCurve,
            roadCurveTarget,
            delta
        );
}

/* =========================================================
   TRAFFIC MOVEMENT
   ========================================================= */

function updateTraffic(delta) {

    if (
        !GAME.trafficEnabled ||
        !trafficGroup
    ) {
        return;
    }

    trafficCars.forEach(
        traffic => {

            traffic.mesh.position.z +=
                (
                    GAME.speed -
                    traffic.speed
                ) *
                delta *
                0.28;

            if (
                traffic.mesh.position.z >
                20
            ) {

                traffic.mesh.position.z =
                    random(
                        -650,
                        -300
                    );

                traffic.mesh.position.x =
                    random(
                        -4,
                        4
                    );
            }

            if (
                playerCar &&
                traffic.mesh.position.distanceTo(
                    playerCar.position
                ) < 3
            ) {

                GAME.condition -=
                    delta * 30;
            }
        }
    );
}

/* =========================================================
   DAY / NIGHT
   ========================================================= */

function updateDayNight(delta) {

    if (
        !GAME.dayNightEnabled
    ) {
        return;
    }

    GAME.timeOfDay +=
        delta *
        0.02;

    if (
        GAME.timeOfDay >= 24
    ) {
        GAME.timeOfDay = 0;
    }

    const t =
        GAME.timeOfDay;

    let daylight = 1;

    if (t < 5) {
        daylight = 0.15;
    } else if (t < 7) {
        daylight =
            lerp(
                0.15,
                0.8,
                (t - 5) / 2
            );
    } else if (t < 17) {
        daylight = 1;
    } else if (t < 20) {
        daylight =
            lerp(
                1,
                0.2,
                (t - 17) / 3
            );
    } else {
        daylight = 0.12;
    }

    if (sunLight) {

        sunLight.intensity =
            0.4 +
            daylight * 2.2;
    }

    if (ambientLight) {

        ambientLight.intensity =
            0.25 +
            daylight * 1.55;
    }

    if (moonLight) {

        moonLight.intensity =
            0.08 +
            (1 - daylight) *
            0.4;
    }

    if (scene) {

        const dayColor =
            new THREE.Color(
                0x79aee0
            );

        const nightColor =
            new THREE.Color(
                0x071326
            );

        scene.background =
            nightColor.clone().lerp(
                dayColor,
                daylight
            );

        scene.fog.color =
            scene.background;
    }
}

/* =========================================================
   WEATHER
   ========================================================= */

function updateWeather(delta) {

    if (!GAME.weatherEnabled) {
        return;
    }

    /*
       Weather changes occasionally.
       Kept intentionally gentle so the
       driving experience remains playable.
    */

    if (
        Math.random() <
        delta * 0.001
    ) {

        const weatherTypes = [
            "Clear",
            "Clear",
            "Clear",
            "Fog",
            "Rain"
        ];

        GAME.weather =
            weatherTypes[
                randomInt(
                    0,
                    weatherTypes.length - 1
                )
            ];
    }

    updateWeatherVisuals();
}

function updateWeatherVisuals() {

    if (!scene) {
        return;
    }

    if (
        GAME.weather === "Fog"
    ) {

        scene.fog.near = 30;
        scene.fog.far = 220;

    } else if (
        GAME.weather === "Rain"
    ) {

        scene.fog.near = 45;
        scene.fog.far = 350;

    } else {

        scene.fog.near = 80;
        scene.fog.far = 650;
    }
}

/* =========================================================
   CAMERA
   ========================================================= */

function updateCamera(delta) {

    if (
        !camera ||
        !playerCar
    ) {
        return;
    }

    let targetPosition;

    if (
        GAME.cameraMode === 0
    ) {

        targetPosition =
            new THREE.Vector3(
                playerCar.position.x,
                5.2,
                12
            );

    } else if (
        GAME.cameraMode === 1
    ) {

        targetPosition =
            new THREE.Vector3(
                playerCar.position.x,
                9,
                17
            );

    } else {

        targetPosition =
            new THREE.Vector3(
                playerCar.position.x,
                2.4,
                7
            );
    }

    camera.position.lerp(
        targetPosition,
        delta * 5
    );

    const lookTarget =
        new THREE.Vector3(
            playerCar.position.x,
            1.8,
            -35
        );

    camera.lookAt(
        lookTarget
    );

    if (
        GAME.cameraShake &&
        GAME.speed > 70
    ) {

        camera.position.y +=
            Math.sin(
                performance.now() *
                0.025
            ) *
            0.025;
    }
}

/* =========================================================
   HUD
   ========================================================= */

function updateHUD() {

    setText(
        "speed-value",
        Math.round(
            GAME.speed
        )
    );

    setText(
        "distance-value",
        GAME.distance.toFixed(1)
    );

    setText(
        "fuel-value",
        Math.round(
            GAME.fuel
        ) + "%"
    );

    setText(
        "condition-value",
        Math.round(
            GAME.condition
        ) + "%"
    );

    setText(
        "weather-value",
        GAME.weather
    );

    setText(
        "location-value",
        GAME.location
    );

    setText(
        "score-value",
        GAME.score.toString()
    );

    setText(
        "time-value",
        formatTime(
            GAME.timeOfDay
        )
    );

    const fuelBar =
        $("fuel-bar");

    if (fuelBar) {

        fuelBar.style.width =
            GAME.fuel + "%";
    }

    const conditionBar =
        $("condition-bar");

    if (conditionBar) {

        conditionBar.style.width =
            GAME.condition + "%";
    }

    drawMinimap();
}

function setText(
    id,
    value
) {

    const element = $(id);

    if (element) {
        element.textContent =
            value;
    }
}

function formatTime(hour) {

    const h =
        Math.floor(hour);

    const minutes =
        Math.floor(
            (hour - h) * 60
        );

    const hh =
        String(
            h
        ).padStart(
            2,
            "0"
        );

    const mm =
        String(
            minutes
        ).padStart(
            2,
            "0"
        );

    return `${hh}:${mm}`;
}

/* =========================================================
   MINIMAP
   ========================================================= */

function drawMinimap() {

    const canvas =
        $("minimap");

    if (!canvas) {
        return;
    }

    const ctx =
        canvas.getContext(
            "2d"
        );

    if (!ctx) {
        return;
    }

    const width =
        canvas.width;

    const height =
        canvas.height;

    ctx.clearRect(
        0,
        0,
        width,
        height
    );

    ctx.fillStyle =
        "#18251b";

    ctx.fillRect(
        0,
        0,
        width,
        height
    );

    /* Road */

    ctx.strokeStyle =
        "#c5b78a";

    ctx.lineWidth = 6;

    ctx.beginPath();

    for (
        let y = 0;
        y < height;
        y += 4
    ) {

        const x =
            width / 2 +
            Math.sin(
                y * 0.045 +
                GAME.distance * 0.02
            ) * 22;

        if (y === 0) {
            ctx.moveTo(
                x,
                y
            );
        } else {
            ctx.lineTo(
                x,
                y
            );
        }
    }

    ctx.stroke();

    /* Player */

    ctx.fillStyle =
        "#ff4a4a";

    ctx.beginPath();

    ctx.arc(
        width / 2,
        height - 18,
        5,
        0,
        Math.PI * 2
    );

    ctx.fill();
}

/* =========================================================
   PAUSE
   ========================================================= */

function pauseGame() {

    if (!GAME.running) {
        return;
    }

    GAME.paused = true;

    const pauseMenu =
        $("pause-menu");

    if (pauseMenu) {
        pauseMenu.classList.add(
            "active"
        );
    }
}

function resumeGame() {

    GAME.paused = false;

    const pauseMenu =
        $("pause-menu");

    if (pauseMenu) {
        pauseMenu.classList.remove(
            "active"
        );
    }

    lastFrameTime =
        performance.now();
}

function quitGame() {

    GAME.running = false;
    GAME.paused = false;

    cancelAnimationFrame(
        animationFrame
    );

    saveGame();

    hideAllScreens();

    const menu =
        $("main-menu");

    if (menu) {
        menu.classList.add(
            "active"
        );
    }
}

/* =========================================================
   GAME OVER
   ========================================================= */

function endGame() {

    GAME.running = false;

    cancelAnimationFrame(
        animationFrame
    );

    setText(
        "final-distance",
        GAME.distance.toFixed(1)
    );

    setText(
        "final-score",
        GAME.score.toString()
    );

    const gameOver =
        $("game-over");

    if (gameOver) {
        gameOver.classList.add(
            "active"
        );
    }

    saveGame();
}

/* =========================================================
   SCREEN MANAGEMENT
   ========================================================= */

function hideAllScreens() {

    const ids = [
        "main-menu",
        "game-screen",
        "pause-menu",
        "game-over",
        "settings-screen",
        "about-screen",
        "error-screen"
    ];

    ids.forEach(
        id => {

            const element = $(id);

            if (element) {

                element.classList.remove(
                    "active"
                );
            }
        }
    );
}

/* =========================================================
   SETTINGS
   ========================================================= */

function loadSettings() {

    try {

        const saved =
            localStorage.getItem(
                "mountainRoadsSettings"
            );

        if (!saved) {
            return;
        }

        const settings =
            JSON.parse(saved);

        Object.assign(
            GAME,
            settings
        );

    } catch (error) {

        console.warn(
            "Could not load settings:",
            error
        );
    }
}

function saveSettings() {

    try {

        localStorage.setItem(
            "mountainRoadsSettings",
            JSON.stringify({
                quality:
                    GAME.quality,

                trafficEnabled:
                    GAME.trafficEnabled,

                dayNightEnabled:
                    GAME.dayNightEnabled,

                weatherEnabled:
                    GAME.weatherEnabled,

                cameraShake:
                    GAME.cameraShake,

                masterVolume:
                    GAME.masterVolume,

                musicVolume:
                    GAME.musicVolume,

                engineVolume:
                    GAME.engineVolume
            })
        );

    } catch (error) {

        console.warn(
            "Could not save settings:",
            error
        );
    }
}

/* =========================================================
   GAME SAVE
   ========================================================= */

function saveGame() {

    try {

        localStorage.setItem(
            "mountainRoadsSave",
            JSON.stringify({
                distance:
                    GAME.distance,

                score:
                    GAME.score,

                fuel:
                    GAME.fuel,

                condition:
                    GAME.condition,

                timeOfDay:
                    GAME.timeOfDay,

                weather:
                    GAME.weather
            })
        );

    } catch (error) {

        console.warn(
            "Could not save game:",
            error
        );
    }
}

function continueGame() {

    try {

        const saved =
            localStorage.getItem(
                "mountainRoadsSave"
            );

        if (!saved) {

            startGame();

            return;
        }

        const data =
            JSON.parse(saved);

        GAME.distance =
            Number(
                data.distance || 0
            );

        GAME.score =
            Number(
                data.score || 0
            );

        GAME.fuel =
            Number(
                data.fuel ?? 100
            );

        GAME.condition =
            Number(
                data.condition ?? 100
            );

        GAME.timeOfDay =
            Number(
                data.timeOfDay ?? 8
            );

        GAME.weather =
            data.weather ||
            "Clear";

        startGame();

    } catch (error) {

        console.warn(
            "Could not continue saved game:",
            error
        );

        startGame();
    }
}

/* =========================================================
   KEYBOARD
   ========================================================= */

window.addEventListener(
    "keydown",
    event => {

        const key =
            event.key.toLowerCase();

        if (
            [
                "arrowup",
                "arrowdown",
                "arrowleft",
                "arrowright",
                " "
            ].includes(key)
        ) {
            event.preventDefault();
        }

        if (
            key === "w" ||
            key === "arrowup"
        ) {
            keys.forward = true;
        }

        if (
            key === "s" ||
            key === "arrowdown"
        ) {
            keys.backward = true;
        }

        if (
            key === "a" ||
            key === "arrowleft"
        ) {
            keys.left = true;
        }

        if (
            key === "d" ||
            key === "arrowright"
        ) {
            keys.right = true;
        }

        if (
            key === "p" ||
            key === "escape"
        ) {

            if (
                GAME.running &&
                !GAME.paused
            ) {
                pauseGame();
            } else if (
                GAME.running &&
                GAME.paused
            ) {
                resumeGame();
            }
        }

        if (
            key === "c"
        ) {

            GAME.cameraMode =
                (
                    GAME.cameraMode + 1
                ) % 3;
        }
    }
);

window.addEventListener(
    "keyup",
    event => {

        const key =
            event.key.toLowerCase();

        if (
            key === "w" ||
            key === "arrowup"
        ) {
            keys.forward = false;
        }

        if (
            key === "s" ||
            key === "arrowdown"
        ) {
            keys.backward = false;
        }

        if (
            key === "a" ||
            key === "arrowleft"
        ) {
            keys.left = false;
        }

        if (
            key === "d" ||
            key === "arrowright"
        ) {
            keys.right = false;
        }
    }
);

/* =========================================================
   TOUCH / MOBILE CONTROLS
   ========================================================= */

function bindHoldButton(
    id,
    keyName
) {

    const button = $(id);

    if (!button) {
        return;
    }

    const start = event => {

        event.preventDefault();

        keys[keyName] = true;
    };

    const stop = event => {

        event.preventDefault();

        keys[keyName] = false;
    };

    button.addEventListener(
        "pointerdown",
        start
    );

    button.addEventListener(
        "pointerup",
        stop
    );

    button.addEventListener(
        "pointercancel",
        stop
    );

    button.addEventListener(
        "pointerleave",
        stop
    );
}

/* =========================================================
   BUTTONS
   ========================================================= */

function bindInterface() {

    on(
        "start-game",
        "click",
        startGame
    );

    on(
        "start-journey",
        "click",
        startGame
    );

    on(
        "continue-game",
        "click",
        continueGame
    );

    on(
        "pause-button",
        "click",
        pauseGame
    );

    on(
        "resume-game",
        "click",
        resumeGame
    );

    on(
        "quit-game",
        "click",
        quitGame
    );

    on(
        "restart-game",
        "click",
        startGame
    );

    on(
        "restart",
        "click",
        startGame
    );

    on(
        "settings-button",
        "click",
        () => {

            hideAllScreens();

            const screen =
                $("settings-screen");

            if (screen) {
                screen.classList.add(
                    "active"
                );
            }
        }
    );

    on(
        "settings",
        "click",
        () => {

            hideAllScreens();

            const screen =
                $("settings-screen");

            if (screen) {
                screen.classList.add(
                    "active"
                );
            }
        }
    );

    on(
        "about-button",
        "click",
        () => {

            hideAllScreens();

            const screen =
                $("about-screen");

            if (screen) {
                screen.classList.add(
                    "active"
                );
            }
        }
    );

    on(
        "about",
        "click",
        () => {

            hideAllScreens();

            const screen =
                $("about-screen");

            if (screen) {
                screen.classList.add(
                    "active"
                );
            }
        }
    );

    on(
        "back-to-menu",
        "click",
        () => {

            hideAllScreens();

            const menu =
                $("main-menu");

            if (menu) {
                menu.classList.add(
                    "active"
                );
            }
        }
    );

    on(
        "reload-button",
        "click",
        () => {
            location.reload();
        }
    );

    /* Mobile */

    bindHoldButton(
        "mobile-up",
        "forward"
    );

    bindHoldButton(
        "mobile-down",
        "backward"
    );

    bindHoldButton(
        "mobile-left",
        "left"
    );

    bindHoldButton(
        "mobile-right",
        "right"
    );

    /* Settings */

    const quality =
        $("graphics-quality");

    if (quality) {

        quality.value =
            GAME.quality;

        quality.addEventListener(
            "change",
            event => {

                GAME.quality =
                    event.target.value;

                saveSettings();
            }
        );
    }

    bindToggle(
        "shadows-toggle",
        value => {

            if (renderer) {
                renderer.shadowMap.enabled =
                    value;
            }
        }
    );

    bindToggle(
        "weather-toggle",
        value => {

            GAME.weatherEnabled =
                value;

            saveSettings();
        }
    );

    bindToggle(
        "day-night-toggle",
        value => {

            GAME.dayNightEnabled =
                value;

            saveSettings();
        }
    );

    bindToggle(
        "traffic-toggle",
        value => {

            GAME.trafficEnabled =
                value;

            saveSettings();
        }
    );

    bindToggle(
        "camera-shake-toggle",
        value => {

            GAME.cameraShake =
                value;

            saveSettings();
        }
    );

    bindRange(
        "master-volume",
        value => {

            GAME.masterVolume =
                value;

            saveSettings();
        }
    );

    bindRange(
        "music-volume",
        value => {

            GAME.musicVolume =
                value;

            saveSettings();
        }
    );

    bindRange(
        "engine-volume",
        value => {

            GAME.engineVolume =
                value;

            saveSettings();
        }
    );
}

function bindToggle(
    id,
    callback
) {

    const element = $(id);

    if (!element) {
        return;
    }

    element.checked = true;

    element.addEventListener(
        "change",
        () => {
            callback(
                element.checked
            );
        }
    );
}

function bindRange(
    id,
    callback
) {

    const element = $(id);

    if (!element) {
        return;
    }

    element.addEventListener(
        "input",
        () => {

            callback(
                Number(
                    element.value
                )
            );
        }
    );
}

/* =========================================================
   BOOT
   ========================================================= */

async function boot() {

    console.log(
        "Mountain Roads booting..."
    );

    loadSettings();

    try {

        await loadThree();

        initializeThree();

        bindInterface();

        hideAllScreens();

        const menu =
            $("main-menu");

        if (menu) {
            menu.classList.add(
                "active"
            );
        }

        /* Loading screen */

        const loadingScreen =
            $("loading-screen");

        if (loadingScreen) {

            setTimeout(
                () => {

                    loadingScreen.classList.remove(
                        "active"
                    );

                },
                500
            );
        }

        console.log(
            "Mountain Roads ready."
        );

    } catch (error) {

        console.error(
            "Mountain Roads boot failed:",
            error
        );

        showError(
            error.message ||
            "The Mountain Roads engine could not start."
        );
    }
}

/* =========================================================
   START
   ========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        boot
    );

} else {

    boot();
}