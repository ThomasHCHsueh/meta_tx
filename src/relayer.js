const RELAYER_URL = 'https://us-central1-dapp-pocket.cloudfunctions.net/relayer/metaTx';

/**
 * @param {string} contractAddress 
 * @param {string} signer 
 * @param {string} method
 * @param {string} param 
 * @param {string} r 
 * @param {string} s 
 * @param {number} v 
 * @returns {promise}
 */
const relayerMetaTx = (contractAddress, signer, method, param, r, s, v, nonce) => {
    const data = {
        contractAddress,
        signer,
        method,
        param,
        r,
        s,
        v,
        nonce,
    };

    return fetch(RELAYER_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        mode: 'cors',
    });
};

exports.relayerMetaTx = relayerMetaTx;
