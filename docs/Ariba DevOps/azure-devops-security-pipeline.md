---
sidebar_position: 5
---

# End-to-End Automated Security Pipeline for PR Validation in Azure DevOps

This guide provides a comprehensive implementation of an automated security pipeline for Azure DevOps that validates pull requests (PRs) through multiple security checks, vulnerability scanning, and compliance verification.

## Overview

The security pipeline automates:
- **Static Application Security Testing (SAST)**
- **Software Composition Analysis (SCA)**
- **Secret scanning**
- **Infrastructure as Code (IaC) security**
- **Container image scanning**
- **Compliance checks**
- **Security policy enforcement**

## Prerequisites

- Azure DevOps organization and project
- Azure Pipelines enabled
- Appropriate permissions (Build Administrator, Project Administrator)
- Access to security scanning tools (SonarQube, Snyk, Trivy, etc.)
- Azure Key Vault for storing secrets

## Architecture

```
┌─────────────────┐
│   Pull Request  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Security Gate  │
│   (Branch Policy)│
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│      Security Pipeline Stages       │
├─────────────────────────────────────┤
│ 1. SAST Analysis                    │
│ 2. Dependency Scanning              │
│ 3. Secret Detection                 │
│ 4. IaC Security Scan                 │
│ 5. Container Scanning               │
│ 6. Compliance Check                 │
│ 7. Security Report Generation       │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  PR Validation  │
│  (Pass/Fail)    │
└─────────────────┘
```

## Step 1: Configure Branch Policies

### Enable Required Status Checks

1. Navigate to **Repos > Branches**
2. Select your main branch (e.g., `main` or `master`)
3. Click **Branch policies**
4. Enable **Require a minimum number of reviewers**
5. Enable **Check for linked work items**
6. Add **Build validation** for the security pipeline

### Configure Build Validation

```yaml
# Branch policy configuration
Build validation:
  - Build pipeline: Security-Pipeline
  - Required: Yes
  - Policy requirement: Optional
  - Display name: Security Validation
  - Path filter: /*
```

## Step 2: Create Security Pipeline

### Main Pipeline YAML

Create `azure-pipelines-security.yml`:

