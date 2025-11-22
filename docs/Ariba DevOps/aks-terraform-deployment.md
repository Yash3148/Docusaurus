---
sidebar_position: 2
---

# Automated Deployment and Scaling of Azure Kubernetes Service (AKS) Using Terraform

This guide provides a comprehensive approach to deploying and managing Azure Kubernetes Service (AKS) clusters using Terraform, enabling infrastructure as code (IaC) practices for scalable and maintainable cloud infrastructure.

## Prerequisites

Before you begin, ensure you have the following:

- Azure subscription with appropriate permissions
- Terraform installed (version 1.0 or later)
- Azure CLI installed and configured
- kubectl installed for cluster management
- Basic understanding of Kubernetes concepts

## Architecture Overview

The Terraform configuration will create:

- **Resource Group** - Container for all resources
- **Virtual Network (VNet)** - Network infrastructure for the cluster
- **AKS Cluster** - Managed Kubernetes service
- **Node Pools** - Worker node configurations
- **Azure Container Registry (ACR)** - Optional container registry
- **Log Analytics Workspace** - For monitoring and logging

## Step 1: Configure Azure Authentication

First, authenticate with Azure:

```bash
az login
az account set --subscription "Your-Subscription-ID"
```

## Step 2: Create Terraform Configuration

Create a new directory for your Terraform configuration:

```bash
mkdir aks-terraform
cd aks-terraform
```

### Main Configuration File

Create `main.tf`:

```hcl
terraform {
  required_version = ">= 1.0"
  
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
  
  backend "azurerm" {
    resource_group_name  = "terraform-state-rg"
    storage_account_name = "terraformstate"
    container_name       = "tfstate"
    key                  = "aks.terraform.tfstate"
  }
}

provider "azurerm" {
  features {
    resource_group {
      prevent_deletion_if_contains_resources = false
    }
  }
}

# Variables
variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
  default     = "aks-rg"
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "East US"
}

variable "cluster_name" {
  description = "Name of the AKS cluster"
  type        = string
  default     = "aks-cluster"
}

variable "node_count" {
  description = "Number of nodes in the default node pool"
  type        = number
  default     = 3
}

variable "vm_size" {
  description = "VM size for nodes"
  type        = string
  default     = "Standard_DS2_v2"
}

# Resource Group
resource "azurerm_resource_group" "aks" {
  name     = var.resource_group_name
  location = var.location

  tags = {
    Environment = "Production"
    ManagedBy   = "Terraform"
  }
}

# Virtual Network
resource "azurerm_virtual_network" "aks" {
  name                = "${var.cluster_name}-vnet"
  address_space       = ["10.0.0.0/16"]
  location            = azurerm_resource_group.aks.location
  resource_group_name = azurerm_resource_group.aks.name

  tags = {
    Environment = "Production"
  }
}

# Subnet for AKS
resource "azurerm_subnet" "aks" {
  name                 = "${var.cluster_name}-subnet"
  resource_group_name  = azurerm_resource_group.aks.name
  virtual_network_name = azurerm_virtual_network.aks.name
  address_prefixes     = ["10.0.1.0/24"]
}

# Log Analytics Workspace
resource "azurerm_log_analytics_workspace" "aks" {
  name                = "${var.cluster_name}-logs"
  location            = azurerm_resource_group.aks.location
  resource_group_name = azurerm_resource_group.aks.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
}

# AKS Cluster
resource "azurerm_kubernetes_cluster" "aks" {
  name                = var.cluster_name
  location            = azurerm_resource_group.aks.location
  resource_group_name = azurerm_resource_group.aks.name
  dns_prefix          = var.cluster_name
  kubernetes_version  = "1.28"

  default_node_pool {
    name                = "default"
    node_count          = var.node_count
    vm_size             = var.vm_size
    os_disk_size_gb     = 50
    type                = "VirtualMachineScaleSets"
    enable_auto_scaling = true
    min_count           = 1
    max_count           = 10
    vnet_subnet_id      = azurerm_subnet.aks.id
  }

  identity {
    type = "SystemAssigned"
  }

  network_profile {
    network_plugin    = "azure"
    load_balancer_sku = "standard"
  }

  oms_agent {
    log_analytics_workspace_id = azurerm_log_analytics_workspace.aks.id
  }

  role_based_access_control_enabled = true

  azure_active_directory_role_based_access_control {
    managed                = true
    azure_rbac_enabled     = true
    admin_group_object_ids = []
  }

  tags = {
    Environment = "Production"
    ManagedBy   = "Terraform"
  }
}

# Additional Node Pool for GPU workloads
resource "azurerm_kubernetes_cluster_node_pool" "gpu" {
  name                  = "gpunodepool"
  kubernetes_cluster_id = azurerm_kubernetes_cluster.aks.id
  vm_size               = "Standard_NC6"
  node_count            = 1
  enable_auto_scaling   = true
  min_count             = 0
  max_count             = 5

  node_taints = [
    "nvidia.com/gpu=true:NoSchedule"
  ]

  tags = {
    Workload = "GPU"
  }
}

# Outputs
output "cluster_name" {
  value = azurerm_kubernetes_cluster.aks.name
}

output "cluster_fqdn" {
  value = azurerm_kubernetes_cluster.aks.fqdn
}

output "cluster_identity" {
  value = azurerm_kubernetes_cluster.aks.identity
}

output "kube_config" {
  value     = azurerm_kubernetes_cluster.aks.kube_config_raw
  sensitive = true
}
```

