var gulp = require('gulp');
var gutil = require('gulp-util');
var jasmine = require('gulp-jasmine');
var eslint = require('gulp-eslint');
var clangFormat = require('gulp-clang-format');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
var sourcemaps = require('gulp-sourcemaps');
var concat = require('gulp-concat');
var inject = require('gulp-inject');
var clean = require('gulp-clean');

var minifyCss = require('gulp-minify-css');
var rev = require('gulp-rev');
var revdel = require('gulp-rev-delete-original');

var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');

var browserify = require('browserify');
var watchify = require('watchify');
var babelify = require('babelify');
var browserSync = require('browser-sync').create();

var glob = require('glob');
var path = require('path');
var extend = require('extend');

// Constants and config.
// --------------------
var VIRT_FILE = 'endgame.js';
var VIRT_MIN_FILE = 'endgame.min.js';
var VIRT_TEST_FILE = 'endgame_specbundle.js';
var VIRT_CSS = 'endgame.css';
var VIRT_HTML = 'index.html';
var ENTRY_HTML = './public/index.html';
var ENTRY_FILE = './src/endgame.js';
var BUILD_PATH = './public/js';
var SRC_DIR = './src';
var TEST_DIR = './test';
var BASE_DIR = './public';
var DIST_DIR = './dist';
var SRC_PATTERN = './src/**/*.js';
var TEST_PATTERN = './test/**/*_spec.js';

var WATCHIFY_CONFIG = {
    entries: [],
    // For source maps.
    debug: true,
    // `cache` and `packageCache` required by watchify.
    cache: {},
    packageCache: {},
    plugin: [watchify]
};

var BABELIFY_CONFIG = {
    presets: ['es2015']
};

var ESLINT_CONFIG = {
    extends: 'eslint:recommended',
    parserOptions: {
        ecmaVersion: 6,
        sourceType: 'module'
    },
    env: {
        browser: true,
        es6: true
    },
    rules: {
        'no-var': 1,
        'no-unused-vars': ['error', {'argsIgnorePattern': '^unused'}]
    },
    globals: {
        'Chess': true,
        'Peer': true,
        'Firebase': true,
        'THREE': true,
        'THREEx': true,
        'TWEEN': true,
        'Vue': true,
        '$': true
    }
};

var SRC_CONFIG = {
    misc: ['public/index.html', 'public/favicon.ico'],
    css: ['public/css/endgame.css'],
    js: [
        'public/js/vendor/three.js',
        'public/js/vendor/peer.js',
        'public/js/vendor/three.canvasrenderer.js',
        'public/js/vendor/three.copyshader.js',
        'public/js/vendor/three.convolutionshader.js',
        'public/js/vendor/three.fxaashader.js',
        'public/js/vendor/three.ssaoshader.js',
        'public/js/vendor/three.effectcomposer.js',
        'public/js/vendor/three.bloompass.js',
        'public/js/vendor/three.maskpass.js',
        'public/js/vendor/three.renderpass.js',
        'public/js/vendor/three.shaderpass.js',
        'public/js/vendor/three.texturepass.js',
        'public/js/vendor/three.mirror.js',
        'public/js/vendor/three.orbitcontrols.js',
        'public/js/vendor/threex.atmospherematerial.js',
        'public/js/vendor/threex.dilategeometry.js',
        'public/js/vendor/threex.geometricglowmesh.js',
        'public/js/vendor/chess.js',
        'public/js/vendor/tween.js',
        'public/js/endgame.js'
    ]
};


// Tasks
// -----

/**
 * Prints the error message.
 */
var onError = function(e) {
    if (e && e.codeFrame) {
        // Babel error.
        gutil.log(
                gutil.colors.red(e.filename) + ':' +
                gutil.colors.cyan(e.loc.line + ',' + e.loc.column) + '\n' +
                e.message + '\n' +
                e.codeFrame);
    } else {
        gutil.log(gutil.colors.red(e));
    }
};


