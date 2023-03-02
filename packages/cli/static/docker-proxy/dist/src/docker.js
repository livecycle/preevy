import { debounce } from 'lodash-es';
import { tryParseJson } from './json.js';
const composeFilter = {
    label: ['com.docker.compose.project'],
};
const client = ({ docker, debounceWait }) => {
    const getRunningServices = async () => (await docker.listContainers({
        filters: {
            ...composeFilter,
            status: ['running'],
        },
    })).map(x => ({
        project: x.Labels['com.docker.compose.project'],
        name: x.Labels['com.docker.compose.service'],
        networks: Object.keys(x.NetworkSettings.Networks),
        ports: x.Ports.filter(p => p.Type === 'tcp').map(x => x.PrivatePort),
    }));
    return {
        listenToContainers: async ({ onChange }) => {
            const handler = debounce(async (data) => {
                console.log('handler', data && tryParseJson(data.toString()));
                const services = await getRunningServices();
                onChange(services);
            }, debounceWait, { leading: true });
            const stream = await docker.getEvents({
                filters: {
                    ...composeFilter,
                    event: ['start', 'stop', 'pause', 'unpause', 'create', 'destroy', 'rename', 'update'],
                    type: ['container'],
                },
                since: 0,
            });
            stream.on('data', handler);
            console.log('listening on docker');
            handler();
        },
    };
};
export default client;
//# sourceMappingURL=docker.js.map