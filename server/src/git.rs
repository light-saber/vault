use serde::Serialize;
use std::process::Command;

pub fn run(vault: &str, args: &[&str]) -> Result<String, String> {
    let out = Command::new("git")
        .arg("-C")
        .arg(vault)
        .args(args)
        .output()
        .map_err(|e| format!("failed to run git: {e}"))?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).to_string())
    } else {
        let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
        if err.is_empty() {
            Err(format!("git {} failed", args.first().unwrap_or(&"")))
        } else {
            Err(err)
        }
    }
}

fn commit_args<'a>(vault: &str, rest: &[&'a str]) -> Vec<&'a str> {
    let mut args: Vec<&str> = Vec::new();
    if run(vault, &["config", "user.email"]).is_err() {
        args.extend(["-c", "user.name=Vault", "-c", "user.email=vault@localhost"]);
    }
    args.extend(rest);
    args
}

pub fn commit_all(vault: &str, message: &str) -> Result<bool, String> {
    run(vault, &["add", "-A"])?;
    let staged = run(vault, &["diff", "--cached", "--name-only"])?;
    if staged.trim().is_empty() {
        return Ok(false);
    }
    let args = commit_args(vault, &["commit", "-m", message]);
    run(vault, &args)?;
    Ok(true)
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct GitFileStatus {
    pub path: String,
    pub status: String,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CommitInfo {
    pub hash: String,
    pub short_hash: String,
    pub message: String,
    pub timestamp: u64,
    pub files: Vec<String>,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub state: String,
    pub message: String,
    pub conflicts: Vec<String>,
}

impl SyncResult {
    fn new(state: &str, message: impl Into<String>) -> Self {
        SyncResult {
            state: state.to_string(),
            message: message.into(),
            conflicts: vec![],
        }
    }
}

pub fn git_status(vault: &str) -> Result<Vec<GitFileStatus>, String> {
    let out = run(vault, &["status", "--porcelain"])?;
    let mut files = Vec::new();
    for line in out.lines() {
        if line.len() < 4 {
            continue;
        }
        let status = line[..2].trim().to_string();
        let rest = &line[3..];
        let path = match rest.split_once(" -> ") {
            Some((_, new)) => new,
            None => rest,
        };
        let path = path.trim_matches('"').to_string();
        files.push(GitFileStatus { path, status });
    }
    Ok(files)
}

const LOG_FORMAT: &str = "--pretty=format:%x1e%H%x1f%h%x1f%ct%x1f%s";

fn parse_log(out: &str) -> Vec<CommitInfo> {
    let mut commits = Vec::new();
    for record in out.split('\x1e') {
        let record = record.trim();
        if record.is_empty() {
            continue;
        }
        let (header, files_part) = match record.split_once('\n') {
            Some((h, rest)) => (h, rest),
            None => (record, ""),
        };
        let fields: Vec<&str> = header.split('\x1f').collect();
        if fields.len() < 4 {
            continue;
        }
        let files = files_part
            .lines()
            .map(|l| l.trim())
            .filter(|l| !l.is_empty())
            .map(|l| l.to_string())
            .collect();
        commits.push(CommitInfo {
            hash: fields[0].to_string(),
            short_hash: fields[1].to_string(),
            timestamp: fields[2].parse::<u64>().unwrap_or(0) * 1000,
            message: fields[3..].join("\u{1f}"),
            files,
        });
    }
    commits
}

pub fn git_log(vault: &str, skip: u64, limit: u64) -> Result<Vec<CommitInfo>, String> {
    let skip_arg = format!("--skip={skip}");
    let n_arg = format!("-n{limit}");
    match run(vault, &["log", &skip_arg, &n_arg, LOG_FORMAT, "--name-only"]) {
        Ok(out) => Ok(parse_log(&out)),
        Err(_) => Ok(vec![]),
    }
}

pub fn git_file_log(vault: &str, path: &str, limit: u64) -> Result<Vec<CommitInfo>, String> {
    let n_arg = format!("-n{limit}");
    match run(vault, &["log", &n_arg, "--follow", LOG_FORMAT, "--", path]) {
        Ok(out) => Ok(parse_log(&out)),
        Err(_) => Ok(vec![]),
    }
}

pub fn git_diff(vault: &str, hash: &str, path: Option<&str>) -> Result<String, String> {
    match path {
        Some(p) => run(vault, &["show", hash, "--pretty=format:", "--", p]),
        None => run(vault, &["show", hash, "--stat", "--patch"]),
    }
}

pub fn git_commit(vault: &str, message: &str) -> Result<bool, String> {
    commit_all(vault, message)
}

pub fn git_has_remote(vault: &str) -> Result<bool, String> {
    Ok(!run(vault, &["remote"])?.trim().is_empty())
}

pub fn git_sync(vault: &str) -> Result<SyncResult, String> {
    if run(vault, &["remote"])?.trim().is_empty() {
        return Ok(SyncResult::new("noRemote", "No git remote configured"));
    }
    if let Err(e) = run(vault, &["fetch", "--prune"]) {
        return Ok(SyncResult::new("error", e));
    }
    if run(vault, &["rev-parse", "--abbrev-ref", "@{upstream}"]).is_err() {
        return match run(vault, &["push", "-u", "origin", "HEAD"]) {
            Ok(_) => Ok(SyncResult::new("synced", "Pushed and set upstream")),
            Err(e) => Ok(SyncResult::new("error", e)),
        };
    }
    let counts = run(vault, &["rev-list", "--left-right", "--count", "HEAD...@{upstream}"])?;
    let mut parts = counts.split_whitespace();
    let ahead: u64 = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0);
    let behind: u64 = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0);
    if behind > 0 {
        if let Err(e) = run(vault, &["pull", "--rebase", "--autostash"]) {
            let conflicts = run(vault, &["diff", "--name-only", "--diff-filter=U"])
                .unwrap_or_default()
                .lines()
                .map(|l| l.to_string())
                .collect();
            let _ = run(vault, &["rebase", "--abort"]);
            return Ok(SyncResult {
                state: "conflict".to_string(),
                message: e,
                conflicts,
            });
        }
    }
    if ahead > 0 || behind > 0 {
        if let Err(e) = run(vault, &["push"]) {
            return Ok(SyncResult::new("error", e));
        }
    }
    Ok(SyncResult::new("synced", ""))
}