```yaml
# Azure DevOps Security Pipeline
trigger: none  # Only run on PRs via branch policy

pr:
  branches:
    include:
      - main
      - develop
      - release/*

variables:
  - group: Security-Pipeline-Variables
  - name: BuildConfiguration
    value: 'Release'
  - name: SonarQubeProjectKey
    value: 'YourProjectKey'

stages:
  - stage: SecurityScan
    displayName: 'Security Validation'
    jobs:
      - job: SASTAnalysis
        displayName: 'Static Application Security Testing'
        pool:
          vmImage: 'ubuntu-latest'
        steps:
          - task: SonarQubePrepare@5
            displayName: 'Prepare SonarQube Analysis'
            inputs:
              SonarQube: 'SonarQube-Connection'
              scannerMode: 'CLI'
              configMode: 'manual'
              cliProjectKey: '$(SonarQubeProjectKey)'
              cliProjectName: '$(Build.Repository.Name)'
              cliSources: '.'
              extraProperties: |
                sonar.pullrequest.key=$(System.PullRequest.PullRequestId)
                sonar.pullrequest.branch=$(Build.SourceBranchName)
                sonar.pullrequest.base=$(System.PullRequest.TargetBranch)
          
          - task: SonarQubeAnalyze@5
            displayName: 'Run SonarQube Analysis'
          
          - task: SonarQubePublish@5
            displayName: 'Publish SonarQube Results'
            inputs:
              pollingTimeoutSec: '300'

      - job: DependencyScanning
        displayName: 'Dependency Vulnerability Scanning'
        pool:
          vmImage: 'ubuntu-latest'
        steps:
          - checkout: self
          
          - task: UseNode@1
            displayName: 'Use Node.js'
            inputs:
              version: '18.x'
          
          - script: |
              npm audit --audit-level=moderate --json > npm-audit.json || true
            displayName: 'Run npm Audit'
            continueOnError: true
          
          - task: SnykSecurityScan@1
            displayName: 'Snyk Security Scan'
            inputs:
              serviceConnectionEndpoint: 'Snyk-Service-Connection'
              testType: 'app'
              severityThreshold: 'high'
              monitorWhen: 'always'
              failOnIssues: true
          
          - task: PublishTestResults@2
            displayName: 'Publish Security Test Results'
            inputs:
              testResultsFormat: 'JUnit'
              testResultsFiles: '**/snyk-test-results.xml'
              failTaskOnFailedTests: true

      - job: SecretDetection
        displayName: 'Secret and Credential Detection'
        pool:
          vmImage: 'ubuntu-latest'
        steps:
          - checkout: self
            fetchDepth: 0
          
          - script: |
              # Install Gitleaks
              wget https://github.com/gitleaks/gitleaks/releases/download/v8.18.0/gitleaks_8.18.0_linux_x64.tar.gz
              tar -xzf gitleaks_8.18.0_linux_x64.tar.gz
              chmod +x gitleaks
              sudo mv gitleaks /usr/local/bin/
            displayName: 'Install Gitleaks'
          
          - script: |
              gitleaks detect --source . --verbose --report-format json --report-path gitleaks-report.json || true
            displayName: 'Scan for Secrets'
            continueOnError: true
          
          - script: |
              # Install TruffleHog
              pip install truffleHog
            displayName: 'Install TruffleHog'
          
          - script: |
              truffleHog --regex --entropy=False --json . > trufflehog-report.json || true
            displayName: 'Run TruffleHog Scan'
            continueOnError: true
          
          - task: PublishPipelineArtifact@1
            displayName: 'Publish Secret Scan Reports'
            inputs:
              targetPath: '$(System.DefaultWorkingDirectory)'
              artifact: 'secret-scan-reports'
              publishLocation: 'pipeline'
          
          - script: |
              # Fail if secrets found
              if [ -s gitleaks-report.json ] && [ "$(cat gitleaks-report.json)" != "[]" ]; then
                echo "##vso[task.logissue type=error]Secrets detected in code!"
                cat gitleaks-report.json
                exit 1
              fi
            displayName: 'Validate No Secrets Found'
            continueOnError: false

      - job: IaCSecurityScan
        displayName: 'Infrastructure as Code Security'
        pool:
          vmImage: 'ubuntu-latest'
        steps:
          - checkout: self
          
          - script: |
              # Install Checkov
              pip install checkov
            displayName: 'Install Checkov'
          
          - script: |
              checkov -d . --framework terraform --output json --output-file checkov-report.json || true
            displayName: 'Run Checkov Scan'
            continueOnError: true
          
          - script: |
              # Install Terrascan
              wget https://github.com/tenable/terrascan/releases/download/v1.18.8/terrascan_1.18.8_Linux_x86_64.tar.gz
              tar -xzf terrascan_1.18.8_Linux_x86_64.tar.gz
              chmod +x terrascan
              sudo mv terrascan /usr/local/bin/
            displayName: 'Install Terrascan'
          
          - script: |
              terrascan scan -t terraform -f . -o json > terrascan-report.json || true
            displayName: 'Run Terrascan Scan'
            continueOnError: true
          
          - task: PublishPipelineArtifact@1
            displayName: 'Publish IaC Scan Reports'
            inputs:
              targetPath: '$(System.DefaultWorkingDirectory)'
              artifact: 'iac-scan-reports'
              publishLocation: 'pipeline'

      - job: ContainerScanning
        displayName: 'Container Image Security Scan'
        pool:
          vmImage: 'ubuntu-latest'
        condition: and(succeeded(), ne(variables['Build.SourceBranch'], 'refs/heads/main'))
        steps:
          - checkout: self
          
          - script: |
              # Install Trivy
              wget https://github.com/aquasecurity/trivy/releases/download/v0.45.0/trivy_0.45.0_Linux-64bit.tar.gz
              tar -xzf trivy_0.45.0_Linux-64bit.tar.gz
              chmod +x trivy
              sudo mv trivy /usr/local/bin/
            displayName: 'Install Trivy'
          
          - script: |
              # Find Dockerfiles
              find . -name "Dockerfile" -type f | while read dockerfile; do
                echo "Scanning $dockerfile"
                trivy fs --security-checks vuln,config --format json --output "trivy-$(basename $(dirname $dockerfile)).json" "$(dirname $dockerfile)" || true
              done
            displayName: 'Scan Dockerfiles'
            continueOnError: true
          
          - script: |
              # Scan container images if built
              if [ -f docker-images.txt ]; then
                while IFS= read -r image; do
                  trivy image --format json --output "trivy-image-$(echo $image | tr '/:' '_').json" "$image" || true
                done < docker-images.txt
              fi
            displayName: 'Scan Container Images'
            continueOnError: true
            condition: and(succeeded(), eq(variables['BuildContainerImages'], 'true'))

      - job: ComplianceCheck
        displayName: 'Compliance and Policy Validation'
        pool:
          vmImage: 'ubuntu-latest'
        steps:
          - checkout: self
          
          - script: |
              # Install OPA (Open Policy Agent)
              wget https://github.com/open-policy-agent/opa/releases/download/v0.57.0/opa_linux_amd64
              chmod +x opa_linux_amd64
              sudo mv opa_linux_amd64 /usr/local/bin/opa
            displayName: 'Install OPA'
          
          - script: |
              # Run compliance policies
              opa test ./policies --format json > opa-compliance-report.json || true
            displayName: 'Run Compliance Policies'
            continueOnError: true
          
          - script: |
              # Check license compliance
              npm install -g license-checker
              license-checker --json > license-report.json || true
            displayName: 'Check License Compliance'
            continueOnError: true
            condition: and(succeeded(), eq(variables['CheckLicenses'], 'true'))

      - job: SecurityReport
        displayName: 'Generate Security Report'
        dependsOn:
          - SASTAnalysis
          - DependencyScanning
          - SecretDetection
          - IaCSecurityScan
          - ContainerScanning
          - ComplianceCheck
        pool:
          vmImage: 'ubuntu-latest'
        steps:
          - download: current
            artifact: 'secret-scan-reports'
          
          - download: current
            artifact: 'iac-scan-reports'
          
          - script: |
              # Generate consolidated security report
              python3 << EOF
              import json
              import os
              
              report = {
                  "pipeline": "$(Build.BuildNumber)",
                  "branch": "$(Build.SourceBranchName)",
                  "pr": "$(System.PullRequest.PullRequestId)",
                  "timestamp": "$(Build.BuildId)",
                  "scans": {}
              }
              
              # Aggregate scan results
              scan_files = [
                  "gitleaks-report.json",
                  "checkov-report.json",
                  "npm-audit.json"
              ]
              
              for scan_file in scan_files:
                  if os.path.exists(scan_file):
                      with open(scan_file, 'r') as f:
                          report["scans"][scan_file] = json.load(f)
              
              with open("security-report.json", "w") as f:
                  json.dump(report, f, indent=2)
              
              print("Security report generated")
              EOF
            displayName: 'Generate Consolidated Report'
          
          - task: PublishPipelineArtifact@1
            displayName: 'Publish Security Report'
            inputs:
              targetPath: '$(System.DefaultWorkingDirectory)'
              artifact: 'security-report'
              publishLocation: 'pipeline'
          
          - task: GitHubComment@0
            displayName: 'Comment on PR'
            inputs:
              gitHubConnection: 'GitHub-Connection'
              repositoryName: '$(Build.Repository.Name)'
              issueNumber: '$(System.PullRequest.PullRequestNumber)'
              action: 'createOrEdit'
              comment: |
                ## 🔒 Security Scan Results
                
                **Pipeline:** $(Build.BuildNumber)
                **Branch:** $(Build.SourceBranchName)
                
                ### Scan Summary
                - ✅ SAST Analysis: Completed
                - ✅ Dependency Scanning: Completed
                - ✅ Secret Detection: Completed
                - ✅ IaC Security: Completed
                - ✅ Container Scanning: Completed
                - ✅ Compliance Check: Completed
                
                [View Full Report]($(System.CollectionUri)$(System.TeamProject)/_build/results?buildId=$(Build.BuildId))
            condition: always()
```

