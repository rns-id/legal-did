use sha2::{Digest, Sha256};

/// Convert hex string to [u8; 32]
pub fn hex_to_bytes32(hex_str: &str) -> [u8; 32] {
    let mut result = [0u8; 32];
    let hex_str = hex_str.trim_start_matches("0x");

    if hex_str.len() >= 64 {
        for i in 0..32 {
            if let Ok(byte) = u8::from_str_radix(&hex_str[i * 2..i * 2 + 2], 16) {
                result[i] = byte;
            }
        }
    } else {
        // If not valid hex, use hash
        let mut hasher = Sha256::new();
        hasher.update(hex_str.as_bytes());
        let hash = hasher.finalize();
        result.copy_from_slice(&hash[..32]);
    }
    result
}
