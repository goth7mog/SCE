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




