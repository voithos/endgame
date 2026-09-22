                    _
      ___ _ __   __| | __ _  __ _ _ __ ___   ___
     / _ \ '_ \ / _` |/ _` |/ _` | '_ ` _ \ / _ \
    |  __/ | | | (_| | (_| | (_| | | | | | |  __/
     \___|_| |_|\__,_|\__, |\__,_|_| |_| |_|\___|
                      |___/

A WebRTC-enabled 3D chess game. [endgame-chess.web.app](https://endgame-chess.web.app/)

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

Get the code and install the Node packages. You'll need Node.js 22 or newer.

    git clone https://github.com/voithos/endgame.git
    cd endgame
    npm ci

Then just run `npm run dev` to build and serve the app locally!

Run `npm run validate` to lint the code and check the production build.

### Deployment

For deployment, there are a couple of build commands:

- `npm run build` builds and minifies endgame into `dist`, with versioned
  JavaScript and CSS filenames
- `npm run preview` builds and serves the distributable locally

endgame was made to be hosted on Firebase. See their docs for directions on how
to set up Firebase hosting and DB. To use a custom Firebase DB, modify the
`FIREBASE_CONFIG` constant in `src/config.js`.

After configuring Firebase, simply run `npm run build` to generate the
distributable and then `firebase deploy` to deploy to hosting.

## Attribution

This project wouldn't be possible without the generosity of open source
creators and contributors. See `ATTRIBUTION.md` for a list of the libraries,
tools, and assets used.
