import React, { useState, useEffect } from 'react';
import './WalletDetails.css';
import { RouteComponentProps } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';
import Modal from 'react-modal';
import successGif from '../public/success.gif';
import errorGif from '../public/error.gif';

interface MatchParams {
  walletId: string;
}

function shortenWalletAddress(address: any, startLength: number, endLength: number) {
  if (!address) return '';
  const prefix = address.substring(0, startLength);
  const suffix = address.substring(address.length - endLength);
  return `${prefix}...${suffix}`;
}

interface WalletData {
  REPORT_ID: string;
  REPORTER: string;
  FLAGGED_WALLET: string;
  TYPE: string;
  DESCRIPTION: string;
  TIMESTAMP: number;
  STATUS: number;
  VOTES: number;
  VISITS: number | null;
}

const WalletDetail: React.FC<RouteComponentProps<MatchParams>> = ({ match }) => {

  const { publicKey, signMessage } = useWallet();

  const walletId = match.params.walletId;
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true); // Track loading state

  const [toastText, setToastText] = useState("Error");
  const [showToast, setShowToast] = useState(false);
  const [voteStatus, setVoteStatus] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  async function handleVote() {
    const signature = await sign();

    const payload = {
      flaggedWallet: walletId,
      publicKey: publicKey?.toBase58(),
      signature,
    };



    // Send a POST request with the payload to our API
    fetch('https://binaramics.io:5173/vote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
      .then((response) => {
        if (response.ok) {
          // Handle a successful response
          setVoteStatus(true);
          setIsModalOpen(true);
        } else {
          // Handle an error response
          console.error('Submission failed');
          setVoteStatus(false);
          setIsModalOpen(true);
          return;
        }
      })
      .catch((error) => {
        console.error('Error:', error);
        console.error('Vote failed');
        return;
      });

  }
  async function fetchNonce() {

    const requestBody = {
      wallet: publicKey,
    };

    const response = await fetch('https://binaramics.io:5173/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const { nonce } = await response.json();

    return nonce;
  }

  async function sign() {
    if (signMessage && publicKey)
      try {

        const nonce = await fetchNonce();
        const message = `Sign this message for authenticating with your wallet. Nonce: ${nonce}`;
        const encodedMessage = new TextEncoder().encode(message);
        const signature = bs58.encode(await signMessage(encodedMessage));
        return signature;

      } catch (e) {
        console.log('could not sign message' + e);
      }
  }

  useEffect(() => {
    fetch(`https://binaramics.io:5173/getDetails?WALLET=${walletId}`)
      .then((response) => response.json())
      .then((data) => {
        if (data.length > 0) {
          const walletInfo = data[0];
          setWalletData(walletInfo);
        } else {
          console.log('Wallet not found');

        }
        setLoading(false); // Set loading state to false after fetching
      })
      .catch((error) => {
        console.error('Error fetching wallet details:', error);
        // Handle the error gracefully in your UI
        setLoading(false); // Set loading state to false on error
      });
  }, [walletId]);

  const shortenedAddressFlagged = shortenWalletAddress(
    walletData?.FLAGGED_WALLET,
    5,
    5
  );
  const shortenedAddressReporter = shortenWalletAddress(
    walletData?.REPORTER,
    5,
    5
  );

  return (
    <div>
      <style type="text/css">

        @import url(https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css);
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.3.1/css/all.min.css" rel="stylesheet" />

      </style>


      {showToast && (
        <div className="toast show">
          {toastText}
        </div>
      )}

      <Modal
        isOpen={isModalOpen}
        onRequestClose={() => setIsModalOpen(false)}
        contentLabel="Submission Modal"
        className="custom-modal"
        overlayClassName="custom-modal-overlay"
      >
        {voteStatus ? (
          <>
            <img src={successGif} alt="Success" />
            <p className="success-message">Voted successfully!</p>
          </>
        ) : (
          <>
            <img src={errorGif} alt="Error" />
            <p className="error-message">Vote failed. You already voted or an issue occured.</p>
          </>
        )}
        <button className="close-modal-button" onClick={() => setIsModalOpen(false)}>
          Close
        </button>
      </Modal>

      {loading ? (
        <div>Loading...</div>
      ) : walletData ? (
        <div className="data-container">
          <h1>
            <a
              href={`https://solscan.io/account/${walletData?.FLAGGED_WALLET}`}
              className="wallet-link"
            >
              {shortenedAddressFlagged}
            </a>
          </h1>

          <div className="data-row">
            <div className="data-label">
              <i className="fas fa-user"></i> Reporter:
            </div>
            <div className="data-value">
              <a
                href={`https://solscan.io/account/${walletData?.REPORTER}`}
                className="wallet-link-reporter"
              >
                {shortenedAddressReporter}
              </a>
            </div>
          </div>
          <div className="data-row">
            <div className="data-label">
              <i className="fas fa-info-circle"></i> Description:
            </div>
            <div className="data-value">{walletData?.DESCRIPTION}</div>
          </div>
          <div className="data-row">
            <div className="data-label">
              <i className="fa fa-exclamation-circle"></i> Type:
            </div>
            <div className="data-value">
              {walletData?.TYPE.toUpperCase()}
            </div>
          </div>
          <div className="data-row">
            <div className="data-label">
              <i className="fa fa-check-circle"></i> Votes:
            </div>
            <div className="data-value">{walletData?.VOTES}</div>
          </div>

          <div className="button-container">

            <button className="upvote-button" onClick={handleVote}>Upvote</button>
          </div>
        </div>
      ) : (
        <div>No data was found for this wallet. Please submit a report first.</div>
      )}
    </div>
  );
};

export default WalletDetail;