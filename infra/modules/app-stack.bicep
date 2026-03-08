targetScope = 'resourceGroup'

@description('Base name used for all resource naming.')
@minLength(3)
@maxLength(20)
param name string

@description('Azure region for resource deployment.')
param location string = resourceGroup().location

@description('Tags to apply to all resources.')
param tags object = {}

@description('Web PubSub hub name used by Galaxy Shooter clients.')
param webPubSubHubName string

@description('Log Analytics workspace retention in days.')
@minValue(30)
@maxValue(730)
param logRetentionDays int = 90

@description('Web PubSub unit capacity for scaling.')
@minValue(1)
param webPubSubCapacity int = 1

@description('Web PubSub SKU. Use Free_F1 for dev/test, Premium_P1 for production.')
param webPubSubSku string = 'Free_F1'

@description('Static Web App SKU. Use Free for dev/test, Standard for production.')
@allowed(['Free', 'Standard'])
param staticWebAppSku string = 'Free'

@description('Redis Enterprise SKU name.')
@allowed(['Balanced_B0', 'Balanced_B1', 'Balanced_B3', 'Balanced_B5', 'Balanced_B10', 'MemoryOptimized_M10', 'MemoryOptimized_M20'])
param redisSku string = 'Balanced_B0'

@description('Minimum replica count for the API container app. Use 0 for dev/test (scale to zero).')
@minValue(0)
param apiMinReplicas int = 0

var resourceSuffix = take(uniqueString(subscription().id, resourceGroup().name, name), 6)
var acrName = toLower('acr${replace(name, '-', '')}${resourceSuffix}')
var managedEnvironmentName = 'cae-${name}-${resourceSuffix}'
var apiAppName = 'api-${name}-${resourceSuffix}'
var logAnalyticsName = 'log-${name}-${resourceSuffix}'
var appInsightsName = 'appi-${name}-${resourceSuffix}'
var redisName = 'redis-${name}-${resourceSuffix}'
var webPubSubName = 'wps-${name}-${resourceSuffix}'
var staticWebAppName = 'swa-${name}-${resourceSuffix}'
var apiImagePlaceholder = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsName
  location: location
  tags: tags
  properties: {
    retentionInDays: logRetentionDays
    features: {
      searchVersion: 1
      legacy: 0
      enableLogAccessUsingOnlyResourcePermissions: true
    }
    sku: {
      name: 'PerGB2018'
    }
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalytics.id
  }
}

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  tags: tags
  sku: {
    name: 'Standard'
  }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Enabled'
  }
}

resource managedEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: managedEnvironmentName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: listKeys(logAnalytics.id, logAnalytics.apiVersion).primarySharedKey
      }
    }
  }
}

resource staticWebApp 'Microsoft.Web/staticSites@2024-11-01' = {
  name: staticWebAppName
  location: location
  tags: union(tags, {
    'azd-service-name': 'web'
  })
  sku: {
    name: staticWebAppSku
    tier: staticWebAppSku
  }
  properties: {}
}

resource redisEnterprise 'Microsoft.Cache/redisEnterprise@2025-04-01' = {
  name: redisName
  location: location
  tags: tags
  sku: {
    name: redisSku
  }
  properties: {
    encryption: {}
    highAvailability: 'Enabled'
    minimumTlsVersion: '1.2'
  }
}

resource redisDatabase 'Microsoft.Cache/redisEnterprise/databases@2025-04-01' = {
  name: 'default'
  parent: redisEnterprise
  properties: {
    accessKeysAuthentication: 'Enabled'
    clientProtocol: 'Encrypted'
    clusteringPolicy: 'NoCluster'
    evictionPolicy: 'AllKeysLRU'
    modules: []
    port: 10000
  }
}

resource webPubSub 'Microsoft.SignalRService/webPubSub@2024-03-01' = {
  name: webPubSubName
  location: location
  tags: tags
  sku: {
    name: webPubSubSku
    capacity: webPubSubCapacity
  }
  properties: {
    publicNetworkAccess: 'Enabled'
  }
}

resource apiApp 'Microsoft.App/containerApps@2024-03-01' = {
  name: apiAppName
  location: location
  tags: union(tags, {
    'azd-service-name': 'api'
  })
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: managedEnvironment.id
    configuration: {
      ingress: {
        external: true
        allowInsecure: false
        targetPort: 80
        transport: 'http'
      }
      secrets: [
        {
          name: 'redis-url'
          // Inline listKeys to avoid storing secret in a variable
          value: 'rediss://:${listKeys(redisDatabase.id, redisDatabase.apiVersion).primaryKey}@${redisEnterprise.properties.hostName}:10000'
        }
        {
          name: 'webpubsub-connection-string'
          value: listKeys(webPubSub.id, webPubSub.apiVersion).primaryConnectionString
        }
        {
          name: 'appinsights-connection-string'
          value: appInsights.properties.ConnectionString
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'api'
          image: apiImagePlaceholder
          env: [
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'PORT'
              value: '80'
            }
            {
              name: 'INSTANCE_ID'
              value: apiAppName
            }
            {
              name: 'ROOM_STATE_TTL_SECONDS'
              value: '3600'
            }
            {
              name: 'ROOM_OWNER_TTL_SECONDS'
              value: '120'
            }
            {
              name: 'WEB_PUBSUB_HUB'
              value: webPubSubHubName
            }
            {
              name: 'REDIS_URL'
              secretRef: 'redis-url'
            }
            {
              name: 'WEB_PUBSUB_CONNECTION_STRING'
              secretRef: 'webpubsub-connection-string'
            }
            {
              name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
              secretRef: 'appinsights-connection-string'
            }
            {
              name: 'ALLOWED_ORIGINS'
              value: 'https://${staticWebApp.properties.defaultHostname}'
            }
          ]
          resources: {
            cpu: json('1.0')
            memory: '2Gi'
          }
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: 80
              }
              periodSeconds: 15
              failureThreshold: 3
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/health'
                port: 80
              }
              periodSeconds: 10
              failureThreshold: 3
            }
          ]
        }
      ]
      scale: {
        minReplicas: apiMinReplicas
        maxReplicas: 10
      }
    }
  }
}

