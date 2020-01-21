import React, { Component } from 'react'
import logo from './ethereum.svg';
import './App.css';
import getWeb3 from "./getWeb3";

const dapp_contract = "0x18cb727dC5D45C9d437917A10BF8B6cA220C19C9";
const dapp_salt = "0xf2d857f4a3edcb9b78b4d503bfe733db1e3f6cdc2b7971ee739626c97e86a558";
const domainTypes = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
  { name: "chainId", type: "uint256" },
  { name: "verifyingContract", type: "address" },
  { name: "salt", type: "bytes32" },
];

class App extends Component {

  constructor(props) {
    super(props);
    this.state = {
      web3: null,
      accounts: null
    };
  }

  componentDidMount = async () => {
    try {
      // Get network provider and web3 instance.
      const web3 = await getWeb3();
      console.log("web3: ", web3);

      // Use web3 to get the user's accounts.
      const accounts = await web3.eth.getAccounts();
      console.log("accounts: ", accounts);

      this.setState({
        web3: web3,
        accounts: accounts
      })

    } catch (error) {
     // Catch any errors for any of the above operations.
     alert(
       `Failed to load Metamask. Check console for details.`,
     );
     console.error(error);
   }
  };

  onclick() {

    const web3 = this.state.web3;
    const accounts = this.state.accounts;

    //const chainId = parseInt(web3.networkVersion, 10);
    const chainId = parseInt(web3.givenProvider.networkVersion);
    console.log(chainId, typeof chainId);

    const domainData = {
      name: "EIP712Dapp",
      version: "1",
      chainId: chainId,
      verifyingContract: dapp_contract, // dapp's address
      salt: dapp_salt // dapp's salt value
    };

    const methodTypes = [
      { name: "num", type: "uint256" },
    ];

    var message = {
      num: 77,
    };

    const data = JSON.stringify({
      types: {
        EIP712Domain: domainTypes,
        Smile: methodTypes,
      },
      domain: domainData,
      primaryType: "Smile", // Must haves
      message: message
    });

    const signer = web3.utils.toChecksumAddress(accounts[0]);

    console.log("data: ", data)
    console.log("signer: ", signer)
    console.log("web3.currentProvider: ", web3.currentProvider);

    web3.currentProvider.sendAsync(
      {
        method: "eth_signTypedData_v3",
        params: [signer, data],
        from: signer
      },
      function(err, result) {
        if (err || result.error) {
          return console.error(result);
        }

        console.log("result: ", result);

        const signature = parseSignature(result.result.substring(2));
        console.log(signature);

      }
    ); // closing sendAsync

  } // closing onclick()

  onclick2() {

    const web3 = this.state.web3;
    const accounts = this.state.accounts;

    //const chainId = parseInt(web3.networkVersion, 10);
    const chainId = parseInt(web3.givenProvider.networkVersion);
    console.log(chainId, typeof chainId);

    const domainData = {
      name: "EIP712Dapp",
      version: "1",
      chainId: chainId,
      verifyingContract: dapp_contract, // dapp's address
      salt: dapp_salt
    };

    var methodTypes = [
      { name: "method", type: "bytes4" },
      { name: "params", type: "bytes" }
    ];
    var message = {
      method: web3.eth.abi.encodeFunctionSignature('smile(address,uint256)'),
      params: web3.eth.abi.encodeParameters(['address', 'uint256'], [accounts[0], 8932])
    };
    console.log("message.method: ", message.method);
    console.log("message.params: ", message.params);

    const data = JSON.stringify({
      types: {
        EIP712Domain: domainTypes,
        Packet: methodTypes,
      },
      domain: domainData,
      primaryType: "Packet", // Must haves
      message: message
    });

    const signer = web3.utils.toChecksumAddress(accounts[0]);

    console.log("data: ", data)
    console.log("signer: ", signer)
    console.log("web3.currentProvider: ", web3.currentProvider);

    web3.currentProvider.sendAsync(
      {
        method: "eth_signTypedData_v3",
        params: [signer, data],
        from: signer
      },
      function(err, result) {
        if (err || result.error) {
          return console.error(result);
        }

        console.log("result: ", result);

        const signature = parseSignature(result.result.substring(2));
        console.log(signature);
      }
    ); // closing sendAsync

  } // closing onclick2()

  render(){
    return(
      <div className="App">
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <br></br>
          <p>
            A general solution for enabling metatransaction.
          </p>
          <button onClick={() => this.onclick()}>
            Click to sign a metatrasanction for <b>Smile(uint256 num)</b>
          </button>
          <button onClick={() => this.onclick2()}>
            Click to sign a metatrasanction for <b>Packet(bytes4 method,bytes params)</b>
          </button>
        </header>
      </div>
    );
  }
}

function parseSignature(signature) {
  var r = signature.substring(0, 64);
  var s = signature.substring(64, 128);
  var v = signature.substring(128, 130);

  return {
      r: "0x" + r,
      s: "0x" + s,
      v: parseInt(v, 16)
  }
}

export default App;
