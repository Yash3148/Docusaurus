---
sidebar_position: 3
---

# PowerShell Script to Retrieve Specific Functions from Azure Functions App

This guide provides PowerShell scripts to retrieve and manage specific functions from Azure Functions App, enabling automation of function discovery, monitoring, and management tasks.

## Prerequisites

- Azure PowerShell module installed
- Azure subscription with Functions App access
- Appropriate RBAC permissions (Reader or Contributor role)
- PowerShell 5.1 or PowerShell 7+

## Installation

Install the Azure PowerShell module:

```powershell
Install-Module -Name Az -AllowClobber -Scope CurrentUser
```

Connect to Azure:

```powershell
Connect-AzAccount
Set-AzContext -SubscriptionId "your-subscription-id"
```

## Script 1: Retrieve All Functions from a Functions App

```powershell
# Retrieve All Functions from Azure Functions App
function Get-AzureFunctionAppFunctions {
    param(
        [Parameter(Mandatory=$true)]
        [string]$ResourceGroupName,
        
        [Parameter(Mandatory=$true)]
        [string]$FunctionAppName
    )
    
    try {
        Write-Host "Retrieving functions from Function App: $FunctionAppName" -ForegroundColor Green
        
        # Get the Function App
        $functionApp = Get-AzFunctionApp -ResourceGroupName $ResourceGroupName -Name $FunctionAppName
        
        if (-not $functionApp) {
            throw "Function App '$FunctionAppName' not found in resource group '$ResourceGroupName'"
        }
        
        # Get function app settings
        $functionAppSettings = Get-AzFunctionAppSetting -ResourceGroupName $ResourceGroupName -Name $FunctionAppName
        
        # Retrieve functions using REST API
        $accessToken = (Get-AzAccessToken).Token
        $headers = @{
            'Authorization' = "Bearer $accessToken"
            'Content-Type' = 'application/json'
        }
        
        $baseUrl = "https://management.azure.com"
        $resourceId = "/subscriptions/$((Get-AzContext).Subscription.Id)/resourceGroups/$ResourceGroupName/providers/Microsoft.Web/sites/$FunctionAppName"
        $apiVersion = "2021-02-01"
        
        $functionsUrl = "$baseUrl$resourceId/functions?api-version=$apiVersion"
        
        $response = Invoke-RestMethod -Uri $functionsUrl -Method Get -Headers $headers
        
        $functions = $response.value
        
        Write-Host "Found $($functions.Count) function(s)" -ForegroundColor Cyan
        
        return $functions
        
    } catch {
        Write-Error "Error retrieving functions: $_"
        return $null
    }
}

# Usage
$functions = Get-AzureFunctionAppFunctions -ResourceGroupName "my-resource-group" -FunctionAppName "my-function-app"
$functions | Format-Table -Property name, type, language
```

## Script 2: Retrieve Specific Functions by Name Pattern

```powershell
# Retrieve Specific Functions by Name Pattern
function Get-AzureFunctionAppFunctionsByPattern {
    param(
        [Parameter(Mandatory=$true)]
        [string]$ResourceGroupName,
        
        [Parameter(Mandatory=$true)]
        [string]$FunctionAppName,
        
        [Parameter(Mandatory=$true)]
        [string]$NamePattern
    )
    
    try {
        Write-Host "Searching for functions matching pattern: $NamePattern" -ForegroundColor Green
        
        # Get all functions
        $allFunctions = Get-AzureFunctionAppFunctions -ResourceGroupName $ResourceGroupName -FunctionAppName $FunctionAppName
        
        if ($null -eq $allFunctions) {
            return $null
        }
        
        # Filter by pattern
        $matchedFunctions = $allFunctions | Where-Object { $_.name -like "*$NamePattern*" }
        
        Write-Host "Found $($matchedFunctions.Count) function(s) matching pattern '$NamePattern'" -ForegroundColor Cyan
        
        return $matchedFunctions
        
    } catch {
        Write-Error "Error filtering functions: $_"
        return $null
    }
}

# Usage - Find functions containing "api" in name
$apiFunctions = Get-AzureFunctionAppFunctionsByPattern `
    -ResourceGroupName "my-resource-group" `
    -FunctionAppName "my-function-app" `
    -NamePattern "api"

