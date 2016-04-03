var gulp = require('gulp');
var gutil = require('gulp-util');
var jasmine = require('gulp-jasmine');
var eslint = require('gulp-eslint');
var uglify = require('gulp-uglify');
var rename = require('gulp-rename');
var sourcemaps = require('gulp-sourcemaps');

var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');

var browserify = require('browserify');
var watchify = require('watchify');
var babelify = require('babelify');
var browserSync = require('browser-sync').create();

var del = require('del');
var glob = require('glob');
var path = require('path');
var extend = require('extend');

// Constants and config.
// --------------------
var VIRT_FILE = 'endgame.js';
var VIRT_MIN_FILE = 'endgame.min.js';
var VIRT_TEST_FILE = 'endgame_spec.js';
var ENTRY_FILE = './src/endgame.js';
var BUILD_PATH = './public/js';
var BASE_DIR = './public';
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
    env: {
        browser: true,
        es6: true
    },
    ecmaFeatures: {
        modules: true
    },
    rules: {
        'no-var': 1
    }
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
        .pipe(gulp.dest(BUILD_PATH))
        .pipe(rename(VIRT_MIN_FILE))
        .pipe(sourcemaps.init({ loadMaps: true }))
            .pipe(uglify())
        // Passing a relative path here forces the source maps to be
        // written externally.
        .pipe(sourcemaps.write(BASE_DIR))
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
        .pipe(gulp.dest(BUILD_PATH));
};


/**
 * Run built tests with jasmine.
 */
var test = function() {
    return gulp.src(path.join(BUILD_PATH, VIRT_TEST_FILE))
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
 * Clean the build directory.
 */
var clean = function() {
    return del(BUILD_PATH);
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


// Build
gulp.task('build', build);
gulp.task('watch', watch);
gulp.task('watch-reload', ['build'], function() {
    browserSync.reload();
});

// Tests
gulp.task('build-tests', buildTests);
gulp.task('test', ['build-tests'], test);
gulp.task('watch-test-setup', watchTestSetup);
gulp.task('watch-test', ['watch-test-setup', 'test']);

// Misc
gulp.task('clean', clean);
gulp.task('lint', lint);
gulp.task('lint-tests', lintTests);


gulp.task('validate', ['test', 'lint', 'lint-tests']);

gulp.task('default', ['watch']);