var bundler;

/**
 * Get the currently configured browserify bundler instance. If none exists,
 * instantiate and configure it.
 * @param {!Array<string>} entries Entry points for browserify
 * @param {boolean=} opt_isWatcher Whether watchify should be used
 */
var getBundler = function(entries, opt_isWatcher) {
    if (!bundler) {
        bundler = browserify(opt_isWatcher ?
                extend({}, WATCHIFY_CONFIG, { entries: entries }) :
                entries)
            .transform(babelify, BABELIFY_CONFIG);
    }
    return bundler;
};


/**
 * Run the currently configured bundler and save the output in the build
 * directory.
 */
var build = function() {
    return getBundler([ENTRY_FILE])
        .bundle()
        .on('error', onError)
        // We're using native browserify, which doesn't know about gulp,
        // so we pipe it to vinyl-source-stream to convert browserify's
        // text stream to an efficient vinyl stream usable by gulp.
        .pipe(source(VIRT_FILE))
        .pipe(buffer())
        .pipe(sourcemaps.init())
        .pipe(gulp.dest(BUILD_PATH))
        .pipe(rename(VIRT_MIN_FILE))
        .pipe(sourcemaps.init({ loadMaps: true }))
        .pipe(uglify())
        // Passing a relative path here forces the source maps to be
        // written externally.
        .pipe(sourcemaps.write('./'))
        .pipe(gulp.dest(BUILD_PATH));
};


/**
 * Setup a browser-sync server and add a change listener to the currently
 * configured bundler.
 */
var watch = function() {
    browserSync.init({
        server: {
            baseDir: BASE_DIR
        }
    });

    var bundler = getBundler([ENTRY_FILE], /* isWatcher */ true);
    bundler.on('update', function() {
        gulp.start('watch-reload');
    });
    return build();
};


/**
 * Build ES6 tests into a single bundle in the build directory.
 */
var buildTests = function() {
    var specs = glob.sync(TEST_PATTERN);
    return getBundler(specs)
        .bundle()
        .on('error', onError)
        .pipe(source(VIRT_TEST_FILE))
        .pipe(gulp.dest(TEST_DIR));
};


/**
 * Run built tests with jasmine.
 */
var test = function() {
    return gulp.src(path.join(TEST_DIR, VIRT_TEST_FILE))
        .pipe(jasmine());
};


/**
 * Setup the watch-test bundler.
 */
var watchTestSetup = function() {
    var specs = glob.sync(TEST_PATTERN);
    var bundler = getBundler(specs, /* isWatcher */ true);
    bundler.on('update', function() {
        gulp.start('test');
    });
};


/**
 * Inject srcs into index.
 */
var index = function() {
    return gulp.src(ENTRY_HTML)
        .pipe(inject(
            gulp.src(SRC_CONFIG.css.concat(SRC_CONFIG.js), {read: false}),
            {relative: true}))
        .pipe(gulp.dest(BASE_DIR));
};


/**
 * Minify and relocate data files.
 */
var distData = function() {
    return gulp.src(path.join(BASE_DIR, 'data') + '/**')
        .pipe(gulp.dest(path.join(DIST_DIR, 'data')));
};


/**
 * Minify and relocate misc files.
 */
var distMisc = function() {
    return gulp.src(SRC_CONFIG.misc)
        .pipe(gulp.dest(DIST_DIR));
};


/**
 * Minify and relocate js.
 */
var distJs = function() {
    return gulp.src(SRC_CONFIG.js)
        .pipe(concat(VIRT_FILE))
        .pipe(uglify())
        .pipe(gulp.dest(path.join(DIST_DIR, 'js')));
};


/**
 * Minify and relocate css.
 */
var distCss = function() {
    return gulp.src(SRC_CONFIG.css)
        .pipe(concat(VIRT_CSS))
        .pipe(minifyCss())
        .pipe(gulp.dest(path.join(DIST_DIR, 'css')));
};


