const express = require('express');
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/chat.html');
});

app.post('/chat', (req, res) => {
  const { message, retrievalMethod } = req.body;

  console.log('User message:', message);
  console.log('Retrieval method:', retrievalMethod);

  res.json({ reply: 'Message received!' });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});