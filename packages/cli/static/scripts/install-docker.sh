#!/bin/bash

set -eou pipefail

export DEBIAN_FRONTEND=noninteractive

sudo dpkg --remove docker docker-engine docker.io containerd runc
sudo apt-get -yq autoremove
sudo apt-get update
sudo apt-get -yq install \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

sudo mkdir -m 0755 -p /etc/apt/keyrings
sudo rm -f /etc/apt/keyrings/docker.gpg
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --batch --no-tty --dearmor -o /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo chmod a+r /etc/apt/keyrings/docker.gpg
sudo apt-get update

sudo apt-get install -yq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo docker run hello-world

sudo systemctl enable docker.service
sudo systemctl enable containerd.service

sudo groupadd -f docker
sudo usermod -aG docker $USER
