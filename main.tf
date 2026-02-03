terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = ">= 3.0.0"
    }
    azuread = {
      source  = "hashicorp/azuread"
      version = ">= 2.0.0"
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

provider "azuread" {}

data "azurerm_client_config" "current" {}

resource "azurerm_resource_group" "sce_rg" {
  name     = "sce-rg"
  location = "switzerlandnorth" # ["switzerlandnorth","polandcentral","italynorth","norwayeast","swedencentral"]
}

# --- Azure AD App Registration for API ---
resource "azuread_application" "sce_api" {
  display_name = "SCE-API"

  owners = [data.azurerm_client_config.current.object_id]

  api {
    requested_access_token_version = 2
  }

  app_role {
    allowed_member_types = ["Application"]
    description          = "Allow access to collect sensor data"
    display_name         = "DataCollector"
    enabled              = true
    id                   = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
    value                = "DataCollector.ReadWrite"
  }

  app_role {
    allowed_member_types = ["Application"]
    description          = "Frontend app access"
    display_name         = "React App"
    enabled              = true
    id                   = "b2c3d4e5-f6a7-8901-bcde-ef1234567891"
    value                = "Frontend.ReadWrite"
  }
}

resource "azuread_application_identifier_uri" "sce_api" {
  application_id = azuread_application.sce_api.id
  identifier_uri = "api://${azuread_application.sce_api.client_id}"
}

resource "azuread_service_principal" "sce_api" {
  client_id = azuread_application.sce_api.client_id

  owners = [data.azurerm_client_config.current.object_id]
}

resource "azuread_application_password" "sce_api" {
  application_id = azuread_application.sce_api.id
  display_name   = "SCE API Client Secret"
}

# --- Azure AD App Registration for Scheduler/Logic App ---
resource "azuread_application" "sce_scheduler" {
  display_name = "SCE-Scheduler"

  owners = [data.azurerm_client_config.current.object_id]
}

resource "azuread_service_principal" "sce_scheduler" {
  client_id = azuread_application.sce_scheduler.client_id

  owners = [data.azurerm_client_config.current.object_id]
}

resource "azuread_application_password" "sce_scheduler" {
  application_id = azuread_application.sce_scheduler.id
  display_name   = "SCE Scheduler Client Secret"
}

# Assign the DataCollector.ReadWrite role to the scheduler service principal
resource "azuread_app_role_assignment" "scheduler_to_api" {
  app_role_id         = azuread_application.sce_api.app_role_ids["DataCollector.ReadWrite"]
  principal_object_id = azuread_service_principal.sce_scheduler.object_id
  resource_object_id  = azuread_service_principal.sce_api.object_id
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
      cpu    = 0.25
      memory = "0.5Gi"
      env {
        name  = "TZ"
        value = "Europe/London"
      }
      env {
        name  = "PORT"
        value = var.port
      }
      env {
        name  = "AZURE_TENANT_ID"
        value = data.azurerm_client_config.current.tenant_id
      }
      env {
        name  = "AZURE_CLIENT_ID"
        value = azuread_application.sce_api.client_id
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

  identity {
    type = "SystemAssigned"
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


# --- MikroTik CHR VM Deployment (Custom Image) ---
resource "azurerm_public_ip" "mikrotik_chr" {
  name                = "mikrotik-chr-pip"
  location            = azurerm_resource_group.sce_rg.location
  resource_group_name = azurerm_resource_group.sce_rg.name
  allocation_method   = "Static"
  sku                 = "Standard"
}

resource "azurerm_network_security_group" "mikrotik_chr" {
  name                = "mikrotik-chr-nsg"
  location            = azurerm_resource_group.sce_rg.location
  resource_group_name = azurerm_resource_group.sce_rg.name

  security_rule {
    name                       = "AllowWinbox"
    priority                   = 1001
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "8291"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }
  security_rule {
    name                       = "AllowSSH"
    priority                   = 1002
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }
  security_rule {
    name                       = "AllowHTTP"
    priority                   = 1003
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "80"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }
  security_rule {
    name                       = "AllowHTTPS"
    priority                   = 1004
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "443"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }
}

resource "azurerm_virtual_network" "mikrotik_chr" {
  name                = "mikrotik-chr-vnet"
  address_space       = ["10.20.0.0/16"]
  location            = azurerm_resource_group.sce_rg.location
  resource_group_name = azurerm_resource_group.sce_rg.name
}

resource "azurerm_subnet" "mikrotik_chr" {
  name                 = "mikrotik-chr-subnet"
  resource_group_name  = azurerm_resource_group.sce_rg.name
  virtual_network_name = azurerm_virtual_network.mikrotik_chr.name
  address_prefixes     = ["10.20.1.0/24"]
}

resource "azurerm_network_interface" "mikrotik_chr" {
  name                = "mikrotik-chr-nic"
  location            = azurerm_resource_group.sce_rg.location
  resource_group_name = azurerm_resource_group.sce_rg.name

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.mikrotik_chr.id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.mikrotik_chr.id
  }
}

resource "azurerm_network_interface_security_group_association" "mikrotik_chr" {
  network_interface_id      = azurerm_network_interface.mikrotik_chr.id
  network_security_group_id = azurerm_network_security_group.mikrotik_chr.id
}

# --- Storage for Custom Image ---
resource "azurerm_storage_account" "mikrotik_chr" {
  name                     = "mikrotikchrsa${random_integer.suffix.result}"
  resource_group_name      = azurerm_resource_group.sce_rg.name
  location                 = azurerm_resource_group.sce_rg.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
}

resource "azurerm_storage_container" "mikrotik_chr" {
  name                  = "vhds"
  storage_account_id    = azurerm_storage_account.mikrotik_chr.id
  container_access_type = "private"
}

resource "azurerm_storage_blob" "mikrotik_chr" {
  name                   = "chr.vhd"
  storage_account_name   = azurerm_storage_account.mikrotik_chr.name
  storage_container_name = azurerm_storage_container.mikrotik_chr.name
  type                   = "Page"
  source                 = "${path.module}/vms/chr.vhd"
}

resource "azurerm_image" "mikrotik_chr" {
  name                = "mikrotik-chr-image"
  location            = azurerm_resource_group.sce_rg.location
  resource_group_name = azurerm_resource_group.sce_rg.name

  os_disk {
    os_type      = "Linux"
    blob_uri     = azurerm_storage_blob.mikrotik_chr.url
    caching      = "ReadWrite"
    size_gb      = 8
    storage_type = "Standard_LRS"
    os_state     = "Generalized"
  }
}

resource "azurerm_linux_virtual_machine" "mikrotik_chr" {
  name                            = "mikrotik-chr-vm"
  resource_group_name             = azurerm_resource_group.sce_rg.name
  location                        = azurerm_resource_group.sce_rg.location
  size                            = "Standard_B1ms"
  admin_username                  = "mikrotikadmin"
  network_interface_ids           = [azurerm_network_interface.mikrotik_chr.id]
  disable_password_authentication = false
  admin_password                  = var.mikrotik_admin_password

  os_disk {
    name                 = "mikrotik-chr-osdisk"
    caching              = "ReadWrite"
    storage_account_type = "Standard_LRS"
    disk_size_gb         = 8
  }

  source_image_id = azurerm_image.mikrotik_chr.id
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
  interval     = 60
}

resource "azurerm_logic_app_action_http" "get_oauth_token" {
  name         = "get-oauth-token"
  logic_app_id = azurerm_logic_app_workflow.sce_scheduler.id
  method       = "POST"
  uri          = "https://login.microsoftonline.com/${data.azurerm_client_config.current.tenant_id}/oauth2/v2.0/token"

  headers = {
    "Content-Type" = "application/x-www-form-urlencoded"
  }

  body = "grant_type=client_credentials&client_id=${azuread_application.sce_scheduler.client_id}&client_secret=${azuread_application_password.sce_scheduler.value}&scope=api://${azuread_application.sce_api.client_id}/.default"

  depends_on = [
    azurerm_logic_app_trigger_recurrence.sce_scheduler_trigger
  ]
}

resource "azurerm_logic_app_action_http" "sce_scheduler_action" {
  name         = "collect-sensor-data"
  logic_app_id = azurerm_logic_app_workflow.sce_scheduler.id
  method       = "GET"
  uri          = "https://${azurerm_container_app.sce_app.ingress[0].fqdn}/collect-sensor-data?timePeriod=60&bucketSize=15"

  headers = {
    "Authorization" = "Bearer @{body('get-oauth-token')['access_token']}"
  }

  run_after {
    action_name   = "get-oauth-token"
    action_result = "Succeeded"
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

output "mikrotik_chr_public_ip" {
  description = "The public IP address of the MikroTik CHR VM."
  value       = azurerm_public_ip.mikrotik_chr.ip_address
}





