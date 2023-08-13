#!/bin/bash

set -eou pipefail
set -x

cat <<EOF | sudo tee /etc/systemd/system/nodeexporter.service
[Unit]
Description=Run the node-exporter Docker container

[Service]
ExecStart=docker run \
  --restart unless-stopped \
  --name node-exporter \
  --network=host  \
  --pid=host \
  -v "/:/host:ro,rslave" \
  --security-opt apparmor=unconfined \
  quay.io/prometheus/node-exporter:latest \
    --path.rootfs=/host

ExecStop=/usr/bin/docker stop node-exporter
ExecStopPost=/usr/bin/docker rm node-exporter
EOF

sudo chmod 0644 /etc/systemd/system/nodeexporter.service
sudo systemctl daemon-reload
sudo systemctl enable nodeexporter.service
sudo systemctl start nodeexporter.service