$apiFunctions | Select-Object name, type, language | Format-Table
```

## Script 3: Retrieve Functions by Type (HTTP, Timer, etc.)

```powershell
# Retrieve Functions by Type
function Get-AzureFunctionAppFunctionsByType {
    param(
        [Parameter(Mandatory=$true)]
        [string]$ResourceGroupName,
        
        [Parameter(Mandatory=$true)]
        [string]$FunctionAppName,
        
        [Parameter(Mandatory=$true)]
        [ValidateSet("HttpTrigger", "TimerTrigger", "QueueTrigger", "BlobTrigger", "EventHubTrigger", "ServiceBusTrigger")]
        [string]$FunctionType
    )
    
    try {
        Write-Host "Retrieving $FunctionType functions..." -ForegroundColor Green
        
        # Get all functions
        $allFunctions = Get-AzureFunctionAppFunctions -ResourceGroupName $ResourceGroupName -FunctionAppName $FunctionAppName
        
        if ($null -eq $allFunctions) {
            return $null
        }
        
        # Get detailed function information
        $accessToken = (Get-AzAccessToken).Token
        $headers = @{
            'Authorization' = "Bearer $accessToken"
            'Content-Type' = 'application/json'
        }
        
        $baseUrl = "https://management.azure.com"
        $resourceId = "/subscriptions/$((Get-AzContext).Subscription.Id)/resourceGroups/$ResourceGroupName/providers/Microsoft.Web/sites/$FunctionAppName"
        $apiVersion = "2021-02-01"
        
        $filteredFunctions = @()
        
        foreach ($function in $allFunctions) {
            $functionUrl = "$baseUrl$resourceId/functions/$($function.name)?api-version=$apiVersion"
            
            try {
                $functionDetails = Invoke-RestMethod -Uri $functionUrl -Method Get -Headers $headers
                
                # Check bindings for trigger type
                $config = $functionDetails.config | ConvertFrom-Json
                $bindings = $config.bindings
                
                $trigger = $bindings | Where-Object { $_.type -like "*Trigger" -and $_.type -eq $FunctionType }
                
                if ($trigger) {
                    $filteredFunctions += [PSCustomObject]@{
                        Name = $function.name
                        Type = $FunctionType
                        Language = $function.language
                        Bindings = $bindings
                    }
                }
            } catch {
                Write-Warning "Could not retrieve details for function: $($function.name)"
            }
        }
        
        Write-Host "Found $($filteredFunctions.Count) $FunctionType function(s)" -ForegroundColor Cyan
        
        return $filteredFunctions
        
    } catch {
        Write-Error "Error retrieving functions by type: $_"
        return $null
    }
}

# Usage - Get all HTTP trigger functions
$httpFunctions = Get-AzureFunctionAppFunctionsByType `
    -ResourceGroupName "my-resource-group" `
    -FunctionAppName "my-function-app" `
    -FunctionType "HttpTrigger"

$httpFunctions | Format-Table -Property Name, Type, Language
```

## Script 4: Retrieve Functions with Detailed Information

```powershell
# Retrieve Functions with Complete Details
function Get-AzureFunctionAppFunctionsDetailed {
    param(
        [Parameter(Mandatory=$true)]
        [string]$ResourceGroupName,
        
        [Parameter(Mandatory=$true)]
        [string]$FunctionAppName,
        
        [Parameter(Mandatory=$false)]
        [string[]]$FunctionNames
    )
    
    try {
        $accessToken = (Get-AzAccessToken).Token
        $headers = @{
            'Authorization' = "Bearer $accessToken"
            'Content-Type' = 'application/json'
        }
        
        $baseUrl = "https://management.azure.com"
        $resourceId = "/subscriptions/$((Get-AzContext).Subscription.Id)/resourceGroups/$ResourceGroupName/providers/Microsoft.Web/sites/$FunctionAppName"
        $apiVersion = "2021-02-01"
        
        # Get all functions if specific names not provided
        if (-not $FunctionNames) {
            $allFunctions = Get-AzureFunctionAppFunctions -ResourceGroupName $ResourceGroupName -FunctionAppName $FunctionAppName
            $FunctionNames = $allFunctions.name
        }
        
        $detailedFunctions = @()
        
        foreach ($functionName in $FunctionNames) {
            Write-Host "Retrieving details for function: $functionName" -ForegroundColor Yellow
            
            $functionUrl = "$baseUrl$resourceId/functions/$functionName?api-version=$apiVersion"
            
            try {
                $functionDetails = Invoke-RestMethod -Uri $functionUrl -Method Get -Headers $headers
                
                $config = $functionDetails.config | ConvertFrom-Json
                
                $functionInfo = [PSCustomObject]@{
                    Name = $functionDetails.name
                    Language = $functionDetails.language
                    Config = $config
                    Bindings = $config.bindings
                    Triggers = ($config.bindings | Where-Object { $_.type -like "*Trigger" })
                    InputBindings = ($config.bindings | Where-Object { $_.type -notlike "*Trigger" -and $_.direction -eq "in" })
                    OutputBindings = ($config.bindings | Where-Object { $_.direction -eq "out" })
                    ScriptRootPathHref = $functionDetails.scriptRootPathHref
                    ScriptHref = $functionDetails.scriptHref
                    TestDataHref = $functionDetails.testDataHref
                    SecretsFileHref = $functionDetails.secretsFileHref
                }
                
                $detailedFunctions += $functionInfo
                
            } catch {
                Write-Warning "Could not retrieve details for function: $functionName - $_"
            }
        }
        
        return $detailedFunctions
        
    } catch {
        Write-Error "Error retrieving detailed function information: $_"
        return $null
    }
}

# Usage - Get detailed info for specific functions
$detailedFunctions = Get-AzureFunctionAppFunctionsDetailed `
    -ResourceGroupName "my-resource-group" `
    -FunctionAppName "my-function-app" `
    -FunctionNames @("Function1", "Function2")

