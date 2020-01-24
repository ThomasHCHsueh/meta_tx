# A clean solution toward a generalized MetaTransaction standard

## Barebone demo on Ropsten
https://gracious-ramanujan-2e52c3.netlify.com/

Sign metatransaction however many times you like as long as the relayer's balance is not depleted! Hit refresh after ~1min to see the stored variables in the contract changing their values.

## Recap of status quo
The dapp ecosystem could benefit significantly from having a standardized, secure and low-cost way of enabling MetaTransaction where a willing third-party hold ETH and help pay for the gas incurred from dapp user's interactions with dapps, particularly for the curious and newly onboarded users that do not hold ETH and are detered by the time-consuming process of fiat on-ramp.

Since the inception of EIP712, several solutions existed.
- **Maker**'s `permit()` is a meta version of its `approve()`.
- **Bounties Network** has a modifier called `senderIsValid(address)`, which checks if caller is sender itself or the official unchangeable relayer set by `setMetaTxRelayer(address)`, and has a meta version for each of its 20+ public methods.
- **Gasless** by Mosendo has a modifier called `onlyRelayer()`, which allows for functions to be called by a single dedicated but changeable relayer at any time.
- **Gas Station Network** took steps toward a generalized approach but was designed for ephemeral accounts.

It is thus desirable to have a standardized approach where *only a single function* is added to the dapp contract that enables MetaTransaction on its public methods, and where MetaMask could render *readable confirmations* per EIP712 for users signing MetaTransactions.

## Critical path identified and design choices made
We have recognized the critical path of this problem being to achieve both **adding a single function to the dapp contract** and **preserving nice confirmations in MetaMask pop-up for users to sign** at the same time. The key bottleneck is that, by requiring the relayer to call the dedicated function `metaTx()` in the dapp contract that processes MetaTransaction, `metaTx()` would have to take in the name of the function (refered to as `method_name` henceforth with a corresponding `bytes4 method_selector`) to be called and the parameters passed to that function (refered to as `params` henceforth) in a singular way. Since the types of `params` for each function would be different, `params` would be passed to `metaTx()` in a packed form, refered to as `params_packed` henceforth. Critically, the packing function `params -> params_packed` has to be bijectively reversible such that `metaTx()` knows how to correctly unpack the `params_packed` it receives. This prompts us to choose the reversible `abi.encode()` for packing `params`, and run `abi.decode` in `metaTx()` *given the tuple of types of each parameter, which can be derived from a straightforward`method_selector` look-up*.

At the same time, in order to ensure readability in MetaMask pop-up, the unreadable `params_packed` can not be the only parameter-related information the user signs. The user needs to be presented with `params` in the form of the EIP712-compliant message that clearly delineates the name of the function called as well as the name and value of each parameter passed to that function. Following this logic, if user signs for `params` + `params_packed` + `method_selector`, then in the dapp contract `metaTx()` has to construct the same EIP712-compliant message with `params` + `params_packed` + `method_selector` as well. This tells us that `metaTx()` would have to decode `params_packed` back to `params` before verifying the received signature with `ecrecover()`.

Finally, while calling any function with the low-level `.call()` function provided with `method_selector` and `params_packed` seems like a unifying and tempting approach, we recognize the slightly higher gas cost with `.call()` in `metaTx()` (about 5% higher), as well as the Ethereum community's advice against it for security concerns. We choose to call each targeted function by its name in `metaTx()`.

