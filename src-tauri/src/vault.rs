use gray_matter::engine::YAML;
use gray_matter::Matter;
use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;
use walkdir::WalkDir;

use crate::git;

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct VaultEntry {
    pub path: String,
    pub title: String,
    pub note_type: Option<String>,
    pub status: Option<String>,
    pub tags: Vec<String>,
    pub snippet: String,
    pub modified: u64,
    pub created: u64,
    pub frontmatter: Value,
    pub belongs_to: Vec<String>,
    pub related_to: Vec<String>,
    pub has: Vec<String>,
    pub wikilinks: Vec<String>,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct NoteContent {
    pub frontmatter: Value,
    pub body: String,
}

/// Split raw file content into (raw frontmatter block incl. delimiters, body).
pub fn split_frontmatter_raw(content: &str) -> (Option<String>, String) {
    let normalized = content.strip_prefix('\u{feff}').unwrap_or(content);
    if !normalized.starts_with("---\n") && !normalized.starts_with("---\r\n") {
        return (None, normalized.to_string());
    }
    let first_nl = normalized.find('\n').unwrap();
    let after = &normalized[first_nl + 1..];
    let mut offset = 0usize;
    for line in after.split_inclusive('\n') {
        let trimmed = line.trim_end();
        if trimmed == "---" || trimmed == "..." {
            let header_end = first_nl + 1 + offset + line.len();
            let raw = normalized[..header_end].to_string();
            let body = normalized[header_end..].to_string();
            let body = body.strip_prefix('\n').unwrap_or(&body).to_string();
            return (Some(raw), body);
        }
        offset += line.len();
    }
    (None, normalized.to_string())
}

/// Parse a note into (frontmatter JSON, body). Never fails: on bad YAML the
/// whole file is treated as body.
pub fn parse_note(content: &str) -> (Value, String) {
    let matter = Matter::<YAML>::new();
    match matter.parse::<Value>(content) {
        Ok(parsed) => {
            let fm = parsed.data.unwrap_or(Value::Null);
            let fm = if fm.is_object() { fm } else { Value::Null };
            (fm, parsed.content)
        }
        Err(_) => {
            let (_, body) = split_frontmatter_raw(content);
            (Value::Null, body)
        }
    }
}

/// Extract `[[wikilink]]` targets from text. Aliases (`[[Target|label]]`) and
/// heading refs (`[[Target#section]]`) resolve to the target note.
pub fn extract_wikilinks(text: &str) -> Vec<String> {
    let mut links = Vec::new();
    let bytes = text.as_bytes();
    let mut i = 0;
    while i + 1 < bytes.len() {
        if bytes[i] == b'[' && bytes[i + 1] == b'[' {
            if let Some(end) = text[i + 2..].find("]]") {
                let inner = &text[i + 2..i + 2 + end];
                let target = strip_wikilink(inner);
                if !target.is_empty() && !links.contains(&target) {
                    links.push(target);
                }
                i += 2 + end + 2;
                continue;
            }
        }
        i += 1;
    }
    links
}

/// Normalize a wikilink value: strips `[[ ]]`, alias and heading suffixes.
pub fn strip_wikilink(raw: &str) -> String {
    let s = raw.trim();
    let s = s.strip_prefix("[[").unwrap_or(s);
    let s = s.strip_suffix("]]").unwrap_or(s);
    let s = s.split('|').next().unwrap_or(s);
    let s = s.split('#').next().unwrap_or(s);
    s.trim().to_string()
}

fn fm_str(fm: &Value, key: &str) -> Option<String> {
    match fm.get(key) {
        Some(Value::String(s)) if !s.trim().is_empty() => Some(s.trim().to_string()),
        Some(Value::Number(n)) => Some(n.to_string()),
        _ => None,
    }
}

fn fm_link_list(fm: &Value, key: &str) -> Vec<String> {
    match fm.get(key) {
        Some(Value::String(s)) => {
            let t = strip_wikilink(s);
            if t.is_empty() { vec![] } else { vec![t] }
        }
        Some(Value::Array(items)) => items
            .iter()
            .filter_map(|v| v.as_str())
            .map(strip_wikilink)
            .filter(|s| !s.is_empty())
            .collect(),
        _ => vec![],
    }
}

fn fm_tags(fm: &Value) -> Vec<String> {
    match fm.get("tags") {
        Some(Value::String(s)) => s
            .split(',')
            .map(|t| t.trim().trim_start_matches('#').to_string())
            .filter(|t| !t.is_empty())
            .collect(),
        Some(Value::Array(items)) => items
            .iter()
            .filter_map(|v| v.as_str())
            .map(|t| t.trim().trim_start_matches('#').to_string())
            .filter(|t| !t.is_empty())
            .collect(),
        _ => vec![],
    }
}

/// First non-empty body line, stripped of leading markdown syntax, max ~120 chars.
pub fn make_snippet(body: &str) -> String {
    for line in body.lines() {
        let cleaned = line
            .trim_start_matches(|c: char| matches!(c, '#' | '>' | '-' | '*' | ' ' | '\t'))
            .trim();
        if cleaned.is_empty() {
            continue;
        }
        let snippet: String = cleaned.chars().take(120).collect();
        return snippet;
    }
    String::new()
}

fn timestamps(path: &Path) -> (u64, u64) {
    let meta = match fs::metadata(path) {
        Ok(m) => m,
        Err(_) => return (0, 0),
    };
    let to_ms = |t: std::io::Result<std::time::SystemTime>| -> u64 {
        t.ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0)
    };
    (to_ms(meta.modified()), to_ms(meta.created()))
}

