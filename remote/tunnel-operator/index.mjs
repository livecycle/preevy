import 'zx/globals'
import Docker from "dockerode"
import { spawn } from 'node:child_process';

const sshPrivateKeyPath = process.env["SSH_PRIVATE_KEY_PATH"] ?? "/root/.ssh/id_rsa"
const tunnelServiceUrl = process.env["PROXY_URL"] ?? "ssh://proxy:2222" //replace with https+ssh
const sshPath = "/usr/bin/ssh"

const schemeDefaultPorts = {
    ssh: 22,
    "https+ssh": 443
}

function parseTunnelServiceUrl(url){
    const m = /^(?<scheme>ssh|https\+ssh):\/\/(?<host>[^:]+)(:(?<port>[0-9]+))?$/.exec(url)
    const {scheme, host, port} = m?.groups
    return {scheme, host, port: port || schemeDefaultPorts[scheme]}
}

const composeFilter = {
    label: ["com.docker.compose.project"]
}
const docker = Docker({socketPath: '/var/run/docker.sock'});

async function getRunningServices(){
    return (await docker.listContainers({
        filters: {
            ...composeFilter,
            status: ["running"],
        }
    })).map((x)=> ({
        project: x.Labels["com.docker.compose.project"],
        name: x.Labels["com.docker.compose.service"],
        networks: Object.keys(x.NetworkSettings.Networks),
        ports: x.Ports.map(x=> x.PrivatePort)
    }))
}

const updateTunnel = (function (){
    let routingParams
    let ssh_process
    let sshStopPromise = Promise.resolve()
    let sshProcessKillInProgress = false
    const {scheme, host, port} = parseTunnelServiceUrl(tunnelServiceUrl)
    const proxyFlag = scheme === "https+ssh" ? "-o 'ProxyCommand openssl s_client -quiet -servername %h -connect %h:%p'" : ""
    const sshTunnelCommand = ()=> `${sshPath} -i ${sshPrivateKeyPath} ${proxyFlag} -o StrictHostKeyChecking=no -p ${port} ${routingParams} ${host} info`
    return async (services)=>{
        const newRoutingParams =  services.flatMap(s=> s.ports.map(p=> ` -R /${s.name}-${p}-${s.project}:${s.name}:${p}`)).join(" ")
        if (newRoutingParams === routingParams){
            return;
        }
        routingParams = newRoutingParams
        await sshStopPromise;
        if (ssh_process){
            sshProcessKillInProgress = true;
            sshStopPromise = new Promise((resolve)=> {
                console.info("stopping old ssh tunnel")
                ssh_process.on("exit", resolve)
                ssh_process.kill();
            });
            await sshStopPromise;
            sshProcessKillInProgress = false;
        }
        console.info("creating tunnels for: ", services.map(x=>x.name))
        const cmd = sshTunnelCommand()
        console.info("creating new ssh tunnel: ", cmd)
        const child = await spawn(cmd, {shell: true}) 
        child.on("error", ()=> {
            if (sshProcessKillInProgress){
                return;
            }
            console.info("error connecting to ssh tunnel service")
            process.exit(1)
        })
        child.on("exit", (s)=> {
            if (sshProcessKillInProgress){
                return;
            }
            if (child.exitCode !== 0){
                console.info("ssh tunnel service exited with error")
                process.exit(1)
            }
        })
        ssh_process = child
        child.stdout.pipe(process.stdout)
        child.stderr.pipe(process.stderr)
    }
})()

async function main(){
    const services = await getRunningServices()
    await updateTunnel(services)
    const stream = await docker.getEvents({
        filters:{
            ...composeFilter,
            event: ["start", "stop", "pause", "stop"],
            type: ["container"]
        }
    });
    stream.on("data",async ()=> {
        const services = await getRunningServices();
        await updateTunnel(services)
    })
}

main();
