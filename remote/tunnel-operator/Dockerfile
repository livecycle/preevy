FROM node:18 as base
COPY index.mjs /app/index.mjs

## Need to replace this with external ssh key
RUN ssh-keygen -t rsa -b 4096 -f /root/.ssh/id_rsa -q -N "" 
ENTRYPOINT [ "npx", "zx", "--install", "/app/index.mjs" ]