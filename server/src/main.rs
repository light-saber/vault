mod git;
mod search;
mod settings;
mod vault;

use std::sync::Arc;

use axum::{
    extract::{Query, Request, State},
    http::StatusCode,
    middleware::{self, Next},
    response::{IntoResponse, Json, Response},
    routing::{delete, get, post},
    Router,
};
use serde::Deserialize;
use tower_http::{
    cors::{Any, CorsLayer},
    services::{ServeDir, ServeFile},
};

// ── Shared state ──────────────────────────────────────────────────────────────

#[derive(Clone)]
struct AppState {
    vault: String,
    token: String,
}

// ── Error type ────────────────────────────────────────────────────────────────

struct ApiError(String);

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (StatusCode::INTERNAL_SERVER_ERROR, self.0).into_response()
    }
}

impl From<String> for ApiError {
    fn from(s: String) -> Self {
        ApiError(s)
    }
}

// ── Auth middleware ───────────────────────────────────────────────────────────

async fn require_auth(
    State(state): State<Arc<AppState>>,
    req: Request,
    next: Next,
) -> Response {
    let token = req
        .headers()
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .unwrap_or("");
    if token != state.token {
        return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response();
    }
    next.run(req).await
}

// ── Request body / query types ────────────────────────────────────────────────

#[derive(Deserialize)]
struct PathQuery {
    path: String,
}

#[derive(Deserialize)]
struct SearchQuery {
    q: String,
}

#[derive(Deserialize)]
struct LogQuery {
    skip: u64,
    limit: u64,
}

#[derive(Deserialize)]
struct FileLogQuery {
    path: String,
    limit: u64,
}

#[derive(Deserialize)]
struct DiffQuery {
    hash: String,
    path: Option<String>,
}

#[derive(Deserialize)]
struct SaveContentBody {
    path: String,
    body: String,
}