fn resolve(vault: &str, rel: &str) -> Result<PathBuf, String> {
    let rel_path = Path::new(rel);
    if rel_path.is_absolute()
        || rel_path
            .components()
            .any(|c| matches!(c, Component::ParentDir))
    {
        return Err(format!("invalid note path: {rel}"));
    }
    Ok(Path::new(vault).join(rel_path))
}

fn write_atomic(path: &Path, content: &str) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let tmp = path.with_extension("md.tmp");
    fs::write(&tmp, content).map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())
}

pub fn build_entry(vault: &Path, abs: &Path) -> Option<VaultEntry> {
    let rel = abs.strip_prefix(vault).ok()?;
    let rel_str = rel.to_string_lossy().replace('\\', "/");
    let content = fs::read_to_string(abs).ok()?;
    let (fm, body) = parse_note(&content);
    let stem = abs.file_stem()?.to_string_lossy().to_string();
    let (modified, created) = timestamps(abs);
    Some(VaultEntry {
        title: fm_str(&fm, "title").unwrap_or(stem),
        note_type: fm_str(&fm, "type").map(|t| t.to_lowercase()),
        status: fm_str(&fm, "status"),
        tags: fm_tags(&fm),
        snippet: make_snippet(&body),
        modified,
        created,
        belongs_to: fm_link_list(&fm, "belongs_to"),
        related_to: fm_link_list(&fm, "related_to"),
        has: fm_link_list(&fm, "has"),
        wikilinks: extract_wikilinks(&body),
        frontmatter: fm,
        path: rel_str,
    })
}

#[tauri::command]
pub fn list_vault(vault: String) -> Result<Vec<VaultEntry>, String> {
    let root = PathBuf::from(&vault);
    if !root.is_dir() {
        return Err(format!("vault folder not found: {vault}"));
    }
    let mut entries = Vec::new();
    let walker = WalkDir::new(&root).into_iter().filter_entry(|e| {
        !e.file_name()
            .to_str()
            .map(|s| s.starts_with('.'))
            .unwrap_or(false)
    });
    for entry in walker.flatten() {
        if entry.file_type().is_file()
            && entry.path().extension().and_then(|e| e.to_str()) == Some("md")
        {
            if let Some(ve) = build_entry(&root, entry.path()) {
                entries.push(ve);
            }
        }
    }
    Ok(entries)
}

#[tauri::command]
pub fn get_entry(vault: String, path: String) -> Result<VaultEntry, String> {
    let abs = resolve(&vault, &path)?;
    build_entry(Path::new(&vault), &abs).ok_or_else(|| format!("cannot read note: {path}"))
}

#[tauri::command]
pub fn read_note(vault: String, path: String) -> Result<NoteContent, String> {
    let abs = resolve(&vault, &path)?;
    let content = fs::read_to_string(&abs).map_err(|e| e.to_string())?;
    let (frontmatter, body) = parse_note(&content);
    Ok(NoteContent { frontmatter, body })
}

/// Write a new body, preserving the existing raw frontmatter block untouched.
#[tauri::command]
pub fn save_note_content(vault: String, path: String, body: String) -> Result<(), String> {
    let abs = resolve(&vault, &path)?;
    let existing = fs::read_to_string(&abs).unwrap_or_default();
    let (raw_fm, _) = split_frontmatter_raw(&existing);
    let content = match raw_fm {
        Some(fm) => format!("{fm}\n{body}"),
        None => body,
    };
    write_atomic(&abs, &content)
}

/// Replace the frontmatter block, preserving the body untouched.
#[tauri::command]
pub fn save_note_frontmatter(vault: String, path: String, frontmatter: Value) -> Result<(), String> {
    let abs = resolve(&vault, &path)?;
    let existing = fs::read_to_string(&abs).map_err(|e| e.to_string())?;
    let (_, body) = split_frontmatter_raw(&existing);
    let is_empty = !frontmatter.is_object()
        || frontmatter.as_object().map(|o| o.is_empty()).unwrap_or(true);
    let content = if is_empty {
        body
    } else {
        let yaml = serde_yaml::to_string(&frontmatter).map_err(|e| e.to_string())?;
        format!("---\n{yaml}---\n\n{body}")
    };
    write_atomic(&abs, &content)
}

