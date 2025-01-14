use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use ts_rs::TS;

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
#[derive(TS)]
#[ts(export)]
pub struct Farms {
    #[serde(rename = "farm")]
    farms: Vec<FarmsFarm>,
}

impl Into<JsonValue> for Farms {
    fn into(self) -> JsonValue {
        serde_json::to_value(self).unwrap()
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
#[derive(TS)]
pub struct FarmsFarm {
    #[serde(rename = "farmId")]
    farm_id: u32,
    name: String,
    color: u32,
    loan: f64,
    money: f64,
    players: FarmsPlayers,
    statistics: FarmsStatistics,
    finances: FarmsFinances,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
#[derive(TS)]
pub struct FarmsPlayers {
    #[serde(rename = "player")]
    players: Vec<FarmsPlayer>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
#[derive(TS)]
pub struct FarmsPlayer {
    unique_user_id: String,
    farm_manager: bool,
    last_nickname: String,
    time_last_connected: String,
    buy_vehicle: bool,
    sell_vehicle: bool,
    buy_placeable: bool,
    sell_placeable: bool,
    manage_contracts: bool,
    trade_animals: bool,
    create_fields: bool,
    landscaping: bool,
    hire_assistant: bool,
    reset_vehicle: bool,
    manage_productions: bool,
    cut_trees: bool,
    manage_rights: bool,
    transfer_money: bool,
    update_farm: bool,
    manage_contracting: bool,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
#[derive(TS)]
pub struct FarmsStatistics {
    traveled_distance: f64,
    fuel_usage: f64,
    seed_usage: f64,
    spray_usage: f64,
    worked_hectares: f64,
    cultivated_hectares: f64,
    sown_hectares: f64,
    sprayed_hectares: f64,
    threshed_hectares: f64,
    plowed_hectares: f64,
    harvested_grapes: f64,
    harvested_olives: f64,
    worked_time: f64,
    cultivated_time: f64,
    sown_time: f64,
    sprayed_time: f64,
    threshed_time: f64,
    plowed_time: f64,
    bale_count: u32,
    breed_cows_count: u32,
    breed_sheep_count: u32,
    breed_pigs_count: u32,
    breed_chicken_count: u32,
    breed_horses_count: u32,
    breed_goats_count: u32,
    breed_water_buffalo_count: u32,
    mission_count: u32,
    revenue: f64,
    expenses: f64,
    play_time: f64,
    planted_tree_count: u32,
    cut_tree_count: u32,
    wood_tons_sold: f64,
    tree_types_cut: String,
    pet_dog_count: u32,
    repair_vehicle_count: u32,
    repaint_vehicle_count: u32,
    horse_jump_count: u32,
    sold_cotton_bales: u32,
    wrapped_bales: u32,
    tractor_distance: f64,
    car_distance: f64,
    truck_distance: f64,
    horse_distance: f64,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
#[derive(TS)]
pub struct FarmsFinances {
    #[serde(rename = "stats")]
    stats: Vec<FarmsStats>,
}

#[derive(Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
#[derive(TS)]
pub struct FarmsStats {
    day: u32,
    new_vehicles_cost: f64,
    sold_vehicles: f64,
    new_handtools_cost: f64,
    sold_handtools: f64,
    new_animals_cost: f64,
    sold_animals: f64,
    construction_cost: f64,
    sold_buildings: f64,
    field_purchase: f64,
    field_selling: f64,
    vehicle_running_cost: f64,
    vehicle_leasing_cost: f64,
    property_maintenance: f64,
    property_income: f64,
    production_costs: f64,
    sold_wood: f64,
    sold_bales: f64,
    sold_wool: f64,
    sold_milk: f64,
    sold_products: f64,
    purchase_fuel: f64,
    purchase_seeds: f64,
    purchase_fertilizer: f64,
    purchase_saplings: f64,
    purchase_water: f64,
    purchase_bales: f64,
    purchase_pallets: f64,
    harvest_income: f64,
    income_bga: f64,
    mission_income: f64,
    wage_payment: f64,
    other: f64,
    loan_interest: f64,
}
