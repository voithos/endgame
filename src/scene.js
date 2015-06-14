'use strict';

let Promise = require('promise');
let _ = require('lodash');

let cfg = require('./config');
let log = require('./log');

module.exports = {
    init: function() {
        let self = this;
        self.scene = new THREE.Scene();
        self.camera = new THREE.PerspectiveCamera(
            45, window.innerWidth / window.innerHeight, 0.1, 1000
        );

        self.renderer = self.createRenderer();
        self.renderer.setClearColor(new THREE.Color(cfg.colors.clear), 1)
        self.renderer.setSize(window.innerWidth, window.innerHeight);

        document.body.appendChild(self.renderer.domElement);

        window.addEventListener('resize', self.resize.bind(self), false);

        self.addLighting();
        self.setInitialCameraPos();
    },

    resize: function() {
        let self = this;
        self.camera.aspect = window.innerWidth / window.innerHeight;
        self.camera.updateProjectionMatrix();

        self.renderer.setSize(window.innerWidth, window.innerHeight);
    },

    createRenderer: function() {
        // Choose between WebGL and Canvas renderer based on availability
        let self = this;
        let renderer = self.webglAvailable() ?
            new THREE.WebGLRenderer({ antialias: true }) :
            new THREE.CanvasRenderer();

        return renderer;
    },

    webglAvailable: function() {
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

    addLighting: function() {
        let self = this;
        self.dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
        self.dirLight.position.set(0, 80, 0).normalize();
        self.scene.add(self.dirLight);

        self.hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.2);
        self.scene.add(self.hemiLight);
    },

    setInitialCameraPos: function() {
        let self = this;
        self.camera.position.x = cfg.gameOpts.cameraStartPos.x;
        self.camera.position.y = cfg.gameOpts.cameraStartPos.y;
        self.camera.position.z = cfg.gameOpts.cameraStartPos.z;
        self.camera.lookAt(new THREE.Vector3(0, 0, 0));
    },

    setPlayCameraPos: function(side) {
        let self = this;
        self.camera.position.x = cfg.gameOpts.cameraPlayPos.x;
        self.camera.position.y = cfg.gameOpts.cameraPlayPos.y;
        self.camera.position.z = (side === 'black' ? -1 : 1) * cfg.gameOpts.cameraPlayPos.z;
        self.camera.lookAt(new THREE.Vector3(
            cfg.gameOpts.cameraPlayLookAt.x,
            cfg.gameOpts.cameraPlayLookAt.y,
            cfg.gameOpts.cameraPlayLookAt.z
        ));
    },

    loadGameGeometry: function() {
        let self = this;
        self.meshes = {};

        // Load all pieces
        return Promise.all(_.map(cfg.pieces.concat(cfg.assets), function(asset) {
            return new Promise(function(resolve, reject) {
                let loader = new THREE.JSONLoader();
                loader.load('data/' + asset + '.json', function(geometry, materials) {
                    let material = materials[0];

                    if (_.contains(cfg.assets, asset)) {
                        let mesh = new THREE.Mesh(geometry, material);
                        self.meshes[asset] = mesh;
                    } else {
                        // Compute normals
                        geometry.computeFaceNormals();
                        geometry.computeVertexNormals();

                        // Duplicate black/white
                        _.forEach(cfg.sides, function(side) {
                            let meshMaterial = material.clone();
                            meshMaterial.color.setHex(cfg.colors.pieces[side].color);
                            meshMaterial.ambient.setHex(cfg.colors.pieces[side].ambient);
                            meshMaterial.emissive.setHex(cfg.colors.pieces[side].emissive);
                            meshMaterial.specular.setHex(cfg.colors.pieces[side].specular);

                            let mesh = new THREE.Mesh(geometry, meshMaterial);

                            if (!self.meshes[side]) {
                                self.meshes[side] = {};
                            }
                            self.meshes[side][asset] = mesh;
                        });
                    }

                    log('done loading', asset);
                    resolve();
                });
            });
        }));
    },

    setupBoard: function() {
        let self = this;

        self.addSkybox();
        self.addBoard();
        self.addPieces();
    },

    addSkybox: function() {
        let self = this;

        let material = new THREE.MeshLambertMaterial({
            color: 0xdadada,
            depthWrite: false,
            side: THREE.BackSide
        });

        let mesh = new THREE.Mesh(new THREE.BoxGeometry(150, 100, 200), material);
        mesh.position.set(0, 50, 0);
        // self.scene.add(mesh);
    },

    addBoard: function() {
        let self = this;

        self.board = new THREE.Object3D();
        self.board.add(self.meshes.board);
        self.board.scale.set(
            cfg.gameOpts.boardScale,
            cfg.gameOpts.boardScale,
            cfg.gameOpts.boardScale
        );

        self.scene.add(self.board);
    },

    addPieces: function() {
        let self = this;
        self.pieces = {};
        self.captured = { 'w': [], 'b': [] };

        _.forEach(cfg.startPosition, function(pieces, side) {
            _.forEach(pieces, function(piece, i) {
                self.addPiece(piece.pos, piece.type, side);
            });
        });
    },

    addPiece: function(pos, type, side) {
        log('creating', type, side);

        let self = this;
        let object = new THREE.Object3D();
        object.add(self.meshes[side][type].clone());
        object.position.setY(cfg.gameOpts.pieceYOffset);

        self.setPiecePosition(object, pos);

        // Rotate white
        if (side === 'white') {
            object.rotation.y = Math.PI;
        }

        self.scene.add(object);
        self.pieces[pos] = {
            type: type,
            side: side,
            object: object
        };
    },

    addFriendScreen: function(side, video) {
        let self = this;

        let material;

        if (video) {
            self.friendVideo = video;
            self.friendTexture = new THREE.Texture(video);

            self.friendTexture.generateMipmaps = false;

            material = new THREE.MeshLambertMaterial({
                map: self.friendTexture,
                emissive: 0xeeeeee
            });
        } else {
            // self.friendTexture = THREE.ImageUtils.loadTexture('grid.png');
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

        self.scene.add(cube);

        self.setPlayCameraPos(side);
    },

    addTileControls: function(legalCallback, moveCallback) {
        let self = this;
        self.legalCallback = legalCallback;
        self.moveCallback = moveCallback;

        self.tiles = {};

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
        _.forEach(cfg.files, function(file, i) {
            _.forEach(cfg.ranks, function(rank, i) {
                self.addTileControl(file + rank, geometry, material.clone());
            });
        });

        // Bind to mouse events
        self.raycaster = new THREE.Raycaster();
        self.addMouseListeners();
    },

    addTileControl: function(pos, geometry, material) {
        let self = this;

        let offsetX = cfg.fileToOffset[pos[0]];
        let offsetZ = cfg.rankToOffset[pos[1]];

        let tile = new THREE.Mesh(geometry, material);
        tile.rotation.x = Math.PI / 2;
        tile.position.setY(cfg.gameOpts.pieceYOffset + 0.05);

        tile.position.setX(-cfg.gameOpts.boardStartOffset + offsetX * cfg.gameOpts.tileSize);
        tile.position.setZ(cfg.gameOpts.boardStartOffset - offsetZ * cfg.gameOpts.tileSize);

        tile.isTile = true;
        tile.chessPos = pos;
        self.tiles[pos] = tile;

        self.scene.add(tile);
    },

    addMouseListeners: function() {
        let self = this;
        self.mousePos = new THREE.Vector2();
        document.addEventListener('mousemove', self.onMouseMove.bind(self), false);
        document.addEventListener('mousedown', self.onMouseDown.bind(self), false);
        document.addEventListener('mouseup', self.onMouseUp.bind(self), false);
    },

    onMouseMove: function(event) {
        let self = this;
        self.updateMousePos(event);
        self.highlightActiveTile();
    },

    updateMousePos: function(event) {
        let self = this;
        self.mousePos.x = (event.clientX / window.innerWidth) * 2 - 1;
        self.mousePos.y = -(event.clientY / window.innerHeight) * 2 + 1;
    },

    highlightActiveTile: function() {
        let self = this;
        self.recolorTiles();

        let intersected = self.intersectTile();
        if (intersected) {
            let tile = intersected.object;
            self.colorTile(tile, cfg.colors.tiles.active);
        }
    },

    onMouseDown: function(event) {
        event.preventDefault();

        let self = this;
        self.handleMoveSelection();
    },

    handleMoveSelection: function() {
        let self = this;
        let intersected = self.intersectTile();

        if (intersected) {
            let tile = intersected.object;

            // We're either in 'piece' or 'move' selection mode (the latter
            // being specific to a piece)
            if (self.isSelectingPieceMovement) {
                if (tile.isLegalMove) {
                    self.commitMove(tile);
                    self.resetTileHighlights();
                } else {
                    self.resetTileHighlights();
                    self.highlightLegalMoves(tile);
                }
            } else {
                self.highlightLegalMoves(tile);
            }
        }
    },

    commitMove: function(tile) {
        let self = this;
        self.moveCallback.call(self, self.selectedPos, tile.chessPos);

        self.isSelectingPieceMovement = false;
        self.selectedPos = null;
    },

    highlightLegalMoves: function(tile) {
        let self = this;
        self.isSelectingPieceMovement = true;
        self.selectedPos = tile.chessPos;

        self.colorTile(tile, cfg.colors.tiles.selected);

        // Get legal moves and highlight them
        self.currentLegalMoves = self.legalCallback.call(self, tile.chessPos);
        _.forEach(self.currentLegalMoves, function(move) {
            let tile = self.tiles[move.to];
            tile.isLegalMove = true;
            self.colorTile(tile, cfg.colors.tiles.legal);
        });
    },

    resetTileHighlights: function() {
        let self = this;

        _.forEach(self.tiles, function(tile, pos) {
            tile.isLegalMove = null;
        });
        self.recolorTiles();
    },

    recolorTiles: function() {
        let self = this;

        _.forEach(self.tiles, function(tile, pos) {
            self.hideTile(tile);

            // Recolor
            if (tile.isLegalMove) {
                self.colorTile(tile, cfg.colors.tiles.legal);
            } else if (tile.chessPos == self.selectedPos) {
                self.colorTile(tile, cfg.colors.tiles.selected);
            } else if (tile.chessPos === self.prevPosFrom) {
                self.colorTile(tile, cfg.colors.tiles.prevFrom);
            } else if (tile.chessPos === self.prevPosTo) {
                self.colorTile(tile, cfg.colors.tiles.prevTo);
            }
        });
    },

    colorTile: function(tile, color) {
        tile.material.color.setHex(color);
        tile.material.opacity = cfg.gameOpts.tileOpacity;
    },

    hideTile: function(tile) {
        tile.material.opacity = 0;
    },

    performGraphicalMove: function(move) {
        let self = this;
        let piece = self.pieces[move.from];

        if (typeof piece === 'undefined') {
            log('ERROR: piece not found - bug?');
            return;
        }

        // Cache previous move for highlighting
        self.prevPosFrom = move.from;
        self.prevPosTo = move.to;

        // Handle moves (order matters because of interactions with
        // `self.pieces`)

        if (move.flags.indexOf('e') !== -1) {
            /** En passant */
        }
        if (move.flags.indexOf('c') !== -1) {
            /** Standard capture */
            let capturedPiece = self.pieces[move.to];
            delete self.pieces[move.to];
            self.captured[move.color].push(capturedPiece);

            self.hidePiece(capturedPiece.object);

            // Move capturing piece
            delete self.pieces[move.from];
            self.pieces[move.to] = piece;

            self.setPiecePosition(piece.object, move.to);
        }
        if (move.flags.indexOf('n') !== -1 || move.flags.indexOf('b') !== -1) {
            /** Standard non-capture or pawn-push */
            delete self.pieces[move.from];
            self.pieces[move.to] = piece;

            self.setPiecePosition(piece.object, move.to);
        }
        if (move.flags.indexOf('p') !== -1) {
            /** Promotion */
        }
        if (move.flags.indexOf('k') !== -1) {
            /** Kingside castle */
        }
        if (move.flags.indexOf('q') !== -1) {
            /** Queenside castle */
        }

        self.recolorTiles();
    },

    onMouseUp: function(event) {
        event.preventDefault();
    },

    intersectTile: function() {
        let self = this;
        self.raycaster.setFromCamera(self.mousePos, self.camera);

        let intersects = self.raycaster.intersectObjects(self.scene.children);
        return _.first(_.filter(intersects, function(intersected) {
            return intersected.object.isTile;
        }));
    },

    setPiecePosition: function(object, pos) {
        let offsetX = cfg.fileToOffset[pos[0]];
        let offsetZ = cfg.rankToOffset[pos[1]];

        object.position.setX(-cfg.gameOpts.boardStartOffset + offsetX * cfg.gameOpts.tileSize);
        object.position.setZ(cfg.gameOpts.boardStartOffset - offsetZ * cfg.gameOpts.tileSize);
    },

    hidePiece: function(object) {
        object.visible = false;
    },

    beginRender: function() {
        let self = this;
        self.render = self.render.bind(self);
        self.previousTime = new Date().getTime();
        self.requestId = requestAnimationFrame(self.render);
    },

    render: function(timestamp) {
        let self = this;

        self.requestId = requestAnimationFrame(self.render);

        // Compute delta time
        let now = new Date().getTime();
        let delta = now - self.previousTime;
        self.previousTime = now;

        // Animations

        // Video texture
        if (self.friendVideo && self.friendVideo.readyState === self.friendVideo.HAVE_ENOUGH_DATA) {
            self.friendTexture.needsUpdate = true;
        }

        self.renderer.render(self.scene, self.camera);
    }
};
