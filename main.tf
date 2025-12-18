terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = ">= 3.0.0"
    }
  }
}

provider "azurerm" {
  features {}
  subscription_id = "584f8a59-dcda-4698-a720-39e3963a9708"
}

resource "azurerm_resource_group" "sce_rg" {
  name     = "sce-rg"
  location = "switzerlandnorth" # ["switzerlandnorth","polandcentral","italynorth","norwayeast","swedencentral"]
}

resource "azurerm_iothub" "sce_iothub" {
  name                = "sce-iothub-01"
  resource_group_name = azurerm_resource_group.sce_rg.name
  location            = azurerm_resource_group.sce_rg.location
  sku {
    name     = "S1"
    capacity = 1
  }
  tags = {
    environment = "sce-demo"
  }
}

# --- Azure Container Registry ---
resource "random_integer" "suffix" {
  min = 10000
  max = 99999
}

resource "azurerm_container_registry" "sce_acr" {
  name                = "sceacr${random_integer.suffix.result}"
  resource_group_name = azurerm_resource_group.sce_rg.name
  location            = azurerm_resource_group.sce_rg.location
  sku                 = "Basic"
  admin_enabled       = true
}

# --- Azure Container Apps Environment ---
resource "azurerm_container_app_environment" "sce_env" {
  name                = "sce-env"
  location            = azurerm_resource_group.sce_rg.location
  resource_group_name = azurerm_resource_group.sce_rg.name
}

# --- Azure Container App (multi-container: app + redis) ---
resource "azurerm_container_app" "sce_app" {
  name                         = "sce-app"
  container_app_environment_id = azurerm_container_app_environment.sce_env.id
  resource_group_name          = azurerm_resource_group.sce_rg.name
  revision_mode                = "Single"

  template {
    container {
      name   = "app"
      image  = "${azurerm_container_registry.sce_acr.login_server}/app:latest" # Custom app image from ACR
      cpu    = 0.5
      memory = "1.0Gi"
      env {
        name  = "TZ"
        value = "Europe/London"
      }
      # Add more env vars as needed
    }
    container {
      name   = "redis"
      image  = "redis/redis-stack-server:latest" # Public Redis image from Docker Hub
      cpu    = 0.5
      memory = "1.0Gi"
      env {
        name  = "TZ"
        value = "Europe/London"
      }
    }
    # Optionally define volumes here
  }

  ingress {
    external_enabled = true
    target_port      = 8080
    transport        = "auto"
    traffic_weight {
      latest_revision = true
      percentage      = 100
    }
  }

  registry {
    server               = azurerm_container_registry.sce_acr.login_server
    username             = azurerm_container_registry.sce_acr.admin_username
    password_secret_name = "acr-password"
  }

  secret {
    name  = "acr-password"
    value = azurerm_container_registry.sce_acr.admin_password
  }
}

# --- Outputs ---
output "iothub_hostname" {
  description = "The hostname of the Azure IoT Hub."
  value       = azurerm_iothub.sce_iothub.hostname
}

output "acr_login_server" {
  description = "The login server of the Azure Container Registry."
  value       = azurerm_container_registry.sce_acr.login_server
}

output "container_app_fqdn" {
  description = "The FQDN of the Azure Container App."
  value       = azurerm_container_app.sce_app.latest_revision_fqdn
}




