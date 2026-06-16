use gray_matter::engine::YAML;
use gray_matter::Matter;
use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::time::UNIX_EPOCH;
use walkdir::WalkDir;

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
    pub starred: bool,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct NoteContent {
    pub frontmatter: Value,
    pub body: String,
}

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

fn fm_bool(fm: &Value, key: &str) -> bool {
    matches!(fm.get(key), Some(Value::Bool(true)))
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

pub fn resolve(vault: &str, rel: &str) -> Result<PathBuf, String> {
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
        starred: fm_bool(&fm, "starred"),
        frontmatter: fm,
        path: rel_str,
    })
}

pub fn list_vault(vault: &str) -> Result<Vec<VaultEntry>, String> {
    let root = PathBuf::from(vault);
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

pub fn get_entry(vault: &str, path: &str) -> Result<VaultEntry, String> {
    let abs = resolve(vault, path)?;
    build_entry(Path::new(vault), &abs).ok_or_else(|| format!("cannot read note: {path}"))
}

pub fn read_note(vault: &str, path: &str) -> Result<NoteContent, String> {
    let abs = resolve(vault, path)?;
    let content = fs::read_to_string(&abs).map_err(|e| e.to_string())?;
    let (frontmatter, body) = parse_note(&content);
    Ok(NoteContent { frontmatter, body })
}

pub fn save_note_content(vault: &str, path: &str, body: &str) -> Result<(), String> {
    let abs = resolve(vault, path)?;
    let existing = fs::read_to_string(&abs).unwrap_or_default();
    let (raw_fm, _) = split_frontmatter_raw(&existing);
    let content = match raw_fm {
        Some(fm) => format!("{fm}\n{body}"),
        None => body.to_string(),
    };
    write_atomic(&abs, &content)
}

pub fn save_note_frontmatter(vault: &str, path: &str, frontmatter: &Value) -> Result<(), String> {
    let abs = resolve(vault, path)?;
    let existing = fs::read_to_string(&abs).map_err(|e| e.to_string())?;
    let (_, body) = split_frontmatter_raw(&existing);
    let is_empty = !frontmatter.is_object()
        || frontmatter.as_object().map(|o| o.is_empty()).unwrap_or(true);
    let content = if is_empty {
        body
    } else {
        let yaml = serde_yaml::to_string(frontmatter).map_err(|e| e.to_string())?;
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

pub fn create_note(
    vault: &str,
    title: &str,
    note_type: Option<&str>,
    folder: Option<&str>,
) -> Result<String, String> {
    let name = sanitize_filename(title);
    let dir = match folder {
        Some(f) if !f.is_empty() => resolve(vault, f)?,
        _ => PathBuf::from(vault),
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
        .strip_prefix(vault)
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .replace('\\', "/"))
}

pub fn delete_note(vault: &str, path: &str) -> Result<(), String> {
    let abs = resolve(vault, path)?;
    fs::remove_file(&abs).map_err(|e| e.to_string())
}

pub fn rename_note(vault: &str, path: &str, new_title: &str) -> Result<String, String> {
    let abs = resolve(vault, path)?;
    let name = sanitize_filename(new_title);
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
        fm["title"] = Value::String(new_title.to_string());
        let rel = target
            .strip_prefix(vault)
            .map_err(|e| e.to_string())?
            .to_string_lossy()
            .replace('\\', "/");
        save_note_frontmatter(vault, &rel, &fm)?;
        return Ok(rel);
    }
    Ok(target
        .strip_prefix(vault)
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .replace('\\', "/"))
}

pub fn toggle_star(vault: &str, path: &str) -> Result<bool, String> {
    let abs = resolve(vault, path)?;
    let content = fs::read_to_string(&abs).map_err(|e| e.to_string())?;
    let (mut fm, body) = parse_note(&content);
    let next = !fm_bool(&fm, "starred");
    if !fm.is_object() {
        fm = serde_json::json!({});
    }
    if next {
        fm["starred"] = Value::Bool(true);
    } else if let Some(obj) = fm.as_object_mut() {
        obj.remove("starred");
    }
    let is_empty = fm.as_object().map(|o| o.is_empty()).unwrap_or(true);
    let new_content = if is_empty {
        body
    } else {
        let yaml = serde_yaml::to_string(&fm).map_err(|e| e.to_string())?;
        format!("---\n{yaml}---\n\n{body}")
    };
    write_atomic(&abs, &new_content)?;
    Ok(next)
}
