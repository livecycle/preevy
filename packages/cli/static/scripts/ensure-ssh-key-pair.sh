#!/bin/bash

set -eou pipefail

keyfile=/root/.ssh/id_rsa

if ! sudo test -f "${keyfile}"; then
  sudo ssh-keygen -t rsa -q -f "${keyfile}" -N ""

  sudo chown root:docker "${keyfile}" "${keyfile}.pub"
  sudo chmod u+r "${keyfile}" "${keyfile}.pub"
fi

# # TODO: take the host public key from somewhere
# SSH_PUBLIC_KEY=AAAAB3NzaC1yc2EAAAADAQABAAABgQDNqjECQzNnVIs1BGVT+YDI6UChSFFjHp+qElwefV+ZrDf1vmVc53RlqiVgiNbNpKvh23LLCvKXe1xuFuDxOUmbX6pgfMDiiCxsNWOtVQoJsnB7K9GrItn4ooSj3gjX1itafdTsnYPbZG2H1UJNpmwlw4fbJxf8FApiYNllV5PkCKARt+LFTvxOy6RYHiIsxvmi4k/mhhapcif+5cYovC5pepnZwUodekd05WHlZfwvo11czmlT0YjP4UJ5X+oWGGeMhZvGD01aSujIJgdH7+//znQfdzwxHMR/FiXs+4QzLJLB3R+Jjn3nhLRJfWpabanF/C1dQ5sZnUhU/0OhoU9CgCAuybutiELOxf80fbWcmRSvGZJDzute3DM79EXZb3MWi48d4kPBBFBbIPQXOmSvmb/4a+sVqMzUfRqTecc15JQZRuDy0P5/PnPsG3tlY5KYAMJ4tZk//UvnrwRFgWlHHZgqZy5uPoilO16904sgy5fquKvKaf72GlipyC9qcC8=

# sudo tee -a /etc/ssh/ssh_known_hosts > /dev/null << EOF
# [${SSH_HOSTNAME}]:${SSH_PORT} ssh-rsa ${SSH_PUBLIC_KEY}
# EOF
