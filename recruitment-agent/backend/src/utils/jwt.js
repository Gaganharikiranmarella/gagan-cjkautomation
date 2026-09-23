const jwt = require('jsonwebtoken');
const env = require('../config/env');

const TOKEN_TTL = '7d';

function signToken(payload) {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: TOKEN_TTL });
}

function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

module.exports = { signToken, verifyToken };
