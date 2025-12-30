// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

contract LegalDIDV3 is
    ERC721Upgradeable,
    ERC721EnumerableUpgradeable,
    ERC721BurnableUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeMathUpgradeable for uint256;

    event RNSAddressAuthorized(string _rnsId, address indexed _wallet);
    event RNSNewID(string _rnsId, address indexed _wallet, uint256 _tokenId);
    event RNSBurnID(string _rnsId, address indexed _wallet, uint256 _tokenId);
    // V4: New OrderId event
    event OrderProcessed(string orderId, string rnsId, address indexed wallet, uint256 amount);

    uint256 public mintPrice;
    uint256 public lastTokenId;
    string private baseURI;
    address private destination;

    bytes32 public constant SECONDARY_ADMIN_ROLE = keccak256("SECONDARY_ADMIN_ROLE");

    // @deprecated - Kept for storage layout compatibility, backend uses event tracking instead
    mapping(string => bool) public isMinted;
    // @deprecated - Kept for storage layout compatibility, backend uses event tracking instead
    mapping(string => bool) public isAuthorized;

    mapping(string => uint256) public numMinted;
    // @deprecated - Kept for storage layout compatibility, blacklist feature removed
    mapping(address => bool) private isBlockedAddress;
    // @deprecated - Kept for storage layout compatibility, blacklist feature removed
    mapping(string => bool) private isBlockedRnsID;

    mapping(uint256 => bytes32) public tokenIdToMerkle;
    mapping(uint256 => address) public tokenIdToWallet;
    mapping(uint256 => string) public tokenIdToRnsId;

    // V4: wallet → rnsId mapping for RNSID validation
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

    // @deprecated - setIsBlockedAddress removed
    // @deprecated - setIsBlockedRnsID removed

    function setTokenIdToMerkle(uint256 tokenId, bytes32 _merkelRoot) external onlyRole(SECONDARY_ADMIN_ROLE) {
        tokenIdToMerkle[tokenId] = _merkelRoot;
    }

    // ============ authorizeMint compatibility ============

    /// @notice Legacy interface, kept for backward compatibility
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

    function authorizeMintV3(
        string memory _rnsId,
        address _wallet,
        string memory _orderId
    ) external payable nonReentrant {
        
        uint256 fee = mintPrice;

        if (hasRole(SECONDARY_ADMIN_ROLE, msg.sender)) {
            fee = 0;
        }
        require(msg.value >= fee, "insufficient fund");

        // V4: Removed isAuthorized write, using event tracking instead
        emit RNSAddressAuthorized(_rnsId, _wallet);
        emit OrderProcessed(_orderId, _rnsId, _wallet, msg.value);

    }
    
    // ============ airdrop with RNSID validation ============

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

    function airdropV3(
        string memory _rnsId,
        address _wallet,
        bytes32 _merkelRoot
    ) external onlyRole(SECONDARY_ADMIN_ROLE) nonReentrant {
        // V4: RNSID validation - same wallet can only hold LDID from the same natural person
        if (balanceOf(_wallet) > 0) {
            require(
                keccak256(bytes(walletToRnsId[_wallet])) == keccak256(bytes(_rnsId)),
                "Wallet already holds LDID from different identity"
            );
        } else {
            // First mint, record wallet → rnsId mapping
            walletToRnsId[_wallet] = _rnsId;
        }

        // V4: Removed isMinted write, using event tracking instead
        uint256 tokenId = lastTokenId.add(1);
        lastTokenId = tokenId;

        _safeMint(_wallet, tokenId);

        tokenIdToMerkle[tokenId] = _merkelRoot;
        tokenIdToWallet[tokenId] = _wallet;
        tokenIdToRnsId[tokenId] = _rnsId;

        emit RNSNewID(_rnsId, _wallet, tokenId);
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return baseURI;
    }

    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        _requireMinted(tokenId);
        return bytes(baseURI).length > 0 ? string(abi.encodePacked(baseURI, tokenIdToRnsId[tokenId], ".json")) : "";
    }

    function tokenMerkleRoot(uint256 tokenId) public view virtual returns (bytes32) {
        _requireMinted(tokenId);
        return tokenIdToMerkle[tokenId];
    }

    function setFundDestination(address _destination) public onlyRole(DEFAULT_ADMIN_ROLE) {
        destination = _destination;
    }

    function withdraw() public onlyRole(DEFAULT_ADMIN_ROLE) {
        payable(destination).transfer(address(this).balance);
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
        string memory rnsId = tokenIdToRnsId[_tokenId];

        // V4: Removed isMinted/isAuthorized cleanup, using event tracking instead

        emit RNSBurnID(rnsId, wallet, _tokenId);

        tokenIdToMerkle[_tokenId] = bytes32(0);
        tokenIdToWallet[_tokenId] = address(0);
        tokenIdToRnsId[_tokenId] = "";

        // V4: Clear walletToRnsId mapping if wallet has no other LDID
        if (balanceOf(wallet) == 0) {
            walletToRnsId[wallet] = "";
        }
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