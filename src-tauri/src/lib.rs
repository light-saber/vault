pub mod git;
pub mod search;
pub mod settings;
pub mod vault;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            settings::get_settings,
            settings::update_settings,
            vault::create_vault,
            vault::open_vault,
            vault::list_vault,
            vault::get_entry,
            vault::read_note,
            vault::save_note_content,
            vault::save_note_frontmatter,
            vault::create_note,
            vault::delete_note,
            vault::rename_note,
            search::search_vault,
            git::git_status,
            git::git_log,
            git::git_file_log,
            git::git_diff,
            git::git_commit,
            git::git_sync,
            git::git_has_remote,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Vault");
}
