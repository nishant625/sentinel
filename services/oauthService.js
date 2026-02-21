const crypto = require('crypto');

const pendingRequests = {};

const savePendingRequest = (params) => {
  const requestId = crypto.randomUUID();
  pendingRequests[requestId] = {
    ...params,
    createdAt: Date.now(),
  };
  return requestId;
};

const getPendingRequest = (requestId) => {
  return pendingRequests[requestId] || null;
};

const deletePendingRequest = (requestId) => {
  delete pendingRequests[requestId];
};

module.exports = {
  savePendingRequest,
  getPendingRequest,
  deletePendingRequest,
};
