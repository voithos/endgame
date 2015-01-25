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
        self.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(self.renderer.domElement);

        self.addLighting();
        self.setInitialCameraPos();
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
        self.dirLight = new THREE.DirectionalLight();
        self.dirLight.position.set(20, 80, 80).normalize();
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

        if (video) {
            self.friendVideo = video;
            self.friendTexture = new THREE.Texture(video);

            self.friendTexture.generateMipmaps = false;
            self.friendTexture.format = THREE.RGBFormat
        } else {
            self.friendTexture = THREE.ImageUtils.loadTexture('grid.png');
        }

        var material = new THREE.MeshLambertMaterial({
            // TODO: Video texture not quite working just yet
            // map: self.friendTexture
        });

        var materials = [material];
        for (var i = 0; i < 5; i++) {
            materials.push(new THREE.MeshLambertMaterial({
                color: cfg.colors.friendScreen
            }));
        }

        var geometry = new THREE.BoxGeometry(
            cfg.gameOpts.friendScreenSize.x,
            cfg.gameOpts.friendScreenSize.y,
            cfg.gameOpts.friendScreenSize.z
        );

        var cube = new THREE.Mesh(geometry, new THREE.MeshFaceMaterial(materials));
        self.scene.add(cube);
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
        if (self.friendVideo && self.friendVideo.readyState === self.friendVideo.HAVE_ENOUGH_DATA) {
            self.friendTexture.needsUpdate = true;
        }

        self.renderer.render(self.scene, self.camera);
    }
};
