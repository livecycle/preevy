import Docker from 'dockerode';
import createDockerClient from './src/docker.js';
import createWebServer from './src/web.js';
import createSshClient from './src/ssh.js';
import { requiredEnv } from './src/env.js';
import { tunnelNameResolver } from './src/tunnel-name.js';
import { inspect } from 'node:util';
const main = async () => {
    const docker = new Docker({ socketPath: '/var/run/docker.sock' });
    const dockerClient = createDockerClient({ docker, debounceWait: 500 });
    const sshClient = createSshClient({
        onError: err => {
            console.error(err);
            process.exit(1);
        },
        tunnelNameResolver,
        sshUrl: requiredEnv('SSH_URL'),
        serverPublicKey: process.env.SSH_SERVER_PUBLIC_KEY,
        debug: Boolean(process.env.DEBUG),
    });
    let services;
    let clientId;
    const initPromise = new Promise(resolve => {
        dockerClient.listenToContainers({
            onChange: async (updatedServices) => {
                services = updatedServices;
                clientId = (await sshClient.updateTunnels(services)).clientId;
                resolve();
            },
        });
    });
    const webServer = createWebServer({
        tunnelNameResolver,
        getTunnels: () => initPromise.then(() => ({ services, clientId })),
    })
        .listen(process.env.PORT ?? 3000, () => {
        console.log(`listening on ${inspect(webServer.address())}`);
    })
        .on('error', (err) => {
        console.error(err);
        process.exit(1);
    })
        .unref();
};
main();
//# sourceMappingURL=index.js.map