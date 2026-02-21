require('dotenv').config();
const express = require('express');
const oauthRoutes = require('./routes/oauth');
const cors = require('cors');

const app = express();
app.use(cors());  
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/oauth', oauthRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(process.env.PORT, () => {
  console.log(`Server listening on port ${process.env.PORT}`);
});
