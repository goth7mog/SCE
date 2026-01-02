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
