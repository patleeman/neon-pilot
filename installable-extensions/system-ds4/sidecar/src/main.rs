use std::env;
use std::io::{self, Read, Write};
use std::net::TcpStream;
use std::process::ExitCode;

use anyhow::{anyhow, bail, Context};
use base64::Engine;
use serde::{Deserialize, Serialize};
use serde_json::json;

const USAGE: &str = r#"ds4 tool gateway

Usage:
  ds4 help
  ds4 tools [--json]
  ds4 help <tool-name>
  ds4 <tool-name> [--field value ...]
  ds4 <tool-name> --json '{"field":"value"}'
  ds4 call <tool-name> --json '{"field":"value"}'

Examples:
  ds4 tools
  ds4 help web_search
  ds4 web_search --query "neon pilot ds4" --count 5
  ds4 web_fetch --url https://example.com
  printf '%s' '{"query":"neon pilot ds4"}' | ds4 web_search --stdin

DS4 exposes only core tools directly. This CLI lists and invokes extension tools
that are active for the current runtime but intentionally absent from the DS4
model schema."#;

#[derive(Debug)]
struct BaseUrl {
    host: String,
    port: u16,
}

#[derive(Debug, Deserialize)]
struct ProtocolStartResponse {
    ok: bool,
    channel: Option<ProtocolChannel>,
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ProtocolChannel {
    port: u16,
    token: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
enum ProtocolFrame {
    #[serde(rename = "stdin")]
    Stdin { data: String },
    #[serde(rename = "stdinEnd")]
    StdinEnd,
    #[serde(rename = "abort")]
    Abort,
    #[serde(rename = "stdout")]
    Stdout { data: String },
    #[serde(rename = "stderr")]
    Stderr { data: String },
    #[serde(rename = "result")]
    Result,
    #[serde(rename = "error")]
    Error { error: String },
}

fn main() -> ExitCode {
    match run() {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("{error:#}");
            ExitCode::from(1)
        }
    }
}

fn run() -> anyhow::Result<()> {
    let args: Vec<String> = env::args().skip(1).collect();
    if args.is_empty() || matches!(args[0].as_str(), "help" | "--help" | "-h") && args.len() == 1 {
        println!("{USAGE}");
        return Ok(());
    }

    let base_url = match env::var("NEON_PILOT_EXTENSION_HOST_BASE_URL") {
        Ok(value) => parse_base_url(&value)?,
        Err(_) => bail!("NEON_PILOT_EXTENSION_HOST_BASE_URL is not set. Run ds4 from a Neon Pilot-managed shell after the DS4 extension is enabled."),
    };
    let token = env::var("NEON_PILOT_EXTENSION_HOST_TOKEN")
        .map(|value| value.trim().to_string())
        .ok()
        .filter(|value| !value.is_empty())
        .ok_or_else(|| anyhow!("NEON_PILOT_EXTENSION_HOST_TOKEN is not set. Run ds4 from a Neon Pilot-managed shell after the DS4 extension is enabled."))?;

    let should_read_stdin = args.iter().any(|arg| arg == "--stdin" || arg == "-");
    let channel = start_protocol(&base_url, &token, &args)?;
    run_protocol_channel(&base_url.host, channel, should_read_stdin)?;
    Ok(())
}

fn parse_base_url(raw: &str) -> anyhow::Result<BaseUrl> {
    let raw = raw.trim();
    let rest = raw
        .strip_prefix("http://")
        .ok_or_else(|| anyhow!("Unsupported extension host URL: {raw}"))?;
    let authority = rest.split('/').next().unwrap_or(rest);
    let (host, port) = authority
        .rsplit_once(':')
        .ok_or_else(|| anyhow!("Extension host URL is missing a port: {raw}"))?;
    let port = port.parse::<u16>().with_context(|| format!("Invalid extension host port in {raw}"))?;
    if host.is_empty() {
        bail!("Extension host URL is missing a host: {raw}");
    }
    Ok(BaseUrl {
        host: host.to_string(),
        port,
    })
}

fn start_protocol(base_url: &BaseUrl, token: &str, args: &[String]) -> anyhow::Result<ProtocolChannel> {
    let body = json!({
        "request": {
            "protocolId": "ds4-tools",
            "input": {
                "args": args,
                "toolContext": protocol_tool_context()
            }
        }
    })
    .to_string();

    let mut stream = TcpStream::connect((base_url.host.as_str(), base_url.port))
        .with_context(|| format!("Unable to connect to Neon Pilot extension host at {}:{}", base_url.host, base_url.port))?;
    let request = format!(
        "POST /protocol/start HTTP/1.0\r\nHost: {}:{}\r\nAuthorization: Bearer {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        base_url.host,
        base_url.port,
        token,
        body.as_bytes().len(),
        body
    );
    stream.write_all(request.as_bytes())?;
    stream.flush()?;

    let mut response = String::new();
    stream.read_to_string(&mut response)?;
    let (headers, body) = response
        .split_once("\r\n\r\n")
        .ok_or_else(|| anyhow!("Extension host returned an invalid HTTP response."))?;
    let status = headers.lines().next().unwrap_or_default();
    let parsed: ProtocolStartResponse = serde_json::from_str(body).context("Extension host returned an invalid protocol start response.")?;
    if !status.contains(" 200 ") {
        bail!(
            "{}",
            parsed
                .error
                .unwrap_or_else(|| format!("Extension host protocol start failed: {status}"))
        );
    }
    if !parsed.ok {
        bail!("{}", parsed.error.unwrap_or_else(|| "Extension host protocol start failed.".to_string()));
    }
    parsed.channel.ok_or_else(|| anyhow!("Extension host did not return a protocol channel."))
}

fn optional_env(name: &str) -> Option<String> {
    env::var(name)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn protocol_tool_context() -> serde_json::Value {
    json!({
        "conversationId": optional_env("NEON_PILOT_SOURCE_CONVERSATION_ID"),
        "sessionId": optional_env("NEON_PILOT_SOURCE_CONVERSATION_ID"),
        "sessionFile": optional_env("NEON_PILOT_SOURCE_SESSION_FILE")
    })
}

fn run_protocol_channel(host: &str, channel: ProtocolChannel, should_read_stdin: bool) -> anyhow::Result<()> {
    let mut stream = TcpStream::connect((host, channel.port)).with_context(|| format!("Unable to connect to DS4 protocol channel on {host}:{}", channel.port))?;
    write_frame(&mut stream, &ProtocolFrame::Stdin {
        data: base64(&channel.token),
    })?;

    if should_read_stdin {
        let mut input = Vec::new();
        io::stdin().read_to_end(&mut input)?;
        if !input.is_empty() {
            write_frame(&mut stream, &ProtocolFrame::Stdin { data: base64(&input) })?;
        }
    }
    write_frame(&mut stream, &ProtocolFrame::StdinEnd)?;

    let mut buffer = String::new();
    stream.read_to_string(&mut buffer)?;
    for line in buffer.lines().filter(|line| !line.trim().is_empty()) {
        match serde_json::from_str::<ProtocolFrame>(line).context("Extension host returned an invalid protocol frame.")? {
            ProtocolFrame::Stdout { data } => io::stdout().write_all(&decode64(&data)?)?,
            ProtocolFrame::Stderr { data } => io::stderr().write_all(&decode64(&data)?)?,
            ProtocolFrame::Result => return Ok(()),
            ProtocolFrame::Error { error } => bail!("{error}"),
            ProtocolFrame::Stdin { .. } | ProtocolFrame::StdinEnd | ProtocolFrame::Abort => {}
        }
    }
    bail!("Extension host protocol channel closed before completion.")
}

fn write_frame(stream: &mut TcpStream, frame: &ProtocolFrame) -> anyhow::Result<()> {
    serde_json::to_writer(&mut *stream, frame)?;
    stream.write_all(b"\n")?;
    stream.flush()?;
    Ok(())
}

fn base64(data: impl AsRef<[u8]>) -> String {
    base64::engine::general_purpose::STANDARD.encode(data)
}

fn decode64(data: &str) -> anyhow::Result<Vec<u8>> {
    Ok(base64::engine::general_purpose::STANDARD.decode(data)?)
}
