import Promise from 'promise';

import routes from './routes';

export default {
    showWaitScreen(gameId) {
        this.waitScreen = new Vue({
            el: '#waitscreen',
            data: {
                link: routes.genGameUrl(gameId)
            },
            methods: {
                onClick(e) {
                    let select = window.getSelection();
                    let range = document.createRange();
                    range.selectNodeContents(e.target);
                    select.addRange(range);
                }
            }
        });

        $('#waitscreen').modal({
            backdrop: false,
            keyboard: false
        });

        return Promise.resolve();
    },

    showMediaScreen() {
        $('#waitscreen').modal('hide');

        $('#mediascreen').modal({
            backdrop: false,
            keyboard: false
        });

        return Promise.resolve();
    },

    showStatusScreen(capturedPieces) {
        $('#mediascreen').modal('hide');

        this.statusScreen = new Vue({
            el: '#statusscreen',
            data: {
                colors: ['white', 'black'],
                pieces: ['pawn', 'knight', 'bishop', 'rook', 'queen'],
                capturedPieces: capturedPieces
            }
        });
        $('#statusscreen').show('slow');

        return Promise.resolve();
    },

    showPromotionScreen(color) {
        return new Promise((resolve, unused_reject) => {
            let onClick = (piece, e) => {
                e.preventDefault();
                $('#promotionscreen').modal('hide');
                this.promotionScreen.$destroy();
                // TODO: Move this to config, and use the reverse-mapping in scene.js
                let promotion =
                    ({'queen': 'q', 'rook': 'r', 'bishop': 'b', 'knight': 'n'})[piece];
                resolve(promotion);
            };

            this.promotionScreen = new Vue({
                el: '#promotionscreen',
                data: {
                    color: color,
                    pieces: ['queen', 'rook', 'bishop', 'knight']
                },
                methods: {
                    onClick: onClick
                }
            });

            $('#promotionscreen').modal({
                backdrop: 'static',
                keyboard: false
            });
        });
    },

    showMessage(title, msg, type = null) {
        if (this.messageScreen) {
            this.messageScreen.$destroy();
        }

        this.messageScreen = new Vue({
            el: '#messagescreen',
            data: {
                title,
                msg,
                type
            }
        });

        $('#messagescreen').modal({
            backdrop: 'static',
            keyboard: false
        });
    }
};
