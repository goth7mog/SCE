# SCE Project

This repository manages a distributed IoT/Edge/Cloud system for sensor data collection, aggregation, and visualization.

## Architecture Overview

![SCE Architecture](etc/pictures/sce-architecture.png)

---

## Key Features
- Distributed Node.js microservices for cloud and edge
- Node-RED flows for local automation
- Infrastructure-as-code with Terraform
- Container orchestration with Docker Compose
- Integration with Azure IoT Hub, MongoDB, Redis, and MQTT

## Directory Structure
- `Azure/` — Cloud-side services and deployment scripts
- `Edge/` — Edge services, Node-RED, and device integration
- `etc/` — Documentation, diagrams, and scripts

## Getting Started
1. Clone the repository
2. Review the Docker Compose files in `Azure/` and `Edge/`
3. See the documentation in `etc/` for setup and usage instructions

---

For more details, see the documentation in the `etc/` folder.