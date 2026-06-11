use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

/// App settings persisted at ~/.config/com.vault.app/settings.json (PRD 6.1.3).
#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub vault_path: Option<String>,
    pub editor_mode: Option<String>,
    pub zoom: Option<f64>,
    pub auto_git_minutes: Option<u64>,
    pub auto_sync_minutes: Option<u64>,
    pub last_note: Option<String>,
    pub inspector_open: Option<bool>,
}

fn settings_file() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("cannot resolve home directory")?;
    Ok(home.join(".config").join("com.vault.app").join("settings.json"))
}

#[tauri::command]
pub fn get_settings() -> Result<Settings, String> {
    let path = settings_file()?;
    if !path.exists() {
        return Ok(Settings::default());
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_settings(settings: Settings) -> Result<(), String> {
    let path = settings_file()?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let raw = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(&path, raw).map_err(|e| e.to_string())
}
