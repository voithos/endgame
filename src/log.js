let logEnabled = true;

export default function() {
    if (window.console && logEnabled) {
        console.log.apply(console, Array.prototype.slice.call(arguments)); // eslint-disable-line no-console
    }
}
