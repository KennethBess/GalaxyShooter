targetScope = 'subscription'

@description('AZD environment name.')
@minLength(3)
@maxLength(24)
param environmentName string

@description('Primary Azure region.')
param location string

@description('Web PubSub hub used by Galaxy Shooter clients.')
param webPubSubHubName string = 'galaxyshooter'

@description('Log Analytics workspace retention in days.')
@minValue(30)
@maxValue(730)
param logRetentionDays int = 90

@description('Web PubSub unit capacity for scaling.')
@minValue(1)
param webPubSubCapacity int = 1

@description('Redis Enterprise SKU name.')
param redisSku string = 'Balanced_B0'

@description('Web PubSub SKU. Use Free_F1 for dev/test, Premium_P1 for production.')
param webPubSubSku string = 'Free_F1'

@description('Static Web App SKU. Use Free for dev/test, Standard for production.')
@allowed(['Free', 'Standard'])
param staticWebAppSku string = 'Free'

@description('Minimum replica count for the API. Use 0 for dev/test (scale to zero).')
@minValue(0)
param apiMinReplicas int = 0

@description('Optional tags to apply to resources.')
param tags object = {}

var mergedTags = union(tags, {
  'azd-env-name': environmentName
})
var resourceGroupName = 'rg-${environmentName}'

resource resourceGroup 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: resourceGroupName
  location: location
  tags: mergedTags
}

module appStack './modules/app-stack.bicep' = {
  name: 'galaxy-shooter-stack'
  scope: resourceGroup
  params: {
    name: environmentName
    location: location
    tags: mergedTags
    webPubSubHubName: webPubSubHubName
    logRetentionDays: logRetentionDays
    webPubSubCapacity: webPubSubCapacity
    webPubSubSku: webPubSubSku
    staticWebAppSku: staticWebAppSku
    redisSku: redisSku
    apiMinReplicas: apiMinReplicas
  }
}

output AZURE_RESOURCE_GROUP string = resourceGroup.name
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = appStack.outputs.containerRegistryEndpoint
output API_URL string = appStack.outputs.apiUrl
output WEB_URL string = appStack.outputs.webUrl
output WEB_PUBSUB_NAME string = appStack.outputs.webPubSubName
output WEB_PUBSUB_HUB string = appStack.outputs.webPubSubHub
output REDIS_HOST string = appStack.outputs.redisHost
output APPLICATIONINSIGHTS_CONNECTION_STRING string = appStack.outputs.applicationInsightsConnectionString