## Proposal: overview
![](https://i.imgur.com/3Whedyn.png)

**In essence, the user would sign a EIP712 message containing both the readable data and the unreadable packed data; the relayer relays only the packed data as well as user's signature as payload into dapp contract; the dapp contract reconstructs the original readable data from the packed data in order to reconstruct the original EIP712 message and verify user's signature.**

## Proposal: full details

The following is our implementation of the **verifyMeta()** function, the single function that processes all incoming requests for executing meta-transactions.

(The dapp for this demonstration has two public methods available for metatransaction: `smile(address,uint256)` and `nod(address,uint256,uint256)`.)

```
/// @notice Verify metatransaction, unpack arguments, and call targeted method
/// @param signer: the address that signs the metatransaction
/// @param r,s,v: signatures
/// @return true if successful transaction; transaction reverted if any require() is failed
function verifyMeta(address signer, bytes4 method, bytes memory params, bytes32 r, bytes32 s, uint8 v, uint256 nonce) public {
        require((method == bytes4(SMILE_METHOD_SIG_HASHED)) || (method == bytes4(NOD_METHOD_SIG_HASHED)), "Verifier/Invalid method signature.");

    if (method == bytes4(SMILE_METHOD_SIG_HASHED)) {
        (address addr, uint256 x) = abi.decode(params, (address, uint256));
        bytes32 digest = packDigest( abi.encode(
            SMILE_TYPEHASH, SMILE_METHOD_SIG_HASHED, addr, x, method, keccak256(params), nonce ));
        verifySigAndNonce(signer, digest, r, s, v, nonce);
        smile(addr, x);

    } else if (method == bytes4(NOD_METHOD_SIG_HASHED)) {
        (address addr, uint256 x, uint256 m) = abi.decode(params, (address, uint256, uint256));
        bytes32 digest = packDigest( abi.encode(
            NOD_TYPEHASH, NOD_METHOD_SIG_HASHED, addr, x, m, method, keccak256(params), nonce ));
        verifySigAndNonce(signer, digest, r, s, v, nonce);
        nod(addr, x, m);
    }
}
```

To improve code maintainability and reduce contract deployment cost, two helper functions were created to refactor the code: **packDigest()** and **verifySigAndNonce()**.
```
/// @notice Verifiy signature and nonce from signer; increment signer's nonce if success
/// @param signer: signer's address
/// @param digest: hashed message to be verified with the signature
/// @param r,s,v: signature sent with the metatransaction
/// @param nonce: nonce sent with the metatransaction
function verifySigAndNonce(address signer, bytes32 digest, bytes32 r, bytes32 s, uint8 v, uint256 nonce) internal {
    require(signer == ecrecover(digest, v, r, s), "Verifier/Invalid signature.");
    require(nonce == nonces[signer], "Verifier/Invalid nonce.");
    nonces[signer]++;
}

/// @notice Produce message digest per EIP712 standard for signature verification
/// @param typeHash_encodeData is strictly bytes32[] per EIP712
function packDigest (bytes memory typeHash_encodeData) internal view returns (bytes32) {
    return keccak256(abi.encodePacked(
        "\x19\x01", DOMAIN_SEPARATOR, keccak256(typeHash_encodeData)
    ));
}
```

Finally, these data are stored in storage to assist the processing of metatransaction:
```
bytes32 private constant SMILE_METHOD_SIG_HASHED = keccak256(bytes('smile(address,uint256)'));
bytes32 private constant SMILE_TYPEHASH = keccak256(abi.encodePacked(
    "Packet(string method_name,address smiler,uint256 smile_num,bytes4 method_identifier,bytes params_packed,uint256 nonce)"    
));

bytes32 public constant  NOD_METHOD_SIG_HASHED = keccak256(bytes('nod(address,uint256,uint256)'));
bytes32 private constant NOD_TYPEHASH = keccak256(abi.encodePacked(
    "Packet(string method_name,address nodder,uint256 nod_num,uint256 nod_mult,bytes4 method_identifier,bytes params_packed,uint256 nonce)"
));

bytes32 constant SALT = 0xf2d857f4a3edcb9b78b4d503bfe733db1e3f6cdc2b7971ee739626c97e86a558; // last resort to identify Dapp
bytes32 private DOMAIN_SEPARATOR = keccak256(abi.encode(
    keccak256(abi.encodePacked(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract,bytes32 salt)"    
    )), // domain type hash
    keccak256("EIP712Dapp"), // Dapp name
    keccak256("1"), // Contract version
    3, // Network id
    address(this), // verifying contract address
    SALT
));
```


## Cost analysis, points of failure, and cost-saving opportunities
By avoiding the low-level `.call()`, gas cost per `verifyMeta()` call is reduced.

Points of failure are identified with this solution: by having `verifyMeta()` calling other public functions in the contract, there are two situations where a simple addition of `verifyMeta()` will not work properly:
1. `verifyMeta()` is not able to call `external` functions unless the low-level `address.call()` is used. We purposefully avoid going that direction.
2. `msg.*` will not work as originally intended in the called function. The author of the contract has to examine her/his usage of `msg.sender` for example and replace it with `signer` when necessary.

Finally, if the 4-byte method identifier ends up not being leveraged to make calls, the design could potentially be refactored further by having the user sign for method's type string instead of method's signature string i.e. "smile(address smiler,uint256 smileNum)" instead of "smile(address,uint256)". This way, the dapp contract will not need to store each method's `METHOD_SIG_HASH` anymore. Method matching process will be completed with each method's `TYPEHASH`, the data can not be pruned away since it is required for EIP712 encoding.

## Demo

https://gracious-ramanujan-2e52c3.netlify.com/

We build a simple relayer server with node.js and Firebase. It binds with an ethereum account that pays for the gas for users. It will call the contract method according to the user's request.

We try to make the least amount of assumptions in building this demo. Many imaginable features can be built on top of this. For example:
1. The relayer API could implement of list of addresses for which it is willing to help relay metatransactions.
2. The relayer API could bind with an indefinite amount of EOAs that participate in a kind of "affiliate program" for the dapp and help pay for gas in return for loyalty tokens / NFT prizes / DAO shares etc.

![](https://i.imgur.com/eKSPF3B.png)
![](demo.gif)

## Final thoughts

To improve readability further, the information shown in MetaMask pop-up can be segregated into two sections, one for user's understanding and the other for hashes and packed bytes.

A concern associated with this solution is that, by having a single function that performs all the `method_selector` matching and `params_packed` unpacking, the "stack too deep" error might occur when there are many functions to differentiate and each having many parameters to be unpacked. This requires a careful investigation into the EVM opcodes involved in order to determine the optimal order of function arguments passed into them per Alexandre Pinto's suggestion in his writing: *https://medium.com/coinmonks/stack-too-deep-error-in-solidity-608d1bd6a1ea*.

Finally, it should be easy to build a script that parses a contract and autogenerates **verifyMeta()** and associated helper functions and variables to enable metatransaction. But again, the issue that the usage of `msg.*` in each of the metatx-enabled functions is invalidated needs to be carefully and individually addressed.

## Conclusion
This solution allows for **any** EOA to help pay for gas, and only requires the dapp contract to **add a single function** that processes incoming requests for metatransaction (along with two short helper functions).

## Authors

- [Anderson Chen](https://twitter.com/andersonChenOG)
- [Thomas Hsueh](https://twitter.com/ThomasHCHsueh)
