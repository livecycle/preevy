const concat = (...v) => v.join('-');
const tunnel = (port, v) => ({ port, tunnel: concat(...v) });
export const tunnelNameResolver = ({ project, name, ports }) => [
    ...ports.map(port => tunnel(port, [name, port, project])),
    ...ports.length === 1 ? [tunnel(ports[0], [name, project])] : []
];
//# sourceMappingURL=tunnel-name.js.map