## Step 3: Configure Service Connections

### SonarQube Connection

1. Navigate to **Project Settings > Service connections**
2. Click **New service connection**
3. Select **SonarQube**
4. Configure:
   - **Server URL**: Your SonarQube server URL
   - **Token**: SonarQube authentication token

### Snyk Connection

1. Create new service connection
2. Select **Snyk**
3. Provide:
   - **API Token**: From Snyk account settings
   - **Organization ID**: Your Snyk organization

## Step 4: Create Variable Groups

Create `Security-Pipeline-Variables`:

```yaml
Variables:
  - SonarQubeProjectKey: "your-project-key"
  - SnykOrgId: "your-org-id"
  - SecurityThreshold: "high"
  - FailOnHighSeverity: "true"
  - BuildContainerImages: "false"
  - CheckLicenses: "true"
```

## Step 5: Create OPA Policies

Create `policies/security.rego`:

```rego
package security

# Deny PRs with high severity vulnerabilities
deny[msg] {
    input.vulnerabilities[_].severity == "HIGH"
    msg := "High severity vulnerability detected"
}

# Require security headers in web applications
deny[msg] {
    input.type == "webapp"
    not input.headers["X-Content-Type-Options"]
    msg := "Missing security headers"
}

# Enforce HTTPS only
deny[msg] {
    input.protocol == "http"
    msg := "HTTP connections not allowed"
}
```