#[derive(Deserialize)]
struct SaveFrontmatterBody {
    path: String,
    frontmatter: serde_json::Value,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateNoteBody {
    title: String,
    note_type: Option<String>,
    folder: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RenameBody {
    path: String,
    new_title: String,
}

#[derive(Deserialize)]
struct StarBody {
    path: String,
}

#[derive(Deserialize)]
struct CommitBody {
    message: String,
}

#[derive(Deserialize)]
struct UpdateSettingsBody {
    settings: settings::Settings,
}

// ── Settings handlers ─────────────────────────────────────────────────────────

async fn handle_get_settings(
    State(state): State<Arc<AppState>>,
) -> Result<Json<settings::Settings>, ApiError> {
    let mut s = settings::read_settings()?;
    s.vault_path = Some(state.vault.clone());
    Ok(Json(s))
}

async fn handle_update_settings(
    Json(body): Json<UpdateSettingsBody>,
) -> Result<StatusCode, ApiError> {
    settings::write_settings(body.settings)?;
    Ok(StatusCode::OK)
}

// ── Vault handlers ────────────────────────────────────────────────────────────

async fn handle_list_vault(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<vault::VaultEntry>>, ApiError> {
    Ok(Json(vault::list_vault(&state.vault)?))
}

async fn handle_get_entry(
    State(state): State<Arc<AppState>>,
    Query(q): Query<PathQuery>,
) -> Result<Json<vault::VaultEntry>, ApiError> {
    Ok(Json(vault::get_entry(&state.vault, &q.path)?))
}

async fn handle_read_note(
    State(state): State<Arc<AppState>>,
    Query(q): Query<PathQuery>,
) -> Result<Json<vault::NoteContent>, ApiError> {
    Ok(Json(vault::read_note(&state.vault, &q.path)?))
}

async fn handle_save_content(
    State(state): State<Arc<AppState>>,
    Json(body): Json<SaveContentBody>,
) -> Result<StatusCode, ApiError> {
    vault::save_note_content(&state.vault, &body.path, &body.body)?;
    Ok(StatusCode::OK)
}

async fn handle_save_frontmatter(
    State(state): State<Arc<AppState>>,
    Json(body): Json<SaveFrontmatterBody>,
) -> Result<StatusCode, ApiError> {
    vault::save_note_frontmatter(&state.vault, &body.path, &body.frontmatter)?;
    Ok(StatusCode::OK)
}

async fn handle_create_note(
    State(state): State<Arc<AppState>>,
    Json(body): Json<CreateNoteBody>,
) -> Result<Json<String>, ApiError> {
    let path = vault::create_note(
        &state.vault,
        &body.title,
        body.note_type.as_deref(),
        body.folder.as_deref(),
    )?;
    Ok(Json(path))
}

async fn handle_delete_note(
    State(state): State<Arc<AppState>>,
    Query(q): Query<PathQuery>,
) -> Result<StatusCode, ApiError> {
    vault::delete_note(&state.vault, &q.path)?;
    Ok(StatusCode::OK)
}

async fn handle_rename_note(
    State(state): State<Arc<AppState>>,
    Json(body): Json<RenameBody>,
) -> Result<Json<String>, ApiError> {
    Ok(Json(vault::rename_note(
        &state.vault,
        &body.path,
        &body.new_title,
    )?))
}

async fn handle_toggle_star(
    State(state): State<Arc<AppState>>,
    Json(body): Json<StarBody>,
) -> Result<Json<bool>, ApiError> {
    Ok(Json(vault::toggle_star(&state.vault, &body.path)?))
}

// ── Search handler ────────────────────────────────────────────────────────────

async fn handle_search(
    State(state): State<Arc<AppState>>,
    Query(q): Query<SearchQuery>,
) -> Result<Json<Vec<search::SearchResult>>, ApiError> {
    Ok(Json(search::search_vault(&state.vault, &q.q)?))
}

// ── Git handlers ──────────────────────────────────────────────────────────────

async fn handle_git_status(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<git::GitFileStatus>>, ApiError> {
    Ok(Json(git::git_status(&state.vault)?))
}

async fn handle_git_log(
    State(state): State<Arc<AppState>>,
    Query(q): Query<LogQuery>,
) -> Result<Json<Vec<git::CommitInfo>>, ApiError> {
    Ok(Json(git::git_log(&state.vault, q.skip, q.limit)?))
}

async fn handle_git_file_log(
    State(state): State<Arc<AppState>>,
    Query(q): Query<FileLogQuery>,
) -> Result<Json<Vec<git::CommitInfo>>, ApiError> {
    Ok(Json(git::git_file_log(&state.vault, &q.path, q.limit)?))
}

async fn handle_git_diff(
    State(state): State<Arc<AppState>>,
    Query(q): Query<DiffQuery>,
) -> Result<Json<String>, ApiError> {
    Ok(Json(git::git_diff(
        &state.vault,
        &q.hash,
        q.path.as_deref(),
    )?))
}

async fn handle_git_commit(
    State(state): State<Arc<AppState>>,
    Json(body): Json<CommitBody>,
) -> Result<Json<bool>, ApiError> {
    Ok(Json(git::git_commit(&state.vault, &body.message)?))
}

async fn handle_git_sync(
    State(state): State<Arc<AppState>>,
) -> Result<Json<git::SyncResult>, ApiError> {
    Ok(Json(git::git_sync(&state.vault)?))
}

async fn handle_git_has_remote(
    State(state): State<Arc<AppState>>,
) -> Result<Json<bool>, ApiError> {
    Ok(Json(git::git_has_remote(&state.vault)?))
}

// ── Router ────────────────────────────────────────────────────────────────────

fn api_router(state: Arc<AppState>) -> Router {
    let vault_routes = Router::new()
        .route("/list", get(handle_list_vault))
        .route("/entry", get(handle_get_entry))
        .route(
            "/note",
            get(handle_read_note).delete(handle_delete_note),
        )
        .route("/note/content", post(handle_save_content))
        .route("/note/frontmatter", post(handle_save_frontmatter))
        .route("/note/create", post(handle_create_note))
        .route("/note/rename", post(handle_rename_note))
        .route("/note/star", post(handle_toggle_star));

    let git_routes = Router::new()
        .route("/status", get(handle_git_status))
        .route("/log", get(handle_git_log))
        .route("/file-log", get(handle_git_file_log))
        .route("/diff", get(handle_git_diff))
        .route("/commit", post(handle_git_commit))
        .route("/sync", post(handle_git_sync))
        .route("/has-remote", get(handle_git_has_remote));

    Router::new()
        .route("/settings", get(handle_get_settings).post(handle_update_settings))
        .route("/search", get(handle_search))
        .nest("/vault", vault_routes)
        .nest("/git", git_routes)
        .layer(middleware::from_fn_with_state(state.clone(), require_auth))
        .with_state(state)
}

// ── Entry point ───────────────────────────────────────────────────────────────

#[tokio::main]
async fn main() {
    let vault = std::env::var("VAULT_PATH")
        .expect("VAULT_PATH environment variable is required (path to your vault directory)");
    let token = std::env::var("VAULT_TOKEN")
        .expect("VAULT_TOKEN environment variable is required (secret bearer token)");
    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse()
        .expect("PORT must be a valid port number");
    let static_dir = std::env::var("STATIC_DIR").unwrap_or_else(|_| "./dist-web".to_string());

    let state = Arc::new(AppState {
        vault: vault.clone(),
        token,
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let spa_fallback = ServeFile::new(format!("{static_dir}/index.html"));
    let static_service = ServeDir::new(&static_dir).fallback(spa_fallback);

    let app = Router::new()
        .nest("/api", api_router(state))
        .fallback_service(static_service)
        .layer(cors);

    let addr = format!("0.0.0.0:{port}");
    println!("Vault server listening on http://{addr}");
    println!("Vault path : {vault}");
    println!("Static dir : {static_dir}");

    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("failed to bind address");
    axum::serve(listener, app)
        .await
        .expect("server error");
}