### Variables File

Create `variables.tf`:

```hcl
variable "resource_group_name" {
  description = "Name of the resource group"
  type        = string
}

variable "location" {
  description = "Azure region for resources"
  type        = string
}

variable "cluster_name" {
  description = "Name of the AKS cluster"
  type        = string
}

variable "node_count" {
  description = "Initial number of nodes"
  type        = number
  default     = 3
}

variable "vm_size" {
  description = "VM size for nodes"
  type        = string
  default     = "Standard_DS2_v2"
}
```

### Terraform Variables File

Create `terraform.tfvars`:

```hcl
resource_group_name = "aks-production-rg"
location            = "East US"
cluster_name        = "aks-production-cluster"
node_count          = 3
vm_size             = "Standard_DS2_v2"
```

## Step 3: Initialize and Deploy

Initialize Terraform:

```bash
terraform init
```

Plan the deployment:

```bash
terraform plan -out=tfplan
```

Apply the configuration:

```bash
terraform apply tfplan
```

## Step 4: Configure kubectl

After deployment, configure kubectl:

```bash
az aks get-credentials --resource-group aks-production-rg --name aks-production-cluster
kubectl get nodes
```

## Step 5: Enable Auto-Scaling

The cluster is configured with auto-scaling enabled. Monitor scaling:

```bash
kubectl get nodes -w
```

## Step 6: Deploy Applications

Example deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sample-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: sample-app
  template:
    metadata:
      labels:
        app: sample-app
    spec:
      containers:
      - name: app
        image: nginx:latest
        ports:
        - containerPort: 80
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi
```

## Scaling Operations

### Manual Scaling

```bash
# Scale node pool
az aks nodepool scale \
  --resource-group aks-production-rg \
  --cluster-name aks-production-cluster \
  --name default \
  --node-count 5
```

### Horizontal Pod Autoscaling

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: sample-app-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: sample-app
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

## Monitoring and Logging

Access logs through Azure Portal or CLI:

```bash
az monitor log-analytics query \
  --workspace $(az aks show -g aks-production-rg -n aks-production-cluster --query addonProfiles.omsagent.config.logAnalyticsWorkspaceResourceId -o tsv) \
  --analytics-query "KubePodInventory | where TimeGenerated > ago(1h) | summarize count() by PodLabel"
```

## Best Practices

1. **Use separate node pools** for different workload types
2. **Enable auto-scaling** for cost optimization
3. **Implement resource quotas** to prevent resource exhaustion
4. **Use Azure Policy** for governance
5. **Regularly update** Kubernetes version
6. **Enable Azure Monitor** for comprehensive monitoring
7. **Use managed identities** for secure authentication

## Troubleshooting

### Common Issues

**Issue**: Nodes not joining cluster
```bash
az aks show --resource-group aks-production-rg --name aks-production-cluster --query nodeResourceGroup -o tsv
```

**Issue**: Pod scheduling failures
```bash
kubectl describe pod <pod-name>
kubectl get events --sort-by='.lastTimestamp'
```

## Cleanup

To destroy all resources:

```bash
terraform destroy
```

## Additional Resources

- [Azure Kubernetes Service Documentation](https://docs.microsoft.com/azure/aks/)
- [Terraform Azure Provider](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs)
- [Kubernetes Official Documentation](https://kubernetes.io/docs/)

