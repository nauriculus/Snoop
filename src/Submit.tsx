import React, { useState } from 'react';
import './Submit.css';
import successGif from '../public/success.gif';
import errorGif from '../public/error.gif';
import Modal from 'react-modal';
import { useWallet } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';
import { PublicKey } from '@solana/web3.js';
import { createBurnCheckedInstruction, TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import { Connection, Keypair, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { useHistory } from 'react-router-dom';

const MINT_ADDRESS = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
const MINT_DECIMALS = 5;

Modal.setAppElement('#root');

export const WalletDetail = () => {

  const history = useHistory();
  const { publicKey, signMessage, signTransaction } = useWallet();

  const [formData, setFormData] = useState({
    walletAddress: '',
    selectedOption: 'fraud', // Default option
    description: '',
  });

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



  const [toastText, setToastText] = useState("Error");
  const [showToast, setShowToast] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleInputChange = (event: any) => {
    const { name, value } = event.target;

    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = async (event: any) => {
    event.preventDefault();

    if (!publicKey) {

      setShowToast(true);
      setToastText("Please connect your wallet first.");
      setTimeout(() => {
        setShowToast(false);
      }, 3000);
      return;
    }



    if (formData.walletAddress.trim() === '' || formData.description.trim() === '') {
      setShowToast(true);
      setToastText("Please fill in all required fields.");

      setTimeout(() => {
        setShowToast(false);
      }, 3000);
      return;
    }

    const pubKey = new PublicKey(formData.walletAddress.trim());

    if (PublicKey.isOnCurve(pubKey)) {
      const account = await getAssociatedTokenAddress(new PublicKey(MINT_ADDRESS), publicKey!);
      const burnIx = createBurnCheckedInstruction(
        account,
        new PublicKey(MINT_ADDRESS),
        publicKey!,
        1000 * (10 ** MINT_DECIMALS),
        MINT_DECIMALS
      );

      const connection = new Connection('https://solana.coin.ledger.com');

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
      const messageV0 = new TransactionMessage({
        payerKey: publicKey!,
        recentBlockhash: blockhash,
        instructions: [burnIx]
      }).compileToV0Message();
      const transaction = new VersionedTransaction(messageV0);
      const tx = await signTransaction!(transaction);

      const txid = await connection.sendTransaction(tx);

      const signature = await sign();
      // Prepare the payload
      const payload = {
        reporter: publicKey,
        flaggedWallet: formData.walletAddress,
        type: formData.selectedOption,
        description: formData.description,
        publicKey: publicKey?.toBase58(),
        signature,
      };

      // Send a POST request with the payload to our API
      fetch('https://binaramics.io:5173/new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
        .then((response) => {
          if (response.ok) {
            // Handle a successful response
            setSubmissionStatus(true);
            setIsModalOpen(true);


          } else {
            // Handle an error response
            console.error('Submission failed');
            setSubmissionStatus(false);
            setIsModalOpen(true);
            setShowToast(true);
            setToastText("There was an error when submitting your report.");
            setTimeout(() => {
              setShowToast(false);
            }, 3000);
            return;
          }
        })
        .catch((error) => {
          console.error('Error:', error);
          console.error('Submission failed');
          setSubmissionStatus(false);
          setIsModalOpen(true); // Open the modal on success

          setShowToast(true);
          setToastText("There was an error when submitting your report!");

          setTimeout(() => {
            setShowToast(false);
          }, 3000);
          return;
        });


    } else {
      setShowToast(true);
      setToastText("The wallet address is invaild.");

      setTimeout(() => {
        setShowToast(false);
      }, 3000);
      return;
    }
  };

  return (
    <div>
      <style type="text/css">
        {`
          @import url(https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css);
        `}
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
        {submissionStatus ? (
          <>
            <img src={successGif} alt="Success" />
            <p className="success-message">Reported successfully!</p>
          </>
        ) : (
          <>
            <img src={errorGif} alt="Error" />
            <p className="error-message">Report failed. Please try again.</p>
          </>
        )}
        <button className="close-modal-button" onClick={() => setIsModalOpen(false)}>
          Close
        </button>
      </Modal>

      <div className="form-group">
        <label htmlFor="wallet-address">Wallet Address</label>
        <input
          type="text"
          id="wallet-address"
          name="walletAddress"
          placeholder="Enter wallet address you want to report"
          required
          onChange={handleInputChange}
        />
      </div>
      <div className="form-group">
        <label htmlFor="options">Select Option</label>
        <select
          id="options"
          name="selectedOption"
          required
          value={formData.selectedOption}
          onChange={handleInputChange}
        >
          <option value="fraud">Fraud</option>
          <option value="spam">Spam</option>
          <option value="exploit">Protocol Exploit</option>
          <option value="contract">Malicious Contract</option>
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          placeholder="Tell us more about the reported wallet (200 characters maximum)"
          required
          className="no-resize"
          maxLength={100}
          onChange={handleInputChange}
        ></textarea>
        <p className="char-count">Submit & Pay The Bonk Fee</p>
      </div>

      <button type="submit" className="submit" onClick={handleSubmit}>
        Submit
      </button>


    </div>
  );
};

export default WalletDetail;
