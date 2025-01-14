use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Config {
    pub savegame_mapping: std::collections::HashMap<String, String>,
    pub game_data_directory: String,
    pub team_id: Option<String>,
    pub invite_code: Option<String>,
    pub name: Option<String>,
    pub lang: Option<String>,
}

impl Into<JsonValue> for Config {
    fn into(self) -> JsonValue {
        serde_json::to_value(self).unwrap()
    }
}
