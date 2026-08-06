//! Binary analysis and reverse-engineering tools ported from nestlone.
//!
//! Provides hex dump, string extraction, base64/hex encoding, and TEA
//! decryption as native Rust tools. Frida integration is handled via
//! the shell tool (frida-inject CLI).

use std::fs;
use std::path::Path;

use async_trait::async_trait;
use base64::Engine;
use serde_json::{Value, json};

use super::spec::{
    ApprovalRequirement, ToolCapability, ToolContext, ToolError, ToolResult, ToolSpec,
    optional_u64, required_str,
};

// ── hex_dump ──────────────────────────────────────────────────────────

pub struct HexDumpTool;

#[async_trait]
impl ToolSpec for HexDumpTool {
    fn name(&self) -> &'static str {
        "hex_dump"
    }

    fn description(&self) -> &'static str {
        "Hex dump a file with ASCII sidebar. Provide path and optional length (default 256) and offset (default 0)."
    }

    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Path to the file within the workspace."
                },
                "length": {
                    "type": "integer",
                    "default": 256,
                    "description": "Number of bytes to dump."
                },
                "offset": {
                    "type": "integer",
                    "default": 0,
                    "description": "Byte offset to start reading from."
                }
            },
            "required": ["path"],
            "additionalProperties": false
        })
    }

    fn capabilities(&self) -> Vec<ToolCapability> {
        vec![ToolCapability::ReadOnly]
    }

    fn approval_requirement(&self) -> ApprovalRequirement {
        ApprovalRequirement::Auto
    }

    fn supports_parallel(&self) -> bool {
        true
    }

    async fn execute(&self, input: Value, context: &ToolContext) -> Result<ToolResult, ToolError> {
        let path_str = required_str(&input, "path")?;
        let length = optional_u64(&input, "length", 256) as usize;
        let offset = optional_u64(&input, "offset", 0) as usize;

        let resolved = context.resolve_path(path_str)?;
        let data = read_file_bytes(&resolved, offset, length)?;
        let hex = render_hex_dump(&data, offset);

        ToolResult::json(&json!({
            "path": path_str,
            "offset": offset,
            "length": data.len(),
            "hex_dump": hex,
        }))
        .map_err(|e| ToolError::execution_failed(e.to_string()))
    }
}

fn read_file_bytes(path: &Path, offset: usize, length: usize) -> Result<Vec<u8>, ToolError> {
    let full = fs::read(path).map_err(|e| {
        ToolError::execution_failed(format!("Failed to read {}: {e}", path.display()))
    })?;
    let available = full.len().saturating_sub(offset);
    if available == 0 {
        return Err(ToolError::invalid_input(format!(
            "Offset {offset} is beyond file length {}",
            full.len()
        )));
    }
    let end = (offset + length).min(full.len());
    Ok(full[offset..end].to_vec())
}

fn render_hex_dump(data: &[u8], base_offset: usize) -> String {
    let mut lines = Vec::new();
    for (i, chunk) in data.chunks(16).enumerate() {
        let addr = base_offset + i * 16;
        let hex_part: String = chunk
            .iter()
            .map(|b| format!("{b:02x}"))
            .collect::<Vec<_>>()
            .join(" ");
        let ascii_part: String = chunk
            .iter()
            .map(|&b| {
                if b.is_ascii_graphic() || b == b' ' {
                    b as char
                } else {
                    '.'
                }
            })
            .collect();
        lines.push(format!("{addr:08x}  {hex_part:<48}  {ascii_part}"));
    }
    lines.join("\n")
}

// ── extract_strings ───────────────────────────────────────────────────

pub struct ExtractStringsTool;

