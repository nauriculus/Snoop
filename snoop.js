const express = require('express');
const https = require('https');
const fs = require('fs');
const mysql = require('mysql2');
const cors = require('cors');
const crypto = require('crypto');
const { serialize } = require('cookie');
const bs58 = require('bs58');
const nacl = require('tweetnacl');
const web3 = require('@solana/web3.js');
const { v4: uuidv4 } = require('uuid');

const allowedOrigins = ['http://localhost:5173', 'https://binaramics.com'];

const app = express();
app.use(express.json());
const port = process.env.PORT || 5173;

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
}));

const options = {
  cert: fs.readFileSync('/etc/letsencrypt/live/certificate.crt'),
  ca: fs.readFileSync('/etc/letsencrypt/live/ca_bundle.crt'),
  key: fs.readFileSync('/etc/letsencrypt/live/private.key')
};

const connection = mysql.createConnection({
  host: 'localhost',
  user: '',
  port: '3306',
  password: '',
  database: ''
});

let connected = false;

function handleDisconnect() {

  const query = 'SELECT * FROM warden LIMIT 1';
  connection.query(query, (err, result) => {
    if (err) throw err;
  });

  connection.connect((err) => {
    if (err) {
      console.error(`Error connecting to database: ${err.message}`);
      setTimeout(handleDisconnect, 2000);
      return;
    }
    connected = true;
    console.log(`MySQL connection refreshed`);
  });

  connection.on('error', (err) => {
    console.error(`MySQL connection error: ${err.message}`);
    if (!connected) {
      handleDisconnect();
    }
  });
}

setInterval(handleDisconnect, 3600000);

