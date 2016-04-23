'use strict';

import Promise from 'promise';
import _ from 'lodash';

import cfg from './config';
import log from './log';

export default {
    init(isDebugMode) {
        this.isDebugMode = isDebugMode;
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            45, window.innerWidth / window.innerHeight, 0.1, 1000
        );

        this.renderer = this.createRenderer();
        this.renderer.setClearColor(new THREE.Color(cfg.colors.clear), 1)
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

        if (this.isDebugMode) {
            this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
            this.controls.enableDamping = true;
            this.controls.dampingFactor = 0.5;
            this.controls.enableZoom = true;
        }
    },

    resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(window.innerWidth, window.innerHeight);
    },

    createRenderer() {
        // Choose between WebGL and Canvas renderer based on availability
        let renderer = this.webglAvailable() ?
            new THREE.WebGLRenderer({ antialias: true }) :
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
        this.dirLight.position.set(-25, 25, 25);
        this.dirLight.castShadow = true;
        this.dirLight.shadow.camera.near = 10;
        this.dirLight.shadow.camera.far = 100;
        this.dirLight.shadow.bias = 0.0001;
        this.dirLight.shadow.camera.top = 40;
        this.dirLight.shadow.camera.right = 40;
        this.dirLight.shadow.camera.bottom = -40;
        this.dirLight.shadow.camera.left = -40;
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
        this.camera.lookAt(new THREE.Vector3(0, 0, 0));
    },

    setPlayCameraPos(side) {
        this.camera.position.x = cfg.gameOpts.cameraPlayPos.x;
        this.camera.position.y = cfg.gameOpts.cameraPlayPos.y;
        this.camera.position.z = (side === 'black' ? -1 : 1) * cfg.gameOpts.cameraPlayPos.z;
        this.camera.lookAt(new THREE.Vector3(
            cfg.gameOpts.cameraPlayLookAt.x,
            cfg.gameOpts.cameraPlayLookAt.y,
            cfg.gameOpts.cameraPlayLookAt.z
        ));
    },

    loadGameGeometry() {
        this.meshes = {};

        // Load all pieces
        return Promise.all(_.map(cfg.pieces.concat(cfg.assets), asset =>
             new Promise((resolve, unused_reject) => {
                let loader = new THREE.JSONLoader();
                loader.load('data/' + asset + '.json', (geometry, materials) => {
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

                            if (!this.meshes[side]) {
                                this.meshes[side] = {};
                            }
                            this.meshes[side][asset] = mesh;
                        });
                    }

                    log('done loading', asset);
                    resolve();
                });
            })
        ));
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

        // Bloom pass.
        this.bloomPass = new THREE.BloomPass(2.5, 12, 5.0, 256);

        // Setup postprocessing passes.
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
        this.ssaoPass.uniforms['aoClamp'].value = 0.8;
        this.ssaoPass.uniforms['lumInfluence'].value = 0.9;

        // Setup composer for effects.
        this.effectComposer = new THREE.EffectComposer(this.renderer);
        this.effectComposer.addPass(this.renderPass);
        this.effectComposer.addPass(this.bloomPass);
        this.effectComposer.addPass(this.ssaoPass);
        this.effectComposer.addPass(effectCopy);
    },

    addSkybox() {
        let material = new THREE.MeshPhongMaterial({
            color: 0xbababa,
            specular: 0xffffff,
            shininess: 3,
            vertexColors: THREE.VertexColors,
            depthWrite: true,
            side: THREE.BackSide
        });

        let geometry = new THREE.BoxGeometry(150, 100, 200);

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
    },

    addPieces() {
        this.pieces = {};
        this.captured = { 'w': [], 'b': [] };

        _.forEach(cfg.startPosition, (pieces, side) => {
            _.forEach(pieces, piece => {
                this.addPiece(piece.pos, piece.type, side);
            });
        });
    },

    addPiece(pos, type, side) {
        log('creating', type, side);

        let object = new THREE.Object3D();
        object.add(this.meshes[side][type].clone());
        object.position.y = cfg.gameOpts.pieceYOffset;

        this.setPiecePosition(object, pos, /* opt_instant */ true);

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

    addFriendScreen(side, video) {
        let material;

        if (video) {
            this.friendVideo = video;
            this.friendTexture = new THREE.Texture(video);

            this.friendTexture.generateMipmaps = false;

            material = new THREE.MeshPhongMaterial({
                map: this.friendTexture,
                emissive: 0xeeeeee
            });
        } else {
            // this.friendTexture = THREE.ImageUtils.loadTexture('grid.png');
            material = new THREE.MeshPhongMaterial({
                color: 0x000000
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
            opacity: 0
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
        tile.rotation.x = Math.PI / 2;
        tile.position.y = cfg.gameOpts.pieceYOffset + 0.05;

        tile.position.x = -cfg.gameOpts.boardStartOffset + offsetX * cfg.gameOpts.tileSize;
        tile.position.z = cfg.gameOpts.boardStartOffset - offsetZ * cfg.gameOpts.tileSize;

        tile.isTile = true;
        tile.chessPos = pos;
        this.tiles[pos] = tile;

        this.scene.add(tile);
    },

    addMouseListeners() {
        this.mousePos = new THREE.Vector2();
        document.addEventListener('mousemove', this.onMouseMove.bind(this), false);
        document.addEventListener('mousedown', this.onMouseDown.bind(this), false);
        document.addEventListener('mouseup', this.onMouseUp.bind(this), false);
    },

    onMouseMove(event) {
        this.updateMousePos(event);
        this.highlightActiveTile();
    },

    updateMousePos(event) {
        this.mousePos.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mousePos.y = -(event.clientY / window.innerHeight) * 2 + 1;
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
        event.preventDefault();
        this.handleMoveSelection();
    },

    handleMoveSelection() {
        let intersected = this.intersectTile();

        if (intersected) {
            let tile = intersected.object;

            // We're either in 'piece' or 'move' selection mode (the latter
            // being specific to a piece)
            if (this.isSelectingPieceMovement) {
                if (tile.isLegalMove) {
                    if (tile.isPromotion) {
                        this.onPromotion().then(promotion => {
                            this.commitMove(tile, promotion);
                            this.resetTileHighlights();
                        });
                    } else {
                        this.commitMove(tile);
                        this.resetTileHighlights();
                    }
                } else {
                    this.resetTileHighlights();
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

        this.colorTile(tile, cfg.colors.tiles.selected);

        // Get legal moves and highlight them
        this.currentLegalMoves = this.legalCallback(tile.chessPos);
        _.forEach(this.currentLegalMoves, move => {
            let tile = this.tiles[move.to];
            tile.isLegalMove = true;
            tile.isPromotion = move.flags.indexOf('p') !== -1;
            this.colorTile(tile, cfg.colors.tiles.legal);
        });
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
        });
    },

    colorTile(tile, color) {
        tile.material.color.setHex(color);
        tile.material.opacity = cfg.gameOpts.tileOpacity;
    },

    hideTile(tile) {
        tile.material.opacity = 0;
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
            piece.object.add(this.meshes[piece.side][promotionType].clone());
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
        event.preventDefault();
    },

    intersectTile() {
        this.raycaster.setFromCamera(this.mousePos, this.camera);

        let intersects = this.raycaster.intersectObjects(this.scene.children);
        return _.first(_.filter(intersects, intersected => {
            return intersected.object.isTile;
        }));
    },

    setPiecePosition(object, pos, opt_instant) {
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

        // Video texture
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
    }
};
