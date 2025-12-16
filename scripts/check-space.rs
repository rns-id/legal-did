// 这是一个伪代码，用于理解空间计算
// Rust 端 try_calculate_account_len 的计算方式：

// 基础 Mint 大小: 82 bytes
// Account Type: 1 byte (在 Mint 数据之后)
// 扩展数据从 offset 166 开始 (82 + 1 + padding to 166)

// 每个扩展的格式: [type: 2 bytes][length: 2 bytes][data: variable]

// NonTransferable: type=9, length=0, data=0 bytes → 4 bytes total
// PermanentDelegate: type=12, length=32, data=32 bytes → 36 bytes total
// MetadataPointer: type=18, length=64, data=64 bytes → 68 bytes total

// 总计: 166 (base) + 4 + 36 + 68 = 274 bytes

// 这与 JS 端的 getMintLen([NonTransferable, PermanentDelegate, MetadataPointer]) = 274 一致
