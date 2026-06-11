use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use walkdir::WalkDir;

use crate::vault::{make_snippet, parse_note};

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub path: String,
    pub title: String,
    pub snippet: String,
    pub score: i64,
}

/// Snap a byte index to the nearest valid char boundary at or below it.
fn snap(s: &str, mut i: usize) -> usize {
    i = i.min(s.len());
    while i > 0 && !s.is_char_boundary(i) {
        i -= 1;
    }
    i
}

/// Contextual snippet around the first match position.
fn context_snippet(content: &str, match_idx: usize) -> String {
    let start = snap(content, match_idx.saturating_sub(60));
    let end = snap(content, match_idx + 90);
    let mut text = content[start..end].replace('\n', " ").trim().to_string();
    if start > 0 {
        text = format!("…{text}");
    }
    if end < content.len() {
        text = format!("{text}…");
    }
    text
}

/// Keyword search across all vault .md files. Title matches rank above
/// content matches (PRD 6.5). All terms must match somewhere in the note.
#[tauri::command]
pub fn search_vault(vault: String, query: String) -> Result<Vec<SearchResult>, String> {
    let q = query.trim().to_lowercase();
    if q.is_empty() {
        return Ok(vec![]);
    }
    let terms: Vec<&str> = q.split_whitespace().collect();
    let root = PathBuf::from(&vault);
    if !root.is_dir() {
        return Err(format!("vault folder not found: {vault}"));
    }

    let mut results = Vec::new();
    let walker = WalkDir::new(&root).into_iter().filter_entry(|e| {
        !e.file_name()
            .to_str()
            .map(|s| s.starts_with('.'))
            .unwrap_or(false)
    });
    for entry in walker.flatten() {
        if !entry.file_type().is_file()
            || entry.path().extension().and_then(|e| e.to_str()) != Some("md")
        {
            continue;
        }
        let content = match fs::read_to_string(entry.path()) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let (fm, body) = parse_note(&content);
        let stem = entry
            .path()
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();
        let title = fm
            .get("title")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or(stem);

        let title_l = title.to_lowercase();
        let body_l = body.to_lowercase();

        let mut score: i64 = 0;
        let mut first_match: Option<usize> = None;
        let mut all_match = true;
        for term in &terms {
            let in_title = title_l.contains(term);
            let body_idx = body_l.find(term);
            if !in_title && body_idx.is_none() {
                all_match = false;
                break;
            }
            if in_title {
                score += 100;
            }
            if let Some(idx) = body_idx {
                score += (body_l.matches(term).take(20).count()) as i64;
                first_match = Some(first_match.map_or(idx, |f| f.min(idx)));
            }
        }
        if !all_match || score == 0 {
            continue;
        }

        let snippet = match first_match {
            Some(idx) => context_snippet(&body, snap(&body, idx)),
            None => make_snippet(&body),
        };
        let rel = entry
            .path()
            .strip_prefix(&root)
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .unwrap_or_default();
        results.push(SearchResult {
            path: rel,
            title,
            snippet,
            score,
        });
    }
    results.sort_by(|a, b| b.score.cmp(&a.score).then(a.title.cmp(&b.title)));
    results.truncate(50);
    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn snippet_handles_multibyte_boundaries() {
        let text = "ééééééééééééééééééééééééééééééééééééééééé match here";
        let idx = text.find("match").unwrap();
        let snip = context_snippet(text, idx);
        assert!(snip.contains("match"));
    }
}
