import React, { Component } from 'react'
import logo from './static/ethereum.svg';
import './css/App.css';
import getWeb3 from "./getWeb3";
import { relayerMetaTx } from './relayer';

const dapp_contract = "0x07637624e1de92a886C2f37A219C1749784D5367";
const dapp_salt = "0xf2d857f4a3edcb9b78b4d503bfe733db1e3f6cdc2b7971ee739626c97e86a558";
const domainTypes = [
  { name: "name", type: "string" },
  { name: "version", type: "string" },
  { name: "chainId", type: "uint256" },
  { name: "verifyingContract", type: "address" },
  { name: "salt", type: "bytes32" },
];
const methodTypes = [
  { name: "method_name", type: "string"},
  { name: "nodder", type: "address"},
  { name: "nod_num", type: "uint256" },
  { name: "nod_mult", type: "uint256" },
  { name: "method_identifier", type: "bytes4" },
  { name: "params_packed", type: "bytes" }
];
const methodTypesSmile = [
  { name: "method_name", type: "string"},
  { name: "smiler", type: "address"},
  { name: "smile_num", type: "uint256" },
  { name: "method_identifier", type: "bytes4" },
  { name: "params_packed", type: "bytes" }
];

class App extends Component {

  constructor(props) {
    super(props);
    this.state = {
      web3: null,
      accounts: null,
      smileNum: 10
    };
  }

  componentDidMount = async () => {
    try {
      // Get authorization of user
      await window.ethereum.enable();

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

      const m = web3.eth.abi.encodeFunctionSignature('smile(address,uint256)');
      const p = web3.eth.abi.encodeParameters(['address', 'uint256'], [accounts[0], 8932]);
      const mp = web3.eth.abi.encodeParameters(['bytes4', 'bytes'], [m, p]);
      console.log("m: ", m)
      console.log("p: ", p)
      console.log("mp: ", mp)
      const mp_decoded = web3.eth.abi.decodeParameters(['bytes4', 'bytes'], mp)
      console.log("m == m_decoded?", m===mp_decoded[0]);
      console.log("p == p_decoded?", p===mp_decoded[1]);
      console.log(web3.eth.abi.decodeParameters(['address','uint256'], p))

      console.log("hash of bytes 0x4587092 by web3 is: ",
                  web3.utils.keccak256( web3.eth.abi.encodeParameters(['bytes'], ["0x4587092"]) ));

      console.log("hash of bytes 0x4587092 by web3 is: ",
                  web3.utils.keccak256( web3.eth.abi.encodeParameters(['bytes'], ["0x04587092"]) ));

      console.log("hash of bytes 0x4587092 by web3 is: ",
                  web3.utils.keccak256("0x4587092") );

      console.log("hash of bytes 0x4587092 by web3 is: ",
                  web3.utils.keccak256("0x04587092") );

    } catch (error) {
      // Catch any errors for any of the above operations.
      alert('Failed to load Metamask. Check console for details.');
      console.error(error);
   }
  };

