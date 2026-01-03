terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = ">= 3.0.0"
    }
    random = {
      source  = "hashicorp/random"
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

# --- Azure Container App ---
resource "azurerm_container_app" "sce_app" {
  name                         = "sce-app"
  container_app_environment_id = azurerm_container_app_environment.sce_env.id
  resource_group_name          = azurerm_resource_group.sce_rg.name
  revision_mode                = "Single"

  template {
    min_replicas = 1
    max_replicas = 3

    container {
      name   = "app"
      image  = "${azurerm_container_registry.sce_acr.login_server}/app:latest" # Custom app image from ACR
      cpu    = 0.5
      memory = "1.0Gi"
      env {
        name  = "TZ"
        value = "Europe/London"
      }
      env {
        name  = "PORT"
        value = var.port
      }
      env {
        name        = "IOTHUB_CONNECTION_STRING"
        secret_name = "iothub-connection-string"
      }
      env {
        name  = "MONGO_HOST"
        value = var.mongo_host
      }
      env {
        name  = "MONGO_PORT"
        value = var.mongo_port
      }
      env {
        name  = "MONGO_USER"
        value = var.mongo_user
      }
      env {
        name        = "MONGO_PASSWORD"
        secret_name = "mongo-password"
      }
      env {
        name  = "MONGO_DATABASE"
        value = var.mongo_database
      }
      env {
        name  = "REDIS_HOST"
        value = var.redis_host
      }
      env {
        name  = "REDIS_PORT"
        value = var.redis_port
      }
      env {
        name        = "REDIS_PASSWORD"
        secret_name = "redis-password"
      }
    }

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

  # App secrets from .env
  secret {
    name  = "mongo-password"
    value = var.mongo_password
  }
  secret {
    name  = "iothub-connection-string"
    value = var.iothub_connection_string
  }
  secret {
    name  = "redis-password"
    value = var.redis_password
  }
}

# --- Azure Logic App for Scheduled Data Collection ---
resource "azurerm_logic_app_workflow" "sce_scheduler" {
  name                = "sce-data-collector"
  location            = azurerm_resource_group.sce_rg.location
  resource_group_name = azurerm_resource_group.sce_rg.name

  tags = {
    environment = "sce-demo"
  }
}

resource "azurerm_logic_app_trigger_recurrence" "sce_scheduler_trigger" {
  name         = "recurrence-trigger"
  logic_app_id = azurerm_logic_app_workflow.sce_scheduler.id
  frequency    = "Minute"
  interval     = 15
}

resource "azurerm_logic_app_action_http" "sce_scheduler_action" {
  name         = "collect-sensor-data"
  logic_app_id = azurerm_logic_app_workflow.sce_scheduler.id
  method       = "GET"
  uri          = "https://${azurerm_container_app.sce_app.ingress[0].fqdn}/collect-sensor-data?timePeriod=60&bucketSize=15"

  depends_on = [
    azurerm_logic_app_trigger_recurrence.sce_scheduler_trigger
  ]
}

# # --- Log Analytics Workspace for Diagnostics ---
# resource "azurerm_log_analytics_workspace" "sce_law" {
#   name                = "sce-law"
#   location            = azurerm_resource_group.sce_rg.location
#   resource_group_name = azurerm_resource_group.sce_rg.name
#   sku                 = "PerGB2018"
#   retention_in_days   = 30
# }
# resource "azurerm_container_app_diagnostic_setting" "sce_app_diag" {
#   name                       = "sce-app-diag"
#   container_app_id           = azurerm_container_app.sce_app.id
#   log_analytics_workspace_id = azurerm_log_analytics_workspace.sce_law.id

#   log {
#     category = "ContainerAppConsoleLogs"
#     enabled  = true
#     retention_policy {
#       enabled = false
#     }
#   }

#   log {
#     category = "ContainerAppSystemLogs"
#     enabled  = true
#     retention_policy {
#       enabled = false
#     }
#   }

#   metric {
#     category = "AllMetrics"
#     enabled  = true
#     retention_policy {
#       enabled = false
#     }
#   }
# }

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




