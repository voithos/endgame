import js from '@eslint/js';
import globals from 'globals';

export default [
    {ignores: ['public/**', 'dist/**', 'node_modules/**']},
    js.configs.recommended,
    {
        files: ['src/**/*.js'],
        languageOptions: {
            globals: {
                ...globals.browser,
                Chess: 'readonly',
                Peer: 'readonly',
                firebase: 'readonly',
                THREE: 'readonly',
                THREEx: 'readonly',
                TWEEN: 'readonly',
                Vue: 'readonly',
                $: 'readonly',
                toastr: 'readonly',
                MobileDetect: 'readonly'
            }
        },
        rules: {
            'no-var': 'warn',
            'no-console': 'error',
            'no-unused-vars': ['error', {
                argsIgnorePattern: '^unused',
                caughtErrors: 'none'
            }]
        }
    },
    {
        files: ['scripts/**/*.mjs', 'test/**/*.mjs', 'eslint.config.mjs'],
        languageOptions: {globals: globals.node}
    }
];