#[async_trait]
impl ToolSpec for ExtractStringsTool {
    fn name(&self) -> &'static str {
        "extract_strings"
    }

    fn description(&self) -> &'static str {
        "Extract printable ASCII/UTF-8 strings from a binary file. Provide path and optional min_length (default 4)."
    }

    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Path to the file within the workspace."
                },
                "min_length": {
                    "type": "integer",
                    "default": 4,
                    "description": "Minimum string length to include."
                }
            },
            "required": ["path"],
            "additionalProperties": false
        })
    }

    fn capabilities(&self) -> Vec<ToolCapability> {
        vec![ToolCapability::ReadOnly]
    }

    fn approval_requirement(&self) -> ApprovalRequirement {
        ApprovalRequirement::Auto
    }

    fn supports_parallel(&self) -> bool {
        true
    }

    async fn execute(&self, input: Value, context: &ToolContext) -> Result<ToolResult, ToolError> {
        let path_str = required_str(&input, "path")?;
        let min_len = optional_u64(&input, "min_length", 4) as usize;

        let resolved = context.resolve_path(path_str)?;
        let data = fs::read(&resolved).map_err(|e| {
            ToolError::execution_failed(format!("Failed to read {}: {e}", resolved.display()))
        })?;

        let strings = extract_printable_strings(&data, min_len);
        let count = strings.len();
        let output = strings.join("\n");

        ToolResult::json(&json!({
            "path": path_str,
            "min_length": min_len,
            "count": count,
            "strings": output,
        }))
        .map_err(|e| ToolError::execution_failed(e.to_string()))
    }
}

fn extract_printable_strings(data: &[u8], min_len: usize) -> Vec<String> {
    let mut strings = Vec::new();
    let mut current = Vec::new();

    for &byte in data {
        if byte.is_ascii_graphic() || byte == b' ' {
            current.push(byte);
        } else {
            if current.len() >= min_len {
                if let Ok(s) = String::from_utf8(current.clone()) {
                    strings.push(s);
                }
            }
            current.clear();
        }
    }
    if current.len() >= min_len {
        if let Ok(s) = String::from_utf8(current) {
            strings.push(s);
        }
    }
    strings
}

// ── base64_decode ─────────────────────────────────────────────────────

pub struct Base64DecodeTool;

#[async_trait]
impl ToolSpec for Base64DecodeTool {
    fn name(&self) -> &'static str {
        "base64_decode"
    }

    fn description(&self) -> &'static str {
        "Decode a base64-encoded string to UTF-8 text."
    }

    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "data": {
                    "type": "string",
                    "description": "Base64-encoded string to decode."
                }
            },
            "required": ["data"],
            "additionalProperties": false
        })
    }

    fn capabilities(&self) -> Vec<ToolCapability> {
        vec![ToolCapability::ReadOnly]
    }

    fn approval_requirement(&self) -> ApprovalRequirement {
        ApprovalRequirement::Auto
    }

    fn supports_parallel(&self) -> bool {
        true
    }

    async fn execute(&self, input: Value, _context: &ToolContext) -> Result<ToolResult, ToolError> {
        let data = required_str(&input, "data")?;

        let decoded = base64::engine::general_purpose::STANDARD
            .decode(data.as_bytes())
            .map_err(|e| ToolError::invalid_input(format!("Base64 decode failed: {e}")))?;

        let text = String::from_utf8(decoded)
            .map_err(|e| ToolError::execution_failed(format!("UTF-8 conversion failed: {e}")))?;

        Ok(ToolResult::success(text))
    }
}

// ── base64_encode ─────────────────────────────────────────────────────

pub struct Base64EncodeTool;

#[async_trait]
impl ToolSpec for Base64EncodeTool {
    fn name(&self) -> &'static str {
        "base64_encode"
    }

    fn description(&self) -> &'static str {
        "Encode a UTF-8 string to base64."
    }

    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "data": {
                    "type": "string",
                    "description": "Text to base64-encode."
                }
            },
            "required": ["data"],
            "additionalProperties": false
        })
    }

    fn capabilities(&self) -> Vec<ToolCapability> {
        vec![ToolCapability::ReadOnly]
    }

    fn approval_requirement(&self) -> ApprovalRequirement {
        ApprovalRequirement::Auto
    }

    fn supports_parallel(&self) -> bool {
        true
    }

    async fn execute(&self, input: Value, _context: &ToolContext) -> Result<ToolResult, ToolError> {
        let data = required_str(&input, "data")?;
        let encoded = base64::engine::general_purpose::STANDARD.encode(data.as_bytes());
        Ok(ToolResult::success(encoded))
    }
}

// ── hex_decode ────────────────────────────────────────────────────────

