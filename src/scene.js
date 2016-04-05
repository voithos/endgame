'use strict';

import Promise from 'promise';
import _ from 'lodash';

import cfg from './config';
import log from './log';

export default {
    init() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(
            45, window.innerWidth / window.innerHeight, 0.1, 1000
        );

        this.renderer = this.createRenderer();
        this.renderer.setClearColor(new THREE.Color(cfg.colors.clear), 1)
        this.renderer.setSize(window.innerWidth, window.innerHeight);

        document.body.appendChild(this.renderer.domElement);

        window.addEventListener('resize', this.resize.bind(this), false);

        this.addLighting();
        this.setInitialCameraPos();
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
        this.dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
        this.dirLight.position.set(0, 80, 0).normalize();
        this.scene.add(this.dirLight);

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

    addSkybox() {
        let material = new THREE.MeshLambertMaterial({
            color: 0xdadada,
            depthWrite: false,
            side: THREE.BackSide
        });

        let mesh = new THREE.Mesh(new THREE.BoxGeometry(150, 100, 200), material);
        mesh.position.set(0, 50, 0);
        // this.scene.add(mesh);
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
        object.position.setY(cfg.gameOpts.pieceYOffset);

        this.setPiecePosition(object, pos);

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

            material = new THREE.MeshLambertMaterial({
                map: this.friendTexture,
                emissive: 0xeeeeee
            });
        } else {
            // this.friendTexture = THREE.ImageUtils.loadTexture('grid.png');
            material = new THREE.MeshLambertMaterial({
                color: 0x000000
            });
        }

        let filler = new THREE.MeshLambertMaterial({
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

    addTileControls(legalCallback, moveCallback) {
        this.legalCallback = legalCallback;
        this.moveCallback = moveCallback;

        this.tiles = {};

        // Create geometry and material
        let geometry = new THREE.PlaneGeometry(
            cfg.gameOpts.tileSize,
            cfg.gameOpts.tileSize
        );

        let material = new THREE.MeshLambertMaterial({
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
        tile.position.setY(cfg.gameOpts.pieceYOffset + 0.05);

        tile.position.setX(-cfg.gameOpts.boardStartOffset + offsetX * cfg.gameOpts.tileSize);
        tile.position.setZ(cfg.gameOpts.boardStartOffset - offsetZ * cfg.gameOpts.tileSize);

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
                    this.commitMove(tile);
                    this.resetTileHighlights();
                } else {
                    this.resetTileHighlights();
                    this.highlightLegalMoves(tile);
                }
            } else {
                this.highlightLegalMoves(tile);
            }
        }
    },

    commitMove(tile) {
        this.moveCallback.call(this, this.selectedPos, tile.chessPos);

        this.isSelectingPieceMovement = false;
        this.selectedPos = null;
    },

    highlightLegalMoves(tile) {
        this.isSelectingPieceMovement = true;
        this.selectedPos = tile.chessPos;

        this.colorTile(tile, cfg.colors.tiles.selected);

        // Get legal moves and highlight them
        this.currentLegalMoves = this.legalCallback.call(this, tile.chessPos);
        _.forEach(this.currentLegalMoves, move => {
            let tile = this.tiles[move.to];
            tile.isLegalMove = true;
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

        // Handle moves (order matters because of interactions with
        // `this.pieces`)
        const makeCapturingMove = (move, capturedPos) => {
            console.log(capturedPos);
            let capturedPiece = this.pieces[capturedPos];
            delete this.pieces[capturedPos];
            this.captured[move.color].push(capturedPiece);
            this.hidePiece(capturedPiece.object);

            // Move capturing piece
            delete this.pieces[move.from];
            this.pieces[move.to] = piece;

            this.setPiecePosition(piece.object, move.to);
        };

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
            // TODO
        }
        if (move.flags.indexOf('k') !== -1) {
            /** Kingside castle */
            // TODO
        }
        if (move.flags.indexOf('q') !== -1) {
            /** Queenside castle */
            // TODO
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

    setPiecePosition(object, pos) {
        let offsetX = cfg.fileToOffset[pos[0]];
        let offsetZ = cfg.rankToOffset[pos[1]];

        object.position.setX(-cfg.gameOpts.boardStartOffset + offsetX * cfg.gameOpts.tileSize);
        object.position.setZ(cfg.gameOpts.boardStartOffset - offsetZ * cfg.gameOpts.tileSize);
    },

    hidePiece(object) {
        object.visible = false;
    },

    beginRender() {
        this.render = this.render.bind(this);
        this.previousTime = new Date().getTime();
        this.requestId = requestAnimationFrame(this.render);
    },

    render(unused_timestamp) {
        this.requestId = requestAnimationFrame(this.render);

        // Compute delta time
        let now = new Date().getTime();
        let delta = now - this.previousTime; // eslint-disable-line no-unused-vars
        this.previousTime = now;

        // Animations

        // Video texture
        if (this.friendVideo && this.friendVideo.readyState === this.friendVideo.HAVE_ENOUGH_DATA) {
            this.friendTexture.needsUpdate = true;
        }

        this.renderer.render(this.scene, this.camera);
    }
};
