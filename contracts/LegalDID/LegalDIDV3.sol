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
    event RNSRevoked(string _rnsId, address indexed _wallet, uint256 _tokenId);

    uint256 public mintPrice;
    uint256 public lastTokenId;
    string private baseURI;
    address private destination;

    bytes32 public constant SECONDARY_ADMIN_ROLE = keccak256("SECONDARY_ADMIN_ROLE");

    mapping(string => bool) public isMinted;
    mapping(string => bool) public isAuthorized;
    mapping(string => uint256) public numMinted;
    mapping(address => bool) private isBlockedAddress;
    mapping(string => bool) private isBlockedRnsID;

    mapping(uint256 => bytes32) public tokenIdToMerkle;
    mapping(uint256 => address) public tokenIdToWallet;
    mapping(uint256 => string) public tokenIdToRnsId;

    // 预留存储空间，未来添加新变量时从这里扣除
    uint256[50] private __gap;

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

    function setIsBlockedAddress(address _wallet, bool _isBlocked) public onlyRole(SECONDARY_ADMIN_ROLE) {
        isBlockedAddress[_wallet] = _isBlocked;
    }

    function setIsBlockedRnsID(string memory _rnsId, bool _isBlocked) public onlyRole(SECONDARY_ADMIN_ROLE) {
        isBlockedRnsID[_rnsId] = _isBlocked;
    }

    function setTokenIdToMerkle(uint256 tokenId, bytes32 _merkelRoot) external onlyRole(SECONDARY_ADMIN_ROLE) {
        tokenIdToMerkle[tokenId] = _merkelRoot;
    }

    function authorizeMint(string memory _rnsId, address _wallet) external payable nonReentrant {
        require(!isBlockedAddress[_wallet], "the wallet is blacklisted");
        require(!isBlockedRnsID[_rnsId], "the LDID is blacklisted");

        uint256 fee = mintPrice;

        if (hasRole(SECONDARY_ADMIN_ROLE, msg.sender)) {
            fee = 0;
        }
        require(msg.value >= fee, "insufficient fund");

        string memory idAddressKey = getIdentityKey(_rnsId, _wallet);
        numMinted[_rnsId] = numMinted[_rnsId].add(1);
        isAuthorized[idAddressKey] = true;
        emit RNSAddressAuthorized(_rnsId, _wallet);
    }

    function airdrop(string memory _rnsId, address _wallet, bytes32 _merkelRoot) external onlyRole(SECONDARY_ADMIN_ROLE) nonReentrant {
        require(!isBlockedAddress[_wallet], "the wallet is blacklisted");
        require(!isBlockedRnsID[_rnsId], "the LDID is blacklisted");

        string memory idAddressKey = getIdentityKey(_rnsId, _wallet);
        isMinted[idAddressKey] = true;
        uint256 tokenId = lastTokenId.add(1);
        lastTokenId = tokenId;

        _safeMint(_wallet, tokenId);

        tokenIdToMerkle[tokenId] = _merkelRoot;
        tokenIdToWallet[tokenId] = _wallet;
        tokenIdToRnsId[tokenId] = _rnsId;

        emit RNSNewID(_rnsId, _wallet, tokenId);
    }

    // V3: 管理员 revoke 功能
    function revoke(uint256 _tokenId) external onlyRole(SECONDARY_ADMIN_ROLE) {
        _requireMinted(_tokenId);

        address wallet = tokenIdToWallet[_tokenId];
        string memory rnsId = tokenIdToRnsId[_tokenId];
        string memory idAddressKey = getIdentityKey(rnsId, wallet);

        // 清理状态
        isMinted[idAddressKey] = false;
        isAuthorized[idAddressKey] = false;

        emit RNSRevoked(rnsId, wallet, _tokenId);

        // 清理 token 数据
        tokenIdToMerkle[_tokenId] = bytes32(0);
        tokenIdToWallet[_tokenId] = address(0);
        tokenIdToRnsId[_tokenId] = "";

        // 销毁 NFT（绕过 owner 检查）
        _burn(_tokenId);
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
        string memory idAddressKey = getIdentityKey(rnsId, wallet);

        isMinted[idAddressKey] = false;
        isAuthorized[idAddressKey] = false;

        emit RNSBurnID(tokenIdToRnsId[_tokenId], tokenIdToWallet[_tokenId], _tokenId);

        tokenIdToMerkle[_tokenId] = bytes32(0);
        tokenIdToWallet[_tokenId] = address(0);
        tokenIdToRnsId[_tokenId] = "";
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal virtual override(ERC721Upgradeable, ERC721EnumerableUpgradeable) {
        if (from != address(0)) {
            // 允许管理员 revoke（通过 _burn 调用）
            if (!hasRole(SECONDARY_ADMIN_ROLE, msg.sender)) {
                address owner = ownerOf(firstTokenId);
                require(owner == msg.sender, "Only the owner of LDID can burn it.");
            }
            require(to == address(0) || from == address(0), "A LDID can only be airdropped or burned.");
        }
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
    }
}
