import http from 'node:http';
const servicesResponse = (tunnelNameResolver, clientId, services) => ({
    projects: services.reduce((acc, s) => ({
        ...acc,
        [s.project]: {
            ...acc[s.project],
            [s.name]: tunnelNameResolver(s).reduce((obj, { port, tunnel }) => {
                (obj[port] ||= []).push(tunnel);
                return obj;
            }, {}),
        },
    }), {}),
    services: services.map(s => ({
        project: s.project,
        service: s.name,
        ports: tunnelNameResolver(s).map(({ port, tunnel }) => ({ name: tunnel, port })),
    })),
    tunnels: services.flatMap(s => tunnelNameResolver(s).map(({ tunnel }) => tunnel)),
    clientId,
});
const createWebServer = ({ getTunnels, tunnelNameResolver }) => {
    const server = http.createServer(async (req, res) => {
        if (req.url === '/tunnels') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            const { services, clientId } = await getTunnels();
            res.end(JSON.stringify(servicesResponse(tunnelNameResolver, clientId, services)));
            return;
        }
        if (req.url === '/healthz') {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('OK');
            return;
        }
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
    });
    return server;
};
export default createWebServer;
//# sourceMappingURL=web.js.map