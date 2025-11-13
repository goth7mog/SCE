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




