import React, { FC, useMemo } from 'react';
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Link
} from "react-router-dom";

import './App.css';
import Header from './Header';
import Portal from './Portal';
import WalletDetail from './WalletDetails';

import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter, TrustWalletAdapter } from '@solana/wallet-adapter-wallets';
import {
  WalletModalProvider,
  WalletDisconnectButton,
  WalletMultiButton
} from '@solana/wallet-adapter-react-ui';
import { withRouter, RouteComponentProps } from 'react-router-dom';

const network = WalletAdapterNetwork.Mainnet;

import { useHistory } from 'react-router-dom';
import { clusterApiUrl, Connection } from '@solana/web3.js';
import './Header.css';

import Submit from './Submit';
const WalletDetailWithRouter = withRouter(WalletDetail);


let rpcHost =
  "https://solana.coin.ledger.com/";

const SubmitPage = () => {
  const endpoint = useMemo(() => clusterApiUrl(network), []);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new TrustWalletAdapter(),
    ],
    [network]
  );
  return (
  
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets}>
          <WalletModalProvider>

            <div className="wallet-connect">
            <WalletMultiButton className="wallet-adapter-button"/> 
            </div>
            <Submit/>
            
           
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>

  );
};

const WalletDetailsPage = () => {
  const endpoint = useMemo(() => clusterApiUrl(network), []);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new TrustWalletAdapter(),
    ],
    [network]
  );
  return (
  
      <ConnectionProvider endpoint={endpoint}>
        <WalletProvider wallets={wallets}>
          <WalletModalProvider>

            <div className="wallet-connect">
            <WalletMultiButton className="wallet-adapter-button"/> 
            </div>
            <WalletDetailWithRouter />
            
           
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>

  );
};

const App = () => {

  
  return (
    <Router>
       <Header/>
    <div>
      {/* Define routes */}
      <Route path="/" exact component={Portal} />
      <Route path="/wallet/:walletId" component={WalletDetailsPage} />
      <Route path="/report/" component={SubmitPage} />
    </div>
  </Router>
  );
};

export default App;