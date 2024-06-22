import React, { useEffect, useState } from 'react';

import './Portal.css';
import { Link } from 'react-router-dom';
import { useHistory } from 'react-router-dom';

interface WalletData {
  FLAGGED_WALLET: string;
  REPORTER: string;
  TIMESTAMP: number;
  TYPE: string;
  VOTES: number | null;

  STATUS: number;
}


function Portal() {


  function shortenAddress(address: string) {
    if (address && address.length > 10) {
      return `${address.slice(0, 5)}...${address.slice(-4)}`;
    }
    return address;
  }

  function formatUnixTimestamp(timestamp: any) {
    const date = new Date(timestamp * 1000); // Convert to milliseconds

    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');

    return `${day}/${month}/${year}`;
  }

  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch the most viewed wallets when the component mounts
    fetch('https://binaramics.io:5173/trending')
      .then((response) => response.json())
      .then((data: { FLAGGED_WALLET: string, REPORTER: string, TIMESTAMP: number, TYPE: string, VOTES: number, STATUS: number }[]) => {
        setWallets(data); // Set the retrieved data in the 'wallets' state
        setLoading(false);
      })


      .finally(() => {
        setLoading(false);
      });
  }, []);

  const [inputValue, setInputValue] = useState('');
  const history = useHistory();

  const handleKeyPress = (event: any) => {
    if (event.key === 'Enter') {
      history.push(`/wallet/${inputValue}`);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  const handleReport = (event: any) => {
    history.push(`/report/`);
  };


  return (

    <div>
      <button className="report" onClick={handleReport}>REPORT</button>

      <div className="container" id="orders-list">



        <form className="search-bar">
          <input type="text"
            placeholder="Search for a wallet..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleKeyPress(e)} />
        </form>

        <table className="table">
          <thead>
            <tr>
              <th>Reporter Wallet</th>
              <th>Flagged Wallet</th>
              <th>Report Date</th>
              <th>Report Type</th>
              <th>Votes</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {wallets.map((wallet) => (
              <tr key={wallet.FLAGGED_WALLET}>
                <td>{shortenAddress(wallet.REPORTER)}</td>
                <td>
                  <a href={`/wallet/${wallet.FLAGGED_WALLET}`}>
                    {shortenAddress(wallet.FLAGGED_WALLET)}
                  </a>
                </td>
                <td>{formatUnixTimestamp(wallet.TIMESTAMP)}</td>
                <td>{wallet.TYPE.toUpperCase()}</td>
                <td>{wallet.VOTES}</td>
                <td>
                  <span className={`badge ${wallet.STATUS === 1 ? 'approved' : wallet.STATUS === 0 ? 'pending' : wallet.STATUS === 2 ? 'declined' : ''}`}>
                    {wallet.STATUS === 1 ? 'Approved' : wallet.STATUS === 0 ? 'Pending' : wallet.STATUS === 2 ? 'Declined' : ''}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Portal;