import { spawn } from "child_process";
import { isEqual } from "lodash-es";
import shellEscape from 'shell-escape';
export const parseSshUrl = (s) => {
    const u = new URL(s);
    const isTls = Boolean(u.protocol.match(/(tls)|(https)/));
    return {
        hostname: u.hostname,
        port: Number(u.port || (isTls ? 443 : 22)),
        isTls,
    };
};
const calcSshArgs = ({ config: { hostname, port, isTls }, serverPublicKey, debug, }) => {
    const args = [
        '-o', 'ExitOnForwardFailure=yes',
        '-o', 'ServerAliveCountMax=2',
        '-o', 'ServerAliveInterval=20',
        '-o', 'PubkeyAcceptedKeyTypes +ssh-rsa'
    ];
    const env = {};
    if (debug) {
        args.push('-v');
    }
    if (serverPublicKey) {
        env.SSH_SERVER_PUBLIC_KEY = serverPublicKey;
        args.push('-o', `KnownHostsCommand /bin/sh -c 'echo [%h]:%p ssh-rsa $SSH_SERVER_PUBLIC_KEY'`);
    }
    else {
        console.warn('server public key not given, will not verify host key');
        args.push('-o', 'StrictHostKeyChecking=no');
    }
    if (isTls) {
        args.push('-o', `ProxyCommand openssl s_client -quiet -verify_quiet -servername ${process.env.TLS_SERVERNAME ?? '%h'} -connect %h:%p`);
    }
    args.push('-p', String(port));
    args.push(hostname);
    return { args, env };
};
export const tunnelNames = (s) => s.ports.map(p => ({ port: p, name: `${s.name}-${p}-${s.project}` }));
const sshClient = ({ onClientId, serverPublicKey, sshUrl, debug }) => {
    let currentSshProcess;
    let currentRouteParams;
    const connectionConfig = parseSshUrl(sshUrl);
    const { args: sshArgs, env } = calcSshArgs({ config: connectionConfig, serverPublicKey, debug });
    const startSsh = (routeParams) => {
        const args = [
            '-nT',
            ...routeParams,
            ...sshArgs,
            'hello',
        ];
        console.log(`spawning: ssh ${shellEscape(args)}`);
        const sshProcess = spawn('ssh', args, { env: { ...process.env, ...env } });
        sshProcess.stderr.pipe(process.stderr);
        sshProcess.stdout.pipe(process.stdout);
        sshProcess.on('exit', (code, signal) => {
            const message = `ssh process ${sshProcess.pid} exited with code ${code}${signal ? `and signal ${signal}` : ''}`;
            if (!sshProcess.killed && code !== 0) {
                console.error(message);
                process.exit(1);
            }
            console.debug(message);
        });
        sshProcess.stdout.on('data', data => {
            const o = (() => {
                try {
                    return JSON.parse(data.toString());
                }
                catch {
                    return undefined;
                }
            })();
            if (o && typeof o === 'object' && 'clientId' in o && typeof o.clientId === 'string') {
                console.log('got clientId', o.clientId);
                onClientId?.(o.clientId);
                return;
            }
            console.error('invalid output in ssh stdout:', data.toString());
        });
        console.log(`started ssh process ${sshProcess.pid}`);
        return sshProcess;
    };
    return {
        updateTunnels: (services) => {
            const routeParams = new Set(services.flatMap(s => tunnelNames(s).map(({ port, name }) => `-R /${name}:${s.name}:${port}`)));
            if (currentSshProcess) {
                if (currentRouteParams && isEqual(routeParams, currentRouteParams)) {
                    console.log('no changes, ignoring');
                    return;
                }
                console.log(`killing current ssh process ${currentSshProcess.pid}`);
                process.kill(currentSshProcess.pid);
            }
            currentRouteParams = routeParams;
            currentSshProcess = startSsh([...routeParams]);
        },
    };
};
export default sshClient;
//# sourceMappingURL=ssh.js.map