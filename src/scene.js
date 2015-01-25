'use strict';

var Promise = require('promise');
var _ = require('lodash');

var cfg = require('./config');
var log = require('./log');

module.exports = {
    init: function() {
        var self = this;
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
        var self = this;
        self.camera.aspect = window.innerWidth / window.innerHeight;
        self.camera.updateProjectionMatrix();

        self.renderer.setSize(window.innerWidth, window.innerHeight);
    },

    createRenderer: function() {
        // Choose between WebGL and Canvas renderer based on availability
        var self = this;
        var renderer = self.webglAvailable() ?
            new THREE.WebGLRenderer({ antialias: true }) :
            new THREE.CanvasRenderer();

        return renderer;
    },

    webglAvailable: function() {
        try {
            var canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && (
                canvas.getContext('webgl') ||
                canvas.getContext('experimental-webgl')
            ));
        } catch (e) {
            return false;
        }
    },

    addLighting: function() {
        var self = this;
        self.dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
        self.dirLight.position.set(0, 80, 0).normalize();
        self.scene.add(self.dirLight);

        self.hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.2);
        self.scene.add(self.hemiLight);
    },

    setInitialCameraPos: function() {
        var self = this;
        self.camera.position.x = cfg.gameOpts.cameraStartPos.x;
        self.camera.position.y = cfg.gameOpts.cameraStartPos.y;
        self.camera.position.z = cfg.gameOpts.cameraStartPos.z;
        self.camera.lookAt(new THREE.Vector3(0, 0, 0));
    },

    setPlayCameraPos: function(side) {
        var self = this;
        self.camera.position.x = cfg.gameOpts.cameraPlayPos.x;
        self.camera.position.y = cfg.gameOpts.cameraPlayPos.y;
        self.camera.position.z = (side === 'black' ? -1 : 1) * cfg.gameOpts.cameraPlayPos.z;
        self.camera.lookAt(new THREE.Vector3(0, 0, 0));
    },

    loadGameGeometry: function() {
        var self = this;
        self.meshes = {};

        // Load all pieces
        return Promise.all(_.map(cfg.pieces.concat(cfg.assets), function(asset) {
            return new Promise(function(resolve, reject) {
                var loader = new THREE.JSONLoader();
                loader.load('data/' + asset + '.json', function(geometry, materials) {
                    var material = materials[0];

                    if (_.contains(cfg.assets, asset)) {
                        var mesh = new THREE.Mesh(geometry, material);
                        self.meshes[asset] = mesh;
                    } else {
                        // Compute normals
                        geometry.computeFaceNormals();
                        geometry.computeVertexNormals();

                        // Duplicate black/white
                        _.forEach(cfg.sides, function(side) {
                            var meshMaterial = material.clone();
                            meshMaterial.color.setHex(cfg.colors.pieces[side].color);
                            meshMaterial.ambient.setHex(cfg.colors.pieces[side].ambient);
                            meshMaterial.emissive.setHex(cfg.colors.pieces[side].emissive);
                            meshMaterial.specular.setHex(cfg.colors.pieces[side].specular);

                            var mesh = new THREE.Mesh(geometry, meshMaterial);

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
        var self = this;

        self.addSkybox();
        self.addBoard();
        self.addPieces();
    },

    addSkybox: function() {
        var self = this;

        var material = new THREE.MeshLambertMaterial({
            color: 0xdadada,
            depthWrite: false,
            side: THREE.BackSide
        });

        var mesh = new THREE.Mesh(new THREE.BoxGeometry(150, 100, 200), material);
        mesh.position.set(0, 50, 0);
        // self.scene.add(mesh);
    },

    addBoard: function() {
        var self = this;

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
        var self = this;
        self.pieces = {};

        _.forEach(cfg.startPosition, function(pieces, side) {
            _.forEach(pieces, function(piece, i) {
                self.addPiece(piece.pos, piece.type, side);
            });
        });
    },

    addPiece: function(pos, type, side) {
        log('creating', type, side);

        var self = this;
        var object = new THREE.Object3D();
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
        var self = this;

        var material;

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

        var filler = new THREE.MeshLambertMaterial({
            color: cfg.colors.friendScreen
        });

        // Only a single face needs the video
        var materials = [filler, filler, filler, filler, material, filler];

        var geometry = new THREE.BoxGeometry(
            cfg.gameOpts.friendScreenSize.x,
            cfg.gameOpts.friendScreenSize.y,
            cfg.gameOpts.friendScreenSize.z
        );

        var cube = new THREE.Mesh(geometry, new THREE.MeshFaceMaterial(materials));
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
        var self = this;
        self.legalCallback = legalCallback;
        self.moveCallback = moveCallback;

        self.tiles = {};

        // Create geometry and material
        var geometry = new THREE.PlaneGeometry(
            cfg.gameOpts.tileSize,
            cfg.gameOpts.tileSize
        );

        var material = new THREE.MeshLambertMaterial({
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
        var self = this;

        var offsetX = cfg.fileToOffset[pos[0]];
        var offsetZ = cfg.rankToOffset[pos[1]];

        var tile = new THREE.Mesh(geometry, material);
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
        var self = this;
        self.mousePos = new THREE.Vector2();
        document.addEventListener('mousemove', self.onMouseMove.bind(self), false);
        document.addEventListener('mousedown', self.onMouseDown.bind(self), false);
        document.addEventListener('mouseup', self.onMouseUp.bind(self), false);
    },

    onMouseMove: function(event) {
        var self = this;
        self.updateMousePos();
        self.highlightActiveTile();
    },

    updateMousePos: function(event) {
        var self = this;
        self.mousePos.x = (event.clientX / window.innerWidth) * 2 - 1;
        self.mousePos.y = -(event.clientY / window.innerHeight) * 2 + 1;
    },

    highlightActiveTile: function() {
        var self = this;
        var intersected = self.intersectTile();

        if (intersected) {
            if (intersected !== self.previousIntersect) {
                if (self.previousIntersect) {
                    self.resetTile(self.previousIntersect);
                    self.previousIntersect = null;
                }

                var tile = intersected.object;
                self.colorTile(tile, cfg.colors.tiles.active);
                self.previousIntersect = tile;
            }
        } else {
            // No intersection
            if (self.previousIntersect) {
                self.resetTile(self.previousIntersect);
                self.previousIntersect = null;
            }
        }
    },

    onMouseDown: function(event) {
        event.preventDefault();

        var self = this;
        self.handleMoveSelection();
    },

    handleMoveSelection: function() {
        var self = this;
        var intersected = self.intersectTile();

        if (intersected) {
            // We're either in 'piece' or 'move' selection mode (the latter
            // being specific to a piece)
            if (self.isSelectingPieceMovement) {
            } else {
                self.isSelectingPieceMovement = true;
                var tile = intersected.object;

                self.colorTile(tile, cfg.colors.tiles.prevFrom);

                // Get legal moves and highlight them
                self.currentLegalMoves = self.legalCallback.call(self, tile.chessPos);
                _.forEach(self.currentLegalMoves, function(move) {
                    var tile = self.tiles[move.to];
                    self.colorTile(tile, cfg.colors.tiles.legal);
                });
            }
        }
    },

    colorTile: function(tile, color) {
        tile.previousColor = tile.material.color.getHex();
        tile.previousOpacity = tile.material.opacity;
        tile.material.color.setHex(color);
        tile.material.opacity = cfg.gameOpts.tileOpacity;
    },

    resetTile: function(tile) {
        tile.material.color.setHex(tile.previousColor);
        tile.material.opacity = tile.previousOpacity;
    },

    onMouseUp: function(event) {
        event.preventDefault();
    },

    intersectTile: function() {
        var self = this;
        self.raycaster.setFromCamera(self.mousePos, self.camera);

        var intersects = self.raycaster.intersectObjects(self.scene.children);
        return _.first(_.filter(intersects, function(intersected) {
            return intersected.object.isTile;
        }));
    },

    setPiecePosition: function(object, pos) {
        var offsetX = cfg.fileToOffset[pos[0]];
        var offsetZ = cfg.rankToOffset[pos[1]];

        object.position.setX(-cfg.gameOpts.boardStartOffset + offsetX * cfg.gameOpts.tileSize);
        object.position.setZ(cfg.gameOpts.boardStartOffset - offsetZ * cfg.gameOpts.tileSize);
    },

    beginRender: function() {
        var self = this;
        self.render = self.render.bind(self);
        self.previousTime = new Date().getTime();
        self.requestId = requestAnimationFrame(self.render);
    },

    render: function(timestamp) {
        var self = this;

        self.requestId = requestAnimationFrame(self.render);

        // Compute delta time
        var now = new Date().getTime();
        var delta = now - self.previousTime;
        self.previousTime = now;

        // Animations

        // Video texture
        if (self.friendVideo && self.friendVideo.readyState === self.friendVideo.HAVE_ENOUGH_DATA) {
            self.friendTexture.needsUpdate = true;
        }

        self.renderer.render(self.scene, self.camera);
    }
};
