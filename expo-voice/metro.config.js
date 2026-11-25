const { getDefaultConfig } = require('expo/metro-config');
const { attachVoiceApi } = require('./voice-api.cjs');

const config = getDefaultConfig(__dirname);
const enhanceMiddleware = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (middleware, metroServer) => attachVoiceApi(
  enhanceMiddleware ? enhanceMiddleware(middleware, metroServer) : middleware,
);

module.exports = config;