fn sanitize_filename(title: &str) -> String {
    let cleaned: String = title
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => ' ',
            c => c,
        })
        .collect();
    let cleaned = cleaned.trim().to_string();
    if cleaned.is_empty() {
        "Untitled".to_string()
    } else {
        cleaned
    }
}

#[tauri::command]
pub fn create_note(
    vault: String,
    title: String,
    note_type: Option<String>,
    folder: Option<String>,
) -> Result<String, String> {
    let name = sanitize_filename(&title);
    let dir = match &folder {
        Some(f) if !f.is_empty() => resolve(&vault, f)?,
        _ => PathBuf::from(&vault),
    };
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let mut candidate = dir.join(format!("{name}.md"));
    let mut n = 2;
    while candidate.exists() {
        candidate = dir.join(format!("{name} {n}.md"));
        n += 1;
    }
    let content = match note_type {
        Some(t) if !t.is_empty() && t != "note" => format!("---\ntype: {t}\n---\n\n"),
        _ => String::new(),
    };
    write_atomic(&candidate, &content)?;
    Ok(candidate
        .strip_prefix(&vault)
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .replace('\\', "/"))
}

#[tauri::command]
pub fn delete_note(vault: String, path: String) -> Result<(), String> {
    let abs = resolve(&vault, &path)?;
    fs::remove_file(&abs).map_err(|e| e.to_string())
}

/// Rename the file to match a new title; updates the frontmatter `title` if set.
#[tauri::command]
pub fn rename_note(vault: String, path: String, new_title: String) -> Result<String, String> {
    let abs = resolve(&vault, &path)?;
    let name = sanitize_filename(&new_title);
    let dir = abs.parent().ok_or("invalid path")?.to_path_buf();
    let mut target = dir.join(format!("{name}.md"));
    let mut n = 2;
    while target.exists() && target != abs {
        target = dir.join(format!("{name} {n}.md"));
        n += 1;
    }
    if target != abs {
        fs::rename(&abs, &target).map_err(|e| e.to_string())?;
    }
    let content = fs::read_to_string(&target).map_err(|e| e.to_string())?;
    let (fm, _) = parse_note(&content);
    if fm.get("title").is_some() {
        let mut fm = fm;
        fm["title"] = Value::String(new_title.clone());
        let rel = target
            .strip_prefix(&vault)
            .map_err(|e| e.to_string())?
            .to_string_lossy()
            .replace('\\', "/");
        save_note_frontmatter(vault.clone(), rel.clone(), fm)?;
        return Ok(rel);
    }
    Ok(target
        .strip_prefix(&vault)
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .replace('\\', "/"))
}

const BUILTIN_TYPES: &[(&str, &str, &str, &str)] = &[
    ("note", "Note", "file-text", "gray"),
    ("project", "Project", "briefcase", "blue"),
    ("person", "Person", "user", "green"),
    ("event", "Event", "calendar", "orange"),
    ("topic", "Topic", "hash", "purple"),
];

fn write_builtin_types(root: &Path) -> Result<(), String> {
    for (slug, label, icon, color) in BUILTIN_TYPES {
        let content = format!(
            "---\ntitle: {label}\ntype: type\nicon: {icon}\ncolor: {color}\n---\n\nNotes with `type: {slug}` in their frontmatter appear under **{label}** in the sidebar.\n"
        );
        write_atomic(&root.join("type").join(format!("{slug}.md")), &content)?;
    }
    Ok(())
}

