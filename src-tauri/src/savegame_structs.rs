use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use ts_rs::TS;

use crate::farms_structs::Farms;

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
#[derive(TS)]
#[ts(export)]
pub struct CareerSavegame {
    settings: CareerSavegameSettings,
    map: CareerSavegameMap,
    introduction_help: CareerSavegameIntroductionHelp,
    statistics: CareerSavegameStatistics,
    maps_split_shape_file_ids: CareerSavegameMapsSplitShapeFileIds,
    slot_system: CareerSavegameSlotSystem,
    #[serde(rename = "mod")]
    mods: Option<Vec<CareerSavegameMod>>,
    // optional and later populated fields of farms
    pub farms: Option<Farms>,
}

impl Into<JsonValue> for CareerSavegame {
    fn into(self) -> JsonValue {
        serde_json::to_value(self).unwrap()
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
#[derive(TS)]
pub struct CareerSavegameSettings {
    savegame_name: String,
    creation_date: String,
    map_id: String,
    map_title: String,
    save_date_formatted: String,
    save_date: String,
    initial_money: u32,
    initial_loan: u32,
    economic_difficulty: String,
    has_initially_owned_farmlands: bool,
    load_default_farm: bool,
    start_with_guided_tour: bool,
    traffic_enabled: bool,
    stop_and_go_braking: bool,
    trailer_fill_limit: bool,
    automatic_motor_start_enabled: bool,
    growth_mode: u8,
    planned_days_per_period: u8,
    fruit_destruction: bool,
    plowing_required_enabled: bool,
    stones_enabled: bool,
    weeds_enabled: bool,
    lime_required: bool,
    is_snow_enabled: bool,
    fuel_usage: u8,
    helper_buy_fuel: bool,
    helper_buy_seeds: bool,
    helper_buy_fertilizer: bool,
    helper_slurry_source: u8,
    helper_manure_source: u8,
    density_map_revision: u8,
    terrain_texture_revision: u8,
    terrain_lod_texture_revision: u8,
    split_shapes_revision: u8,
    tip_collision_revision: u8,
    placement_collision_revision: u8,
    navigation_collision_revision: u8,
    map_density_map_revision: u8,
    map_terrain_texture_revision: u8,
    map_terrain_lod_texture_revision: u8,
    map_split_shapes_revision: u8,
    map_tip_collision_revision: u8,
    map_placement_collision_revision: u8,
    map_navigation_collision_revision: u8,
    disaster_destruction_state: String,
    dirt_interval: u8,
    time_scale: f64,
    auto_save_interval: f64,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
#[derive(TS)]
pub struct CareerSavegameMap {
    found_help_icons: String,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
#[derive(TS)]
pub struct CareerSavegameIntroductionHelp {
    active: bool,
    shown_elements: Option<String>,
    shown_hints: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
#[derive(TS)]
pub struct CareerSavegameStatistics {
    money: u32,
    play_time: f64,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
#[derive(TS)]
pub struct CareerSavegameMapsSplitShapeFileIds {
    count: u8,
    id: Vec<CareerSavegameId>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
#[derive(TS)]
pub struct CareerSavegameId {
    id: u8,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
#[derive(TS)]
pub struct CareerSavegameSlotSystem {
    slot_usage: u32,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
#[derive(TS)]
pub struct CareerSavegameMod {
    mod_name: String,
    title: String,
    version: String,
    required: bool,
    file_hash: String,
}
