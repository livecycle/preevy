import http from 'node:http';
const createWebServer = ({ getTunnels, getClientId }) => {
    const server = http.createServer(async (req, res) => {
        if (req.url === '/tunnels') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(await getTunnels()));
            return;
        }
        if (req.url === '/client-id') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(await getClientId()));
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