## Step 6: PowerShell Script for PR Validation

```powershell
# Azure DevOps PR Security Validation Script
param(
    [Parameter(Mandatory=$true)]
    [string]$OrganizationUrl,
    
    [Parameter(Mandatory=$true)]
    [string]$ProjectName,
    
    [Parameter(Mandatory=$true)]
    [string]$RepositoryId,
    
    [Parameter(Mandatory=$true)]
    [int]$PullRequestId,
    
    [Parameter(Mandatory=$true)]
    [string]$PatToken
)

$headers = @{
    'Authorization' = "Basic $([Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(":$PatToken")))"
    'Content-Type' = 'application/json'
}

# Get PR details
$prUrl = "$OrganizationUrl/$ProjectName/_apis/git/repositories/$RepositoryId/pullRequests/$PullRequestId`?api-version=7.1"
$pr = Invoke-RestMethod -Uri $prUrl -Method Get -Headers $headers

Write-Host "Validating PR: $($pr.title)" -ForegroundColor Cyan

# Check if security pipeline passed
$buildsUrl = "$OrganizationUrl/$ProjectName/_apis/build/builds`?definitions=Security-Pipeline&branchName=$($pr.sourceRefName)&api-version=7.1"
$builds = Invoke-RestMethod -Uri $buildsUrl -Method Get -Headers $headers

$latestBuild = $builds.value | Sort-Object -Property finishTime -Descending | Select-Object -First 1

if ($latestBuild.status -eq "completed" -and $latestBuild.result -eq "succeeded") {
    Write-Host "✅ Security validation passed" -ForegroundColor Green
    return $true
} else {
    Write-Host "❌ Security validation failed" -ForegroundColor Red
    return $false
}
```

## Step 7: Configure PR Status Policy

```yaml
# Branch policy YAML
status_checks:
  - name: Security-Pipeline
    required: true
    strict: true
```

## Best Practices

1. **Fail Fast**: Stop pipeline on critical security issues
2. **Comprehensive Scanning**: Cover all code, dependencies, and infrastructure
3. **Automated Remediation**: Where possible, auto-fix low-risk issues
4. **Security Gates**: Enforce security policies at PR level
5. **Regular Updates**: Keep scanning tools updated
6. **Reporting**: Provide clear, actionable security reports
7. **Compliance**: Align with industry standards (OWASP, NIST, etc.)

## Monitoring and Alerts

### Create Alert Rules

```yaml
# Alert configuration
alerts:
  - name: HighSeverityVulnerability
    condition: vulnerabilities.severity == "HIGH"
    action: block_pr
    
  - name: SecretDetected
    condition: secrets.count > 0
    action: block_pr
    
  - name: ComplianceFailure
    condition: compliance.score < 80
    action: notify_and_block
```

## Troubleshooting

### Common Issues

**Issue**: Pipeline not triggering on PR
- Verify branch policy configuration
- Check pipeline trigger settings
- Ensure service connections are valid

**Issue**: Scan tools failing
- Verify tool installations
- Check network connectivity
- Review tool-specific logs

**Issue**: False positives
- Tune scan tool configurations
- Update exclusion lists
- Refine security policies

## Additional Resources

- [Azure DevOps Security Best Practices](https://docs.microsoft.com/azure/devops/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [SonarQube Documentation](https://docs.sonarqube.org/)
- [Snyk Documentation](https://docs.snyk.io/)