fn write_sample_notes(root: &Path) -> Result<(), String> {
    let samples: &[(&str, &str)] = &[
        (
            "Welcome.md",
            "---\ntitle: Welcome to Vault\ntags:\n  - meta\n---\n\nVault is a local-first knowledge base. Every note is a plain Markdown file in this folder, and the whole vault is a git repository.\n\nStart with [[Getting Started]], or explore an example project: [[Build a Second Brain]].\n\n- Press `Cmd+K` for the command palette\n- Press `Cmd+P` to jump to any note\n- Press `Cmd+N` to create a note\n- Type `[[` in the editor to link notes together\n",
        ),
        (
            "Notes/Getting Started.md",
            "---\ntitle: Getting Started\ntags:\n  - meta\n---\n\n## How Vault organises notes\n\nNotes have no required structure. Optional YAML frontmatter adds metadata:\n\n- `type` groups notes in the sidebar (see the `type/` folder)\n- `status` shows a chip in the note list\n- `belongs_to`, `related_to` and `has` describe relationships\n\n## Relationships\n\nThis note is related to [[Build a Second Brain]]. Open the Inspector (`Cmd+I`) to see backlinks and metadata for any note.\n\n## Git\n\nEvery change is auto-committed after a few minutes of inactivity. Press `Cmd+Shift+G` to commit manually, and check the Pulse view for history.\n",
        ),
        (
            "Projects/Build a Second Brain.md",
            "---\ntitle: Build a Second Brain\ntype: project\nstatus: active\ntags:\n  - pkm\nrelated_to:\n  - \"[[Knowledge Management]]\"\nhas:\n  - \"[[Getting Started]]\"\n---\n\nAn example project note. Track tasks, link related people like [[Ada Lovelace]], and keep everything connected.\n\n- [ ] Capture ideas as notes\n- [ ] Link liberally with `[[` wikilinks\n- [ ] Review the graph of backlinks weekly\n",
        ),
        (
            "People/Ada Lovelace.md",
            "---\ntitle: Ada Lovelace\ntype: person\nurl: https://en.wikipedia.org/wiki/Ada_Lovelace\ntags:\n  - history\nrelated_to:\n  - \"[[Knowledge Management]]\"\n---\n\nAn example person note. Person notes collect everything about someone — meetings, ideas, shared projects like [[Build a Second Brain]].\n",
        ),
        (
            "Events/Vault Kickoff.md",
            "---\ntitle: Vault Kickoff\ntype: event\nstatus: done\nstart_date: 2026-06-11\nbelongs_to: \"[[Build a Second Brain]]\"\n---\n\nAn example event note with a date range and a parent project.\n",
        ),
        (
            "Topics/Knowledge Management.md",
            "---\ntitle: Knowledge Management\ntype: topic\ntags:\n  - pkm\n---\n\nA topic note acts as a hub. Backlinks from [[Build a Second Brain]] and [[Ada Lovelace]] show up in the Inspector automatically.\n",
        ),
    ];
    for (rel, content) in samples {
        write_atomic(&root.join(rel), content)?;
    }
    Ok(())
}

#[tauri::command]
pub fn create_vault(path: String, with_sample: bool) -> Result<(), String> {
    let root = PathBuf::from(&path);
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    if !root.join(".git").exists() {
        git::run(&path, &["init", "-b", "main"])?;
    }
    fs::write(root.join(".gitignore"), ".DS_Store\n").map_err(|e| e.to_string())?;
    write_builtin_types(&root)?;
    if with_sample {
        write_sample_notes(&root)?;
    }
    git::commit_all(&path, "Initialize vault")?;
    Ok(())
}

#[tauri::command]
pub fn open_vault(path: String) -> Result<(), String> {
    let root = PathBuf::from(&path);
    if !root.is_dir() {
        return Err(format!("folder not found: {path}"));
    }
    if !root.join(".git").exists() {
        git::run(&path, &["init", "-b", "main"])?;
        git::commit_all(&path, "Initialize vault")?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_frontmatter_and_body() {
        let (fm, body) = parse_note("---\ntitle: Hello\ntags:\n  - a\n---\n\nBody text");
        assert_eq!(fm["title"], "Hello");
        assert_eq!(fm_tags(&fm), vec!["a"]);
        assert_eq!(body.trim(), "Body text");
    }

    #[test]
    fn handles_missing_frontmatter() {
        let (fm, body) = parse_note("Just text");
        assert!(fm.is_null());
        assert_eq!(body, "Just text");
    }

    #[test]
    fn extracts_wikilinks_with_aliases() {
        let links = extract_wikilinks("See [[Note A]] and [[Note B|alias]] plus [[Note A]] again, [[C#heading]].");
        assert_eq!(links, vec!["Note A", "Note B", "C"]);
    }

    #[test]
    fn normalizes_relation_values() {
        let fm: Value =
            serde_json::from_str(r#"{"belongs_to": "[[Parent]]", "related_to": ["[[A]]", "B"]}"#)
                .unwrap();
        assert_eq!(fm_link_list(&fm, "belongs_to"), vec!["Parent"]);
        assert_eq!(fm_link_list(&fm, "related_to"), vec!["A", "B"]);
    }

    #[test]
    fn snippet_strips_markdown() {
        assert_eq!(make_snippet("\n\n## Heading line\nrest"), "Heading line");
    }

    #[test]
    fn splits_raw_frontmatter_preserving_block() {
        let (raw, body) = split_frontmatter_raw("---\ntitle: X\n---\n\nbody");
        assert_eq!(raw.unwrap(), "---\ntitle: X\n---\n");
        assert_eq!(body, "body");
    }
}
