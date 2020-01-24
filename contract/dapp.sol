pragma experimental ABIEncoderV2;
pragma solidity ^0.5.0;

contract Verifier {

    mapping (address => uint) public nonces;

    mapping (address => uint) public smiles;
    mapping (address => uint) public nods;

    function nod(address nodder, uint nodNum, uint nodMultiplier) public {
        nods[nodder] = nods[nodder]*nodMultiplier + nodNum;
    }

    function smile(address smiler, uint256 smileNum) public {
        smiles[smiler] += smileNum;
    }

    // ---------- For Meta Tx --------- //

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
}
