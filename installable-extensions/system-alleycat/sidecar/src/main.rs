use std::env;
use std::time::Duration;

use anyhow::{anyhow, Context};
use base64::Engine;
use iroh::endpoint::{presets, IdleTimeout, QuicTransportConfig};
use iroh::{Endpoint, SecretKey};
use serde::{Deserialize, Serialize};
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;
#[cfg(unix)]
use tokio::signal::unix::{signal, SignalKind};
use tracing::{info, warn};

const PROTOCOL_VERSION: u32 = 1;
const ALLEYCAT_ALPN: &[u8] = b"alleycat/1";
const AGENT_NAME: &str = "neon-pilot";
const MAX_FRAME_BYTES: usize = 1024 * 1024;
const INITIAL_FRAME_TIMEOUT: Duration = Duration::from_secs(10);
const ENDPOINT_ONLINE_TIMEOUT: Duration = Duration::from_secs(20);

#[derive(Debug, Clone)]
struct Config {
    token: String,
    secret_key: SecretKey,
    jsonl_host: String,
    jsonl_port: u16,
}

#[derive(Debug, Serialize)]
struct PairPayload {
    v: u32,
    node_id: String,
    token: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    host_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    relay: Option<String>,
}

#[derive(Debug, Serialize)]
struct AgentInfo {
    name: &'static str,
    display_name: &'static str,
    wire: &'static str,
    available: bool,
    presentation: AgentPresentation,
    capabilities: AgentCapabilities,
}

#[derive(Debug, Serialize)]
struct AgentPresentation {
    title: &'static str,
    is_beta: bool,
    sort_order: i32,
    description: &'static str,
    aliases: Vec<&'static str>,
}

#[derive(Debug, Serialize)]
struct AgentCapabilities {
    locks_reasoning_effort_after_activity: bool,
    supports_ssh_bridge: bool,
    uses_direct_codex_port: bool,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(tag = "op", rename_all = "snake_case")]
enum Request {
    ListAgents {
        v: u32,
        token: String,
    },
    RestartAgent {
        v: u32,
        token: String,
        agent: String,
    },
    Connect {
        v: u32,
        token: String,
        agent: String,
        resume: Option<Resume>,
    },
}

#[derive(Debug, Deserialize, Serialize)]
struct Resume {
    #[allow(dead_code)]
    last_seq: u64,
}

#[derive(Debug, Serialize)]
struct Response {
    v: u32,
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    agents: Option<Vec<AgentInfo>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    session: Option<SessionInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Debug, Serialize)]
struct SessionInfo {
    attached: &'static str,
    current_seq: u64,
    floor_seq: u64,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .with_writer(std::io::stderr)
        .init();

    let config = load_config()?;
    let endpoint = bind_endpoint(config.secret_key.clone()).await?;
    wait_for_dialable_endpoint(&endpoint).await?;
    let pair = PairPayload {
        v: PROTOCOL_VERSION,
        node_id: config.secret_key.public().to_string(),
        token: config.token.clone(),
        host_name: hostname::get()
            .ok()
            .and_then(|name| name.into_string().ok()),
        relay: endpoint
            .addr()
            .relay_urls()
            .next()
            .map(|url| url.to_string()),
    };
    println!(
        "{}",
        serde_json::to_string(&serde_json::json!({ "type": "ready", "pairPayload": pair }))?
    );

    loop {
        tokio::select! {
            _ = shutdown_signal() => {
                info!("shutdown requested");
                endpoint.close().await;
                return Ok(());
            }
            incoming = endpoint.accept() => {
                let Some(connecting) = incoming else { return Ok(()); };
                let config = config.clone();
                tokio::spawn(async move {
                    match connecting.await {
                        Ok(conn) => {
                            let remote = conn.remote_id().to_string();
                            info!(%remote, "iroh connection accepted");
                            while let Ok((send, recv)) = conn.accept_bi().await {
                                let config = config.clone();
                                tokio::spawn(async move {
                                    if let Err(error) = handle_stream(send, recv, config).await {
                                        warn!("alleycat stream ended: {error:#}");
                                    }
                                });
                            }
                        }
                        Err(error) => warn!("incoming connection failed: {error:#}"),
                    }
                });
            }
        }
    }
}

