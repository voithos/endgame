let logEnabled = true;

export default function() {
    if (global.console && logEnabled) {
        console.log.apply(console, Array.prototype.slice.call(arguments));
    }
};
