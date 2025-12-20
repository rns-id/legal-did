// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IEAS, AttestationRequest, AttestationRequestData, RevocationRequest, RevocationRequestData, MultiAttestationRequest, MultiRevocationRequest } from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";
import { NO_EXPIRATION_TIME, EMPTY_UID } from "@ethereum-attestation-service/eas-contracts/contracts/Common.sol";

/// @title TaggedAttester
/// @notice 标签式证明发放器 - Legal DID Attestation System
contract TaggedAttester {
    error InvalidEAS();
    error InvalidTag();
    error UnauthorizedIssuer();
    error ExpiredTag();
    error InvalidInput();
    
    // 有效性标签
    struct ValidityTag {
        bool valid;
        uint256 issued;      // 发放时间戳
        uint256 expires;     // 过期时间戳
    }
    
    // 清理状态标签
    struct ClearanceTag {
        bool clear;
        uint256 checkDate;   // 检查日期
        string checkType;    // 检查类型：background, security, compliance
    }
    
    // 年龄验证标签
    struct AgeVerificationTag {
        bool over18;
        bool over21;
        uint256 birthYear;
        bool verified;       // 是否已验证
    }
    
    // 性别标签
    struct GenderTag {
        string gender;       // Male, Female, Other
        bool verified;
    }
    
    // 文档类型标签
    struct DocumentTypeTag {
        string docType;      // ID, Passport, License, Certificate
        bytes32 docHash;     // 文档哈希
        bool authentic;      // 是否真实
    }
    
    // 地理位置标签
    struct GeographicTag {
        string country;      // 国家代码
        string region;       // 地区
        string jurisdiction; // 司法管辖区
    }

    IEAS private immutable _eas;
    
    // 授权发放者 - issuer => tagType => authorized
    mapping(address => mapping(string => bool)) public authorizedIssuers;
    
    // 标签模式映射 - tagType => schemaUID
    mapping(string => bytes32) public tagSchemas;
    
    // 管理员
    address public owner;
    
    // 事件
    event TagIssued(
        address indexed recipient,
        string indexed tagType,
        bytes32 indexed attestationUID,
        address issuer
    );
    
    event TagRevoked(
        address indexed recipient,
        string indexed tagType,
        bytes32 indexed attestationUID
    );
    
    event IssuerAuthorized(
        address indexed issuer,
        string indexed tagType,
        bool authorized
    );
    
    event SchemaRegistered(
        string indexed tagType,
        bytes32 indexed schemaUID
    );
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    modifier onlyAuthorizedIssuer(string memory tagType) {
        require(authorizedIssuers[msg.sender][tagType], "Unauthorized issuer");
        _;
    }
    
    constructor(IEAS eas) {
        if (address(eas) == address(0)) {
            revert InvalidEAS();
        }
        _eas = eas;
        owner = msg.sender;
    }
    
    /// @notice 设置授权发放者
    function setAuthorizedIssuer(
        address issuer,
        string calldata tagType,
        bool authorized
    ) external onlyOwner {
        authorizedIssuers[issuer][tagType] = authorized;
        emit IssuerAuthorized(issuer, tagType, authorized);
    }
    
    /// @notice 注册标签模式
    function registerTagSchema(
        string calldata tagType,
        bytes32 schemaUID
    ) external onlyOwner {
        tagSchemas[tagType] = schemaUID;
        emit SchemaRegistered(tagType, schemaUID);
    }
    
    /// @notice 发放有效性标签
    function issueValidityTag(
        address recipient,
        ValidityTag calldata tag
    ) external onlyAuthorizedIssuer("validity") returns (bytes32) {
        require(tag.expires > block.timestamp, "Invalid expiration");
        require(tag.issued <= block.timestamp, "Invalid issue time");
        
        bytes memory data = abi.encode(tag);
        
        bytes32 uid = _eas.attest(AttestationRequest({
            schema: tagSchemas["validity"],
            data: AttestationRequestData({
                recipient: recipient,
                expirationTime: uint64(tag.expires),
                revocable: true,
                refUID: EMPTY_UID,
                data: data,
                value: 0
            })
        }));
        
        emit TagIssued(recipient, "validity", uid, msg.sender);
        return uid;
    }
    
    /// @notice 发放清理状态标签
    function issueClearanceTag(
        address recipient,
        ClearanceTag calldata tag
    ) external onlyAuthorizedIssuer("clearance") returns (bytes32) {
        require(tag.checkDate <= block.timestamp, "Invalid check date");
        
        bytes memory data = abi.encode(tag);
        
        bytes32 uid = _eas.attest(AttestationRequest({
            schema: tagSchemas["clearance"],
            data: AttestationRequestData({
                recipient: recipient,
                expirationTime: NO_EXPIRATION_TIME,
                revocable: true,
                refUID: EMPTY_UID,
                data: data,
                value: 0
            })
        }));
        
        emit TagIssued(recipient, "clearance", uid, msg.sender);
        return uid;
    }
    
    /// @notice 发放年龄验证标签
    function issueAgeVerificationTag(
        address recipient,
        AgeVerificationTag calldata tag
    ) external onlyAuthorizedIssuer("age") returns (bytes32) {
        // 验证年龄逻辑一致性
        uint256 currentYear = (block.timestamp / 365 days) + 1970;
        uint256 age = currentYear - tag.birthYear;
        
        if (tag.over18) {
            require(age >= 18, "Age inconsistent with over18 flag");
        }
        if (tag.over21) {
            require(age >= 21, "Age inconsistent with over21 flag");
        }
        
        bytes memory data = abi.encode(tag);
        
        bytes32 uid = _eas.attest(AttestationRequest({
            schema: tagSchemas["age"],
            data: AttestationRequestData({
                recipient: recipient,
                expirationTime: NO_EXPIRATION_TIME,
                revocable: false, // 年龄信息通常不可撤销
                refUID: EMPTY_UID,
                data: data,
                value: 0
            })
        }));
        
        emit TagIssued(recipient, "age", uid, msg.sender);
        return uid;
    }
    
    /// @notice 发放性别标签
    function issueGenderTag(
        address recipient,
        GenderTag calldata tag
    ) external onlyAuthorizedIssuer("gender") returns (bytes32) {
        // 验证性别值有效性
        bytes32 genderHash = keccak256(bytes(tag.gender));
        require(
            genderHash == keccak256("Male") || 
            genderHash == keccak256("Female") || 
            genderHash == keccak256("Other"),
            "Invalid gender value"
        );
        
        bytes memory data = abi.encode(tag);
        
        bytes32 uid = _eas.attest(AttestationRequest({
            schema: tagSchemas["gender"],
            data: AttestationRequestData({
                recipient: recipient,
                expirationTime: NO_EXPIRATION_TIME,
                revocable: true,
                refUID: EMPTY_UID,
                data: data,
                value: 0
            })
        }));
        
        emit TagIssued(recipient, "gender", uid, msg.sender);
        return uid;
    }
    
    /// @notice 发放文档类型标签
    function issueDocumentTypeTag(
        address recipient,
        DocumentTypeTag calldata tag
    ) external onlyAuthorizedIssuer("document") returns (bytes32) {
        require(tag.docHash != bytes32(0), "Invalid document hash");
        require(bytes(tag.docType).length > 0, "Invalid document type");
        
        bytes memory data = abi.encode(tag);
        
        bytes32 uid = _eas.attest(AttestationRequest({
            schema: tagSchemas["document"],
            data: AttestationRequestData({
                recipient: recipient,
                expirationTime: NO_EXPIRATION_TIME,
                revocable: true,
                refUID: EMPTY_UID,
                data: data,
                value: 0
            })
        }));
        
        emit TagIssued(recipient, "document", uid, msg.sender);
        return uid;
    }
    
    /// @notice 发放地理位置标签
    function issueGeographicTag(
        address recipient,
        GeographicTag calldata tag
    ) external onlyAuthorizedIssuer("geographic") returns (bytes32) {
        require(bytes(tag.country).length > 0, "Invalid country");
        
        bytes memory data = abi.encode(tag);
        
        bytes32 uid = _eas.attest(AttestationRequest({
            schema: tagSchemas["geographic"],
            data: AttestationRequestData({
                recipient: recipient,
                expirationTime: NO_EXPIRATION_TIME,
                revocable: true,
                refUID: EMPTY_UID,
                data: data,
                value: 0
            })
        }));
        
        emit TagIssued(recipient, "geographic", uid, msg.sender);
        return uid;
    }
    
    /// @notice 批量发放标签
    function batchIssueTags(
        address[] calldata recipients,
        string[] calldata tagTypes,
        bytes[] calldata tagData
    ) external returns (bytes32[] memory) {
        if (recipients.length == 0 || 
            recipients.length != tagTypes.length || 
            recipients.length != tagData.length) {
            revert InvalidInput();
        }
        
        bytes32[] memory uids = new bytes32[](recipients.length);
        
        for (uint256 i = 0; i < recipients.length; i++) {
            require(authorizedIssuers[msg.sender][tagTypes[i]], "Unauthorized for tag type");
            require(tagSchemas[tagTypes[i]] != bytes32(0), "Schema not registered");
            
            bytes32 uid = _eas.attest(AttestationRequest({
                schema: tagSchemas[tagTypes[i]],
                data: AttestationRequestData({
                    recipient: recipients[i],
                    expirationTime: NO_EXPIRATION_TIME,
                    revocable: true,
                    refUID: EMPTY_UID,
                    data: tagData[i],
                    value: 0
                })
            }));
            
            uids[i] = uid;
            emit TagIssued(recipients[i], tagTypes[i], uid, msg.sender);
        }
        
        return uids;
    }
    
    /// @notice 撤销标签
    function revokeTag(
        bytes32 schemaUID,
        bytes32 attestationUID
    ) external {
        _eas.revoke(RevocationRequest({
            schema: schemaUID,
            data: RevocationRequestData({
                uid: attestationUID,
                value: 0
            })
        }));
        
        emit TagRevoked(address(0), "", attestationUID); // recipient和tagType需要从事件中获取
    }
    
    /// @notice 批量撤销标签
    function batchRevokeTags(
        bytes32[] calldata schemaUIDs,
        bytes32[] calldata attestationUIDs
    ) external {
        if (schemaUIDs.length != attestationUIDs.length) {
            revert InvalidInput();
        }
        
        MultiRevocationRequest[] memory requests = new MultiRevocationRequest[](schemaUIDs.length);
        
        for (uint256 i = 0; i < schemaUIDs.length; i++) {
            RevocationRequestData[] memory data = new RevocationRequestData[](1);
            data[0] = RevocationRequestData({
                uid: attestationUIDs[i],
                value: 0
            });
            
            requests[i] = MultiRevocationRequest({
                schema: schemaUIDs[i],
                data: data
            });
        }
        
        _eas.multiRevoke(requests);
    }
    
    /// @notice 获取EAS合约地址
    function getEAS() external view returns (IEAS) {
        return _eas;
    }
    
    /// @notice 转移所有权
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid new owner");
        owner = newOwner;
    }
}