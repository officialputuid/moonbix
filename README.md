# Moonbix

## Prerequisites
```bash
sudo apt update -y && sudo apt install nodejs -y
```

## Installation
```bash
git clone https://github.com/officialputuid/moonbix && cd moonbix && npm i
```

## Configuration
- Add `query_id=xxxx` or `user_id=xxxx` to `data.txt`.
- Set proxies in `proxy.txt`: `http://user:pass@ip:port`.

## Changelog
- Update API
- Automated check-in process.
- Fixed ticket display issues.

## Usage
| | |
|--------------------------|---------------------------------------------|
| `node moonbix`           | Start Moonbix.                              |
| `node moonbix-proxy`     | Start with proxy support.                   |
