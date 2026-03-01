const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const registerClient = async ({ name, isPublic, redirectUris, scopes }) => {
  const clientId = 'clt_' + crypto.randomBytes(12).toString('hex');

  let clientSecret = null;
  let clientSecretHash = null;
  if (!isPublic) {
    clientSecret = 'cs_' + crypto.randomBytes(24).toString('hex');
    clientSecretHash = await bcrypt.hash(clientSecret, 10);
  }

  const client = await prisma.client.create({
    data: {
      clientId,
      clientSecret: clientSecretHash,
      name,
      isPublic: isPublic !== false,
      redirectUris: redirectUris || [],
      scopes: scopes || 'openid',
    },
  });

  return {
    clientId: client.clientId,
    clientSecret,        // raw secret returned once, never again
    name: client.name,
    isPublic: client.isPublic,
    redirectUris: client.redirectUris,
    scopes: client.scopes,
    createdAt: client.createdAt,
  };
};

const getClient = async (clientId) => {
  return prisma.client.findUnique({ where: { clientId } });
};

const validateRedirectUri = (client, redirectUri) => {
  return client.redirectUris.includes(redirectUri);
};

const listClients = async () => {
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: 'desc' },
  });
  // never return hashed secrets
  return clients.map(({ clientSecret: _, ...c }) => c);
};

const deleteClient = async (clientId) => {
  return prisma.client.delete({ where: { clientId } });
};

module.exports = { registerClient, getClient, validateRedirectUri, listClients, deleteClient };
