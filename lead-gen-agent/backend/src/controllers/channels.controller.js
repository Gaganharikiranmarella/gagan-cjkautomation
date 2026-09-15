const { listChannels, getChannel } = require('../services/channels/channelRegistry');
const { HttpError } = require('../utils/httpError');

function list(req, res) {
  res.json({ channels: listChannels().map((c) => c.getStatus()) });
}

function connect(req, res) {
  const channel = getChannel(req.params.name);
  if (typeof channel.connect !== 'function') {
    throw new HttpError(400, `${req.params.name} does not use a connect step`);
  }
  res.json({ status: channel.connect() });
}

function disconnect(req, res) {
  const channel = getChannel(req.params.name);
  if (typeof channel.disconnect !== 'function') {
    throw new HttpError(400, `${req.params.name} does not use a connect step`);
  }
  res.json({ status: channel.disconnect() });
}

module.exports = { list, connect, disconnect };
