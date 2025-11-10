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
}

resource "azurerm_resource_group" "sce_rg" {
  name     = "sce-rg"
  location = "West Europe"
}

resource "azurerm_iothub" "sce_iothub" {
  name                = "sce-iothub"
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

resource "azurerm_iothub_device" "sce_device" {
  iothub_name         = azurerm_iothub.sce_iothub.name
  resource_group_name = azurerm_resource_group.sce_rg.name
  device_id           = "sce-sim-device"
}

resource "azurerm_container_group" "node_red" {
  name                = "sce-node-red"
  location            = azurerm_resource_group.sce_rg.location
  resource_group_name = azurerm_resource_group.sce_rg.name
  os_type             = "Linux"

  container {
    name   = "node-red"
    image  = "nodered/node-red"
    cpu    = "1.0"
    memory = "1.5"

    ports {
      port     = 1880
      protocol = "TCP"
    }
    environment_variables = {
      TZ = "Europe/London"
    }
  }

  ip_address_type = "Public"
  dns_name_label  = "sce-nodered-demo"
}

output "node_red_url" {
  value       = "http://${azurerm_container_group.node_red.dns_name_label}.${azurerm_resource_group.sce_rg.location}.azurecontainer.io:1880"
  description = "Node-Red web interface URL"
}