app.get('/trending', async (req, res) => {
  try {

    const query = `
        SELECT *
        FROM warden
        ORDER BY VOTES DESC
        LIMIT 8
      `;

    const [rows] = await connection.promise().query(query);

    // Return the fetched data as JSON
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching most viewed wallets:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/getDetails', async (req, res) => {
  try {
    const flaggedWallet = req.query.WALLET;

    const query = `
        SELECT *
        FROM warden
        WHERE FLAGGED_WALLET = ?
      `;

    const [rows] = await connection.promise().query(query, [flaggedWallet]);

    // Return the fetched data as JSON
    res.status(200).json(rows);
  } catch (error) {
    console.error('Error fetching wallet details:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/auth', async (req, res) => {
  try {
    const { wallet } = req.body;

    if (!wallet) {
      return res.status(400).json({ error: 'Missing wallet in the request body' });
    }

    // Check if the wallet exists in the database
    const [rows] = await connection.promise().query('SELECT PUBLICKEY, NONCE FROM walletAuth WHERE PUBLICKEY = ?', [wallet]);

    let nonce;

    if (rows.length > 0) {
      // Wallet exists, get the current nonce
      nonce = rows[0].NONCE;
    } else {
      // Wallet doesn't exist, create a new nonce
      nonce = crypto.randomBytes(32).toString('base64');
      // Save the wallet and nonce in the database
      await connection.promise().query('INSERT INTO walletAuth (PUBLICKEY, NONCE) VALUES (?, ?)', [wallet, nonce]);
    }

    // Set the nonce in a cookie
    res.setHeader('Set-Cookie', serialize('auth-nonce', nonce, { httpOnly: true, sameSite: 'strict', secure: true }));

    return res.status(200).json({ nonce });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

function isValidSolanaWallet(address) {
  const solanaWalletPattern = /^[1-9A-HJ-NP-Za-z]{44}$/;
  return solanaWalletPattern.test(address);
}

app.post('/vote', async (req, res) => {
  try {
    const {
      flaggedWallet,
      publicKey,
      signature,
    } = req.body;

    if (!flaggedWallet) {
      return res.status(400).json({ error: 'flagged wallet missing in the request body' });
    }

    if (!publicKey) {
      return res.status(400).json({ error: 'publicKey missing in the request body' });
    }

    if (!signature) {
      return res.status(400).json({ error: 'signature missing in the request body' });
    }

    const [rows] = await connection
      .promise()
      .query('SELECT PUBLICKEY, NONCE FROM walletAuth WHERE PUBLICKEY = ?', [publicKey]);

    let nonce;
    let publicKeyFromDb;

    if (rows.length > 0) {
      // Wallet exists, get the current nonce
      nonce = rows[0].NONCE;
      publicKeyFromDb = rows[0].PUBLICKEY;
    } else {
      return res.status(400).json({ error: 'Auth first' });
    }

    if (publicKeyFromDb !== publicKey) {
      return res.status(400).json({ error: 'PublicKeys dont match' });
    }

    const publicKeyBytes = bs58.decode(publicKey.toString());
    const signatureBytes = bs58.decode(signature);

    const message = `Sign this message for authenticating with your wallet. Nonce: ${nonce}`;
    const encodedMessage = new TextEncoder().encode(message);

    const verify = nacl.sign.detached.verify(encodedMessage, signatureBytes, publicKeyBytes);
    if (!verify) {
      return res.status(400).json({ error: 'Signature invalid' });
    } else {
      // Retrieve the current VOTE_WALLETS array from the warden table
      const [selectRows] = await connection
        .promise()
        .query('SELECT VOTE_WALLETS FROM warden WHERE FLAGGED_WALLET = ?', [flaggedWallet]);

      let voteWalletsArray = [];

      if (selectRows.length > 0) {
        // Extract the current array from the database and parse it
        voteWalletsArray = JSON.parse(selectRows[0].VOTE_WALLETS || '[]');
      }

      // Check if the wallet's public key is already in the array
      if (!voteWalletsArray.includes(publicKey)) {
        // Add the public key to the array if it's not already present
        voteWalletsArray.push(publicKey);

        const updateQuery = `
            UPDATE warden
            SET VOTE_WALLETS = ?
            WHERE FLAGGED_WALLET = ?
          `;

        const [updateResult] = await connection.promise().query(updateQuery, [JSON.stringify(voteWalletsArray), flaggedWallet]);


        if (updateResult.affectedRows === 0) {
          return res.status(500).json({ error: 'Failed to update VOTE_WALLETS' });
        }
      } else {
        return res.status(400).json({ error: 'Wallet has already voted' });
      }

      const selectQuery = `
        SELECT VOTES
        FROM warden
        WHERE FLAGGED_WALLET = ?
      `;

      const [selectRows2] = await connection.promise().query(selectQuery, [flaggedWallet]);

      if (selectRows2.length === 0) {
        return res.status(404).json({ error: 'Wallet not found' });
      }

      const updateQuery = `
        UPDATE warden
        SET VOTES = IFNULL(VOTES, 0) + 1
        WHERE FLAGGED_WALLET = ?
      `;

      const [updateResult] = await connection.promise().query(updateQuery, [flaggedWallet]);

      if (updateResult.affectedRows === 0) {
        return res.status(500).json({ error: 'Failed to update votes' });
      }

      return res.status(200).json({ error: 'Success' });
    }
  } catch (err) {
    console.error('Error creating report entry:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


app.post('/new', async (req, res) => {
  try {
    const reportId = uuidv4();
    const {
      reporter,
      flaggedWallet,
      type,
      description,
      publicKey,
      signature,
    } = req.body;

    if (!reporter) {
      return res.status(400).json({ error: 'reporter wallet missing in the request body' });
    }

    if (!flaggedWallet) {
      return res.status(400).json({ error: 'flagged wallet missing in the request body' });
    }

    if (!type) {
      return res.status(400).json({ error: 'type missing in the request body' });
    }

    if (!description) {
      return res.status(400).json({ error: 'description missing in the request body' });
    }

    if (!publicKey) {
      return res.status(400).json({ error: 'publicKey missing in the request body' });
    }

    if (!signature) {
      return res.status(400).json({ error: 'signature missing in the request body' });
    }

    const reporterPub = new web3.PublicKey(reporter);
    const flaggedWalletPub = new web3.PublicKey(flaggedWallet);
    const publicKeyPub = new web3.PublicKey(publicKey);

    if (
      !await web3.PublicKey.isOnCurve(reporterPub) ||
      !await web3.PublicKey.isOnCurve(flaggedWalletPub) ||
      !await web3.PublicKey.isOnCurve(publicKeyPub)
    ) {
      return res.status(400).json({ error: 'Invalid Solana wallet address' });
    }

    // Validate Description Length
    if (description.split(' ').length > 200) {
      return res.status(400).json({ error: 'Description exceeds 200 words' });
    }

    // Check if the wallet already exists
    const checkQuery = `
        SELECT FLAGGED_WALLET
        FROM warden
        WHERE FLAGGED_WALLET = ?
        LIMIT 1
      `;

    connection.query(checkQuery, [flaggedWallet], async (err, results) => {
      if (err) {
        console.error('Error checking for wallet existence:', err);
        return res.status(500).json({ error: 'Internal Server Error' });
      }

      if (results.length !== 0) {
        console.log('Wallet already exists:', flaggedWallet);
        res.status(500).json({ error: 'Wallet exists' });
        return;
      }

      // Continue with the insertion
      try {
        const [rows] = await connection
          .promise()
          .query('SELECT PUBLICKEY, NONCE FROM walletAuth WHERE PUBLICKEY = ?', [publicKey]);

        let nonce;
        let publicKeyFromDb;

        if (rows.length > 0) {
          // Wallet exists, get the current nonce
          nonce = rows[0].NONCE;
          publicKeyFromDb = rows[0].PUBLICKEY;
        } else {
          return res.status(400).json({ error: 'Auth first' });
        }

        if (publicKeyFromDb !== publicKey) {
          return res.status(400).json({ error: 'PublicKeys dont match' });
        }

        const publicKeyBytes = bs58.decode(publicKey.toString());
        const signatureBytes = bs58.decode(signature);

        const message = `Sign this message for authenticating with your wallet. Nonce: ${nonce}`;
        const encodedMessage = new TextEncoder().encode(message);

        const verify = nacl.sign.detached.verify(encodedMessage, signatureBytes, publicKeyBytes);
        if (!verify) {
          return res.status(400).json({ error: 'Signature invalid' });
        } else {
          const votes = 0;

          let status;

          if (type === "fraud" || type === "contract" || type === "spam") {
            status = 1; // Instant Approve
          } else if (type === "exploit") {
            status = 0; // Check first then Approve
          } else {
            // Handle the case when type is not one of the specified values
            return res.status(400).json({ error: 'Invalid type' });
          }

          const timestamp = Math.floor(Date.now() / 1000);

          const queryUpdateNonce = `
              UPDATE walletAuth
              SET NONCE = ?
              WHERE PUBLICKEY = ?;
            `;

          const newNonce = crypto.randomBytes(32).toString('base64');

          const valuesUpdateNonce = [
            newNonce,
            publicKey
          ];

          await connection.promise().query(queryUpdateNonce, valuesUpdateNonce);

          const query = `
              INSERT INTO warden (
                REPORT_ID,
                REPORTER,
                FLAGGED_WALLET,
                TYPE,
                DESCRIPTION,
                TIMESTAMP,
                STATUS,
                VOTES,
                VOTE_WALLETS
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
            `;
          const values = [
            reportId,
            reporter,
            flaggedWallet,
            type,
            description,
            timestamp,
            status,
            votes,
            '[]'
          ];

          await connection.promise().query(query, values);

          res.status(200).json({ reportId });
        }
      } catch (err) {
        console.error('Error creating report entry:', err);
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });
  } catch (err) {
    console.error('Error creating report entry:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
const server = https.createServer(options, app);

server.listen(port, () => {
  console.log(`Snoop API is running on port ${port}`);
});
