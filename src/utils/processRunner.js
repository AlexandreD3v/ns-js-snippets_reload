const { spawn } = require('child_process');

const WINDOWS_META = /[\s"&|<>^()%!]/;
const POSIX_SAFE = /^[A-Za-z0-9_@%+=:,./-]+$/;

function quoteArg(value, platform = process.platform) {
    const text = String(value);

    if (platform === 'win32') {
        if (text !== '' && !WINDOWS_META.test(text)) {
            return text;
        }
        return `"${text.replace(/"/g, '""').replace(/%/g, '%%')}"`;
    }

    if (text !== '' && POSIX_SAFE.test(text)) {
        return text;
    }
    return `'${text.replace(/'/g, `'\\''`)}'`;
}

function buildCommandLine(executable, args, platform = process.platform) {
    return [executable, ...args].map((part) => quoteArg(part, platform)).join(' ');
}

function runProcess(executable, args, options = {}) {
    const { cwd, onOutput, token } = options;

    return new Promise((resolve) => {
        const useShell = process.platform === 'win32';
        const child = useShell
            ? spawn(buildCommandLine(executable, args), { cwd, shell: true, windowsHide: true })
            : spawn(executable, args, { cwd, shell: false });

        let output = '';
        const append = (chunk) => {
            const text = chunk.toString();
            output += text;
            if (onOutput) {
                onOutput(text);
            }
        };

        child.stdout.on('data', append);
        child.stderr.on('data', append);

        const cancellation = token?.onCancellationRequested
            ? token.onCancellationRequested(() => child.kill())
            : null;

        child.on('error', (error) => {
            cancellation?.dispose();
            resolve({ exitCode: -1, output, error, cancelled: false });
        });

        child.on('close', (exitCode) => {
            cancellation?.dispose();
            resolve({
                exitCode: exitCode === null ? -1 : exitCode,
                output,
                cancelled: Boolean(token?.isCancellationRequested)
            });
        });
    });
}

module.exports = {
    quoteArg,
    buildCommandLine,
    runProcess
};
