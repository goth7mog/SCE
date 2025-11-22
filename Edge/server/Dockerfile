# Use official Node.js LTS image
FROM node:18-alpine as debug

WORKDIR /usr/src/app
ENV HOST 0.0.0.0
COPY package.json ./
RUN npm install
RUN npm install -g nodemon

COPY . .
RUN chown -R node /usr/src/app
USER node

ENTRYPOINT [ "nodemon", "main.js" ]



FROM node:18-alpine as prod

WORKDIR /usr/src/app
ENV HOST 0.0.0.0
COPY package.json ./
RUN npm install

COPY . .
RUN chown -R node /usr/src/app
USER node

CMD [ "node", "main.js" ]