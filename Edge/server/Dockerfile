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









# # Use official Node.js LTS image

# # Use Debian-based image for amd64 compatibility
# FROM node:18-bullseye as debug

# WORKDIR /usr/src/app
# ENV HOST 0.0.0.0
# COPY package.json ./
# RUN npm install
# RUN npm install -g nodemon

# COPY . .



# # Install Splunk Universal Forwarder and supervisor
# USER root
# RUN apt-get update && apt-get install -y wget tar bash supervisor && \
#     wget -O /tmp/splunkforwarder.deb 'https://download.splunk.com/products/universalforwarder/releases/10.2.2/linux/splunkforwarder-10.2.2-80b90d638de6-linux-amd64.deb' && \
#     dpkg -i /tmp/splunkforwarder.deb && \
#     rm /tmp/splunkforwarder.deb

# RUN mkdir -p /var/log/app



# # Copy Splunk Universal Forwarder outputs.conf and inputs.conf
# COPY splunk-uf-outputs.conf /opt/splunkforwarder/etc/system/local/outputs.conf
# COPY splunk-uf-inputs.conf /opt/splunkforwarder/etc/system/local/inputs.conf


# # Copy supervisord config
# COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf


# RUN id -u node 2>/dev/null || useradd -m -s /bin/bash node && \
#     id -u splunk 2>/dev/null || useradd -m -s /bin/bash splunk
# RUN chown -R node:node /usr/src/app && \
#     mkdir -p /var/log/app && chown -R node:node /var/log/app && \
#     chown -R splunk:splunk /opt/splunkforwarder || true


# # USER node

# ENV APP_MODE=debug
# ENTRYPOINT ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]




# # Use Debian-based image for amd64 compatibility
# FROM node:18-bullseye as prod

# WORKDIR /usr/src/app
# ENV HOST 0.0.0.0
# COPY package.json ./
# RUN npm install

# COPY . .

# # Install Splunk Universal Forwarder

# USER root
# RUN apt-get update && apt-get install -y wget tar bash && \
#     wget -O /tmp/splunkforwarder.deb 'https://download.splunk.com/products/universalforwarder/releases/10.2.2/linux/splunkforwarder-10.2.2-80b90d638de6-linux-amd64.deb' && \
#     dpkg -i /tmp/splunkforwarder.deb && \
#     rm /tmp/splunkforwarder.deb

# RUN mkdir -p /var/log/app


# # Copy Splunk Universal Forwarder outputs.conf and inputs.conf
# COPY splunk-uf-outputs.conf /opt/splunkforwarder/etc/system/local/outputs.conf
# COPY splunk-uf-inputs.conf /opt/splunkforwarder/etc/system/local/inputs.conf


# # Copy supervisord config
# COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf


# RUN id -u node 2>/dev/null || useradd -m -s /bin/bash node && \
#     id -u splunk 2>/dev/null || useradd -m -s /bin/bash splunk
# RUN chown -R node:node /usr/src/app && \
#     mkdir -p /var/log/app && chown -R node:node /var/log/app && \
#     chown -R splunk:splunk /opt/splunkforwarder || true


# # USER node


# ENV APP_MODE=prod
# ENTRYPOINT ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]