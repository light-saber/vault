use std::fs;

fn temp_vault(name: &str) -> String {
    let dir = std::env::temp_dir().join(format!("vault-test-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    dir.to_string_lossy().to_string()
}

#[test]
fn full_vault_lifecycle() {
    let vault = temp_vault("lifecycle");

    // Create a sample vault: git repo + builtin types + sample notes.
    vault_lib::vault::create_vault(vault.clone(), true).expect("create_vault");
    assert!(std::path::Path::new(&vault).join(".git").is_dir());

    // The initial commit captured everything.
    let log = vault_lib::git::git_log(vault.clone(), 0, 10).expect("git_log");
    assert_eq!(log.len(), 1);
    assert_eq!(log[0].message, "Initialize vault");
    assert!(log[0].files.iter().any(|f| f == "Welcome.md"));

    // Listing finds type definitions and sample notes with parsed frontmatter.
    let entries = vault_lib::vault::list_vault(vault.clone()).expect("list_vault");
    assert!(entries.len() >= 10);
    let project = entries
        .iter()
        .find(|e| e.title == "Build a Second Brain")
        .expect("sample project note");
    assert_eq!(project.note_type.as_deref(), Some("project"));
    assert_eq!(project.status.as_deref(), Some("active"));
    assert!(project.related_to.contains(&"Knowledge Management".to_string()));
    assert!(project.wikilinks.contains(&"Ada Lovelace".to_string()));
    assert_eq!(
        entries.iter().filter(|e| e.note_type.as_deref() == Some("type")).count(),
        5
    );

    // Create, edit and rename a note; frontmatter block survives body saves.
    let path = vault_lib::vault::create_note(
        vault.clone(),
        "Field Journal".into(),
        Some("project".into()),
        None,
    )
    .expect("create_note");
    vault_lib::vault::save_note_content(
        vault.clone(),
        path.clone(),
        "First observation about [[Welcome to Vault]].".into(),
    )
    .expect("save body");
    let note = vault_lib::vault::read_note(vault.clone(), path.clone()).expect("read_note");
    assert_eq!(note.frontmatter["type"], "project");
    assert!(note.body.contains("[[Welcome to Vault]]"));

    let renamed =
        vault_lib::vault::rename_note(vault.clone(), path, "Trail Notes".into()).expect("rename");
    assert!(renamed.ends_with("Trail Notes.md"));

    // Frontmatter edits preserve the body.
    let mut fm = vault_lib::vault::read_note(vault.clone(), renamed.clone())
        .unwrap()
        .frontmatter;
    fm["status"] = serde_json::json!("active");
    vault_lib::vault::save_note_frontmatter(vault.clone(), renamed.clone(), fm).expect("save fm");
    let note = vault_lib::vault::read_note(vault.clone(), renamed.clone()).unwrap();
    assert_eq!(note.frontmatter["status"], "active");
    assert!(note.body.contains("First observation"));

    // Search ranks the title match for "trail" first; body matches also found.
    let results = vault_lib::search::search_vault(vault.clone(), "trail".into()).expect("search");
    assert_eq!(results[0].title, "Trail Notes");
    let results =
        vault_lib::search::search_vault(vault.clone(), "observation".into()).expect("search body");
    assert!(results.iter().any(|r| r.path == renamed));
    assert!(results[0].snippet.contains("observation"));

    // Status sees the new file; commit cleans the tree; file history exists.
    let status = vault_lib::git::git_status(vault.clone()).expect("status");
    assert!(status.iter().any(|f| f.path.ends_with("Trail Notes.md")));
    let committed = vault_lib::git::git_commit(vault.clone(), "Updated 1 note(s)".into()).unwrap();
    assert!(committed);
    assert!(vault_lib::git::git_status(vault.clone()).unwrap().is_empty());
    let file_log = vault_lib::git::git_file_log(vault.clone(), renamed, 10).unwrap();
    assert_eq!(file_log.len(), 1);

    // No remote configured → sync reports noRemote.
    let sync = vault_lib::git::git_sync(vault.clone()).unwrap();
    assert_eq!(sync.state, "noRemote");

    let _ = fs::remove_dir_all(&vault);
}
