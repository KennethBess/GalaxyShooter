targetScope = 'subscription'

@description('AZD environment name.')
param environmentName string

@description('Primary Azure region.')
param location string

@description('Web PubSub hub used by Galaxy Shooter clients.')
param webPubSubHubName string = 'galaxyshooter'

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