pub struct HexDecodeTool;

#[async_trait]
impl ToolSpec for HexDecodeTool {
    fn name(&self) -> &'static str {
        "hex_decode"
    }

    fn description(&self) -> &'static str {
        "Decode a hex string to UTF-8 text."
    }

    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "hex_str": {
                    "type": "string",
                    "description": "Hex string to decode."
                }
            },
            "required": ["hex_str"],
            "additionalProperties": false
        })
    }

    fn capabilities(&self) -> Vec<ToolCapability> {
        vec![ToolCapability::ReadOnly]
    }

    fn approval_requirement(&self) -> ApprovalRequirement {
        ApprovalRequirement::Auto
    }

    fn supports_parallel(&self) -> bool {
        true
    }

    async fn execute(&self, input: Value, _context: &ToolContext) -> Result<ToolResult, ToolError> {
        let hex_str = required_str(&input, "hex_str")?;
        let cleaned: String = hex_str.chars().filter(|c| !c.is_whitespace()).collect();
        let bytes = hex::decode(&cleaned)
            .map_err(|e| ToolError::invalid_input(format!("Hex decode failed: {e}")))?;
        let text = String::from_utf8(bytes)
            .map_err(|e| ToolError::execution_failed(format!("UTF-8 conversion failed: {e}")))?;
        Ok(ToolResult::success(text))
    }
}

// ── tea_decrypt ───────────────────────────────────────────────────────

pub struct TeaDecryptTool;

const TEA_DELTA: u32 = 0x9E37_79B9;

#[async_trait]
impl ToolSpec for TeaDecryptTool {
    fn name(&self) -> &'static str {
        "tea_decrypt"
    }

    fn description(&self) -> &'static str {
        "TEA (Tiny Encryption Algorithm) decrypt hex-encoded data with a 16-byte hex key. Returns hex-encoded plaintext."
    }

    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "key_hex": {
                    "type": "string",
                    "description": "16-byte key as a hex string (32 hex characters)."
                },
                "data_hex": {
                    "type": "string",
                    "description": "Ciphertext as a hex string to decrypt."
                }
            },
            "required": ["key_hex", "data_hex"],
            "additionalProperties": false
        })
    }

    fn capabilities(&self) -> Vec<ToolCapability> {
        vec![ToolCapability::ReadOnly]
    }

    fn approval_requirement(&self) -> ApprovalRequirement {
        ApprovalRequirement::Auto
    }

    fn supports_parallel(&self) -> bool {
        true
    }

    async fn execute(&self, input: Value, _context: &ToolContext) -> Result<ToolResult, ToolError> {
        let key_hex = required_str(&input, "key_hex")?;
        let data_hex = required_str(&input, "data_hex")?;

        let key = hex::decode(key_hex)
            .map_err(|e| ToolError::invalid_input(format!("Invalid key hex: {e}")))?;
        if key.len() != 16 {
            return Err(ToolError::invalid_input(format!(
                "Key must be 16 bytes, got {} bytes",
                key.len()
            )));
        }

        let mut data = hex::decode(data_hex)
            .map_err(|e| ToolError::invalid_input(format!("Invalid data hex: {e}")))?;

        // Pad to 8-byte boundary
        let pad = (8 - data.len() % 8) % 8;
        data.resize(data.len() + pad, 0);

        let k: Vec<u32> = key
            .chunks_exact(4)
            .map(|c| u32::from_le_bytes(c.try_into().unwrap()))
            .collect();

        let mut result = Vec::with_capacity(data.len());
        for chunk in data.chunks_exact(8) {
            let mut v0 = u32::from_le_bytes(chunk[0..4].try_into().unwrap());
            let mut v1 = u32::from_le_bytes(chunk[4..8].try_into().unwrap());

            let mut sum = TEA_DELTA.wrapping_mul(32);
            for _ in 0..32 {
                v1 = v1.wrapping_sub(
                    ((v0 << 4).wrapping_add(k[2]))
                        ^ (v0.wrapping_add(sum))
                        ^ ((v0 >> 5).wrapping_add(k[3])),
                );
                v0 = v0.wrapping_sub(
                    ((v1 << 4).wrapping_add(k[0]))
                        ^ (v1.wrapping_add(sum))
                        ^ ((v1 >> 5).wrapping_add(k[1])),
                );
                sum = sum.wrapping_sub(TEA_DELTA);
            }

            result.extend_from_slice(&v0.to_le_bytes());
            result.extend_from_slice(&v1.to_le_bytes());
        }

        Ok(ToolResult::success(hex::encode(&result)))
    }
}

