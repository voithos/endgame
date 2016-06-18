'use strict';

import Promise from 'promise';
import _ from 'lodash';

import cfg from './config';
import log from './log';

export default {
    init(isDebugMode) {
        this.isDebugMode = isDebugMode;
        this.hasFocus = true;
        this.isLoaded = false;
        this.movesEnabled = false;
        this.gameOver = false;
        this.isInCheck = false;
        this.side = null;
        this.activeSide = 'white';
        this.percentLoaded = 0;
        this.cameraMoveEnabled = false;
        this.cameraTween = null;
        this.isMovingCamera = false;
        this.touchStarted = false;
        this.lastTouchTime = 0;

        this.halfX = window.innerWidth / 2;
        this.halfY = window.innerHeight / 2;

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            45, window.innerWidth / window.innerHeight, 0.1, 1000
        );

        this.audioListener = new THREE.AudioListener();
        this.camera.add(this.audioListener);

        this.renderer = this.createRenderer();
        this.renderer.setClearColor(new THREE.Color(cfg.colors.clear), 1)
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.gammaInput = true;
        this.renderer.gammaOutput = true;

        document.body.appendChild(this.renderer.domElement);

        window.addEventListener('resize', this.resize.bind(this), false);

        this.addLighting();
        this.setupPostprocessing();
        this.setInitialCameraPos();

        this.setupLoader();

        if (this.isDebugMode) {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enabled = false;
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.5;
            this.controls.enableZoom = true;

            window.addEventListener('keydown', event => {
                let key = 'which' in event ? event.which : event.keyCode;
                // Toggle on space key press.
                if (key === 32) {
                    this.cameraMoveEnabled = !this.cameraMoveEnabled;
                    this.controls.enabled = !this.controls.enabled;
                }
            }, false);
        }
    },

    setupLoader() {
        this.loaderElement = $('#loadingscreen');
        this.loaderElement.css({
            width: window.innerWidth,
            height: window.innerHeight
        });
        this.loaderBar = $('#loadingscreen .inner-bar');
    },

    onLoadProgress(item, loaded, total) {
        if (loaded === total) {
            this.isLoaded = true;
            this.loaderElement.addClass('delayed-fade-out');
        }
        this.percentLoaded = loaded / total * 100;
        this.loaderBar.css('width', `${this.percentLoaded}%`);
    },

    resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(window.innerWidth, window.innerHeight);

        this.loaderElement.css({
            width: window.innerWidth,
            height: window.innerHeight
        });

        this.halfX = window.innerWidth / 2;
        this.halfY = window.innerHeight / 2;
    },

    createRenderer() {
        // Choose between WebGL and Canvas renderer based on availability
        let renderer = this.webglAvailable() ?
            new THREE.WebGLRenderer({ antialias: false }) :
            new THREE.CanvasRenderer();

        return renderer;
    },

    webglAvailable() {
        try {
            let canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && (
                canvas.getContext('webgl') ||
                canvas.getContext('experimental-webgl')
            ));
        } catch (e) {
            return false;
        }
    },

    addLighting() {
        this.ambientLight = new THREE.AmbientLight(0x202020);
        this.scene.add(this.ambientLight);

        // TODO: Consider using PointLight.
        // this.pointLight = new THREE.PointLight(0xffffff, 0.9, 200);
        this.dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
        this.dirLight.position.set(
                cfg.gameOpts.dirLightPos.x,
                cfg.gameOpts.dirLightPos.y,
                cfg.gameOpts.dirLightPos.z);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.camera.near = 10;
        this.dirLight.shadow.camera.far = 100;
        this.dirLight.shadow.bias = 0;
        this.dirLight.shadow.camera.top = 40;
        this.dirLight.shadow.camera.right = 40;
        this.dirLight.shadow.camera.bottom = -40;
        this.dirLight.shadow.camera.left = -40;
        this.dirLight.shadow.mapSize.width = 1024;
        this.dirLight.shadow.mapSize.height = 1024;
        this.scene.add(this.dirLight);

        if (this.isDebugMode) {
            this.scene.add(new THREE.CameraHelper(this.dirLight.shadow.camera));
        }

        this.hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.2);
        this.scene.add(this.hemiLight);
    },

    setInitialCameraPos() {
        this.camera.position.x = cfg.gameOpts.cameraStartPos.x;
        this.camera.position.y = cfg.gameOpts.cameraStartPos.y;
        this.camera.position.z = cfg.gameOpts.cameraStartPos.z;
        this.camera.lookAt(new THREE.Vector3(
            cfg.gameOpts.cameraPlayLookAt.x,
            cfg.gameOpts.cameraPlayLookAt.y,
            cfg.gameOpts.cameraPlayLookAt.z
        ));

        let camera = this.camera;
        this.initialCameraRotation = new TWEEN.Tween({rotation: 0})
            .to({rotation: 2 * Math.PI}, cfg.gameOpts.rotationSpeed)
            .onUpdate(function() {
                camera.position.x = cfg.gameOpts.cameraStartPos.x * Math.cos(this.rotation);
                camera.position.z = cfg.gameOpts.cameraStartPos.z * Math.sin(this.rotation);
                camera.lookAt(new THREE.Vector3(
                    cfg.gameOpts.cameraPlayLookAt.x,
                    cfg.gameOpts.cameraPlayLookAt.y,
                    cfg.gameOpts.cameraPlayLookAt.z
                ));
            })
            .repeat(Infinity)
            .start();
    },

    setPlayCameraPos(side) {
        this.side = side;
        this.initialCameraRotation.stop();

        let target = {
            x: cfg.gameOpts.cameraPlayPos.x,
            y: cfg.gameOpts.cameraPlayPos.y,
            z: (side === 'black' ? -1 : 1) * cfg.gameOpts.cameraPlayPos.z
        };

        new TWEEN.Tween(this.camera.position).to(target, cfg.gameOpts.animationSpeed * 6)
            .easing(TWEEN.Easing.Cubic.InOut)
            .onUpdate(() => {
                this.camera.lookAt(new THREE.Vector3(
                    cfg.gameOpts.cameraPlayLookAt.x,
                    cfg.gameOpts.cameraPlayLookAt.y,
                    cfg.gameOpts.cameraPlayLookAt.z
                ));
            })
            .onComplete(() => {
                this.cameraMoveEnabled = true;
            })
            .start();

        if (side === 'black') {
            // For black, we move the directional light, to provide a better
            // view.
            let target = { x: -cfg.gameOpts.dirLightPos.x, z: -cfg.gameOpts.dirLightPos.z };
            new TWEEN.Tween(this.dirLight.position).to(target, cfg.gameOpts.animationSpeed * 6)
                .easing(TWEEN.Easing.Cubic.InOut)
                .start();
        }
    },

    loadGameAssets() {
        log('loading assets');
        this.meshes = {};
        this.sounds = {};
        this.textures = {};

        return new Promise((resolve, unused_reject) => {
            // Setup loader.
            THREE.DefaultLoadingManager.onProgress = (item, loaded, total) => {
                this.onLoadProgress(item, loaded, total);
                if (this.isLoaded) {
                    resolve();
                }
            };

            // Load all sounds.
            let soundPromises = _.map(cfg.sounds, sound =>
                new Promise((resolve, unused_reject) => {
                    let loader = new THREE.AudioLoader();
                    loader.load(`data/${sound.name}.${sound.ext}`, audioBuffer => {
                        let audio = new THREE.Audio(this.audioListener);
                        audio.setBuffer(audioBuffer);
                        this.sounds[sound.name] = audio;
                        resolve();
                    });
                })
            );

            // Load textures
            let texturePromises = _.map(cfg.textures, texture =>
                new Promise((resolve, unused_reject) => {
                    let loader = new THREE.TextureLoader();
                    loader.load(`data/${texture.name}.${texture.ext}`, loadedTexture => {
                        this.textures[texture.name] = loadedTexture;
                        resolve();
                    });
                })
            );

            // Load all pieces.
            let geometryPromises = _.map(cfg.pieces.concat(cfg.assets), asset =>
                 new Promise((resolve, unused_reject) => {
                    let loader = new THREE.JSONLoader();
                    loader.load(`data/${asset}.json`, (geometry, materials) => {
                        let material = materials[0];

                        if (_.contains(cfg.assets, asset)) {
                            let mesh = new THREE.Mesh(geometry, material);
                            mesh.name = asset + 'Mesh';
                            mesh.receiveShadow = true;
                            this.meshes[asset] = mesh;
                        } else {
                            // Compute normals
                            geometry.computeFaceNormals();
                            geometry.computeVertexNormals();

                            // Duplicate black/white
                            _.forEach(cfg.sides, side => {
                                let meshMaterial = material.clone();
                                meshMaterial.color.setHex(cfg.colors.pieces[side].color);
                                meshMaterial.emissive.setHex(cfg.colors.pieces[side].emissive);
                                meshMaterial.specular.setHex(cfg.colors.pieces[side].specular);

                                let mesh = new THREE.Mesh(geometry, meshMaterial);
                                mesh.name = 'pieceMesh';
                                mesh.castShadow = true;
                                mesh.receiveShadow = true;

                                // Add glow effect.
                                let glowMesh = new THREEx.GeometricGlowMesh(mesh);
                                glowMesh.object3d.name = 'glowMesh';
                                glowMesh.object3d.visible = false;
                                mesh.add(glowMesh.object3d);

                                if (!this.meshes[side]) {
                                    this.meshes[side] = {};
                                }
                                this.meshes[side][asset] = mesh;
                            });
                        }

                        resolve();
                    });
                })
            );

            return Promise.all(
                    soundPromises.concat(texturePromises)
                    .concat(geometryPromises));
        });
    },

    setupBoard() {
        this.addSkybox();
        this.addBoard();
        this.addPieces();
    },

    setupPostprocessing() {
        let effectCopy = new THREE.ShaderPass(THREE.CopyShader);
        effectCopy.renderToScreen = true;

        // Setup basic render pass with texture pass, so that we can reuse it.
        this.renderPass = new THREE.RenderPass(this.scene, this.camera);

        // Setup postprocessing passes.
        // Bloom pass.
        this.bloomPass = new THREE.BloomPass(
                cfg.effects.bloom.strength,
                cfg.effects.bloom.kernel,
                cfg.effects.bloom.sigma,
                cfg.effects.bloom.resolution);

        // Depth material is used to render depth for SSAO.
        this.depthMaterial = new THREE.MeshDepthMaterial();
        this.depthMaterial.depthPacking = THREE.RGBADepthPacking;
        this.depthMaterial.blending = THREE.NoBlending;

        let params = {minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter};
        this.depthRenderTarget = new THREE.WebGLRenderTarget(
                window.innerWidth, window.innerHeight, params);

        this.ssaoPass = new THREE.ShaderPass(THREE.SSAOShader);
        this.ssaoPass.uniforms['tDepth'].value = this.depthRenderTarget;
        this.ssaoPass.uniforms['size'].value.set(window.innerWidth, window.innerHeight);
        this.ssaoPass.uniforms['cameraNear'].value = this.camera.near;
        this.ssaoPass.uniforms['cameraFar'].value = this.camera.far;
        this.ssaoPass.uniforms['onlyAO'].value = false;
        this.ssaoPass.uniforms['aoClamp'].value = cfg.effects.ssao.clamp;
        this.ssaoPass.uniforms['lumInfluence'].value = cfg.effects.ssao.lumInfluence;

        // Antialiasing.
        this.fxaaPass = new THREE.ShaderPass(THREE.FXAAShader);
        this.fxaaPass.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight);

        // Setup composer for effects.
        this.effectComposer = new THREE.EffectComposer(this.renderer);
        this.effectComposer.addPass(this.renderPass);
        this.effectComposer.addPass(this.bloomPass);
        this.effectComposer.addPass(this.ssaoPass);
        this.effectComposer.addPass(this.fxaaPass);
        this.effectComposer.addPass(effectCopy);
    },

    addSkybox() {
        let material = new THREE.MeshPhongMaterial({
            color: cfg.colors.skybox,
            specular: 0xffffff,
            shininess: 3,
            vertexColors: THREE.VertexColors,
            depthWrite: true,
            side: THREE.BackSide
        });

        let geometry = new THREE.BoxGeometry(
                cfg.gameOpts.skyboxSize.x,
                cfg.gameOpts.skyboxSize.y,
                cfg.gameOpts.skyboxSize.z);

        // Add ambient-occlusion-like vertex colors.
        // let light = new THREE.Color(0xffffff);
        // let shadow = new THREE.Color(0x505050);

        // TODO: Decide on whether or not to use vertex colors.
        // geometry.faces[0].vertexColors = [light, shadow, light];
        // geometry.faces[1].vertexColors = [shadow, shadow, light];
        // geometry.faces[2].vertexColors = [light, shadow, light];
        // geometry.faces[3].vertexColors = [shadow, shadow, light];
        // geometry.faces[4].vertexColors = [light, shadow, light];
        // geometry.faces[5].vertexColors = [shadow, shadow, light];
        // geometry.faces[6].vertexColors = [light, shadow, light];
        // geometry.faces[7].vertexColors = [shadow, shadow, light];
        // geometry.faces[8].vertexColors = [light, shadow, light];
        // geometry.faces[9].vertexColors = [shadow, shadow, light];
        // geometry.faces[10].vertexColors = [light, shadow, light];
        // geometry.faces[11].vertexColors = [shadow, shadow, light];

        let mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(0, 50, 0);
        this.scene.add(mesh);
    },

    addBoard() {
        this.board = new THREE.Object3D();
        this.board.add(this.meshes.board);
        this.board.scale.set(
            cfg.gameOpts.boardScale,
            cfg.gameOpts.boardScale,
            cfg.gameOpts.boardScale
        );

        this.scene.add(this.board);

        // Setup board mirroring.
        this.boardMirrorPlane = new THREE.PlaneBufferGeometry(38, 38);
        this.boardMirror = new THREE.Mirror(this.renderer, this.camera, {
            opacity: cfg.gameOpts.mirrorOpacity,
            clipBias: 0.003,
            textureWidth: window.innerWidth,
            textureHeight: window.innerHeight
        });
        this.mirrorMesh = new THREE.Mesh(this.boardMirrorPlane, this.boardMirror.material);
        this.mirrorMesh.add(this.boardMirror);
        this.mirrorMesh.rotateX(-Math.PI / 2);  // Quarter rotation, to face up.
        this.mirrorMesh.position.y = 1.8;
        this.scene.add(this.mirrorMesh);
    },

    addPieces() {
        log('creating pieces');

        this.pieces = {};
        this.captured = { 'w': [], 'b': [] };

        _.forEach(cfg.startPosition, (pieces, side) => {
            _.forEach(pieces, piece => {
                this.addPiece(piece.pos, piece.type, side);
            });
        });
    },

    addPiece(pos, type, side) {
        let object = new THREE.Object3D();
        object.add(this.cloneMesh(side, type));
        object.position.y = cfg.gameOpts.pieceYOffset;
        object.userData.origPos = pos;
        object.userData.type = type;
        object.userData.side = side;

        this.setPiecePosition(object, pos, /* opt_instant */ true, /* opt_noglow */ true);

        // Rotate white
        if (side === 'white') {
            object.rotation.y = Math.PI;
        }

        this.scene.add(object);
        this.pieces[pos] = {
            type: type,
            side: side,
            object: object
        };
    },

    cloneMesh(side, type) {
        let mesh = this.meshes[side][type].clone();
        let glowMesh = mesh.getObjectByName('glowMesh');
        // We need to clone the material because each piece may need to animate
        // its glow independently.
        glowMesh.children[0].material = glowMesh.children[0].material.clone();
        glowMesh.children[1].material = glowMesh.children[1].material.clone();
        return mesh;
    },

    addFriendScreen(side, video) {
        let material;

        if (video) {
            log('adding friend screen (with video)');
            this.friendVideo = video;
            this.friendTexture = new THREE.VideoTexture(this.friendVideo);
            this.friendTexture.minFilter = THREE.LinearFilter;
            this.friendTexture.magFilter = THREE.LinearFilter;
            this.friendTexture.format = THREE.RGBFormat;

            material = new THREE.MeshLambertMaterial({
                map: this.friendTexture,
                color: 0xeeeeee
            });
        } else {
            log('adding friend screen (no video)');
            material = new THREE.MeshLambertMaterial({
                map: this.textures['user'],
                color: 0xeeeeee
            });
        }

        let filler = new THREE.MeshPhongMaterial({
            color: cfg.colors.friendScreen
        });

        // Only a single face needs the video
        let materials = [filler, filler, filler, filler, material, filler];

        let geometry = new THREE.BoxGeometry(
            cfg.gameOpts.friendScreenSize.x,
            cfg.gameOpts.friendScreenSize.y,
            cfg.gameOpts.friendScreenSize.z
        );

        let cube = new THREE.Mesh(geometry, new THREE.MeshFaceMaterial(materials));
        cube.position.set(
            cfg.gameOpts.friendScreenPos.x,
            cfg.gameOpts.friendScreenPos.y,
            cfg.gameOpts.friendScreenPos.z
        );

        if (side === 'black') {
            cube.position.setZ(-cfg.gameOpts.friendScreenPos.z);
            cube.rotation.y = Math.PI;
        }

        this.scene.add(cube);

        this.setPlayCameraPos(side);
    },

    addTileControls(legalCallback, moveCallback, onPromotion) {
        this.legalCallback = legalCallback;
        this.moveCallback = moveCallback;
        this.onPromotion = onPromotion;

        this.tiles = {};

        // Create geometry and material
        let geometry = new THREE.PlaneGeometry(
            cfg.gameOpts.tileSize,
            cfg.gameOpts.tileSize
        );

        let material = new THREE.MeshPhongMaterial({
            color: cfg.colors.tiles.active,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: cfg.gameOpts.tileOpacity
        });

        // Generate mesh for each tile
        _.forEach(cfg.files, file => {
            _.forEach(cfg.ranks, rank => {
                this.addTileControl(file + rank, geometry, material.clone());
            });
        });

        // Bind to mouse events
        this.raycaster = new THREE.Raycaster();
        this.addMouseListeners();
    },

    addTileControl(pos, geometry, material) {
        let offsetX = cfg.fileToOffset[pos[0]];
        let offsetZ = cfg.rankToOffset[pos[1]];

        let tile = new THREE.Mesh(geometry, material);
        tile.visible = false;
        tile.rotation.x = Math.PI / 2;
        tile.position.y = cfg.gameOpts.pieceYOffset + 0.15;

        tile.position.x = -cfg.gameOpts.boardStartOffset + offsetX * cfg.gameOpts.tileSize;
        tile.position.z = cfg.gameOpts.boardStartOffset - offsetZ * cfg.gameOpts.tileSize;

        tile.isTile = true;
        tile.chessPos = pos;
        this.tiles[pos] = tile;

        this.scene.add(tile);
    },

    addMouseListeners() {
        this.mousePos = new THREE.Vector2();
        document.addEventListener('mousemove',
                _.throttle(this.onMouseMove.bind(this), cfg.gameOpts.mouseThrottle), false);
        document.addEventListener('mousedown', this.onMouseDown.bind(this), false);
        document.addEventListener('mouseup', this.onMouseUp.bind(this), false);
        document.addEventListener('touchmove',
                _.throttle(this.onTouchMove.bind(this), cfg.gameOpts.touchThrottle), false);
        document.addEventListener('touchstart', this.onTouchStart.bind(this), false);
        document.addEventListener('touchend', this.onTouchEnd.bind(this), false);
        document.addEventListener('contextmenu', this.onContextMenu.bind(this), false);
    },

    onContextMenu(event) {
        if (this.hasFocus) {
            event.preventDefault();
        }
    },

    onMouseMove(event) {
        if (this.hasFocus) {
            this.updateMousePos(event);
            this.highlightActiveTile();
        }
    },

    onTouchMove(event) {
        if (this.hasFocus && this.touchStarted) {
            event.preventDefault();
            // See if sufficient time has elapsed since touch start.
            let elapsedMillis = Date.now() - this.lastTouchTime;
            if (elapsedMillis > cfg.gameOpts.touchMoveDelay) {
                let touch = event.changedTouches[0];
                if (touch) {
                    this.isMovingCamera = true;
                    this.updateMousePos(touch);
                }
            }
        }
    },

    updateMousePos(event) {
        this.mousePos.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mousePos.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this.tweenCamera();
    },

    tweenCamera() {
        if (!this.cameraMoveEnabled || !this.isMovingCamera) {
            return;
        }

        let sideMultiplier = this.side === 'black' ? -1 : 1;
        let rotateStrength = 2 * cfg.gameOpts.cameraStrength;

        let rotateX = this.mousePos.x;
        let offsetY = this.mousePos.y * cfg.gameOpts.cameraStrength;

        let targetX = cfg.gameOpts.cameraPlayPos.x +
            sideMultiplier * rotateStrength *
            Math.sin(Math.PI * rotateX / 2);
        let targetY = cfg.gameOpts.cameraPlayPos.y + offsetY;
        let targetZ = sideMultiplier * cfg.gameOpts.cameraPlayPos.z +
            (-1 * sideMultiplier) * 0.5 * rotateStrength *
            Math.sin(Math.PI * Math.abs(rotateX) / 2);

        targetY = Math.max(targetY, 5);

        let target = {x: targetX, y: targetY, z: targetZ};
        if (this.cameraTween) {
            this.cameraTween.stop();
        }
        this.cameraTween = new TWEEN.Tween(this.camera.position)
            .to(target, cfg.gameOpts.cameraAnimationSpeed)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onUpdate(() => {
                this.camera.lookAt(new THREE.Vector3(
                    cfg.gameOpts.cameraPlayLookAt.x,
                    cfg.gameOpts.cameraPlayLookAt.y,
                    cfg.gameOpts.cameraPlayLookAt.z
                ));
            })
            .start();
    },

    highlightActiveTile() {
        this.recolorTiles();

        let intersected = this.intersectTile();
        if (intersected) {
            let tile = intersected.object;
            this.colorTile(tile, cfg.colors.tiles.active);
        }
    },

    onMouseDown(event) {
        if (this.hasFocus) {
            event.preventDefault();
            // Determine right-click vs left-click.
            if (event.button === 0) {
                this.handleMoveSelection();
            } else if (event.button === 2) {
                this.isMovingCamera = true;
                this.tweenCamera();
            }
        }
    },

    onTouchStart(event) {
        if (this.hasFocus) {
            // Prevent mouse handler from firing.
            event.preventDefault();
            let touch = event.changedTouches[0];
            if (touch) {
                this.updateMousePos(touch);
            }
            this.touchStarted = true;
            this.lastTouchTime = Date.now();
        }
    },

    handleMoveSelection() {
        if (!this.movesEnabled || this.gameOver) {
            return;
        }
        let intersected = this.intersectTile();

        if (intersected) {
            let tile = intersected.object;

            // We're either in 'piece' or 'move' selection mode (the latter
            // being specific to a piece)
            if (this.isSelectingPieceMovement) {
                if (tile.isLegalMove) {
                    if (tile.isPromotion) {
                        this.hasFocus = false;
                        this.onPromotion().then(promotion => {
                            this.hasFocus = true;
                            this.commitMove(tile, promotion);
                            this.resetTileHighlights();
                        });
                    } else {
                        this.commitMove(tile);
                        this.resetTileHighlights();
                    }
                } else {
                    this.highlightLegalMoves(tile);
                }
            } else {
                this.highlightLegalMoves(tile);
            }
        }
    },

    commitMove(tile, opt_promotion) {
        this.moveCallback(this.selectedPos, tile.chessPos, opt_promotion);

        this.isSelectingPieceMovement = false;
        this.selectedPos = null;
    },

    highlightLegalMoves(tile) {
        this.isSelectingPieceMovement = true;
        this.selectedPos = tile.chessPos;

        this.resetTileHighlights();

        // Get legal moves and highlight them.
        this.currentLegalMoves = this.legalCallback(tile.chessPos);
        _.forEach(this.currentLegalMoves, move => {
            let tile = this.tiles[move.to];
            tile.isLegalMove = true;
            tile.isPromotion = move.flags.indexOf('p') !== -1;
            this.colorTile(tile, cfg.colors.tiles.legal);
        });

        // If there is a piece under the cursor, highlight it.
        let piece = this.pieces[tile.chessPos];
        if (piece && piece.side === this.activeSide) {
            this.lastSelectedGlowMesh = this.fadeInOutObjectGlow(
                    piece.object, this.lastSelectedGlowMesh, cfg.colors.glow.selection);
        } else if (this.lastSelectedGlowMesh) {
            this.fadeOutGlowMesh(this.lastSelectedGlowMesh);
            this.lastSelectedGlowMesh = null;
        }
    },

    resetTileHighlights() {
        _.forEach(this.tiles, tile => {
            tile.isLegalMove = null;
        });
        this.recolorTiles();
    },

    recolorTiles() {
        _.forEach(this.tiles, tile => {
            this.hideTile(tile);

            // Recolor
            if (tile.isLegalMove) {
                this.colorTile(tile, cfg.colors.tiles.legal);
            } else if (tile.chessPos == this.selectedPos) {
                this.colorTile(tile, cfg.colors.tiles.selected);
            } else if (tile.chessPos === this.prevPosFrom) {
                this.colorTile(tile, cfg.colors.tiles.prevFrom);
            } else if (tile.chessPos === this.prevPosTo) {
                this.colorTile(tile, cfg.colors.tiles.prevTo);
            }

            if (this.isInCheck) {
                // The active side has already been swapped, so look for the
                // king.
                let piece = this.pieces[tile.chessPos];
                if (piece && piece.type === 'king' && piece.side === this.activeSide) {
                    this.colorTile(tile, cfg.colors.tiles.check);
                }
            }
        });
    },

    colorTile(tile, color) {
        tile.material.color.setHex(color);
        tile.visible = true;
    },

    hideTile(tile) {
        tile.visible = false;
    },

    performMove(move, isInCheck) {
        this.isInCheck = isInCheck;

        // TODO: Improve move sound, or remove it completely.
        // this.sounds.move.play();
        this.performGraphicalMove(move);
    },

    performGraphicalMove(move) {
        let piece = this.pieces[move.from];

        if (typeof piece === 'undefined') {
            log('ERROR: piece not found - bug?');
            return;
        }

        // Cache previous move for highlighting
        this.prevPosFrom = move.from;
        this.prevPosTo = move.to;

        const makeCapturingMove = (move, capturedPos) => {
            let capturedPiece = this.pieces[capturedPos];
            delete this.pieces[capturedPos];
            this.captured[move.color].push(capturedPiece);
            this.hidePiece(capturedPiece.object);

            // Move capturing piece
            delete this.pieces[move.from];
            this.pieces[move.to] = piece;

            this.setPiecePosition(piece.object, move.to);
        };

        const makeCastlingMove = (move) => {
            delete this.pieces[move.from];
            this.pieces[move.to] = piece;
            this.setPiecePosition(piece.object, move.to);

            // Figure out if it's kingside or queenside
            let castleType = move.to.charAt(0) > move.from.charAt(0) ?
                'kingside' :
                'queenside';

            const rookPositions = {
                'kingside': {
                    'w': {'from': 'h1', 'to': 'f1'},
                    'b': {'from': 'h8', 'to': 'f8'}
                },
                'queenside': {
                    'w': {'from': 'a1', 'to': 'd1'},
                    'b': {'from': 'a8', 'to': 'd8'}
                }
            };

            // Bring the rook over
            let rookFrom = rookPositions[castleType][move.color]['from'];
            let rookTo = rookPositions[castleType][move.color]['to'];
            let rook = this.pieces[rookFrom];
            delete this.pieces[rookFrom];
            this.pieces[rookTo] = rook;
            this.setPiecePosition(rook.object, rookTo);
        };

        // Handle moves (order matters because of interactions with
        // `this.pieces`)
        if (move.flags.indexOf('e') !== -1) {
            /** En passant */
            // Captured position is computed off of from/to
            let capturedPos = move.to.charAt(0) + move.from.charAt(1);
            makeCapturingMove(move, capturedPos);
        }
        if (move.flags.indexOf('c') !== -1) {
            /** Standard capture */
            makeCapturingMove(move, move.to);
        }
        if (move.flags.indexOf('n') !== -1 || move.flags.indexOf('b') !== -1) {
            /** Standard non-capture or pawn-push */
            delete this.pieces[move.from];
            this.pieces[move.to] = piece;
            this.setPiecePosition(piece.object, move.to);
        }
        if (move.flags.indexOf('p') !== -1) {
            /** Promotion */
            const promotionTypes = {
                'q': 'queen',
                'r': 'rook',
                'b': 'bishop',
                'n': 'knight'
            };
            // Pawn-push is handled via the code above.
            piece.object.remove(piece.object.children[0]);
            let promotionType = promotionTypes[move.promotion];
            piece.object.add(this.cloneMesh(piece.side, promotionType));
        }
        if (move.flags.indexOf('k') !== -1) {
            /** Kingside castle */
            makeCastlingMove(move);
        }
        if (move.flags.indexOf('q') !== -1) {
            /** Queenside castle */
            makeCastlingMove(move);
        }

        this.recolorTiles();
    },

    onMouseUp(event) {
        if (this.hasFocus) {
            event.preventDefault();
            // If right-click.
            if (event.button === 2) {
                this.isMovingCamera = false;
            }
        }
    },

    onTouchEnd(event) {
        if (this.hasFocus) {
            event.preventDefault();
            // If we weren't moving the camera, then this is a 'click' event.
            if (!this.isMovingCamera) {
                this.handleMoveSelection();
            }
            this.touchStarted = false;
            this.isMovingCamera = false;
        }
    },

    intersectTile() {
        this.raycaster.setFromCamera(this.mousePos, this.camera);

        // We can't use `intersectObjects` directly because it ignores
        // invisible objects.
        let intersects = [];
        this.scene.children.forEach(child => child.raycast(this.raycaster, intersects));
        return _.first(_.filter(intersects, intersected => {
            return intersected.object.isTile;
        }));
    },

    setPiecePosition(object, pos, opt_instant, opt_noglow) {
        let offsetX = cfg.fileToOffset[pos[0]];
        let offsetZ = cfg.rankToOffset[pos[1]];
        let posX = -cfg.gameOpts.boardStartOffset + offsetX * cfg.gameOpts.tileSize;
        let posZ = cfg.gameOpts.boardStartOffset - offsetZ * cfg.gameOpts.tileSize;

        if (opt_instant) {
            object.position.x = posX;
            object.position.z = posZ;
        } else {
            let target = {x: posX, z: posZ};
            new TWEEN.Tween(object.position).to(target, cfg.gameOpts.animationSpeed)
                .easing(TWEEN.Easing.Cubic.InOut)
                .start();
        }

        if (!opt_noglow) {
            this.lastSelectedGlowMesh = null;
            this.lastMovedGlowMesh = this.fadeInOutObjectGlow(
                    object, this.lastMovedGlowMesh, cfg.colors.glow.afterMove);
        }
    },

    fadeInOutObjectGlow(object, lastGlowMesh, color) {
        if (lastGlowMesh) {
            this.fadeOutGlowMesh(lastGlowMesh);
        }
        let glowMesh = object.getObjectByName('glowMesh');
        this.fadeInGlowMesh(glowMesh, color);
        return glowMesh;
    },

    fadeInGlowMesh(glowMesh, color) {
        // GlowMesh has 2 materials that need animation.
        glowMesh.visible = true;
        glowMesh.children[0].material.uniforms.glowOpacity.value = 0;
        glowMesh.children[1].material.uniforms.glowOpacity.value = 0;
        glowMesh.children[0].material.uniforms.glowColor.value.set(color);
        glowMesh.children[1].material.uniforms.glowColor.value.set(color);
        new TWEEN.Tween({glowOpacity: 0})
            .to({glowOpacity: cfg.gameOpts.glowOpacity}, cfg.gameOpts.animationSpeed)
            .easing(TWEEN.Easing.Cubic.Out)
            // Don't use arrow function here because intermediate values
            // are accessed via `this` set by TWEEN.js
            .onUpdate(function() {
                glowMesh.children[0].material.uniforms.glowOpacity.value = this.glowOpacity;
                glowMesh.children[1].material.uniforms.glowOpacity.value = this.glowOpacity;
            })
            .start();
    },

    fadeOutGlowMesh(glowMesh) {
        // GlowMesh has 2 materials that need animation.
        glowMesh.children[0].material.uniforms.glowOpacity.value = cfg.gameOpts.glowOpacity;
        glowMesh.children[1].material.uniforms.glowOpacity.value = cfg.gameOpts.glowOpacity;
        new TWEEN.Tween({glowOpacity: cfg.gameOpts.glowOpacity})
            .to({glowOpacity: 0}, cfg.gameOpts.animationSpeed / 2)
            .easing(TWEEN.Easing.Cubic.In)
            // Don't use arrow function here because intermediate values
            // are accessed via `this` set by TWEEN.js
            .onUpdate(function() {
                glowMesh.children[0].material.uniforms.glowOpacity.value = this.glowOpacity;
                glowMesh.children[1].material.uniforms.glowOpacity.value = this.glowOpacity;
            })
            .onComplete(() => {
                glowMesh.visible = false;
            })
            .start();
    },

    hidePiece(object) {
        let mesh = object.getObjectByName('pieceMesh');
        // Clone the material, else it will affect all pieces of the same type.
        mesh.material = mesh.material.clone();
        // 'transparent' must be true for the opacity to take effect.
        mesh.material.transparent = true;
        new TWEEN.Tween(mesh.material).to({opacity: 0}, cfg.gameOpts.animationSpeed)
            .onComplete(() => {
                object.visible = false;
            })
            .easing(TWEEN.Easing.Cubic.Out)
            .start();
    },

    beginRender() {
        this.render = this.render.bind(this);
        this.requestId = requestAnimationFrame(this.render);
    },

    render(timestamp) {
        this.requestId = requestAnimationFrame(this.render);
        TWEEN.update(timestamp);

        if (this.isDebugMode) {
            this.controls.update();
        }

        // If we haven't loaded everything yet, return early.
        if (!this.isLoaded) return;

        // Video texture.
        if (this.friendVideo && this.friendVideo.readyState === this.friendVideo.HAVE_ENOUGH_DATA) {
            this.friendTexture.needsUpdate = true;
        }

        // Render postprocessing. First, render depth into depthRenderTarget.
        this.scene.overrideMaterial = this.depthMaterial;
        this.renderer.render(this.scene, this.camera, this.depthRenderTarget, /* forceClear */ true);

        this.renderer.autoClear = false;
        this.renderer.clear();

        // Next, run postprocessing composer.
        this.scene.overrideMaterial = null;
        this.effectComposer.render();

        // The mirror effect is added after-load.
        if (this.boardMirror) {
            this.boardMirror.render();
        }
    }
};