$detailedFunctions | Format-List
```

## Script 5: Export Functions to CSV

```powershell
# Export Functions Information to CSV
function Export-AzureFunctionAppFunctionsToCSV {
    param(
        [Parameter(Mandatory=$true)]
        [string]$ResourceGroupName,
        
        [Parameter(Mandatory=$true)]
        [string]$FunctionAppName,
        
        [Parameter(Mandatory=$true)]
        [string]$OutputPath
    )
    
    try {
        Write-Host "Exporting functions to CSV: $OutputPath" -ForegroundColor Green
        
        $allFunctions = Get-AzureFunctionAppFunctions -ResourceGroupName $ResourceGroupName -FunctionAppName $FunctionAppName
        
        if ($null -eq $allFunctions) {
            Write-Error "No functions found to export"
            return
        }
        
        $exportData = @()
        
        foreach ($function in $allFunctions) {
            $exportData += [PSCustomObject]@{
                FunctionName = $function.name
                Type = $function.type
                Language = $function.language
                ResourceGroup = $ResourceGroupName
                FunctionApp = $FunctionAppName
                Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            }
        }
        
        $exportData | Export-Csv -Path $OutputPath -NoTypeInformation -Encoding UTF8
        
        Write-Host "Successfully exported $($exportData.Count) function(s) to $OutputPath" -ForegroundColor Green
        
    } catch {
        Write-Error "Error exporting functions: $_"
    }
}

# Usage
Export-AzureFunctionAppFunctionsToCSV `
    -ResourceGroupName "my-resource-group" `
    -FunctionAppName "my-function-app" `
    -OutputPath "C:\temp\functions-export.csv"
```

## Complete Example: Multi-Function App Inventory

```powershell
# Complete Function App Inventory Script
function Get-AzureFunctionAppInventory {
    param(
        [Parameter(Mandatory=$true)]
        [string]$ResourceGroupName,
        
        [Parameter(Mandatory=$false)]
        [string]$FunctionAppName
    )
    
    $inventory = @()
    
    if ($FunctionAppName) {
        $functionApps = @(Get-AzFunctionApp -ResourceGroupName $ResourceGroupName -Name $FunctionAppName)
    } else {
        $functionApps = Get-AzFunctionApp -ResourceGroupName $ResourceGroupName
    }
    
    foreach ($app in $functionApps) {
        Write-Host "Processing Function App: $($app.Name)" -ForegroundColor Cyan
        
        $functions = Get-AzureFunctionAppFunctions -ResourceGroupName $ResourceGroupName -FunctionAppName $app.Name
        
        foreach ($function in $functions) {
            $inventory += [PSCustomObject]@{
                FunctionAppName = $app.Name
                FunctionName = $function.name
                FunctionType = $function.type
                Language = $function.language
                ResourceGroup = $ResourceGroupName
                Location = $app.Location
                Runtime = $app.ApplicationSettings.WEBSITE_NODE_DEFAULT_VERSION
            }
        }
    }
    
    return $inventory
}

# Usage
$inventory = Get-AzureFunctionAppInventory -ResourceGroupName "my-resource-group"
$inventory | Format-Table -AutoSize
$inventory | Export-Csv -Path "function-app-inventory.csv" -NoTypeInformation
```

## Best Practices

1. **Error Handling**: Always implement try-catch blocks
2. **Logging**: Use Write-Host with colors for better visibility
3. **Performance**: Use parallel processing for multiple function apps
4. **Security**: Store credentials securely using Azure Key Vault
5. **Reusability**: Create functions instead of scripts for repeated tasks

## Troubleshooting

### Common Issues

**Issue**: Authentication failures
```powershell
# Re-authenticate
Connect-AzAccount
Get-AzContext
```

**Issue**: Function not found
```powershell
# Verify function app exists
Get-AzFunctionApp -ResourceGroupName "rg-name" -Name "function-app-name"
```

**Issue**: Permission denied
```powershell
# Check your role assignments
Get-AzRoleAssignment -SignInName (Get-AzContext).Account.Id
```

## Additional Resources

- [Azure Functions PowerShell Documentation](https://docs.microsoft.com/powershell/module/az.functions/)
- [Azure Functions REST API](https://docs.microsoft.com/rest/api/appservice/web-apps)
- [Azure PowerShell Module](https://docs.microsoft.com/powershell/azure/)

