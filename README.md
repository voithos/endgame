                    _
      ___ _ __   __| | __ _  __ _ _ __ ___   ___
     / _ \ '_ \ / _` |/ _` |/ _` | '_ ` _ \ / _ \
    |  __/ | | | (_| | (_| | (_| | | | | | |  __/
     \___|_| |_|\__,_|\__, |\__,_|_| |_| |_|\___|
                      |___/

A WebRTC-enabled 3D chess game. [endgame-chess.firebaseapp.com](https://endgame-chess.firebaseapp.com/)

## Intro

endgame is a simple online 3D chess game. Load the page, share the link,
connect up and play chess!

endgame began as an entry for Static Showdown 2015, and has slowly crystallized
into existence from that point on. The goal was to build an interesting way of
playing chess with remote friends or family, while using it as an excuse to
learn about
[WebRTC](https://developer.mozilla.org/en-US/docs/Web/Guide/API/WebRTC) and
[WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API).

## Development

Get the code and install the Node packages.

    git clone https://github.com/voithos/endgame.git
    cd endgame
    npm install

Then just run `gulp` to build and serve the app locally!

### Deployment

For deployment, there are a set of `dist` gulp tasks that can be used to
isolate, concatenate, and minify endgame's source.

- `gulp dist` will build and minify a distributable set of files for endgame,
  under the `dist` directory
- `gulp dist-serve` will launch a local web serve for the minified source
- `gulp dist-clean` will clean and remove the `dist` files

endgame was made to be hosted on Firebase. See their docs for directions on how
to set up Firebase hosting and DB. To use a custom Firebase DB, modify the
`DB_BASE_URL` constant in `src/config.js`.

After configuring Firebase, simply run `gulp dist` to generate the
distributable and then `firebase deploy` to deploy to hosting.

## Attribution

This project wouldn't be possible without the generosity of open source
creators and contributors. See `ATTRIBUTION.md` for a list of the libraries,
tools, and assets used.
