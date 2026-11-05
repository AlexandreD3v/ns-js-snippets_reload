'use strict';

const { spawn } = require('child_process');
const path = require('path');

const cli = path.join(__dirname, '..', 'node_modules', '.bin', 'vscode-test');
const linux = process.platform === 'linux';
const command = linux ? 'xvfb-run' : cli;
const args = linux ? ['-a', '-s', '-screen 0 1920x1080x24', cli] : [];
const child = spawn(command, args, {
    stdio: 'inherit',
    env: {
        ...process.env,
        LIBGL_ALWAYS_SOFTWARE: process.env.LIBGL_ALWAYS_SOFTWARE || '1'
    }
});

child.on('error', (error) => {
    if (error.code === 'ENOENT' && linux) {
        console.error('xvfb-run não está instalado. No Ubuntu: sudo apt-get install -y xvfb');
    } else {
        console.error(error);
    }
    process.exit(1);
});

child.on('exit', (code, signal) => {
    if (signal) {
        process.kill(process.pid, signal);
        return;
    }
    process.exit(code == null ? 1 : code);
});