// ── Tests ─────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn hex_dump_basic() {
        let tmp = tempdir().expect("tempdir");
        let ctx = ToolContext::new(tmp.path());
        let data = [0x00, 0x01, 0x02, 0x48, 0x65, 0x6c, 0x6c, 0x6f];
        fs::write(tmp.path().join("test.bin"), data).expect("write");

        let result = HexDumpTool
            .execute(json!({"path": "test.bin", "length": 8}), &ctx)
            .await
            .expect("execute");
        assert!(result.success);
        assert!(result.content.contains("00000000"));
        assert!(result.content.contains("Hello"));
    }

    #[tokio::test]
    async fn hex_dump_offset() {
        let tmp = tempdir().expect("tempdir");
        let ctx = ToolContext::new(tmp.path());
        fs::write(tmp.path().join("test.bin"), &[0u8; 100]).expect("write");

        let result = HexDumpTool
            .execute(
                json!({"path": "test.bin", "offset": 80, "length": 16}),
                &ctx,
            )
            .await
            .expect("execute");
        assert!(result.success);
        assert!(result.content.contains("00000050"));
    }

    #[tokio::test]
    async fn extract_strings_basic() {
        let tmp = tempdir().expect("tempdir");
        let ctx = ToolContext::new(tmp.path());
        let data = b"Hello World\x00\x00Test123\x00Secret!";
        fs::write(tmp.path().join("test.bin"), data).expect("write");

        let result = ExtractStringsTool
            .execute(json!({"path": "test.bin", "min_length": 4}), &ctx)
            .await
            .expect("execute");
        assert!(result.success);
        let content: Value = serde_json::from_str(&result.content).expect("json");
        assert!(content["strings"].as_str().unwrap().contains("Hello World"));
    }

    #[tokio::test]
    async fn base64_encode_decode_roundtrip() {
        let tmp = tempdir().expect("tempdir");
        let ctx = ToolContext::new(tmp.path());

        let encoded = Base64EncodeTool
            .execute(json!({"data": "hello world"}), &ctx)
            .await
            .expect("encode");
        assert!(encoded.success);

        let decoded = Base64DecodeTool
            .execute(json!({"data": encoded.content.trim()}), &ctx)
            .await
            .expect("decode");
        assert_eq!(decoded.content, "hello world");
    }

    #[tokio::test]
    async fn hex_decode_basic() {
        let tmp = tempdir().expect("tempdir");
        let ctx = ToolContext::new(tmp.path());

        let result = HexDecodeTool
            .execute(json!({"hex_str": "48656c6c6f"}), &ctx)
            .await
            .expect("execute");
        assert_eq!(result.content, "Hello");
    }

    #[tokio::test]
    async fn tea_decrypt_basic() {
        let tmp = tempdir().expect("tempdir");
        let ctx = ToolContext::new(tmp.path());

        // Known test vector: key = 16 zeros, data = 8 zeros
        let result = TeaDecryptTool
            .execute(
                json!({
                    "key_hex": "00000000000000000000000000000000",
                    "data_hex": "0000000000000000"
                }),
                &ctx,
            )
            .await
            .expect("execute");
        assert!(result.success);
        // Output should be 16 hex chars (8 bytes)
        assert_eq!(result.content.len(), 16);
    }

    #[tokio::test]
    async fn tea_decrypt_rejects_short_key() {
        let tmp = tempdir().expect("tempdir");
        let ctx = ToolContext::new(tmp.path());

        let err = TeaDecryptTool
            .execute(
                json!({
                    "key_hex": "0000",
                    "data_hex": "0000000000000000"
                }),
                &ctx,
            )
            .await
            .expect_err("should fail");
        assert!(matches!(err, ToolError::InvalidInput { .. }));
    }
}
