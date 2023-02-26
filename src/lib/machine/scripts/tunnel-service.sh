#!/bin/bash

set -eou pipefail

keyfile=/etc/default/id_rsa

if [[ ! -f "${keyfile}" ]]; then
  sudo ssh-keygen -t rsa -q -f "${keyfile}" -N ""

  sudo chown root:docker "${keyfile}" "${keyfile}.pub"
  sudo chmod u+r "${keyfile}" "${keyfile}.pub"
fi

# TODO: take the host public key from somewhere
sudo tee -a /etc/ssh/ssh_known_hosts > /dev/null << EOF
[${SSH_HOSTNAME}]:${SSH_PORT} ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDrOeY/1LfEFyvWtJDERJD5S3gD6HtuM3i+4wD8TsPHJio5kt4my1UeuTHlixyBFxDi+yrAMuF0k2zkRWbHth4nVdXfJ1b2fjNJ6CiPsNzbSx/3zLvZ8/+827yvzmUOqDIgsRHISJ/GkyICD8nL8mQkjW04C/5TBuQt5zOLR1C5yKevZa2hgtYnTy1JdR0A+AghAxdChGDEnegkLSOOd+BV7Cl8DU8vI8+RmFN5F/eK4zWuhS1ISMZhLJUvwJjryoLXW138OyvFb4Yg6RYujsIKzKElrSHgviMtPeko5VyADD1jUgo5FQW0zMIgJ31j/vqzlI91oDpHZyUFmDsEAVjT/qzW305FwQh6zYYpzijr9NJP4tkxAieTe33f3qncL4SHZccTf1YPCtgqasmFL3QhT58dFk62Vy2eTmbPtTGba+XX9q/2mOKBdEe0BrLq0UzG6YXiuTqbRIhXy5NfvidlkHvNaR+b0YpaV9lglyz7CEYKAx9BGQAUEW2D0+px62c=
EOF

sudo tee /etc/ssh/ssh_config.d/preview_tunnel.conf > /dev/null << EOF
Host ${SSH_HOSTNAME}
	ProxyCommand openssl s_client -quiet -verify_quiet -servername ${SSH_SERVERNAME:-%h} -connect %h:%p
	ServerAliveCountMax 2
	ServerAliveInterval 20
	IdentityFile "${keyfile}"
	ExitOnForwardFailure yes
	Port ${SSH_PORT}
EOF

sudo tee /usr/local/bin/preview_tunnel_meta > /dev/null << 'EOF'
#!/bin/bash

set -eou pipefail

source /etc/default/secure-tunnel@preview-server

/usr/bin/ssh \
  -nT \
  ${SSH_USER}@${SSH_HOSTNAME} \
  hello
EOF

sudo chmod a+x /usr/local/bin/preview_tunnel_meta

sudo tee /etc/systemd/system/secure-tunnel@.service > /dev/null <<'EOF'
[Unit]
Description=Setup a secure tunnel to %I
After=network.target

[Service]
Type=exec
EnvironmentFile=/etc/default/secure-tunnel@%i
ExecStart=/usr/bin/ssh -NnT -R /preview:127.0.0.1:80 ${SSH_USER}@${SSH_HOSTNAME}

RestartSec=4
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/default/secure-tunnel@preview-server > /dev/null <<EOF
SSH_USER=${SSH_USER}
SSH_PORT=${SSH_PORT:-443}
SSH_HOSTNAME=${SSH_HOSTNAME}
EOF

sudo systemctl daemon-reload

sudo systemctl start secure-tunnel@preview-server

sudo systemctl enable secure-tunnel@preview-server
