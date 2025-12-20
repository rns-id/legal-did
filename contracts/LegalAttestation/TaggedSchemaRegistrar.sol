// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import { ISchemaRegistry } from "@ethereum-attestation-service/eas-contracts/contracts/ISchemaRegistry.sol";
import { ISchemaResolver } from "@ethereum-attestation-service/eas-contracts/contracts/resolver/ISchemaResolver.sol";

/// @title TaggedSchemaRegistrar
/// @notice 标签模式注册器 - Legal DID Attestation System
contract TaggedSchemaRegistrar {
    error InvalidSchemaRegistry();
    error InvalidSchema();
    error InvalidResolver();
    error SchemaAlreadyRegistered();
    error UnauthorizedCaller();
    
    // 标签模式定义
    struct TagSchema {
        string tagType;
        string schemaDefinition;
        bytes32 schemaUID;
        bool revocable;
        bool registered;
    }
    
    ISchemaRegistry private immutable _schemaRegistry;
    address public owner;
    
    // 标签类型到模式的映射
    mapping(string => TagSchema) public tagSchemas;
    
    // 已注册的标签类型列表
    string[] public registeredTagTypes;
    
    // 预定义的标签模式
    mapping(string => string) private _predefinedSchemas;
    
    event TagSchemaRegistered(
        string indexed tagType,
        bytes32 indexed schemaUID,
        string schemaDefinition,
        bool revocable
    );
    
    event TagSchemaUpdated(
        string indexed tagType,
        bytes32 indexed oldSchemaUID,
        bytes32 indexed newSchemaUID
    );
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }
    
    constructor(ISchemaRegistry schemaRegistry) {
        if (address(schemaRegistry) == address(0)) {
            revert InvalidSchemaRegistry();
        }
        
        _schemaRegistry = schemaRegistry;
        owner = msg.sender;
        
        // 初始化预定义模式
        _initializePredefinedSchemas();
    }
    
    /// @notice 初始化预定义的标签模式
    function _initializePredefinedSchemas() private {
        // 有效性标签模式
        _predefinedSchemas["validity"] = "bool valid,uint256 issued,uint256 expires";
        
        // 清理状态标签模式
        _predefinedSchemas["clearance"] = "bool clear,uint256 checkDate,string checkType";
        
        // 年龄验证标签模式
        _predefinedSchemas["age"] = "bool over18,bool over21,uint256 birthYear,bool verified";
        
        // 性别标签模式
        _predefinedSchemas["gender"] = "string gender,bool verified";
        
        // 文档类型标签模式
        _predefinedSchemas["document"] = "string docType,bytes32 docHash,bool authentic";
        
        // 地理位置标签模式
        _predefinedSchemas["geographic"] = "string country,string region,string jurisdiction";
    }
    
    /// @notice 注册单个标签模式
    function registerTagSchema(
        string calldata tagType,
        ISchemaResolver resolver,
        bool revocable
    ) external onlyOwner returns (bytes32) {
        if (bytes(tagType).length == 0) {
            revert InvalidSchema();
        }
        
        if (address(resolver) == address(0)) {
            revert InvalidResolver();
        }
        
        if (tagSchemas[tagType].registered) {
            revert SchemaAlreadyRegistered();
        }
        
        // 获取预定义的模式定义
        string memory schemaDefinition = _predefinedSchemas[tagType];
        if (bytes(schemaDefinition).length == 0) {
            revert InvalidSchema();
        }
        
        // 注册模式
        bytes32 schemaUID = _schemaRegistry.register(schemaDefinition, resolver, revocable);
        
        // 保存模式信息
        tagSchemas[tagType] = TagSchema({
            tagType: tagType,
            schemaDefinition: schemaDefinition,
            schemaUID: schemaUID,
            revocable: revocable,
            registered: true
        });
        
        registeredTagTypes.push(tagType);
        
        emit TagSchemaRegistered(tagType, schemaUID, schemaDefinition, revocable);
        
        return schemaUID;
    }
    
    /// @notice 注册自定义标签模式
    function registerCustomTagSchema(
        string calldata tagType,
        string calldata schemaDefinition,
        ISchemaResolver resolver,
        bool revocable
    ) external onlyOwner returns (bytes32) {
        if (bytes(tagType).length == 0 || bytes(schemaDefinition).length == 0) {
            revert InvalidSchema();
        }
        
        if (address(resolver) == address(0)) {
            revert InvalidResolver();
        }
        
        if (tagSchemas[tagType].registered) {
            revert SchemaAlreadyRegistered();
        }
        
        // 注册模式
        bytes32 schemaUID = _schemaRegistry.register(schemaDefinition, resolver, revocable);
        
        // 保存模式信息
        tagSchemas[tagType] = TagSchema({
            tagType: tagType,
            schemaDefinition: schemaDefinition,
            schemaUID: schemaUID,
            revocable: revocable,
            registered: true
        });
        
        registeredTagTypes.push(tagType);
        
        emit TagSchemaRegistered(tagType, schemaUID, schemaDefinition, revocable);
        
        return schemaUID;
    }
    
    /// @notice 批量注册所有预定义标签模式
    function batchRegisterAllPredefinedSchemas(
        ISchemaResolver resolver,
        bool revocable
    ) external onlyOwner returns (bytes32[] memory) {
        string[] memory tagTypes = new string[](6);
        tagTypes[0] = "validity";
        tagTypes[1] = "clearance";
        tagTypes[2] = "age";
        tagTypes[3] = "gender";
        tagTypes[4] = "document";
        tagTypes[5] = "geographic";
        
        bytes32[] memory schemaUIDs = new bytes32[](6);
        
        for (uint256 i = 0; i < tagTypes.length; i++) {
            if (!tagSchemas[tagTypes[i]].registered) {
                schemaUIDs[i] = this.registerTagSchema(tagTypes[i], resolver, revocable);
            } else {
                schemaUIDs[i] = tagSchemas[tagTypes[i]].schemaUID;
            }
        }
        
        return schemaUIDs;
    }
    
    /// @notice 批量注册指定的标签模式
    function batchRegisterTagSchemas(
        string[] calldata tagTypes,
        ISchemaResolver resolver,
        bool revocable
    ) external onlyOwner returns (bytes32[] memory) {
        bytes32[] memory schemaUIDs = new bytes32[](tagTypes.length);
        
        for (uint256 i = 0; i < tagTypes.length; i++) {
            if (!tagSchemas[tagTypes[i]].registered) {
                schemaUIDs[i] = this.registerTagSchema(tagTypes[i], resolver, revocable);
            } else {
                schemaUIDs[i] = tagSchemas[tagTypes[i]].schemaUID;
            }
        }
        
        return schemaUIDs;
    }
    
    /// @notice 获取标签模式信息
    function getTagSchema(string calldata tagType) 
        external view returns (TagSchema memory) {
        return tagSchemas[tagType];
    }
    
    /// @notice 获取标签模式UID
    function getTagSchemaUID(string calldata tagType) 
        external view returns (bytes32) {
        require(tagSchemas[tagType].registered, "Schema not registered");
        return tagSchemas[tagType].schemaUID;
    }
    
    /// @notice 批量获取标签模式UID
    function batchGetTagSchemaUIDs(string[] calldata tagTypes) 
        external view returns (bytes32[] memory) {
        bytes32[] memory schemaUIDs = new bytes32[](tagTypes.length);
        
        for (uint256 i = 0; i < tagTypes.length; i++) {
            require(tagSchemas[tagTypes[i]].registered, "Schema not registered");
            schemaUIDs[i] = tagSchemas[tagTypes[i]].schemaUID;
        }
        
        return schemaUIDs;
    }
    
    /// @notice 获取所有已注册的标签类型
    function getAllRegisteredTagTypes() 
        external view returns (string[] memory) {
        return registeredTagTypes;
    }
    
    /// @notice 获取已注册标签类型数量
    function getRegisteredTagTypesCount() 
        external view returns (uint256) {
        return registeredTagTypes.length;
    }
    
    /// @notice 检查标签类型是否已注册
    function isTagTypeRegistered(string calldata tagType) 
        external view returns (bool) {
        return tagSchemas[tagType].registered;
    }
    
    /// @notice 获取预定义模式定义
    function getPredefinedSchemaDefinition(string calldata tagType) 
        external view returns (string memory) {
        return _predefinedSchemas[tagType];
    }
    
    /// @notice 获取所有预定义标签类型
    function getAllPredefinedTagTypes() 
        external pure returns (string[] memory) {
        string[] memory tagTypes = new string[](6);
        tagTypes[0] = "validity";
        tagTypes[1] = "clearance";
        tagTypes[2] = "age";
        tagTypes[3] = "gender";
        tagTypes[4] = "document";
        tagTypes[5] = "geographic";
        return tagTypes;
    }
    
    /// @notice 添加新的预定义模式（仅限管理员）
    function addPredefinedSchema(
        string calldata tagType,
        string calldata schemaDefinition
    ) external onlyOwner {
        require(bytes(tagType).length > 0, "Invalid tag type");
        require(bytes(schemaDefinition).length > 0, "Invalid schema definition");
        
        _predefinedSchemas[tagType] = schemaDefinition;
    }
    
    /// @notice 更新预定义模式（仅限管理员）
    function updatePredefinedSchema(
        string calldata tagType,
        string calldata newSchemaDefinition
    ) external onlyOwner {
        require(bytes(_predefinedSchemas[tagType]).length > 0, "Tag type not found");
        require(bytes(newSchemaDefinition).length > 0, "Invalid schema definition");
        
        _predefinedSchemas[tagType] = newSchemaDefinition;
    }
    
    /// @notice 获取模式注册表合约地址
    function getSchemaRegistry() external view returns (ISchemaRegistry) {
        return _schemaRegistry;
    }
    
    /// @notice 转移所有权
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid new owner");
        owner = newOwner;
    }
}