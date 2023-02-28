FROM node:18 as base
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.mts ./
## Need to replace this with external ssh key
RUN ssh-keygen -t rsa -b 4096 -f /root/.ssh/id_rsa -q -N "" 
CMD [ "npm", "start" ]