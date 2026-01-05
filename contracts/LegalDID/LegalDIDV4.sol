// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/StringsUpgradeable.sol";

contract LegalDIDV4 is
    ERC721Upgradeable,
    ERC721EnumerableUpgradeable,
    ERC721BurnableUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeMathUpgradeable for uint256;
    using StringsUpgradeable for uint256;

    // ============ Legacy Events (kept for compatibility) ============
    event RNSAddressAuthorized(string _rnsId, address indexed _wallet);
    event RNSNewID(string _rnsId, address indexed _wallet, uint256 _tokenId);
    event RNSBurnID(string _rnsId, address indexed _wallet, uint256 _tokenId);
    event OrderProcessed(string orderId, string rnsId, address indexed wallet, uint256 amount);

    // ============ V4 Events (orderId based tracking) ============
    event AuthorizeMintV4(string indexed orderId, address indexed wallet, uint256 amount);
    event AirdropV4(string indexed orderId, address indexed wallet, uint256 tokenId, bytes32 merkleRoot);
    event BurnV4(address indexed wallet, uint256 tokenId);
    event WithdrawV4(address indexed recipient, uint256 amount);

    uint256 public mintPrice;
    uint256 public lastTokenId;
    string private baseURI;
    address private destination;

    bytes32 public constant SECONDARY_ADMIN_ROLE = keccak256("SECONDARY_ADMIN_ROLE");

    // @deprecated - Kept for storage layout compatibility
    mapping(string => bool) public isMinted;
    // @deprecated - Kept for storage layout compatibility
    mapping(string => bool) public isAuthorized;

    mapping(string => uint256) public numMinted;
    // @deprecated - Kept for storage layout compatibility
    mapping(address => bool) private isBlockedAddress;
    // @deprecated - Kept for storage layout compatibility
    mapping(string => bool) private isBlockedRnsID;

    mapping(uint256 => bytes32) public tokenIdToMerkle;
    mapping(uint256 => address) public tokenIdToWallet;
    // @deprecated - Kept for storage layout compatibility, V4 uses event tracking
    mapping(uint256 => string) public tokenIdToRnsId;

    // @deprecated - Kept for storage layout compatibility, V4 moves validation to backend
    mapping(address => string) public walletToRnsId;

    // Reserved storage gap for future upgrades
    uint256[49] private __gap;

    function initialize() public initializer {
        __ERC721_init("Legal DID Test", "LDIDTest");
        __ERC721Enumerable_init();
        __ERC721Burnable_init();
        __AccessControl_init();
        __ReentrancyGuard_init();

        mintPrice = 0.01 ether;
        baseURI = "https://api.rns.id/api/v2/portal/identity/nft/";

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(SECONDARY_ADMIN_ROLE, msg.sender);
        _setRoleAdmin(DEFAULT_ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
        _setRoleAdmin(SECONDARY_ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
        destination = msg.sender;
    }

    function getIdentityKey(string memory _rnsId, address _wallet) internal pure returns (string memory) {
        return string(abi.encodePacked(_rnsId, string(abi.encodePacked(_wallet))));
    }

    function setMintPrice(uint256 _mintPrice) external onlyRole(SECONDARY_ADMIN_ROLE) {
        mintPrice = _mintPrice;
    }

    function setBaseURI(string memory _URI) external onlyRole(SECONDARY_ADMIN_ROLE) {
        baseURI = _URI;
    }

    // ============ Legacy authorizeMint (kept for compatibility) ============

    /// @notice Legacy interface, kept for backward compatibility
    /// @dev DEPRECATED: Use authorizeMintV4() for new business
    function authorizeMint(string memory _rnsId, address _wallet) external payable nonReentrant {
        string memory idAddressKey = getIdentityKey(_rnsId, _wallet);
        require(!isAuthorized[idAddressKey], "Authorization is in process, please wait.");

        uint256 fee = mintPrice;
        uint256 numMintedForID = numMinted[_rnsId];

        if (hasRole(SECONDARY_ADMIN_ROLE, msg.sender)) {
            fee = 0;
        }
        require(msg.value >= fee, "insufficient fund");

        numMinted[_rnsId] = numMintedForID.add(1);
        isAuthorized[idAddressKey] = true;
        emit RNSAddressAuthorized(_rnsId, _wallet);
    }
    

    /// @notice V4 interface - orderId based tracking, no rnsId
    function authorizeMintV4(
        string memory _orderId,
        address _wallet
    ) external payable nonReentrant {
        uint256 fee = mintPrice;

        if (hasRole(SECONDARY_ADMIN_ROLE, msg.sender)) {
            fee = 0;
        }
        require(msg.value >= fee, "insufficient fund");

        emit AuthorizeMintV4(_orderId, _wallet, msg.value);
    }

    // ============ Legacy airdrop (kept for compatibility) ============

    /// @notice Legacy interface, kept for backward compatibility
    /// @dev DEPRECATED: Use airdropV4() for new business
    function airdrop(
        string memory _rnsId,
        address _wallet,
        bytes32 _merkelRoot
    ) external onlyRole(SECONDARY_ADMIN_ROLE) nonReentrant {
        string memory idAddressKey = getIdentityKey(_rnsId, _wallet);
        require(!isMinted[idAddressKey], "One LDID can only mint once to the same wallet.");
        require(!isBlockedAddress[_wallet], "the wallet is blacklisted");
        require(!isBlockedRnsID[_rnsId], "the LDID is blacklisted");

        isMinted[idAddressKey] = true;
        uint256 tokenId = lastTokenId.add(1);
        lastTokenId = tokenId;

        _safeMint(_wallet, tokenId);

        tokenIdToMerkle[tokenId] = _merkelRoot;
        tokenIdToWallet[tokenId] = _wallet;
        tokenIdToRnsId[tokenId] = _rnsId;

        emit RNSNewID(_rnsId, _wallet, tokenId);
    }

    /// @notice V4 interface - orderId based tracking, no on-chain rnsId storage or validation
    function airdropV4(
        string memory _orderId,
        address _wallet,
        bytes32 _merkelRoot
    ) external onlyRole(SECONDARY_ADMIN_ROLE) nonReentrant {
        uint256 tokenId = lastTokenId.add(1);
        lastTokenId = tokenId;

        _safeMint(_wallet, tokenId);

        tokenIdToMerkle[tokenId] = _merkelRoot;
        tokenIdToWallet[tokenId] = _wallet;

        emit AirdropV4(_orderId, _wallet, tokenId, _merkelRoot);
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return baseURI;
    }

    /// @dev Convert bytes32 to hex string (without 0x prefix)
    function _toHexString(bytes32 data) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(64);
        for (uint256 i = 0; i < 32; i++) {
            str[i * 2] = alphabet[uint8(data[i] >> 4)];
            str[i * 2 + 1] = alphabet[uint8(data[i] & 0x0f)];
        }
        return string(str);
    }

    /// @notice V4: tokenURI uses merkleRoot instead of tokenId for better identity binding
    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        _requireMinted(tokenId);
        bytes32 merkle = tokenIdToMerkle[tokenId];
        return bytes(baseURI).length > 0 
            ? string(abi.encodePacked(baseURI, _toHexString(merkle), ".json")) 
            : "";
    }

    function tokenMerkleRoot(uint256 tokenId) public view virtual returns (bytes32) {
        _requireMinted(tokenId);
        return tokenIdToMerkle[tokenId];
    }

    function setFundDestination(address _destination) public onlyRole(DEFAULT_ADMIN_ROLE) {
        destination = _destination;
    }

    function withdraw() public onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 balance = address(this).balance;
        payable(destination).transfer(balance);
        emit WithdrawV4(destination, balance);
    }

    function supportsInterface(bytes4 _interfaceId)
        public
        view
        override(ERC721Upgradeable, ERC721EnumerableUpgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(_interfaceId);
    }

    function burn(uint256 _tokenId) public override(ERC721BurnableUpgradeable) {
        super.burn(_tokenId);
        address wallet = tokenIdToWallet[_tokenId];

        // V4: Only emit event, no state cleanup needed
        emit BurnV4(wallet, _tokenId);

        tokenIdToMerkle[_tokenId] = bytes32(0);
        tokenIdToWallet[_tokenId] = address(0);
        // V4: tokenIdToRnsId not used, but clear for consistency
        tokenIdToRnsId[_tokenId] = "";
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal virtual override(ERC721Upgradeable, ERC721EnumerableUpgradeable) {
        if (from != address(0)) {
            address owner = ownerOf(firstTokenId);
            require(owner == msg.sender, "Only the owner of LDID can burn it.");
            require(to == address(0) || from == address(0), "A LDID can only be airdropped or burned.");
        }
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
    }
}
