variable "port" {
  description = "App port"
  type        = string
}

variable "mongo_host" {
  description = "MongoDB host"
  type        = string
}

variable "mongo_port" {
  description = "MongoDB port"
  type        = string
}

variable "mongo_user" {
  description = "MongoDB user"
  type        = string
}

variable "mongo_database" {
  description = "MongoDB database"
  type        = string
}

variable "redis_host" {
  description = "Redis host"
  type        = string
}

variable "redis_port" {
  description = "Redis port"
  type        = string
}
variable "mongo_password" {
  description = "MongoDB password"
  type        = string
  sensitive   = true
}

variable "iothub_connection_string" {
  description = "IoT Hub connection string"
  type        = string
  sensitive   = true
}

variable "redis_password" {
  description = "Redis password"
  type        = string
  sensitive   = true
}

variable "okta_domain" {
  description = "Okta domain"
  type        = string
}

variable "okta_client_id" {
  description = "Okta OAuth client ID for Logic App"
  type        = string
  sensitive   = true
}

variable "okta_client_secret" {
  description = "Okta OAuth client secret for Logic App"
  type        = string
  sensitive   = true
}

variable "okta_audience" {
  description = "Okta audience for token validation"
  type        = string
}

variable "okta_scope" {
  description = "Okta OAuth scope to request"
  type        = string
}