resource webPubSubHub 'Microsoft.SignalRService/webPubSub/hubs@2024-03-01' = {
  name: webPubSubHubName
  parent: webPubSub
  properties: {
    anonymousConnectPolicy: 'Deny'
    eventHandlers: [
      {
        urlTemplate: 'https://${apiApp.properties.configuration.ingress.fqdn}/api/webpubsub/hubs/${webPubSubHubName}/'
        userEventPattern: 'client-message'
        systemEvents: [
          'connect'
          'connected'
          'disconnected'
        ]
      }
    ]
  }
}

// Platform auth disabled intentionally — game API uses its own room-based auth via player IDs
resource apiAuth 'Microsoft.App/containerApps/authConfigs@2024-03-01' = {
  name: 'current'
  parent: apiApp
  properties: {
    globalValidation: {
      unauthenticatedClientAction: 'AllowAnonymous'
    }
    platform: {
      enabled: false
    }
  }
}
resource apiAcrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(containerRegistry.id, apiAppName, 'AcrPull')
  scope: containerRegistry
  properties: {
    principalId: apiApp.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
  }
}

var actionGroupName = 'ag-${name}-${resourceSuffix}'

resource alertActionGroup 'Microsoft.Insights/actionGroups@2023-09-01-preview' = {
  name: actionGroupName
  location: 'global'
  tags: tags
  properties: {
    groupShortName: take('ag-${name}', 12)
    enabled: true
  }
}

resource highCpuAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'High CPU - ${apiAppName}'
  location: 'global'
  tags: tags
  properties: {
    description: 'Alert when API container app CPU exceeds 80%'
    severity: 2
    enabled: true
    scopes: [apiApp.id]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'HighCPU'
          metricName: 'UsageNanoCores'
          metricNamespace: 'Microsoft.App/containerApps'
          operator: 'GreaterThan'
          threshold: 800000000
          timeAggregation: 'Average'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [{ actionGroupId: alertActionGroup.id }]
  }
}

resource highMemoryAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'High Memory - ${apiAppName}'
  location: 'global'
  tags: tags
  properties: {
    description: 'Alert when API container app memory exceeds 80%'
    severity: 2
    enabled: true
    scopes: [apiApp.id]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'HighMemory'
          metricName: 'WorkingSetBytes'
          metricNamespace: 'Microsoft.App/containerApps'
          operator: 'GreaterThan'
          threshold: 1717986918
          timeAggregation: 'Average'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [{ actionGroupId: alertActionGroup.id }]
  }
}

resource serverErrorAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'Server Errors - ${apiAppName}'
  location: 'global'
  tags: tags
  properties: {
    description: 'Alert on elevated 5xx error rate'
    severity: 1
    enabled: true
    scopes: [apiApp.id]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'ServerErrors'
          metricName: 'Requests'
          metricNamespace: 'Microsoft.App/containerApps'
          operator: 'GreaterThan'
          threshold: 10
          timeAggregation: 'Total'
          criterionType: 'StaticThresholdCriterion'
          dimensions: [
            {
              name: 'statusCodeCategory'
              operator: 'Include'
              values: ['5xx']
            }
          ]
        }
      ]
    }
    actions: [{ actionGroupId: alertActionGroup.id }]
  }
}

resource responseTimeAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'Slow Response - ${apiAppName}'
  location: 'global'
  tags: tags
  properties: {
    description: 'Alert when average response time exceeds 2 seconds'
    severity: 3
    enabled: true
    scopes: [appInsights.id]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'SlowResponse'
          metricName: 'requests/duration'
          metricNamespace: 'Microsoft.Insights/components'
          operator: 'GreaterThan'
          threshold: 2000
          timeAggregation: 'Average'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [{ actionGroupId: alertActionGroup.id }]
  }
}

output containerRegistryEndpoint string = containerRegistry.properties.loginServer
output apiUrl string = 'https://${apiApp.properties.configuration.ingress.fqdn}'
output webUrl string = 'https://${staticWebApp.properties.defaultHostname}'
output webPubSubName string = webPubSub.name
output webPubSubHub string = webPubSubHubName
output redisHost string = redisEnterprise.properties.hostName
output applicationInsightsConnectionString string = appInsights.properties.ConnectionString








