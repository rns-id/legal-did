// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { IEAS, Attestation } from "@ethereum-attestation-service/eas-contracts/contracts/IEAS.sol";
import "./TaggedResolver.sol";

/// @title TaggedQuery
/// @notice 标签查询和验证合约 - Legal DID Attestation System
contract TaggedQuery {
    
    // 重用结构体定义
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
    
    // 用户标签摘要
    struct UserTagSummary {
        address user;
        bool hasValidity;
        bool hasClearance;
        bool hasAge;
        bool hasGender;
        bool hasDocument;
        bool hasGeographic;
        uint256 totalTags;
    }
    
    IEAS private immutable _eas;
    TaggedResolver private immutable _resolver;
    
    constructor(IEAS eas, TaggedResolver resolver) {
        _eas = eas;
        _resolver = resolver;
    }
    
    /// @notice 查询用户的有效性标签
    function getValidityTag(address user, bytes32 attestationUID) 
        external view returns (ValidityTag memory) {
        Attestation memory attestation = _eas.getAttestation(attestationUID);
        require(attestation.recipient == user, "Invalid recipient");
        require(attestation.uid != bytes32(0), "Attestation not found");
        
        return abi.decode(attestation.data, (ValidityTag));
    }
    
    /// @notice 查询用户的清理状态标签
    function getClearanceTag(address user, bytes32 attestationUID) 
        external view returns (ClearanceTag memory) {
        Attestation memory attestation = _eas.getAttestation(attestationUID);
        require(attestation.recipient == user, "Invalid recipient");
        require(attestation.uid != bytes32(0), "Attestation not found");
        
        return abi.decode(attestation.data, (ClearanceTag));
    }
    
    /// @notice 查询用户的年龄验证标签
    function getAgeVerificationTag(address user, bytes32 attestationUID) 
        external view returns (AgeVerificationTag memory) {
        Attestation memory attestation = _eas.getAttestation(attestationUID);
        require(attestation.recipient == user, "Invalid recipient");
        require(attestation.uid != bytes32(0), "Attestation not found");
        
        return abi.decode(attestation.data, (AgeVerificationTag));
    }
    
    /// @notice 查询用户的性别标签
    function getGenderTag(address user, bytes32 attestationUID) 
        external view returns (GenderTag memory) {
        Attestation memory attestation = _eas.getAttestation(attestationUID);
        require(attestation.recipient == user, "Invalid recipient");
        require(attestation.uid != bytes32(0), "Attestation not found");
        
        return abi.decode(attestation.data, (GenderTag));
    }
    
    /// @notice 查询用户的文档类型标签
    function getDocumentTypeTag(address user, bytes32 attestationUID) 
        external view returns (DocumentTypeTag memory) {
        Attestation memory attestation = _eas.getAttestation(attestationUID);
        require(attestation.recipient == user, "Invalid recipient");
        require(attestation.uid != bytes32(0), "Attestation not found");
        
        return abi.decode(attestation.data, (DocumentTypeTag));
    }
    
    /// @notice 查询用户的地理位置标签
    function getGeographicTag(address user, bytes32 attestationUID) 
        external view returns (GeographicTag memory) {
        Attestation memory attestation = _eas.getAttestation(attestationUID);
        require(attestation.recipient == user, "Invalid recipient");
        require(attestation.uid != bytes32(0), "Attestation not found");
        
        return abi.decode(attestation.data, (GeographicTag));
    }
    
    /// @notice 验证用户是否具有特定标签
    function hasValidTag(address user, string calldata tagType) 
        external view returns (bool) {
        return _resolver.userTags(user, tagType);
    }
    
    /// @notice 批量查询用户标签状态
    function batchCheckTags(address user, string[] calldata tagTypes) 
        external view returns (bool[] memory) {
        bool[] memory results = new bool[](tagTypes.length);
        
        for (uint256 i = 0; i < tagTypes.length; i++) {
            results[i] = _resolver.userTags(user, tagTypes[i]);
        }
        
        return results;
    }
    
    /// @notice 批量查询多个用户的标签状态
    function batchCheckUsersTag(address[] calldata users, string calldata tagType) 
        external view returns (bool[] memory) {
        bool[] memory results = new bool[](users.length);
        
        for (uint256 i = 0; i < users.length; i++) {
            results[i] = _resolver.userTags(users[i], tagType);
        }
        
        return results;
    }
    
    /// @notice 获取用户标签摘要
    function getUserTagSummary(address user) 
        external view returns (UserTagSummary memory) {
        (
            bool hasValidity,
            bool hasClearance,
            bool hasAge,
            bool hasGender,
            bool hasDocument,
            bool hasGeographic
        ) = _resolver.getUserAllTagStatus(user);
        
        uint256 totalTags = 0;
        if (hasValidity) totalTags++;
        if (hasClearance) totalTags++;
        if (hasAge) totalTags++;
        if (hasGender) totalTags++;
        if (hasDocument) totalTags++;
        if (hasGeographic) totalTags++;
        
        return UserTagSummary({
            user: user,
            hasValidity: hasValidity,
            hasClearance: hasClearance,
            hasAge: hasAge,
            hasGender: hasGender,
            hasDocument: hasDocument,
            hasGeographic: hasGeographic,
            totalTags: totalTags
        });
    }
    
    /// @notice 批量获取用户标签摘要
    function batchGetUserTagSummaries(address[] calldata users) 
        external view returns (UserTagSummary[] memory) {
        UserTagSummary[] memory summaries = new UserTagSummary[](users.length);
        
        for (uint256 i = 0; i < users.length; i++) {
            summaries[i] = this.getUserTagSummary(users[i]);
        }
        
        return summaries;
    }
    
    /// @notice 获取用户特定类型标签的数量
    function getUserTagCount(address user, string calldata tagType) 
        external view returns (uint256) {
        return _resolver.getUserTagCount(user, tagType);
    }
    
    /// @notice 获取用户所有类型标签的数量
    function getUserAllTagCounts(address user) 
        external view returns (
            uint256 validityCount,
            uint256 clearanceCount,
            uint256 ageCount,
            uint256 genderCount,
            uint256 documentCount,
            uint256 geographicCount
        ) {
        return (
            _resolver.getUserTagCount(user, "validity"),
            _resolver.getUserTagCount(user, "clearance"),
            _resolver.getUserTagCount(user, "age"),
            _resolver.getUserTagCount(user, "gender"),
            _resolver.getUserTagCount(user, "document"),
            _resolver.getUserTagCount(user, "geographic")
        );
    }
    
    /// @notice 获取标签统计信息
    function getTagStatistics() external view returns (
        uint256 validityCount,
        uint256 clearanceCount,
        uint256 ageCount,
        uint256 genderCount,
        uint256 documentCount,
        uint256 geographicCount
    ) {
        return _resolver.getAllTagStatistics();
    }
    
    /// @notice 验证证明是否有效且未过期
    function isAttestationValidAndActive(bytes32 attestationUID) 
        external view returns (bool) {
        Attestation memory attestation = _eas.getAttestation(attestationUID);
        
        // 检查证明是否存在
        if (attestation.uid == bytes32(0)) {
            return false;
        }
        
        // 检查是否被撤销
        if (attestation.revocationTime != 0) {
            return false;
        }
        
        // 检查是否过期
        if (attestation.expirationTime != 0 && attestation.expirationTime <= block.timestamp) {
            return false;
        }
        
        return true;
    }
    
    /// @notice 批量验证证明有效性
    function batchCheckAttestationValidity(bytes32[] calldata attestationUIDs) 
        external view returns (bool[] memory) {
        bool[] memory results = new bool[](attestationUIDs.length);
        
        for (uint256 i = 0; i < attestationUIDs.length; i++) {
            results[i] = this.isAttestationValidAndActive(attestationUIDs[i]);
        }
        
        return results;
    }
    
    /// @notice 查询具有特定标签的用户数量（需要遍历，gas消耗较高，建议链下查询）
    function countUsersWithTag(string calldata tagType, address[] calldata userList) 
        external view returns (uint256) {
        uint256 count = 0;
        
        for (uint256 i = 0; i < userList.length; i++) {
            if (_resolver.userTags(userList[i], tagType)) {
                count++;
            }
        }
        
        return count;
    }
    
    /// @notice 过滤具有特定标签的用户（返回地址列表）
    function filterUsersWithTag(string calldata tagType, address[] calldata userList) 
        external view returns (address[] memory) {
        // 首先计算符合条件的用户数量
        uint256 count = 0;
        for (uint256 i = 0; i < userList.length; i++) {
            if (_resolver.userTags(userList[i], tagType)) {
                count++;
            }
        }
        
        // 创建结果数组
        address[] memory filteredUsers = new address[](count);
        uint256 index = 0;
        
        for (uint256 i = 0; i < userList.length; i++) {
            if (_resolver.userTags(userList[i], tagType)) {
                filteredUsers[index] = userList[i];
                index++;
            }
        }
        
        return filteredUsers;
    }
    
    /// @notice 获取EAS合约地址
    function getEAS() external view returns (IEAS) {
        return _eas;
    }
    
    /// @notice 获取解析器合约地址
    function getResolver() external view returns (TaggedResolver) {
        return _resolver;
    }
}