/**
 * Add revision IDs.
 */
var distRev = function() {
    var sources = [path.join(DIST_DIR, '**/*.css'), path.join(DIST_DIR, '**/*.js')];
    return gulp.src(sources, {base: DIST_DIR})
        .pipe(rev())
        .pipe(revdel())
        .pipe(gulp.dest(DIST_DIR));
};


/**
 * Rename the revision IDs in the html.
 */
var distRename = function() {
    var sources = [path.join(DIST_DIR, '**/*.css'), path.join(DIST_DIR, '**/*.js')];
    return gulp.src(path.join(DIST_DIR, VIRT_HTML))
        .pipe(inject(
            gulp.src(sources, {read: false}),
            {relative: true}))
        .pipe(gulp.dest(DIST_DIR));
};


/**
 * Clean dist directory.
 */
var distClean = function() {
    return gulp.src(DIST_DIR, {read: false})
        .pipe(clean());
};


/**
 * Starts a local server for the minified sources.
 */
var distServe = function() {
    browserSync.init({
        server: {
            baseDir: DIST_DIR
        }
    });
};


/**
 * Lint the source files.
 */
var lint = function() {
    return gulp.src(SRC_PATTERN)
        .pipe(eslint(ESLINT_CONFIG))
        .pipe(eslint.format())
        .pipe(eslint.failAfterError());
};


/**
 * Lint the test files.
 */
var lintTests = function() {
    var eslintConfig = extend({}, ESLINT_CONFIG);
    eslintConfig.env['jasmine'] = true;
    return gulp.src(TEST_PATTERN)
        .pipe(eslint(eslintConfig))
        .pipe(eslint.format())
        .pipe(eslint.failAfterError());
};


/**
 * Check format of source files.
 */
var checkFormat = function() {
    return gulp.src(SRC_PATTERN)
        .pipe(clangFormat.checkFormat('file', undefined, {verbose: true}));
};


/**
 * Check format of test files.
 */
var checkFormatTests = function() {
    return gulp.src(TEST_PATTERN)
        .pipe(clangFormat.checkFormat('file', undefined, {verbose: true}));
};


/**
 * Autoformat source files.
 */
var format = function() {
    return gulp.src(SRC_PATTERN)
        .pipe(clangFormat.format('file'))
        .pipe(gulp.dest(SRC_DIR));
};


/**
 * Autoformat test files.
 */
var formatTests = function() {
    return gulp.src(TEST_PATTERN)
        .pipe(clangFormat.format('file'))
        .pipe(gulp.dest(TEST_DIR));
};


// Build
gulp.task('index', index);
gulp.task('build', ['index'], build);
gulp.task('watch', ['index'], watch);
gulp.task('watch-reload', ['build'], function() {
    browserSync.reload();
});

// Tests
gulp.task('build-tests', buildTests);
gulp.task('test', ['build-tests'], test);
gulp.task('watch-test-setup', watchTestSetup);
gulp.task('watch-test', ['watch-test-setup', 'test']);

// Misc
gulp.task('lint', lint);
gulp.task('lint-tests', lintTests);
gulp.task('check-format', checkFormat);
gulp.task('check-format-tests', checkFormatTests);
gulp.task('format', format);
gulp.task('format-tests', formatTests);

gulp.task('dist-clean', distClean);
gulp.task('dist-data', ['dist-clean'], distData);
gulp.task('dist-misc', ['dist-clean'], distMisc);
gulp.task('dist-js', ['dist-clean', 'build'], distJs);
gulp.task('dist-css', ['dist-clean'], distCss);
gulp.task('dist-rev', ['dist-js', 'dist-css'], distRev);
gulp.task('dist', ['dist-data', 'dist-misc', 'dist-rev'], distRename);
gulp.task('dist-serve', ['dist'], distServe);


gulp.task('validate', ['test', 'lint', 'lint-tests']);

gulp.task('default', ['watch']);
