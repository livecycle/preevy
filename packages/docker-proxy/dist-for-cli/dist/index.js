import Docker from 'dockerode';
import createDockerClient from './src/docker.js';
import createWebServer from './src/web.js';
import createSshClient, { tunnelNames } from './src/ssh.js';
import { requiredEnv } from './src/env.js';
const main = async () => {
    const docker = new Docker({ socketPath: '/var/run/docker.sock' });
    const dockerClient = createDockerClient({ docker, debounceWait: 500 });
    let clientId;
    const sshClient = createSshClient({
        onClientId: clId => { clientId = clId; },
        sshUrl: requiredEnv('SSH_URL'),
        serverPublicKey: process.env.SSH_SERVER_PUBLIC_KEY,
        debug: Boolean(process.env.DEBUG),
    });
    let services = [];
    dockerClient.listenToContainers({
        onChange: updatedServices => {
            services = updatedServices;
            sshClient.updateTunnels(services);
        },
    });
    const webServer = createWebServer({
        getTunnels: async () => ({
            projects: services.reduce((acc, s) => ({
                ...acc,
                [s.project]: {
                    ...acc[s.project],
                    [s.name]: Object.fromEntries(tunnelNames(s).map(({ name, port }) => [port, name])),
                },
            }), {}),
            services: services.map(s => ({
                project: s.project,
                service: s.name,
                ports: tunnelNames(s),
            })),
            tunnels: services.flatMap(s => tunnelNames(s).map(({ name }) => name)),
        }),
        getClientId: async () => clientId,
    });
    const port = process.env.PORT ?? 3000;
    webServer.listen(port, () => {
        console.log(`listening on port ${port}`);
    });
    webServer.on('error', (err) => {
        console.error(err);
        process.exit(1);
    });
    webServer.unref();
};
main();
//# sourceMappingURL=index.js.map