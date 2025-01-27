use serde::{Deserialize, Serialize};
use serde_json::Value;
use ts_rs::TS;

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
#[derive(TS)]
#[ts(export)]
pub struct ModDesc {
    desc_version: u32,
    author: String,
    version: String,
    title: ModDescTitle,
    description: ModDescDescription,
    icon_filename: String,
    multiplayer: ModDescMultiplayer,
    store_items: ModDescStoreItems,
    extra_source_files: ModDescExtraSourceFiles,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
#[derive(TS)]
pub struct ModDescTitle {
    languages: std::collections::HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
#[derive(TS)]
pub struct ModDescDescription {
    languages: std::collections::HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
#[derive(TS)]
pub struct ModDescMultiplayer {
    supported: bool,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
#[derive(TS)]
pub struct ModDescStoreItems {
    store_items: Vec<ModDescStoreItem>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
#[derive(TS)]
pub struct ModDescStoreItem {
    xml_filename: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
#[derive(TS)]
pub struct ModDescExtraSourceFiles {
    source_file: Vec<ModDescExtraSourceFile>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
#[derive(TS)]
pub struct ModDescExtraSourceFile {
    filename: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CachedModDescriptions {
    pub mods: Vec<CachedModDesc>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CachedModDesc {
    pub mods: SimplifiedModDesc,
    pub filename: String,
    pub modified_at: u32,
}

#[derive(Serialize, Deserialize, Debug, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SimplifiedModDesc {
    pub filename: String,
    pub version: String,
    pub mod_name: String,
    pub titles: Value,
    pub description: Value,
}
