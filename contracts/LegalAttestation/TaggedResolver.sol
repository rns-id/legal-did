// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IEAS, Attestation } from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";
import { SchemaResolver } from "@ethereum-attestation-service/eas-contracts/contracts/resolver/SchemaResolver.sol";

/// @title TaggedResolver
/// @notice 标签验证和处理解析器 - Legal DID Attestation System
contract TaggedResolver is SchemaResolver {
    
    // 重用TaggedAttester中的结构体定义
    struct ValidityTag {
        bool valid;
        uint256 issued;
        uint256 expires;
    }
    
    struct ClearanceTag {
        bool clear;
        uint256 checkDate;
        string checkType;
    }
    
    struct AgeVerificationTag {
        bool over18;
        bool over21;
        uint256 birthYear;
        bool verified;
    }
    
    struct GenderTag {
        string gender;
        bool verified;
    }
    
    struct DocumentTypeTag {
        string docType;
        bytes32 docHash;
        bool authentic;
    }
    
    struct GeographicTag {
        string country;
        string region;
        string jurisdiction;
    }
    
    // 标签验证事件
    event ValidityTagProcessed(
        address indexed recipient, 
        bool valid, 
        uint256 expires,
        bytes32 indexed attestationUID
    );
    
    event ClearanceTagProcessed(
        address indexed recipient, 
        bool clear, 
        uint256 checkDate,
        bytes32 indexed attestationUID
    );
    
    event AgeTagProcessed(
        address indexed recipient, 
        bool over18, 
        bool over21,
        bytes32 indexed attestationUID
    );
    
    event GenderTagProcessed(
        address indexed recipient, 
        string gender,
        bytes32 indexed attestationUID
    );
    
    event DocumentTagProcessed(
        address indexed recipient, 
        string docType, 
        bytes32 docHash,
        bytes32 indexed attestationUID
    );
    
    event GeographicTagProcessed(
        address indexed recipient, 
        string country,
        bytes32 indexed attestationUID
    );
    
    event TagRevoked(
        address indexed recipient,
        bytes32 indexed attestationUID,
        bytes32 indexed schemaUID
    );
    
    // 标签统计
    mapping(string => uint256) public tagCounts;
    
    // 用户标签状态 - user => tagType => hasTag
    mapping(address => mapping(string => bool)) public userTags;
    
    // 用户标签计数 - user => tagType => count
    mapping(address => mapping(string => uint256)) public userTagCounts;
    
    // 模式UID到标签类型的映射
    mapping(bytes32 => string) public schemaToTagType;
    
    // 管理员
    address public owner;
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    constructor(IEAS eas) SchemaResolver(eas) {
        owner = msg.sender;
    }
    
    /// @notice 注册模式到标签类型的映射
    function registerSchemaMapping(
        bytes32 schemaUID,
        string calldata tagType
    ) external onlyOwner {
        schemaToTagType[schemaUID] = tagType;
    }
    
    /// @notice 批量注册模式映射
    function batchRegisterSchemaMappings(
        bytes32[] calldata schemaUIDs,
        string[] calldata tagTypes
    ) external onlyOwner {
        require(schemaUIDs.length == tagTypes.length, "Length mismatch");
        
        for (uint256 i = 0; i < schemaUIDs.length; i++) {
            schemaToTagType[schemaUIDs[i]] = tagTypes[i];
        }
    }
    
    function onAttest(Attestation calldata attestation, uint256 /*value*/) 
        internal override returns (bool) {
        
        string memory tagType = schemaToTagType[attestation.schema];
        
        // 根据标签类型处理不同标签
        if (keccak256(bytes(tagType)) == keccak256("validity")) {
            return _processValidityTag(attestation);
        } else if (keccak256(bytes(tagType)) == keccak256("clearance")) {
            return _processClearanceTag(attestation);
        } else if (keccak256(bytes(tagType)) == keccak256("age")) {
            return _processAgeTag(attestation);
        } else if (keccak256(bytes(tagType)) == keccak256("gender")) {
            return _processGenderTag(attestation);
        } else if (keccak256(bytes(tagType)) == keccak256("document")) {
            return _processDocumentTag(attestation);
        } else if (keccak256(bytes(tagType)) == keccak256("geographic")) {
            return _processGeographicTag(attestation);
        }
        
        // 未知标签类型，拒绝
        return false;
    }
    
    function _processValidityTag(Attestation calldata attestation) private returns (bool) {
        ValidityTag memory tag = abi.decode(attestation.data, (ValidityTag));
        
        // 验证有效期
        if (tag.expires <= block.timestamp) {
            return false;
        }
        
        // 验证发放时间
        if (tag.issued > block.timestamp) {
            return false;
        }
        
        // 更新用户标签状态
        userTags[attestation.recipient]["validity"] = tag.valid;
        userTagCounts[attestation.recipient]["validity"]++;
        tagCounts["validity"]++;
        
        emit ValidityTagProcessed(
            attestation.recipient, 
            tag.valid, 
            tag.expires,
            attestation.uid
        );
        
        return true;
    }
    
    function _processClearanceTag(Attestation calldata attestation) private returns (bool) {
        ClearanceTag memory tag = abi.decode(attestation.data, (ClearanceTag));
        
        // 验证检查日期不能是未来
        if (tag.checkDate > block.timestamp) {
            return false;
        }
        
        // 验证检查类型
        bytes32 checkTypeHash = keccak256(bytes(tag.checkType));
        if (checkTypeHash != keccak256("background") && 
            checkTypeHash != keccak256("security") && 
            checkTypeHash != keccak256("compliance")) {
            return false;
        }
        
        userTags[attestation.recipient]["clearance"] = tag.clear;
        userTagCounts[attestation.recipient]["clearance"]++;
        tagCounts["clearance"]++;
        
        emit ClearanceTagProcessed(
            attestation.recipient, 
            tag.clear, 
            tag.checkDate,
            attestation.uid
        );
        
        return true;
    }
    
    function _processAgeTag(Attestation calldata attestation) private returns (bool) {
        AgeVerificationTag memory tag = abi.decode(attestation.data, (AgeVerificationTag));
        
        // 验证年龄逻辑一致性
        uint256 currentYear = (block.timestamp / 365 days) + 1970;
        uint256 age = currentYear - tag.birthYear;
        
        if (tag.over18 && age < 18) return false;
        if (tag.over21 && age < 21) return false;
        
        // 验证出生年份合理性（不能是未来，不能太久远）
        if (tag.birthYear > currentYear || tag.birthYear < 1900) {
            return false;
        }
        
        userTags[attestation.recipient]["age"] = true;
        userTagCounts[attestation.recipient]["age"]++;
        tagCounts["age"]++;
        
        emit AgeTagProcessed(
            attestation.recipient, 
            tag.over18, 
            tag.over21,
            attestation.uid
        );
        
        return true;
    }
    
    function _processGenderTag(Attestation calldata attestation) private returns (bool) {
        GenderTag memory tag = abi.decode(attestation.data, (GenderTag));
        
        // 验证性别值有效性
        bytes32 genderHash = keccak256(bytes(tag.gender));
        if (genderHash != keccak256("Male") && 
            genderHash != keccak256("Female") && 
            genderHash != keccak256("Other")) {
            return false;
        }
        
        userTags[attestation.recipient]["gender"] = true;
        userTagCounts[attestation.recipient]["gender"]++;
        tagCounts["gender"]++;
        
        emit GenderTagProcessed(
            attestation.recipient, 
            tag.gender,
            attestation.uid
        );
        
        return true;
    }
    
    function _processDocumentTag(Attestation calldata attestation) private returns (bool) {
        DocumentTypeTag memory tag = abi.decode(attestation.data, (DocumentTypeTag));
        
        // 验证文档哈希不为空
        if (tag.docHash == bytes32(0)) {
            return false;
        }
        
        // 验证文档类型
        bytes32 docTypeHash = keccak256(bytes(tag.docType));
        if (docTypeHash != keccak256("ID") && 
            docTypeHash != keccak256("Passport") && 
            docTypeHash != keccak256("License") && 
            docTypeHash != keccak256("Certificate")) {
            return false;
        }
        
        userTags[attestation.recipient]["document"] = true;
        userTagCounts[attestation.recipient]["document"]++;
        tagCounts["document"]++;
        
        emit DocumentTagProcessed(
            attestation.recipient, 
            tag.docType, 
            tag.docHash,
            attestation.uid
        );
        
        return true;
    }
    
    function _processGeographicTag(Attestation calldata attestation) private returns (bool) {
        GeographicTag memory tag = abi.decode(attestation.data, (GeographicTag));
        
        // 验证国家代码不为空
        if (bytes(tag.country).length == 0) {
            return false;
        }
        
        // 验证国家代码长度（通常是2-3位）
        if (bytes(tag.country).length > 10) {
            return false;
        }
        
        userTags[attestation.recipient]["geographic"] = true;
        userTagCounts[attestation.recipient]["geographic"]++;
        tagCounts["geographic"]++;
        
        emit GeographicTagProcessed(
            attestation.recipient, 
            tag.country,
            attestation.uid
        );
        
        return true;
    }
    
    function onRevoke(Attestation calldata attestation, uint256 /*value*/) 
        internal override returns (bool) {
        
        string memory tagType = schemaToTagType[attestation.schema];
        
        // 更新用户标签状态
        if (userTagCounts[attestation.recipient][tagType] > 0) {
            userTagCounts[attestation.recipient][tagType]--;
            
            // 如果用户该类型标签数量为0，则设置为false
            if (userTagCounts[attestation.recipient][tagType] == 0) {
                userTags[attestation.recipient][tagType] = false;
            }
        }
        
        // 减少总计数
        if (tagCounts[tagType] > 0) {
            tagCounts[tagType]--;
        }
        
        emit TagRevoked(
            attestation.recipient,
            attestation.uid,
            attestation.schema
        );
        
        return true;
    }
    
    /// @notice 获取用户特定类型标签数量
    function getUserTagCount(address user, string calldata tagType) 
        external view returns (uint256) {
        return userTagCounts[user][tagType];
    }
    
    /// @notice 获取用户所有标签状态
    function getUserAllTagStatus(address user) 
        external view returns (
            bool hasValidity,
            bool hasClearance,
            bool hasAge,
            bool hasGender,
            bool hasDocument,
            bool hasGeographic
        ) {
        return (
            userTags[user]["validity"],
            userTags[user]["clearance"],
            userTags[user]["age"],
            userTags[user]["gender"],
            userTags[user]["document"],
            userTags[user]["geographic"]
        );
    }
    
    /// @notice 获取所有标签统计
    function getAllTagStatistics() 
        external view returns (
            uint256 validityCount,
            uint256 clearanceCount,
            uint256 ageCount,
            uint256 genderCount,
            uint256 documentCount,
            uint256 geographicCount
        ) {
        return (
            tagCounts["validity"],
            tagCounts["clearance"],
            tagCounts["age"],
            tagCounts["gender"],
            tagCounts["document"],
            tagCounts["geographic"]
        );
    }
    
    /// @notice 转移所有权
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid new owner");
        owner = newOwner;
    }
}