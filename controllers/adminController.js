const clientService = require('../services/clientService');

const createClient = async (req, res) => {
  const { name, isPublic, redirectUris, scopes, tokenFormat } = req.body;

  if (!name || !redirectUris || !Array.isArray(redirectUris) || redirectUris.length === 0) {
    return res.status(400).json({ error: 'name and redirectUris (array) are required' });
  }

  try {
    const client = await clientService.registerClient({ name, isPublic, redirectUris, scopes, tokenFormat });
    res.status(201).json(client);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create client' });
  }
};

const listClients = async (req, res) => {
  try {
    const clients = await clientService.listClients();
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: 'Failed to list clients' });
  }
};

const deleteClient = async (req, res) => {
  const { clientId } = req.params;

  try {
    await clientService.deleteClient(clientId);
    res.json({ deleted: clientId });
  } catch (err) {
    res.status(404).json({ error: 'Client not found' });
  }
};

module.exports = { createClient, listClients, deleteClient };
