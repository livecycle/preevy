const { Client } = require('ssh2')
client = new Client()
client.on(
  'ready', 
  () => {
    client.openssh_forwardOutStreamLocal('/var/run/docker.sock', (err, stream) => {
      console.log('forward', err, stream)
    })
  },
).connect({
  host: '3.75.247.37',
  username: 'ubuntu',
  privateKey: require('fs').readFileSync('/Users/roy/.local/share/preview/ssh-keys/preview-vvv2-5d1015228a48dbe0feb8e460e9a656e1/id_rsa'),
  debug: console.log
})

