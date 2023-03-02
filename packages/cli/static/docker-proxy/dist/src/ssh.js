import { spawn } from "child_process";
import { isEqual } from "lodash-es";
import shellEscape from 'shell-escape';
import { tryParseJson } from "./json.js";
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
const hasClientId = (o) => Boolean(o && typeof o === 'object' && 'clientId' in o && typeof o.clientId === 'string');
const sshClient = ({ serverPublicKey, sshUrl, debug, tunnelNameResolver, onError }) => {
    const connectionConfig = parseSshUrl(sshUrl);
    const { args: sshArgs, env } = calcSshArgs({ config: connectionConfig, serverPublicKey, debug });
    const startSsh = (services) => {
        const routeParams = services.map(s => tunnelNameResolver(s).map(({ port, tunnel }) => ['-R', `/${tunnel}:${s.name}:${port}`])).flat(2);
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
        return new Promise((resolve, reject) => {
            sshProcess.on('exit', (code, signal) => {
                const message = `ssh process ${sshProcess.pid} exited with code ${code}${signal ? `and signal ${signal}` : ''}`;
                if (!sshProcess.killed && code !== 0) {
                    const err = new Error(message);
                    reject(err);
                    onError(err);
                    return;
                }
                console.debug(message);
            });
            sshProcess.stdout.on('data', data => {
                const o = tryParseJson(data.toString());
                if (hasClientId(o)) {
                    const { clientId } = o;
                    console.log('got clientId', clientId);
                    resolve({ sshProcess, clientId });
                    return;
                }
            });
            console.log(`started ssh process ${sshProcess.pid}`);
        });
    };
    let currentSshProcess;
    let currentServices = [];
    let clientId;
    return {
        updateTunnels: async (services) => {
            if (currentSshProcess) {
                if (isEqual(services, currentServices)) {
                    console.log('no changes, ignoring');
                    return { clientId };
                }
                console.log(`killing current ssh process ${currentSshProcess.pid}`);
                currentSshProcess.kill();
            }
            currentServices = services;
            const r = await startSsh(services);
            currentSshProcess = r.sshProcess;
            clientId = r.clientId;
            return { clientId };
        },
    };
};
export default sshClient;
//# sourceMappingURL=ssh.js.map