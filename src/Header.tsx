import React from 'react';
import './Header.css';

import { useHistory } from 'react-router-dom';


function Header() {

  const history = useHistory();

  const handleReport = (event: any) => {
    history.push(`/report/`);
  };

  const handleHome = (event: any) => {
    history.push(`/`);
  };

  return (


    <div className="header">
      <div className="wallet-buttons">
        <img src="../public/snoop-black.png" onClick={handleHome} className="logo" />
      </div>

    </div>
  );
}


export default Header;