async fn wait_for_dialable_endpoint(endpoint: &Endpoint) -> anyhow::Result<()> {
    tokio::time::timeout(ENDPOINT_ONLINE_TIMEOUT, endpoint.online())
        .await
        .context("timed out waiting for iroh endpoint to connect to a relay")?;

    let relay = endpoint
        .addr()
        .relay_urls()
        .next()
        .map(|url| url.to_string());
    if relay.is_none() {
        return Err(anyhow!(
            "iroh endpoint reported online but no relay address is available"
        ));
    }

    info!(relay = relay.as_deref(), "PA Alleycat endpoint is dialable");
    Ok(())
}

async fn shutdown_signal() {
    #[cfg(unix)]
    {
        let mut term =
            signal(SignalKind::terminate()).expect("installing SIGTERM handler for Alleycat host");
        tokio::select! {
            _ = tokio::signal::ctrl_c() => {}
            _ = term.recv() => {}
        }
    }

    #[cfg(not(unix))]
    {
        let _ = tokio::signal::ctrl_c().await;
    }
}

fn load_config() -> anyhow::Result<Config> {
    let token =
        env::var("NEON_PILOT_ALLEYCAT_TOKEN").context("NEON_PILOT_ALLEYCAT_TOKEN is required")?;
    let secret = env::var("NEON_PILOT_ALLEYCAT_SECRET_KEY")
        .context("NEON_PILOT_ALLEYCAT_SECRET_KEY is required")?;
    let secret_bytes = base64::engine::general_purpose::STANDARD
        .decode(secret.as_bytes())
        .or_else(|_| base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(secret.as_bytes()))
        .context("decoding NEON_PILOT_ALLEYCAT_SECRET_KEY")?;
    let secret_key = SecretKey::try_from(secret_bytes.as_slice())
        .map_err(|_| anyhow!("invalid NEON_PILOT_ALLEYCAT_SECRET_KEY"))?;
    let jsonl_host =
        env::var("NEON_PILOT_ALLEYCAT_JSONL_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let jsonl_port = env::var("NEON_PILOT_ALLEYCAT_JSONL_PORT")
        .context("NEON_PILOT_ALLEYCAT_JSONL_PORT is required")?
        .parse::<u16>()
        .context("NEON_PILOT_ALLEYCAT_JSONL_PORT must be a TCP port")?;
    Ok(Config {
        token,
        secret_key,
        jsonl_host,
        jsonl_port,
    })
}

async fn bind_endpoint(secret_key: SecretKey) -> anyhow::Result<Endpoint> {
    let idle_timeout = IdleTimeout::try_from(Duration::from_secs(600))
        .context("constructing iroh idle timeout")?;
    let transport = QuicTransportConfig::builder()
        .max_idle_timeout(Some(idle_timeout))
        .build();
    let endpoint = Endpoint::builder(presets::N0)
        .clear_ip_transports()
        .bind_addr("0.0.0.0:0")
        .context("configuring IPv4 Alleycat endpoint bind")?
        .secret_key(secret_key)
        .alpns(vec![ALLEYCAT_ALPN.to_vec()])
        .transport_config(transport)
        .bind()
        .await
        .context("binding iroh endpoint")?;
    info!(node_id = %endpoint.id(), "PA Alleycat endpoint bound");
    Ok(endpoint)
}

async fn handle_stream(
    mut send: iroh::endpoint::SendStream,
    mut recv: iroh::endpoint::RecvStream,
    config: Config,
) -> anyhow::Result<()> {
    let request: Request = tokio::time::timeout(INITIAL_FRAME_TIMEOUT, read_json_frame(&mut recv))
        .await
        .context("timed out waiting for initial Alleycat request frame")??;
    if let Err(error) = validate_request(&request, &config.token) {
        write_json_frame(&mut send, &Response::error(error.to_string())).await?;
        return Err(error);
    }

    match request {
        Request::ListAgents { .. } => {
            write_json_frame(&mut send, &Response::agents(vec![personal_agent(true)])).await?;
            Ok(())
        }
        Request::RestartAgent { agent, .. } => {
            if agent != AGENT_NAME {
                write_json_frame(
                    &mut send,
                    &Response::error(format!("agent `{agent}` is disabled or unknown")),
                )
                .await?;
                return Err(anyhow!("unknown agent: {agent}"));
            }
            write_json_frame(&mut send, &Response::ok()).await?;
            Ok(())
        }
        Request::Connect { agent, resume, .. } => {
            if agent != AGENT_NAME {
                write_json_frame(
                    &mut send,
                    &Response::error(format!("agent `{agent}` is disabled or unknown")),
                )
                .await?;
                return Err(anyhow!("unknown agent: {agent}"));
            }
            let tcp =
                match TcpStream::connect((config.jsonl_host.as_str(), config.jsonl_port)).await {
                    Ok(tcp) => tcp,
                    Err(error) => {
                        let message = format!(
                            "connecting to PA JSONL bridge on {}:{}: {error}",
                            config.jsonl_host, config.jsonl_port
                        );
                        write_json_frame(&mut send, &Response::error(message.clone())).await?;
                        return Err(anyhow!(message));
                    }
                };
            let mut tcp = tcp;
            let auth_line =
                serde_json::to_vec(&serde_json::json!({ "type": "auth", "token": config.token }))?;
            tcp.write_all(&auth_line)
                .await
                .context("writing JSONL bridge auth")?;
            tcp.write_all(b"\n")
                .await
                .context("terminating JSONL bridge auth")?;
            write_json_frame(&mut send, &Response::ok_with_session(resume)).await?;
            let iroh_stream = IrohBiStream { recv, send };
            bridge_jsonl(tcp, iroh_stream).await
        }
    }
}

async fn bridge_jsonl(mut tcp: TcpStream, iroh_stream: IrohBiStream) -> anyhow::Result<()> {
    let (mut tcp_read, mut tcp_write) = tcp.split();
    let (mut iroh_read, mut iroh_write) = iroh_stream.split();

    bridge_streams(
        &mut tcp_read,
        &mut tcp_write,
        &mut iroh_read,
        &mut iroh_write,
    )
    .await
}

async fn bridge_streams<TcpRead, TcpWrite, ClientRead, ClientWrite>(
    tcp_read: &mut TcpRead,
    tcp_write: &mut TcpWrite,
    client_read: &mut ClientRead,
    client_write: &mut ClientWrite,
) -> anyhow::Result<()>
where
    TcpRead: AsyncRead + Unpin,
    TcpWrite: AsyncWrite + Unpin,
    ClientRead: AsyncRead + Unpin,
    ClientWrite: AsyncWrite + Unpin,
{
    let client_to_pa = async {
        tokio::io::copy(client_read, tcp_write)
            .await
            .context("copying client to PA JSONL bridge")?;
        tcp_write
            .shutdown()
            .await
            .context("shutting down PA JSONL bridge write half")?;
        Ok::<(), anyhow::Error>(())
    };

    let pa_to_client = async {
        tokio::io::copy(tcp_read, client_write)
            .await
            .context("copying PA JSONL bridge to client")?;
        client_write
            .shutdown()
            .await
            .context("shutting down client write half")?;
        Ok::<(), anyhow::Error>(())
    };

    tokio::try_join!(client_to_pa, pa_to_client)?;
    Ok(())
}

fn validate_request(request: &Request, expected_token: &str) -> anyhow::Result<()> {
    let (version, token) = match request {
        Request::ListAgents { v, token }
        | Request::RestartAgent { v, token, .. }
        | Request::Connect { v, token, .. } => (*v, token),
    };
    if version != PROTOCOL_VERSION {
        return Err(anyhow!(
            "protocol mismatch: client={version} host={PROTOCOL_VERSION}"
        ));
    }
    if token != expected_token {
        return Err(anyhow!("invalid token"));
    }
    Ok(())
}

fn personal_agent(available: bool) -> AgentInfo {
    AgentInfo {
        name: AGENT_NAME,
        display_name: "Neon Pilot",
        wire: "jsonl",
        available,
        presentation: AgentPresentation {
            title: "Neon Pilot",
            is_beta: true,
            sort_order: 0,
            description: "Neon Pilot conversations exposed to Kitty Litter.",
            aliases: vec!["pa", "personalagent"],
        },
        capabilities: AgentCapabilities {
            locks_reasoning_effort_after_activity: false,
            supports_ssh_bridge: false,
            uses_direct_codex_port: false,
        },
    }
}

async fn read_json_frame<T, R>(reader: &mut R) -> anyhow::Result<T>
where
    T: for<'de> Deserialize<'de>,
    R: AsyncRead + Unpin,
{
    let len = reader.read_u32().await.context("reading frame length")? as usize;
    if len > MAX_FRAME_BYTES {
        return Err(anyhow!("frame too large: {len} bytes"));
    }
    let mut buf = vec![0u8; len];
    reader
        .read_exact(&mut buf)
        .await
        .context("reading frame body")?;
    serde_json::from_slice(&buf).context("decoding JSON frame")
}

async fn write_json_frame<T, W>(writer: &mut W, value: &T) -> anyhow::Result<()>
where
    T: Serialize,
    W: AsyncWrite + Unpin,
{
    let buf = serde_json::to_vec(value).context("encoding JSON frame")?;
    if buf.len() > MAX_FRAME_BYTES {
        return Err(anyhow!("frame too large: {} bytes", buf.len()));
    }
    writer
        .write_u32(buf.len() as u32)
        .await
        .context("writing frame length")?;
    writer.write_all(&buf).await.context("writing frame body")?;
    writer.flush().await.context("flushing frame")?;
    Ok(())
}

impl Response {
    fn ok() -> Self {
        Self {
            v: PROTOCOL_VERSION,
            ok: true,
            agents: None,
            session: None,
            error: None,
        }
    }

    fn ok_with_session(resume: Option<Resume>) -> Self {
        Self {
            v: PROTOCOL_VERSION,
            ok: true,
            agents: None,
            session: Some(SessionInfo {
                attached: if resume.is_some() { "resumed" } else { "fresh" },
                current_seq: 0,
                floor_seq: 0,
            }),
            error: None,
        }
    }

    fn agents(agents: Vec<AgentInfo>) -> Self {
        Self {
            v: PROTOCOL_VERSION,
            ok: true,
            agents: Some(agents),
            session: None,
            error: None,
        }
    }

    fn error(error: impl Into<String>) -> Self {
        Self {
            v: PROTOCOL_VERSION,
            ok: false,
            agents: None,
            session: None,
            error: Some(error.into()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::AsyncBufReadExt;

    fn token() -> &'static str {
        "kitty-token"
    }

    #[test]
    fn validates_matching_protocol_version_and_token() {
        let request = Request::ListAgents {
            v: PROTOCOL_VERSION,
            token: token().to_string(),
        };

        validate_request(&request, token()).expect("valid request should pass");
    }

    #[test]
    fn rejects_protocol_mismatch_before_agent_handling() {
        let request = Request::ListAgents {
            v: PROTOCOL_VERSION + 1,
            token: token().to_string(),
        };

        let error = validate_request(&request, token()).expect_err("version mismatch should fail");
        assert!(error.to_string().contains("protocol mismatch"));
    }

    #[test]
    fn rejects_invalid_token_before_bridge_connect() {
        let request = Request::Connect {
            v: PROTOCOL_VERSION,
            token: "wrong".to_string(),
            agent: AGENT_NAME.to_string(),
            resume: None,
        };

        let error = validate_request(&request, token()).expect_err("wrong token should fail");
        assert!(error.to_string().contains("invalid token"));
    }

    #[test]
    fn advertises_only_neon_pilot_jsonl_agent() {
        let agent = personal_agent(true);
        let json = serde_json::to_value(Response::agents(vec![agent]))
            .expect("agent response should serialize");

        assert_eq!(json["ok"], true);
        assert_eq!(json["agents"].as_array().expect("agents array").len(), 1);
        assert_eq!(json["agents"][0]["name"], AGENT_NAME);
        assert_eq!(json["agents"][0]["display_name"], "Neon Pilot");
        assert_eq!(json["agents"][0]["wire"], "jsonl");
        assert_eq!(
            json["agents"][0]["capabilities"]["uses_direct_codex_port"],
            false
        );
    }

    #[test]
    fn connect_session_ack_reports_fresh_or_resumed_attachment() {
        let fresh =
            serde_json::to_value(Response::ok_with_session(None)).expect("fresh session response");
        assert_eq!(fresh["ok"], true);
        assert_eq!(fresh["session"]["attached"], "fresh");
        assert_eq!(fresh["session"]["current_seq"], 0);
        assert_eq!(fresh["session"]["floor_seq"], 0);

        let resumed =
            serde_json::to_value(Response::ok_with_session(Some(Resume { last_seq: 12 })))
                .expect("resumed session response");
        assert_eq!(resumed["session"]["attached"], "resumed");
    }

    #[tokio::test]
    async fn length_prefixed_json_frames_round_trip() {
        let (mut client, mut server) = tokio::io::duplex(1024);
        let request = Request::RestartAgent {
            v: PROTOCOL_VERSION,
            token: token().to_string(),
            agent: AGENT_NAME.to_string(),
        };

        let write = write_json_frame(&mut client, &request);
        let read = read_json_frame::<Request, _>(&mut server);
        let (_, decoded) = tokio::join!(write, read);
        match decoded.expect("request should decode") {
            Request::RestartAgent {
                v,
                token: decoded_token,
                agent,
            } => {
                assert_eq!(v, PROTOCOL_VERSION);
                assert_eq!(decoded_token, token());
                assert_eq!(agent, AGENT_NAME);
            }
            _ => panic!("unexpected request variant"),
        }
    }

    #[tokio::test]
    async fn bridge_streams_proxies_jsonl_bytes_both_directions() {
        let (mut tcp_peer, tcp_bridge) = tokio::io::duplex(1024);
        let (client_bridge, mut client_peer) = tokio::io::duplex(1024);
        let (mut tcp_read, mut tcp_write) = tokio::io::split(tcp_bridge);
        let (mut client_read, mut client_write) = tokio::io::split(client_bridge);

        let bridge = tokio::spawn(async move {
            bridge_streams(
                &mut tcp_read,
                &mut tcp_write,
                &mut client_read,
                &mut client_write,
            )
            .await
        });

        client_peer
            .write_all(b"{\"jsonrpc\":\"2.0\",\"id\":1}\n")
            .await
            .expect("client request write");
        client_peer.shutdown().await.expect("client shutdown");

        let mut request = Vec::new();
        tcp_peer
            .read_to_end(&mut request)
            .await
            .expect("PA bridge read");
        assert_eq!(request, b"{\"jsonrpc\":\"2.0\",\"id\":1}\n");

        tcp_peer
            .write_all(b"{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{}}\n")
            .await
            .expect("PA response write");
        tcp_peer.shutdown().await.expect("PA shutdown");

        let mut response = Vec::new();
        client_peer
            .read_to_end(&mut response)
            .await
            .expect("client response read");
        assert_eq!(response, b"{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{}}\n");

        bridge
            .await
            .expect("bridge task joins")
            .expect("bridge succeeds");
    }

    #[tokio::test]
    async fn iroh_loopback_matches_alleycat_probe_flow() {
        let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
            .await
            .expect("fake JSONL bridge binds");
        let jsonl_port = listener.local_addr().expect("fake JSONL addr").port();
        let fake_bridge = tokio::spawn(async move {
            let (socket, _) = listener
                .accept()
                .await
                .expect("JSONL bridge accepts sidecar");
            let mut socket = BufReader::new(socket);
            let mut auth = String::new();
            socket.read_line(&mut auth).await.expect("auth line read");
            assert_eq!(
                serde_json::from_str::<serde_json::Value>(auth.trim()).expect("auth JSON"),
                serde_json::json!({ "type": "auth", "token": token() })
            );

            let mut request = String::new();
            socket
                .read_line(&mut request)
                .await
                .expect("JSON-RPC request read");
            assert_eq!(
                serde_json::from_str::<serde_json::Value>(request.trim()).expect("request JSON")
                    ["method"],
                "initialize"
            );
            socket
                .get_mut()
                .write_all(b"{\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"ok\":true}}\n")
                .await
                .expect("JSON-RPC response write");
        });

        let server_secret = SecretKey::try_from([7_u8; 32].as_slice()).expect("server secret");
        let server_endpoint = bind_endpoint(server_secret.clone())
            .await
            .expect("server endpoint binds");
        let config = Config {
            token: token().to_string(),
            secret_key: server_secret,
            jsonl_host: "127.0.0.1".to_string(),
            jsonl_port,
        };
        let server = tokio::spawn({
            let endpoint = server_endpoint.clone();
            async move {
                let connecting = endpoint.accept().await.expect("incoming connection");
                let conn = connecting.await.expect("accepted connection");
                for _ in 0..2 {
                    let (send, recv) = conn.accept_bi().await.expect("incoming stream");
                    if let Err(error) = handle_stream(send, recv, config.clone()).await {
                        assert!(
                            error
                                .to_string()
                                .contains("copying client to PA JSONL bridge")
                                || error.to_string().contains("connection lost"),
                            "unexpected stream error: {error:#}"
                        );
                    }
                }
                endpoint.close().await;
            }
        });

        let client_secret = SecretKey::try_from([8_u8; 32].as_slice()).expect("client secret");
        let client_endpoint = Endpoint::builder(presets::N0)
            .secret_key(client_secret)
            .alpns(vec![ALLEYCAT_ALPN.to_vec()])
            .bind()
            .await
            .expect("client endpoint binds");
        let conn = client_endpoint
            .connect(server_endpoint.addr(), ALLEYCAT_ALPN)
            .await
            .expect("client dials sidecar endpoint");

        let (mut send, mut recv) = conn.open_bi().await.expect("list_agents stream opens");
        write_json_frame(
            &mut send,
            &Request::ListAgents {
                v: PROTOCOL_VERSION,
                token: token().to_string(),
            },
        )
        .await
        .expect("list_agents frame writes");
        send.finish().ok();
        let agents: serde_json::Value = read_json_frame(&mut recv)
            .await
            .expect("list_agents response");
        assert_eq!(agents["ok"], true);
        assert_eq!(agents["agents"].as_array().expect("agents").len(), 1);

        let (mut send, mut recv) = conn.open_bi().await.expect("connect stream opens");
        write_json_frame(
            &mut send,
            &Request::Connect {
                v: PROTOCOL_VERSION,
                token: token().to_string(),
                agent: AGENT_NAME.to_string(),
                resume: None,
            },
        )
        .await
        .expect("connect frame writes");
        let connected: serde_json::Value =
            read_json_frame(&mut recv).await.expect("connect response");
        assert_eq!(connected["ok"], true);
        assert_eq!(connected["session"]["attached"], "fresh");

        send.write_all(b"{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{}}\n")
            .await
            .expect("JSON-RPC initialize writes");
        let mut reader = BufReader::new(recv);
        let mut response = String::new();
        reader
            .read_line(&mut response)
            .await
            .expect("JSON-RPC response reads");
        assert_eq!(
            serde_json::from_str::<serde_json::Value>(response.trim()).expect("response JSON"),
            serde_json::json!({ "jsonrpc": "2.0", "id": 1, "result": { "ok": true } })
        );

        conn.close(iroh::endpoint::VarInt::from_u32(0), b"test complete");
        client_endpoint.close().await;
        server.await.expect("server task joins");
        fake_bridge.await.expect("fake bridge task joins");
    }
}

struct IrohBiStream {
    recv: iroh::endpoint::RecvStream,
    send: iroh::endpoint::SendStream,
}

impl IrohBiStream {
    fn split(
        self,
    ) -> (
        BufReader<iroh::endpoint::RecvStream>,
        iroh::endpoint::SendStream,
    ) {
        (BufReader::new(self.recv), self.send)
    }
}
