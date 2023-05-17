#!/bin/bash

set -eou pipefail

get_flag() {
  local key="${1}"
  sudo sysctl -a | grep -F ${key} | sed -E 's/.*=\s+//'
}

set_flag() {
  local key="${1}"
  local val="${2}"
  if [[ "$(get_flag ${key})" != "${val}" ]] ; then
    echo "${key} = ${val}" | sudo tee -a /etc/sysctl.conf > /dev/null
  fi
  sudo sysctl ${key}=${val} > /dev/null
}

set_flag fs.inotify.max_user_watches 1048576
set_flag fs.inotify.max_user_instances 1024
set_flag fs.inotify.max_queued_events 131072
