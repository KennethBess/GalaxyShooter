targetScope = 'resourceGroup'

param name string
param location string = resourceGroup().location
param tags object = {}
param webPubSubHubName string

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
var redisConnectionString = 'rediss://:${listKeys(redisDatabase.id, redisDatabase.apiVersion).primaryKey}@${redisEnterprise.properties.hostName}:10000'

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsName
  location: location
  tags: tags
  properties: {
    retentionInDays: 30
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
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {}
}

resource redisEnterprise 'Microsoft.Cache/redisEnterprise@2025-04-01' = {
  name: redisName
  location: location
  tags: tags
  sku: {
    name: 'Balanced_B0'
  }
  properties: {
    encryption: {}
    highAvailability: 'Enabled'
    minimumTlsVersion: '1.2'
  }
}

resource redisDatabase 'Microsoft.Cache/redisEnterprise/databases@2025-07-01' = {
  name: 'default'
  parent: redisEnterprise
  properties: {
    accessKeysAuthentication: 'Enabled'
    clientProtocol: 'Encrypted'
    clusteringPolicy: 'NoCluster'
    evictionPolicy: 'NoEviction'
    modules: []
    port: 10000
  }
}

resource webPubSub 'Microsoft.SignalRService/webPubSub@2024-03-01' = {
  name: webPubSubName
  location: location
  tags: tags
  sku: {
    name: 'Premium_P1'
    capacity: 1
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
          value: redisConnectionString
        }
        {
          name: 'webpubsub-connection-string'
          value: listKeys(webPubSub.id, webPubSub.apiVersion).primaryConnectionString
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
              value: appInsights.properties.ConnectionString
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
        }
      ]
      scale: {
        minReplicas: 1
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

output containerRegistryEndpoint string = containerRegistry.properties.loginServer
output apiUrl string = 'https://${apiApp.properties.configuration.ingress.fqdn}'
output webUrl string = 'https://${staticWebApp.properties.defaultHostname}'
output webPubSubName string = webPubSub.name
output webPubSubHub string = webPubSubHubName
output redisHost string = redisEnterprise.properties.hostName
output applicationInsightsConnectionString string = appInsights.properties.ConnectionString








