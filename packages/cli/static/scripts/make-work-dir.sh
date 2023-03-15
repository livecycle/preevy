#!/bin/bash

set -eou pipefail

sudo mkdir -p /var/lib/preview
sudo chown $USER:docker /var/lib/preview
