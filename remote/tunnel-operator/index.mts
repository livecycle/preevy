import Docker from "dockerode"
import { spawn } from 'node:child_process';
import readline from 'node:readline/promises';
import fs from "fs/promises"

const sshPrivateKeyPath = process.env["SSH_PRIVATE_KEY_PATH"] ?? "/root/.ssh/id_rsa"
const tunnelServiceUrl = process.env["PROXY_URL"] ?? "ssh://proxy:2222" //replace with https+ssh
const sshPath = "/usr/bin/ssh"

const protocolDefaultPorts = {
    "ssh:": 22,
    "https+ssh:": 443
}

function parseTunnelServiceUrl(url){
    const {protocol, hostname, port} = new URL(url)
    return {protocol, hostname, port: port || protocolDefaultPorts[protocol]}
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
    const {protocol, hostname, port} = parseTunnelServiceUrl(tunnelServiceUrl)
    const proxyFlag = protocol === "https+ssh:" ? "-o 'ProxyCommand openssl s_client -quiet -servername %h -connect %h:%p'" : ""
    const sshTunnelCommand = ()=> `${sshPath} -i ${sshPrivateKeyPath} ${proxyFlag} -o StrictHostKeyChecking=no -p ${port} ${routingParams} ${hostname} hello`
    return async (services)=>{
        console.log("services updated")
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
        console.info("starting ssh tunnel: ", cmd)
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
        
        ;(async ()=> {
            const rl = readline.createInterface(child.stdout)
            try {
                for await (const line of rl) {
                    if (!line.startsWith("{")){
                        continue;
                    }
                    try {
                        const cmd = JSON.parse(line)
                        if (cmd.type === "active-tunnels" || cmd.type=== "hello"){
                            console.info(cmd.tunnels)
                            await fs.writeFile("/tmp/tunnels.json", JSON.stringify(cmd.tunnels, null, 2))
                        }
                    } catch (error) {
                        continue;
                    }   
                }
        
            } catch (error) {
                if (sshProcessKillInProgress){
                    return;
                }
                console.error(error)
            }
        })()
       
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
