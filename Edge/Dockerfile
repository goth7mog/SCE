# Use the official Node-Red base image
FROM nodered/node-red:latest

# Set timezone (optional)
ENV TZ=Europe/London

# Copy custom flows or configuration if needed
# COPY flows.json /data/flows.json
# COPY settings.js /data/settings.js

# Install additional Node-Red nodes (example)
# RUN npm install --prefix /data node-red-contrib-redis node-red-contrib-azure-iot-hub

# Expose Node-Red port
EXPOSE 1880

# Start Node-Red (default CMD from base image)
