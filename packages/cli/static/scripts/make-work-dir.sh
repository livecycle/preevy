#!/bin/bash

set -eou pipefail

sudo mkdir -p /var/run/preview
sudo chown $USER:docker /var/run/preview
