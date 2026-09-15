// Single entry point the backend imports — keeps backend code decoupled from
// the storage engine and the on-disk layout of the database package.
module.exports = {
  leadsRepository: require('./repositories/leadsRepository'),
  campaignsRepository: require('./repositories/campaignsRepository'),
  messagesRepository: require('./repositories/messagesRepository'),
  channelsRepository: require('./repositories/channelsRepository'),
  schema: require('./schema'),
};
