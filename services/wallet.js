// services/wallet.js
const { ethers } = require('ethers');
const jwt = require('jsonwebtoken');
const { v4: uuid } = require('uuid');
const config = require('../config');
const { sessions } = require('../db');

const SESSION_TTL = 24 * 60 * 60; // 24 hours

async function verifyWallet(address, message, signature) {
  // Validate message timestamp (must be within 5 minutes)
  const tsMatch = message.match(/Timestamp:\s*(\d+)/);
  if (!tsMatch) throw Object.assign(new Error('Invalid message format'), { status: 400 });

  const msgTime = parseInt(tsMatch[1]);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - msgTime) > 300) {
    throw Object.assign(new Error('Message expired'), { status: 401 });
  }

  // Recover signer address from signature
  let recoveredAddress;
  try {
    recoveredAddress = ethers.verifyMessage(message, signature);
  } catch (e) {
    throw Object.assign(new Error('Invalid signature'), { status: 401 });
  }

  if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
    throw Object.assign(new Error('Signature does not match address'), { status: 401 });
  }

  // Generate session token
  const expiresAt = now + SESSION_TTL;
  const token = jwt.sign(
    { address: address.toLowerCase(), exp: expiresAt },
    config.jwtSecret
  );

  // Store session
  sessions.create.run(token, address.toLowerCase(), expiresAt);

  return {
    verified: true,
    address: address.toLowerCase(),
    session_token: token,
    expires_at: new Date(expiresAt * 1000).toISOString(),
  };
}

function validateSession(token) {
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const session = sessions.get.get(token);
    if (!session) return null;
    sessions.touch.run(token);
    return { address: decoded.address };
  } catch (e) {
    return null;
  }
}

module.exports = { verifyWallet, validateSession };