  onClickSmile() {
    const { web3, accounts, smileNum } = this.state;

    const account = accounts[0];
    const chainId = parseInt(web3.givenProvider.networkVersion);
    const domainData = {
      name: "EIP712Dapp",
      version: "1",
      chainId: chainId,
      verifyingContract: dapp_contract, // dapp's address
      salt: dapp_salt
    };
    const message = {
      method_name: 'smile(address,uint256)',
      smiler: account,
      smile_num: smileNum,
      method_identifier: web3.eth.abi.encodeFunctionSignature('smile(address,uint256)'),
      params_packed: web3.eth.abi.encodeParameters(['address', 'uint256'], [account, smileNum])
    };
    const data = JSON.stringify({
      types: {
        EIP712Domain: domainTypes,
        Packet: methodTypesSmile,
      },
      domain: domainData,
      primaryType: "Packet", // Must haves
      message: message
    });
    const signer = web3.utils.toChecksumAddress(account);

    console.log("message: ", message);
    console.log("message.method_name hashed: ", web3.utils.keccak256(message.method_name));
    console.log("message.params_packed hashed: ", web3.utils.keccak256(message.params_packed));
    console.log("data: ", data)
    console.log("signer: ", signer)

    web3.currentProvider.sendAsync(
      {
        method: "eth_signTypedData_v4",
        params: [signer, data],
        from: signer
      },
      function(err, result) {
        if (err || result.error) {
          return console.error(result);
        }

        const signature = parseSignature(result.result.substring(2));
        console.log(signature);

        // Post to Relayer
        relayerMetaTx(
          dapp_contract,
          account,
          message.method_identifier,
          message.params_packed,
          signature.r,
          signature.s,
          signature.v
        )
        .then((res) => {
          res.json().then((res) => { alert(`Metx tx is sent!\nTx hash: ${res.hash}`); console.log(res.hash); });
        })
        .catch((err) => {
          err.json().then((res) => { alert(`Error: ${res.hash}`); });
        });
      }
    ); // closing sendAsync
  } // closing onClickSmile()

  onClickNod() {
    const web3 = this.state.web3;
    const accounts = this.state.accounts;
    const chainId = parseInt(web3.givenProvider.networkVersion);
    const account = accounts[0];
    const num = 519;
    const mult = 4;
    console.log(chainId, typeof chainId);

    // Set domainData
    const domainData = {
      name: "EIP712Dapp",
      version: "1",
      chainId: chainId,
      verifyingContract: dapp_contract, // dapp's address
      salt: dapp_salt
    };

    // Set message
    var message = {
      method_name: 'nod(address,uint256,uint256)',
      nodder: account,
      nod_num: num,
      nod_mult: mult,
      method_identifier: web3.eth.abi.encodeFunctionSignature('nod(address,uint256,uint256)'),
      params_packed: web3.eth.abi.encodeParameters(['address', 'uint256', 'uint256'], [account, num, mult])
    };
    // console.log("message: ", message);
    // console.log("message.method_name hashed: ", web3.utils.keccak256(message.method_name));
    // console.log("message.params_packed hashed: ", web3.utils.keccak256(message.params_packed));

    // Set Data
    const data = JSON.stringify({
      types: {
        EIP712Domain: domainTypes,
        Packet: methodTypes,
      },
      domain: domainData,
      primaryType: "Packet", // Must haves
      message: message
    });

    // Set signer
    const signer = web3.utils.toChecksumAddress(accounts[0]);
    console.log("data: ", data)
    console.log("signer: ", signer)
    console.log("web3.currentProvider: ", web3.currentProvider);

    // Sign
    web3.currentProvider.sendAsync(
      {
        method: "eth_signTypedData_v4",
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
        
        // Post to Relayer
        relayerMetaTx(
          dapp_contract,
          account,
          message.method_identifier,
          message.params_packed,
          signature.r,
          signature.s,
          signature.v
        )
        .then((res) => {
          res.json().then((res) => { alert(`Metx tx is sent!\nTx hash: ${res.hash}`); });
        })
        .catch((err) => {
          err.json().then((res) => { alert(`Error: ${res.hash}`); });
        });
      }
    ); // closing sendAsync
  } // closing onClickNod()

  render(){
    return(
      <div className="App">
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <h3>A general solution for enabling metatransaction.</h3>
          <div>
            <button className="Btn" onClick={() => this.onClickSmile()}>
              Click to sign a metatrasanction for the dapp's <b>smile(address smiler, uint256 smileNum)</b>
            </button>
            <button className="Btn" onClick={() => this.onClickNod()}>
              Click to sign a metatrasanction for the dapp's <b>nod(address nodder, uint nodNum, uint nodMultiplier)</b>
            </button>
          </div>
          <p style={{ fontSize: 14, marginTop: 10 }}>
            <span>Target Contract: {dapp_contract}</span>
          </p>
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
